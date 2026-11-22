"""Read-only, cell-by-cell reconciliation of the matrix and original learnset tables."""
import re
import math
from collections import Counter

from openpyxl.utils import get_column_letter

PROFICIENCIES = ('Sword', 'Spear', 'Axe', 'Bow', 'Gauntlet', 'Reason', 'Faith',
                 'Authority', 'Infantry', 'Riding', 'Armor', 'Flying')
RANK_ORDER = ('E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+')
MATRIX_HEADERS = ('Character', 'Proficiency', 'Rank', 'Unlock text from source',
                  'Evidence / record state', 'Source cell', 'Verification note', 'Direct source link')
COVERAGE_HEADERS = ('Proficiency', 'Ranks', 'Character rows', 'Documented single entries',
                    'Compound entries', 'Explicit N/A', 'Unrecorded / unknown', 'Recorded / total', 'Needs verification')
GLOSSARY_HEADERS = ('Ability / raw entry', 'Source proficiencies', 'Listed occurrences',
                    'Effect / rule (only if sourced)', 'Verification status', 'Example character / rank',
                    'Research note', 'Mechanics reference')
EVIDENCE = {'Community-listed / unverified', 'Unrecorded / unknown',
            'Explicitly marked N/A', 'Compound / needs parsing'}


def entry_state(text, evidence):
    if text is None or not text.strip():
        return 'unknown'
    if text.strip().upper() in ('N/A', '-', '—', 'NONE'):
        return 'unavailable'
    if '?' in text:
        return 'placeholder'
    if evidence == 'Compound / needs parsing' or any(mark in text for mark in ('/', '\n', '(', ',', ';')):
        return 'compound'
    return 'documented'


def read_proficiencies(workbook, characters, issues):
    def error(location, message, code='invalid_proficiency'):
        issues.append(dict(severity='error', code=code, location=location, message=message))

    def text(cell, location):
        if cell.value is None:
            return None
        if not isinstance(cell.value, str) or cell.data_type in ('f', 'e'):
            error(location, 'Expected literal text or an empty source cell.')
            return None
        return cell.value

    def table(title, headers):
        rows = list(workbook[title].iter_rows(max_col=len(headers)))
        if not rows or tuple(cell.value for cell in rows[0]) != headers:
            error(f'{title}!1:1', 'Unexpected database headers.')
            return []
        return [(index, row) for index, row in enumerate(rows[1:], 2)
                if any(cell.value is not None for cell in row)]

    result = dict(categories={}, profileMapping={'Mu (with growth)': 'Mu'}, glossary={}, coverage=[])
    required = (*PROFICIENCIES, 'Proficiency Matrix', 'Proficiency Coverage', 'Ability Glossary')
    for title in required:
        if title not in workbook.sheetnames:
            error(title, 'Required proficiency worksheet is missing.', 'missing_sheet')
    if any(title not in workbook.sheetnames for title in required):
        return result, {}

    names = {profile['name'] for profile in characters} - {'Mu (with growth)'}
    originals = {}
    for category in PROFICIENCIES:
        rows = iter(workbook[category].iter_rows())
        header = next(rows, ())
        rank_columns = [(col, cell.value) for col, cell in enumerate(header, 1)
                        if col > 1 and isinstance(cell.value, str) and re.fullmatch(r'[EDCBAS]\+?', cell.value)]
        ranks = [rank for _, rank in rank_columns]
        if not ranks or len(set(ranks)) != len(ranks) or ranks != sorted(ranks, key=RANK_ORDER.index):
            error(f'{category}!1:1', 'Rank headings must be unique and in progression order.')
        by_character = {}
        # The first table ends at its blank separator; lists of combat arts/formulas below are not character rows.
        for row_number, row in enumerate(rows, 2):
            name = row[0].value if row else None
            if name is None or (isinstance(name, str) and not name.strip()):
                break
            if not isinstance(name, str) or name not in names or name in by_character:
                error(f'{category}!A{row_number}', f'Unknown or duplicate learnset character: {name!r}. No aliases applied.')
                continue
            by_character[name] = []
            for column, rank in rank_columns:
                source = f"'{category}'!{get_column_letter(column)}{row_number}"
                value = text(row[column - 1], source) if column <= len(row) else None
                originals[(name, category, rank)] = (value, source)
        if len(by_character) != 63 or set(by_character) != names:
            error(category, f'Expected all 63 original identities; imported {len(by_character)}.')
        result['categories'][category] = dict(ranks=ranks, rankSources=[f"'{category}'!{get_column_letter(col)}1" for col, _ in rank_columns],
                                              characters=by_character)

    seen = set()
    raw_counts = {category: Counter() for category in PROFICIENCIES}
    for row_number, row in table('Proficiency Matrix', MATRIX_HEADERS):
        values = [text(cell, f'Proficiency Matrix!{get_column_letter(col)}{row_number}') for col, cell in enumerate(row, 1)]
        name, category, rank, raw, evidence, source, note, url = values
        key = (name, category, rank)
        if key in seen:
            error(f'Proficiency Matrix!A{row_number}', 'Duplicate character/proficiency/rank record.')
            continue
        seen.add(key)
        if key not in originals:
            error(f'Proficiency Matrix!A{row_number}', 'Unknown character, proficiency, or rank; no aliases applied.')
            continue
        original, expected_source = originals[key]
        if (raw or '').strip() != (original or '').strip() or source != expected_source:
            error(f'Proficiency Matrix!D{row_number}', f'Matrix text/reference differs from {expected_source}.')
        elif (raw or '') != (original or ''):
            issues.append(dict(severity='info', code='matrix_whitespace', location=f'Proficiency Matrix!D{row_number}',
                               message=f'Matrix trims surrounding whitespace from {expected_source}; both exact texts retained.'))
        state = entry_state(raw, evidence)
        expected_evidence = ('Unrecorded / unknown' if state == 'unknown' else
                             'Explicitly marked N/A' if state == 'unavailable' else None)
        if evidence not in EVIDENCE or (expected_evidence and evidence != expected_evidence) or (
                not expected_evidence and evidence not in ('Community-listed / unverified', 'Compound / needs parsing')):
            error(f'Proficiency Matrix!E{row_number}', 'Evidence label conflicts with the recorded text or is unsupported.')
        raw_counts[category][evidence] += 1
        result['categories'][category]['characters'][name].append(dict(
            rank=rank, text=original, matrixText=raw, state=state, reliability='unverified',
            evidence=evidence, source=source, matrixSource=f'Proficiency Matrix!A{row_number}:H{row_number}',
            note=note, sourceUrl=url))
    missing = originals.keys() - seen
    if missing:
        error('Proficiency Matrix', f'{len(missing)} original rank cells are absent from the matrix.')
    for category in result['categories'].values():
        for entries in category['characters'].values():
            entries.sort(key=lambda entry: RANK_ORDER.index(entry['rank']))

    coverage_seen = set()
    for row_number, row in table('Proficiency Coverage', COVERAGE_HEADERS):
        values = [cell.value for cell in row]
        category = values[0]
        if category not in (*PROFICIENCIES, 'TOTAL') or category in coverage_seen:
            error(f'Proficiency Coverage!A{row_number}', 'Unknown or duplicate coverage category.')
            continue
        coverage_seen.add(category)
        result['coverage'].append(dict(values=values, source=f'Proficiency Coverage!A{row_number}:I{row_number}'))
        counts = sum(raw_counts.values(), Counter()) if category == 'TOTAL' else raw_counts[category]
        expected = [63, counts['Community-listed / unverified'], counts['Compound / needs parsing'],
                    counts['Explicitly marked N/A'], counts['Unrecorded / unknown']]
        if values[2:7] != expected or (category != 'TOTAL' and values[1] != ', '.join(result['categories'][category]['ranks'])):
            error(f'Proficiency Coverage!B{row_number}:G{row_number}', 'Coverage totals/ranks disagree with imported source records.')
    if coverage_seen != {*PROFICIENCIES, 'TOTAL'}:
        error('Proficiency Coverage', 'Missing category or total audit row.')

    for row_number, row in table('Ability Glossary', GLOSSARY_HEADERS):
        values = [text(cell, f'Ability Glossary!{get_column_letter(col)}{row_number}') if col != 3 else cell.value
                  for col, cell in enumerate(row, 1)]
        name, categories, occurrences, description, evidence, example, note, url = values
        if (isinstance(occurrences, bool) or not isinstance(occurrences, (int, float))
                or not math.isfinite(occurrences) or occurrences < 1 or occurrences != int(occurrences)):
            error(f'Ability Glossary!C{row_number}', 'Occurrence count must be a positive whole number.')
        if not name or name in result['glossary']:
            error(f'Ability Glossary!A{row_number}', 'Missing or duplicate exact glossary name.')
            continue
        result['glossary'][name] = dict(name=name, proficiencies=categories, occurrences=occurrences,
            description=description, evidence=evidence, example=example, note=note, reference=url,
            reliability='unverified' if description else 'unknown', source=f'Ability Glossary!A{row_number}:H{row_number}')

    entries = [entry for category in result['categories'].values() for values in category['characters'].values() for entry in values]
    counts = dict(categories=len(result['categories']), originalCharacters=len(names), rankCells=len(entries),
                  states=dict(Counter(entry['state'] for entry in entries)),
                  matrixEvidence=dict(sum(raw_counts.values(), Counter())),
                  glossaryEntries=len(result['glossary']),
                  glossaryDescriptions=sum(bool(entry['description']) for entry in result['glossary'].values()),
                  profileMapping=result['profileMapping'])
    return result, counts
