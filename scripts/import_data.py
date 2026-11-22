"""Read the Excel source without saving it; publish JSON only after validation."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys
from typing import TypedDict

import openpyxl
from openpyxl.utils import get_column_letter
from import_proficiencies import read_proficiencies
from import_mounts import read_mounts
from import_battalions import read_battalions
from import_scrolls import read_scrolls
from import_dungeons import read_dungeons
from import_forging import read_forging

ROOT = Path(__file__).resolve().parents[1]
STATS = ('HP', 'Str', 'Mag', 'Spd', 'Dex', 'Def', 'Res', 'Lck', 'Cha')
ROUTES = ('Cai', 'Dietrich', 'Theodora', 'Leda')
PROFICIENCIES = ('Sword', 'Spear', 'Axe', 'Bow', 'Gauntlet', 'Reason', 'Faith',
                 'Authority', 'Infantry', 'Riding', 'Armor', 'Flying')
CLASS_TEXT_COLUMNS = {
    'license': 2, 'level': 3, 'renown': 4, 'primaryRequirements': 5,
    'secondaryRequirements': 6, 'masteryAbility': 7, 'masteryDescription': 8,
    'abilities': 9, 'abilityDescriptions': 10, 'additionalUnlocks': 11,
    'allowedWeaponsAndSkills': 12, 'mountType': 53,
}
EXPECTED = {'characters': 64, 'classes': 59}


class Profile(TypedDict):
    name: str
    growths: dict[str, int | float]
    source: dict[str, str | int]
    notes: list[str]


class SourceText(TypedDict):
    text: str | None
    status: str
    source: str


def read_source_text(cell, location: str, issues: list[dict], *,
                     error_code='invalid_character_text', preserve_whitespace=False) -> SourceText:
    """Presence is not confirmation: retain community text and explicit N/A markers."""
    value = cell.value
    if value is None or (isinstance(value, str) and not value.strip()):
        return dict(text=None, status='unknown', source=location)
    if not isinstance(value, str) or getattr(cell, 'data_type', None) in ('f', 'e'):
        issue(issues, 'error', error_code, location,
              'Expected recorded text or a blank; formulas, errors, and non-text values are not accepted.')
        return dict(text=None, status='unknown', source=location)
    text = value if preserve_whitespace else value.strip()
    status = 'unavailable' if text.strip().upper() in ('N/A', '-', '—', 'NONE') else 'unverified'
    return dict(text=text, status=status, source=location)


def read_class_number(cell, location: str, issues: list[dict], *, proficiency=False) -> dict:
    """Blank XP means not listed as usable; blank flat/movement values stay unknown."""
    value = cell.value
    if value is None:
        return dict(value=None, status='unavailable' if proficiency else 'unknown', source=location)
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or '%' in cell.number_format
            or (proficiency and value < 0)):
        issue(issues, 'error', 'invalid_class_number', location,
              'Expected finite numeric points (nonnegative for proficiency XP), not text, a formula, or a percentage.')
        return dict(value=None, status='unknown', source=location)
    return dict(value=int(value) if value == int(value) else value, status='unverified', source=location)


def discover_class_rows(sheet, issues: list[dict]) -> dict:
    """Scan the actual sheet, retaining unnamed single-cell F annotations as sheet notes."""
    last_named = 2
    last_populated = 2
    populated_rows = []
    for row_number, row in enumerate(sheet.iter_rows(min_row=3, max_col=53), 3):
        occupied = [(column, cell) for column, cell in enumerate(row, 1) if cell.value is not None]
        if not occupied:
            continue
        last_populated = row_number
        populated_rows.append((row_number, occupied))
        if row[0].value is not None:
            last_named = row_number
    notes = []
    annotation_rows = []
    for row_number, occupied in populated_rows:
        if len(occupied) == 1 and occupied[0][0] == 6:
            entry = read_source_text(occupied[0][1], f'Classes!F{row_number}', issues,
                                     error_code='invalid_class_text', preserve_whitespace=True)
            notes.append(entry)
            annotation_rows.append(row_number)
        elif row_number > last_named:
            issue(issues, 'error', 'invalid_name', f'Classes!A{row_number}',
                  'Populated class fields have no class name; row cannot be imported.')
    return dict(lastNamedRow=last_named, lastPopulatedRow=last_populated,
                annotationRows=annotation_rows, sheetNotes=notes)


def validate_class_headers(sheet, issues: list[dict]):
    rows = list(sheet.iter_rows(min_row=1, max_row=2, max_col=53))
    headers = [cell.value for cell in rows[1]]
    expected_text = ('License', 'Level', 'Renown', 'Primary Skills', 'Secondary Skills',
                     'Mastery Ability', 'Description', 'Class Abilities', 'Description', 'Additional Unlock Req')
    expected_xp = ('Sword', 'Spear', 'Axe', 'Bow', 'Gauntlets', 'B. Magic', 'W. Magic',
                   'Authority', 'Infantry', 'Riding', 'H. Armor', 'Flying')
    # L1:L2 is a merged heading in this workbook, leaving L2 blank.
    allowed_header = headers[11] == 'Allowed Weapons and Skills' or (
        headers[11] is None and rows[0][11].value == 'Allowed Weapons and Skills')
    if (tuple(headers[1:11]) != expected_text or not allowed_header
            or tuple(headers[12:24]) != expected_xp or tuple(headers[33:42]) != STATS
            or headers[51:53] != ['Mov', 'Mount']):
        issue(issues, 'error', 'invalid_class_schema', 'Classes!B2:BA2',
              'Class text, proficiency XP, flat-stat, movement, or mount headers do not match the configured source columns.')


def read_class_details(row, row_number: int, issues: list[dict]) -> dict:
    def location(column):
        return f'Classes!{get_column_letter(column)}{row_number}'

    details = {key: read_source_text(row[column - 1], location(column), issues,
                                    error_code='invalid_class_text', preserve_whitespace=True)
               for key, column in CLASS_TEXT_COLUMNS.items()}
    details['proficiencyExperience'] = {
        key: read_class_number(row[column - 1], location(column), issues, proficiency=True)
        for key, column in zip(PROFICIENCIES, range(13, 25))
    }
    details['flatStatBonuses'] = {
        key: read_class_number(row[column - 1], location(column), issues)
        for key, column in zip(STATS, range(34, 43))
    }
    details['movement'] = read_class_number(row[51], location(52), issues)
    # AQ:AY are incomplete base stats. Deliberately do not import them as bonuses or calculation inputs.
    return details


def issue(issues: list[dict], severity: str, code: str, location: str, message: str):
    issues.append(dict(severity=severity, code=code, location=location, message=message))


def parse_growth(cell) -> int | float:
    """JSON stores percentage points (45 means 45%), without clamping."""
    value = cell.value
    if value is None or value == '':
        raise ValueError('Required growth value is missing.')
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f'Expected a numeric growth value; found {value!r}.')
    if not math.isfinite(value):
        raise ValueError('Growth value must be finite.')
    # Native Excel percentage cells store a ratio; this workbook uses plain numbers.
    if '%' in cell.number_format:
        value = round(value * 100, 12)
    return int(value) if value == int(value) else value


def verify_zero_evidence(workbook) -> list[dict[str, str]]:
    """Recognize the existing nine SUMIF growth formulas, never general blank defaults."""
    if 'Character Learnsets' not in workbook.sheetnames:
        return []
    sheet = workbook['Character Learnsets']
    cells = next(sheet.iter_rows(min_row=27, max_row=27, min_col=4, max_col=12))
    evidence = []
    for cell, column in zip(cells, range(25, 34)):
        formula = cell.value
        letter = get_column_letter(column).lower()
        expected = f'=sumif(classes!a:a,d4,classes!{letter}:{letter})'
        normalized = re.sub(r"[\s$']", '', str(formula)).lower()
        if getattr(cell, 'data_type', None) != 'f' or normalized != expected:
            return []
        evidence.append({'location': f'Character Learnsets!{cell.coordinate}', 'formula': formula})
    return evidence


def read_profiles(sheet, start_column: int, issues: list[dict], *, last_row=None,
                  zero_evidence=None, annotation_rows=()) -> tuple[list[Profile], dict]:
    profiles: list[Profile] = []
    seen: dict[str, int] = {}
    counts = dict(namedRows=0, repeatedHeaders=0, blankRows=0, rejectedRows=0)
    max_column = 28 if sheet.title == 'Characters' else 53
    for row_number, row in enumerate(sheet.iter_rows(min_row=3, max_row=last_row, max_col=max_column), 3):
        if row_number in annotation_rows:
            continue
        name_cell = row[0]
        cells = row[start_column - 1:start_column + 8]
        name_value = name_cell.value
        location = f'{sheet.title}!A{row_number}'
        empty_check = row if sheet.title == 'Classes' else cells
        if name_value is None and all(c.value is None for c in empty_check):
            counts['blankRows'] += 1
            continue
        if name_value == 'Name' and tuple(c.value for c in cells) == STATS:
            counts['repeatedHeaders'] += 1
            issue(issues, 'info', 'repeated_header', location, 'Excluded repeated Name/stat header.')
            continue
        if not isinstance(name_value, str) or not name_value.strip() or name_value.strip().casefold() == 'name':
            counts['rejectedRows'] += 1
            issue(issues, 'error', 'invalid_name', location, 'Expected a nonempty profile name, not a header.')
            continue
        counts['namedRows'] += 1
        name = name_value.strip()
        if name != name_value:
            issue(issues, 'warning', 'trimmed_name', location, 'Removed surrounding whitespace from name.')
        key = ' '.join(name.split()).casefold()
        if key in seen:
            counts['rejectedRows'] += 1
            issue(issues, 'error', 'duplicate_name', location, f'Duplicate {name!r}; first seen at row {seen[key]}.')
            continue
        seen[key] = row_number
        notes = []
        growths = {}
        known_zero = (sheet.title == 'Classes' and name == 'Commoner / Noble'
                      and row_number == 3 and all(c.value is None for c in cells)
                      and bool(zero_evidence))
        if known_zero:
            growths = dict.fromkeys(STATS, 0)
            notes.append('No class modifiers: blank source cells are treated as zero by the workbook’s existing SUMIF growth formulas.')
            issue(issues, 'info', 'documented_zero', 'Classes!Y3:AG3', notes[0])
        else:
            for column, (stat, cell) in enumerate(zip(STATS, cells), start_column):
                try:
                    growths[stat] = parse_growth(cell)
                except ValueError as error:
                    issue(issues, 'error', 'invalid_growth', f'{sheet.title}!{get_column_letter(column)}{row_number}', f'{name} {stat}: {error}')
        if len(growths) != len(STATS):
            counts['rejectedRows'] += 1
            continue
        profile = dict(name=name, growths=growths,
                       source=dict(sheet=sheet.title, row=row_number,
                                   range=f'{get_column_letter(start_column)}{row_number}:{get_column_letter(start_column+8)}{row_number}'), notes=notes)
        if sheet.title == 'Characters':
            profile['personal'] = {
                key: read_source_text(row[column - 1], f'Characters!{get_column_letter(column)}{row_number}', issues)
                for key, column in [('inherent', 23), ('equippable', 24)]
            }
            profile['recruitment'] = {
                route: read_source_text(row[column - 1], f'Characters!{get_column_letter(column)}{row_number}', issues)
                for route, column in zip(ROUTES, range(25, 29))
            }
        else:
            profile['details'] = read_class_details(row, row_number, issues)
        profiles.append(profile)
    return profiles, counts


def import_workbook(path: Path) -> tuple[dict, dict]:
    issues: list[dict] = []
    data = dict(schemaVersion=2, units='percentage-points', stats=list(STATS), characters=[], classes=[])
    report = dict(sourceFile=path.name, sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  expectedCounts=EXPECTED, issues=issues, researchQueue=[], zeroModifierEvidence=[])
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
    try:
        for title in ('Characters', 'Classes', 'Research Queue'):
            if title not in workbook.sheetnames:
                issue(issues, 'error', 'missing_sheet', title, 'Required worksheet is missing.')
        evidence = verify_zero_evidence(workbook)
        report['zeroModifierEvidence'] = evidence
        for key, title, column in [('characters', 'Characters', 2), ('classes', 'Classes', 25)]:
            if title not in workbook.sheetnames:
                continue
            sheet = workbook[title]
            headers = next(sheet.iter_rows(min_row=2, max_row=2, max_col=column + 8))
            if headers[0].value != 'Name' or tuple(c.value for c in headers[column-1:column+8]) != STATS:
                issue(issues, 'error', 'invalid_schema', f'{title}!2:2', 'Expected Name and the nine growth headers in the configured columns.')
                continue
            if title == 'Characters':
                text_headers = next(sheet.iter_rows(min_row=2, max_row=2, min_col=23, max_col=28))
                expected_headers = ('Inherent ability', 'Equippable ability/abilities',
                                    "Cai's Path", "Dietrich's Path", "Theodora's Path", "Leda's Path")
                if tuple(c.value for c in text_headers) != expected_headers:
                    issue(issues, 'error', 'invalid_character_schema', 'Characters!W2:AB2',
                          'Expected personal-ability and four recruitment-route headers in W:AB.')
            discovery = None
            if title == 'Classes':
                validate_class_headers(sheet, issues)
                discovery = discover_class_rows(sheet, issues)
            last_row = discovery['lastNamedRow'] if discovery else None
            profiles, counts = read_profiles(sheet, column, issues, last_row=last_row, zero_evidence=evidence,
                                            annotation_rows=discovery['annotationRows'] if discovery else ())
            data[key] = profiles
            report[key] = counts
            if discovery:
                report[key].update(discovery)
        if 'Research Queue' in workbook.sheetnames:
            fields = ('id', 'priority', 'area', 'location', 'finding', 'confidence', 'status', 'nextStep', 'sourceUrl')
            for row in workbook['Research Queue'].iter_rows(min_row=2, max_col=9, values_only=True):
                if all(value is None for value in row):
                    continue
                record = dict(zip(fields, [str(value) if value is not None else '' for value in row]))
                report['researchQueue'].append(record)
                if 'growth' in record['area'].lower() and not record['status'].lower().startswith('resolved'):
                    issue(issues, 'warning', 'research_uncertainty', record['location'], f"{record['id']}: {record['finding']}")
                    for profile in data['characters'] + data['classes']:
                        if record['location'].startswith(f"{profile['source']['sheet']}!") and re.search(
                            rf"[A-Z]+{profile['source']['row']}(?::|,|$)", record['location']
                        ):
                            profile['notes'].append(f"{record['id']}: {record['finding']}")
        data['proficiencies'], report['proficiencyCounts'] = read_proficiencies(workbook, data['characters'], issues)
        data['mounts'], report['mountCounts'] = read_mounts(workbook, data['classes'], issues,
                                                         read_text=read_source_text, parse_growth=parse_growth)
        data['battalions'], report['battalionCounts'] = read_battalions(workbook, data['classes'], issues, read_text=read_source_text)
        data['magicScrolls'], report['magicScrollCounts'] = read_scrolls(workbook, issues)
        data['dungeons'], report['dungeonCounts'] = read_dungeons(workbook, issues)
        data['forging'], report['forgingCounts'] = read_forging(workbook, issues)
        report['importedCounts'] = {key: len(data[key]) for key in EXPECTED}
        text_fields = [field for profile in data['characters']
                       for group in ('personal', 'recruitment') for field in profile[group].values()]
        report['characterTextCounts'] = {status: sum(field['status'] == status for field in text_fields)
                                        for status in ('confirmed', 'unverified', 'unknown', 'unavailable')}
        class_xp = [entry['value'] for profile in data['classes']
                    for entry in profile['details']['proficiencyExperience'].values()]
        flat_entries = [entry for profile in data['classes']
                        for entry in profile['details']['flatStatBonuses'].values()]
        class_text = [entry for profile in data['classes'] for entry in profile['details'].values()
                      if isinstance(entry, dict) and 'text' in entry]
        report['classDetailCounts'] = {
            'proficiencyExperience': {
                'unlisted': sum(value is None for value in class_xp),
                'zero': sum(value == 0 for value in class_xp),
                'positive': sum(value is not None and value > 0 for value in class_xp),
            },
            'flatStatBonuses': {
                'recorded': sum(entry['value'] is not None for entry in flat_entries),
                'unknown': sum(entry['value'] is None for entry in flat_entries),
            },
            'text': {status: sum(entry['status'] == status for entry in class_text)
                     for status in ('confirmed', 'unverified', 'unknown', 'unavailable')},
            'baseStats': 'AQ:AY excluded: source work in progress',
        }
        for key, expected in EXPECTED.items():
            if len(data[key]) != expected:
                issue(issues, 'error', 'count_mismatch', key, f'Expected {expected}, imported {len(data[key])}.')
        report['status'] = 'failed' if any(i['severity'] == 'error' for i in issues) else 'passed'
        data['metadata'] = dict(sourceFile=path.name, sourceSha256=report['sourceSha256'],
                                counts=report['importedCounts'], unresolvedGrowthIssues=[
                                    i for i in issues if i['code'] == 'research_uncertainty'])
        return data, report
    finally:
        workbook.close()


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(text, encoding='utf-8')
    temporary.replace(path)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/source.xlsx')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/growths.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'data/import-report.json')
    args = parser.parse_args(argv)
    if args.source.resolve() in (args.output.resolve(), args.report.resolve()) or args.output.resolve() == args.report.resolve():
        parser.error('Source, output, and report must have distinct paths.')
    try:
        data, report = import_workbook(args.source)
    except (OSError, ValueError, KeyError, openpyxl.utils.exceptions.InvalidFileException) as error:
        print(f'Import failed: {error}', file=sys.stderr)
        return 1
    write_json(args.report, report)
    for item in report['issues']:
        print(f"{item['severity'].upper()}: {item['location']} — {item['message']}")
    if report['status'] == 'failed':
        print('Import failed. Frontend JSON was not replaced; consult the report.', file=sys.stderr)
        return 1
    write_json(args.output, data)
    print(f"Imported {len(data['characters'])} character profiles and {len(data['classes'])} classes.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
