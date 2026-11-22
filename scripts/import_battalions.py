"""Battalion reference import; flat stat annotations never enter growth calculations."""
from collections import Counter
import hashlib
import math
import re

from openpyxl.utils import get_column_letter

STATS = ('HP', 'Str', 'Mag', 'Spd', 'Dex', 'Def', 'Res', 'Lck', 'Cha')
HEADERS = ('Name', 'Category', 'Rank Requirement', 'Gather Limit', 'Abilities', 'Stats', 'Location')
EXPECTED_CATEGORIES = {'Physical': 18, 'Defense': 18, 'Support': 17, 'Magical': 16}
EXPECTED_RANKS = {'E': 10, 'D': 13, 'C': 15, 'B': 16, 'A': 15}
EXPECTED_GATHER = {8: 10, 10: 13, 14: 15, 18: 16, 22: 15}
TEXT_COLUMNS = {'nameSource': 1, 'category': 2, 'authorityRank': 3, 'ability': 5, 'flatStatText': 6, 'acquisition': 7}


def parse_battalion_stats(raw, source):
    values = dict.fromkeys(STATS)
    if raw is None or not raw.strip():
        return dict(state='unknown', values=values, unparsed=[], source=source)
    pattern = r'(HP|Str|Mag|Spd|Dex|Def|Res|Luck|Lck|Cha)\s*([+-]?\d+(?:\.\d+)?)'
    parsed = {}
    unparsed = []
    cursor = 0
    for match in re.finditer(pattern, raw):
        gap = raw[cursor:match.start()]
        if not re.fullmatch(r'[\s,;]*', gap):
            unparsed.append(gap)
        stat, number = match.groups()
        stat = 'Lck' if stat == 'Luck' else stat
        value = float(number)
        if stat in parsed or not math.isfinite(value):
            unparsed.append(match.group())
        else:
            parsed[stat] = int(value) if value.is_integer() else value
        cursor = match.end()
    tail = raw[cursor:]
    if not re.fullmatch(r'[\s,;]*', tail):
        unparsed.append(tail)
    if unparsed or not parsed:
        # All-or-nothing: a partially understood entry is not a usable numeric approximation.
        return dict(state='unresolved', values=values, unparsed=unparsed or [raw], source=source)
    values.update(parsed)
    return dict(state='parsed', values=values, unparsed=[], source=source)


def read_battalions(workbook, classes, issues, *, read_text):
    result = dict(records=[], generalNotes=[])
    counts = dict(expected=69, imported=0, categories={}, authorityRanks={}, gatherLimits={})
    if 'Battalions' not in workbook.sheetnames:
        issues.append(dict(severity='error', code='missing_sheet', location='Battalions', message='Required battalion worksheet is missing.'))
        return result, counts
    rows = list(workbook['Battalions'].iter_rows())
    if not rows or tuple(cell.value for cell in rows[0][:7]) != HEADERS:
        issues.append(dict(severity='error', code='invalid_battalion_schema', location='Battalions!A1:G1', message='Unexpected battalion headers.'))
        return result, counts
    seen = set()
    for row_number, row in enumerate(rows, 1):
        # H and all later columns belong to the independent reference block, never a row's record.
        for column, cell in enumerate(row[7:], 8):
            if cell.value is None:
                continue
            source = f'Battalions!{get_column_letter(column)}{row_number}'
            value = cell.value
            if isinstance(value, str) and cell.data_type not in ('f', 'e'):
                result['generalNotes'].append(dict(value=value, status='unverified', source=source))
            elif isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                result['generalNotes'].append(dict(value=value, status='unverified', source=source))
            else:
                issues.append(dict(severity='error', code='invalid_battalion_note', location=source, message='Expected a literal text or numeric reference cell.'))
        if row_number == 1 or not any(cell.value is not None for cell in row[:7]):
            continue
        findings = []

        def note(severity, code, source, message):
            entry = dict(severity=severity, code=code, location=source, message=message)
            findings.append(entry)
            issues.append(entry)

        fields = {key: read_text(row[column - 1], f'Battalions!{get_column_letter(column)}{row_number}', issues,
                                 error_code='invalid_battalion_text', preserve_whitespace=True)
                  for key, column in TEXT_COLUMNS.items()}
        raw_name = fields['nameSource']['text']
        if not raw_name or fields['nameSource']['status'] == 'unavailable':
            note('error', 'invalid_battalion_name', f'Battalions!A{row_number}', 'Missing battalion name.')
            continue
        name = raw_name.strip()
        normalized = ' '.join(name.split()).casefold()
        if normalized in seen:
            note('error', 'duplicate_battalion', f'Battalions!A{row_number}', f'Duplicate battalion name {name!r}.')
            continue
        seen.add(normalized)
        for key, expected in [('category', EXPECTED_CATEGORIES), ('authorityRank', EXPECTED_RANKS)]:
            if fields[key]['text'] not in expected:
                note('error', 'invalid_battalion_classification', fields[key]['source'], f'Unknown or missing {key}.')
        cell = row[3]
        value = cell.value
        gather = dict(value=None, status='unknown', source=f'Battalions!D{row_number}')
        if (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
                or value not in EXPECTED_GATHER or '%' in cell.number_format):
            note('error', 'invalid_battalion_gather', gather['source'], 'Expected a recorded gather limit: 8, 10, 14, 18 or 22.')
        else:
            gather.update(value=int(value), status='unverified')
        parsed = parse_battalion_stats(fields['flatStatText']['text'], fields['flatStatText']['source'])
        if parsed['state'] != 'parsed':
            note('warning', 'unresolved_battalion_stats', fields['flatStatText']['source'],
                 'Flat stat text is missing or unresolved. Raw text retained; no parsed numerical approximation supplied.')
        for key in ('ability', 'acquisition'):
            if fields[key]['status'] in ('unknown', 'unavailable'):
                note('warning', f'missing_battalion_{key}', fields[key]['source'], 'Reference field is not recorded; no mechanics or availability inferred.')
        if fields['acquisition']['text'] and re.search(r'\b(may|unknown|unconfirmed|possibly)\b|\?', fields['acquisition']['text'], re.IGNORECASE):
            note('warning', 'ambiguous_battalion_acquisition', fields['acquisition']['source'], 'Acquisition conditions remain uncertain; original qualifier retained.')
        result['records'].append(dict(id='battalion-' + hashlib.sha256(name.encode('utf8')).hexdigest()[:20],
            name=name, **fields, gatherLimit=gather, parsedStats=parsed, reliability='unverified', validation=findings,
            source=dict(sheet='Battalions', row=row_number, range=f'A{row_number}:G{row_number}')))
    records = result['records']
    categories = Counter(record['category']['text'] for record in records)
    ranks = Counter(record['authorityRank']['text'] for record in records)
    gather = Counter(record['gatherLimit']['value'] for record in records)
    for label, actual, expected in [('categories', categories, EXPECTED_CATEGORIES), ('authorityRanks', ranks, EXPECTED_RANKS), ('gatherLimits', gather, EXPECTED_GATHER)]:
        if actual != expected:
            issues.append(dict(severity='error', code='battalion_distribution_mismatch', location='Battalions', message=f'{label} differ: expected {expected}, imported {dict(actual)}.'))
    if len(records) != 69:
        issues.append(dict(severity='error', code='battalion_count_mismatch', location='Battalions', message=f'Expected 69 battalions, imported {len(records)}.'))
    listed_unmounted = not_listed_mounted = unknown = 0
    for profile in classes:
        details = profile['details']
        tokens = [token.strip() for token in (details['allowedWeaponsAndSkills']['text'] or '').split(',')]
        mount_type = details['mountType']['text']
        if mount_type == 'No' and 'Battalions' in tokens:
            listed_unmounted += 1
        elif mount_type not in (None, 'No') and 'Battalions' not in tokens:
            not_listed_mounted += 1
        else:
            unknown += 1
    counts.update(imported=len(records), categories=dict(categories), authorityRanks=dict(ranks),
        gatherLimits={str(key): count for key, count in gather.items()},
        parsedStats=dict(Counter(record['parsedStats']['state'] for record in records)), generalReferenceCells=len(result['generalNotes']),
        classSupport=dict(listedUnmounted=listed_unmounted, notListedMounted=not_listed_mounted, otherOrUnknown=unknown))
    return result, counts
