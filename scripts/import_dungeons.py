"""One chest per source cell, with separate Part I/III rewards and independent notes."""
from collections import Counter
import hashlib
import re

from openpyxl.utils import get_column_letter
from import_scrolls import raw_cell

SHEET = 'Dungeon Chests'
HEADERS = ('Column 1', 'Chest 1', 'Chest 2', 'Chest 3', 'Chest 4', 'Chest 5')
REWARD_STATES = ('documented', 'placeholder', 'empty', 'unresolved')


def stable_id(name):
    return 'dungeon-' + hashlib.sha256(name.encode('utf8')).hexdigest()[:20]


def parse_chest(cell, source, chest_number, location_id, issues):
    raw = raw_cell(cell, source)
    value = cell.value
    findings = []
    lines = re.split(r'\r\n|\r|\n', value) if isinstance(value, str) and cell.data_type not in ('f', 'e') else []
    if len(lines) != 2:
        entry = dict(severity='warning', code='unresolved_chest_lines', location=source,
                     message='Expected exactly two reward lines (Part I then Part III). Raw cell retained; neither phase guessed.')
        findings.append(entry); issues.append(entry)
        fields = [dict(raw=None, status='unresolved'), dict(raw=None, status='unresolved')]
    else:
        fields = [dict(raw=line, status='empty' if not line.strip() else 'placeholder' if line.strip() == '-' else 'documented') for line in lines]
        for index, field in enumerate(fields):
            if field['status'] == 'empty':
                entry = dict(severity='warning', code='missing_chest_reward', location=source,
                             message=f"Part {'I' if index == 0 else 'III'} has an empty reward line; no item inferred.")
                findings.append(entry); issues.append(entry)
    return dict(id=f'{location_id}-chest-{chest_number}', number=chest_number, **raw,
                part1=fields[0], part3=fields[1], confidence='unverified', validation=findings)


def read_dungeons(workbook, issues):
    result = dict(records=[], generalNotes=[])
    counts = dict(expectedLocations=31, expectedChests=90, expectedPartIPlaceholders=4, locations=0, chests=0)

    def issue(severity, code, location, message):
        entry = dict(severity=severity, code=code, location=location, message=message)
        issues.append(entry)
        return entry

    if SHEET not in workbook.sheetnames:
        issue('error', 'missing_sheet', SHEET, 'Required dungeon chest worksheet is missing.')
        return result, counts
    rows = list(workbook[SHEET].iter_rows())
    if not rows or tuple(cell.value for cell in rows[0][:6]) != HEADERS:
        issue('error', 'invalid_dungeon_schema', f'{SHEET}!A1:F1', 'Unexpected location/chest headers.')
        return result, counts

    def note(cell, source):
        raw = raw_cell(cell, source)
        literal = isinstance(cell.value, str) and cell.data_type not in ('f', 'e')
        if not literal:
            issue('warning', 'unresolved_dungeon_note', source, 'Non-text note retained as raw diagnostic data without assigning it to a chest.')
        return dict(**raw, text=cell.value if literal else None, confidence='unverified' if literal else 'unknown')

    seen = set()
    footer = []
    for row_number, row in enumerate(rows, 1):
        for column, cell in enumerate(row[7:], 8):
            if cell.value is not None:
                result['generalNotes'].append(note(cell, f'{SHEET}!{get_column_letter(column)}{row_number}'))
        if row_number == 1 or not any(cell.value is not None for cell in row[:7]):
            continue
        name = row[0].value
        # The source's footnotes begin with * or ^, below the 31-location block.
        # They are annotations, even when another cell contains a community reply.
        if isinstance(name, str) and name.startswith(('*', '^')):
            for column, cell in enumerate(row[:7], 1):
                if cell.value is not None:
                    footer.append(note(cell, f'{SHEET}!{get_column_letter(column)}{row_number}'))
            continue
        if not isinstance(name, str) or not name.strip() or row[0].data_type in ('f', 'e'):
            issue('error', 'invalid_dungeon_name', f'{SHEET}!A{row_number}', 'Missing/invalid location name; no location identifier assigned.')
            continue
        normalized = ' '.join(name.split()).casefold()
        if normalized in seen:
            issue('error', 'duplicate_dungeon', f'{SHEET}!A{row_number}', f'Duplicate location name {name!r}.')
            continue
        seen.add(normalized)
        location_id = stable_id(name)
        chests = []
        for column in range(2, 7):
            cell = row[column - 1]
            if cell.value is None or (isinstance(cell.value, str) and not cell.value.strip()):
                continue
            chests.append(parse_chest(cell, f'{SHEET}!{get_column_letter(column)}{row_number}', column - 1, location_id, issues))
        notes = [note(row[6], f'{SHEET}!G{row_number}')] if len(row) > 6 and row[6].value is not None else []
        warnings = [finding for chest in chests for finding in chest['validation']]
        if any(chest['part1']['status'] == 'placeholder' for chest in chests):
            warnings.append(issue('warning', 'dungeon_phase_placeholder', f'{SHEET}!A{row_number}:F{row_number}',
                                  'Part I contains dash placeholders. A dash is not an obtainable item or proof that the chest does not exist.'))
        result['records'].append(dict(id=location_id, name=name, chests=chests, notes=notes, warnings=warnings,
                                     confidence='unverified', source=dict(sheet=SHEET, row=row_number, range=f'A{row_number}:G{row_number}')))
    # Associate a footer only when it explicitly begins with one unique location name.
    # The exact source text and provenance remain intact; unmatched replies stay independent.
    for entry in footer:
        text = (entry['text'] or '').lstrip('*^').strip().casefold()
        matches = [record for record in result['records'] if text.startswith(record['name'].strip().rstrip('*').casefold() + ' ')]
        if len(matches) == 1:
            matches[0]['notes'].append(entry)
        else:
            result['generalNotes'].append(entry)
    chests = [chest for location in result['records'] for chest in location['chests']]
    counts.update(locations=len(result['records']), chests=len(chests), phaseFields=2 * len(chests),
                  phases={part: {state: sum(chest[part]['status'] == state for chest in chests) for state in REWARD_STATES} for part in ('part1', 'part3')},
                  locationNotes=sum(len(record['notes']) for record in result['records']), generalReferenceCells=len(result['generalNotes']))
    for key, expected in [('locations', 31), ('chests', 90)]:
        if counts[key] != expected:
            issue('error', 'dungeon_count_mismatch', SHEET, f'Expected {expected} {key}, imported {counts[key]}.')
    if counts['phases']['part1']['placeholder'] != 4:
        issue('warning', 'dungeon_placeholder_count_mismatch', SHEET,
              f"Expected four Part I dash fields; parsed {counts['phases']['part1']['placeholder']}. Malformed cells remain unresolved, without invented phase assignments.")
    return result, counts
