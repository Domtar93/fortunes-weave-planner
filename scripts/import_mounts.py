"""Read mount records without resolving community disagreements or filling numeric blanks."""
import math
import re
from collections import Counter

from openpyxl.utils import get_column_letter

STATS = ('HP', 'Str', 'Mag', 'Spd', 'Dex', 'Def', 'Res', 'Lck', 'Cha')
HEADERS = ('Species', 'Abilities', 'Stats', 'Growths', 'Location', 'Notes', *STATS)
TEXT_COLUMNS = {'nameSource': 1, 'species': 2, 'abilities': 3, 'flatStatText': 4,
                'growthText': 5, 'acquisition': 6, 'communityNotes': 7}


def parse_modifier_text(text, source, *, growth):
    """Parse only complete, unambiguous stat/value tokens; omitted stats remain None."""
    values = dict.fromkeys(STATS)
    unparsed = []
    if text is None or not text.strip():
        return dict(values=values, state='unknown', unparsed=unparsed, source=source)
    suffix = r'\s*%' if growth else ''
    pattern = rf'\s*({"|".join(STATS)})\s*([+-]?\d+(?:\.\d+)?){suffix}\s*'
    for token in text.split(','):
        match = re.fullmatch(pattern, token)
        if not match:
            unparsed.append(token)
            continue
        stat, number = match.groups()
        value = float(number)
        if values[stat] is not None or not math.isfinite(value):
            unparsed.append(token)
            continue
        values[stat] = int(value) if value.is_integer() else value
    return dict(values=values, state='needs_review' if unparsed else 'parsed', unparsed=unparsed, source=source)


def read_mounts(workbook, classes, issues, *, read_text, parse_growth):
    result = dict(records=[], abilityWarning=None, sheetNotes=[])
    counts = dict(expected=22, imported=0, species={})
    if 'Mounts' not in workbook.sheetnames:
        issues.append(dict(severity='error', code='missing_sheet', location='Mounts', message='Required mount worksheet is missing.'))
        return result, counts
    sheet = workbook['Mounts']
    rows = list(sheet.iter_rows(max_col=17))
    if not rows or tuple(cell.value for cell in rows[0][1:16]) != HEADERS:
        issues.append(dict(severity='error', code='invalid_mount_schema', location='Mounts!B1:P1', message='Mount text and nine growth headings do not match source columns.'))
        return result, counts
    recognized_types = {profile['details']['mountType']['text'] for profile in classes
                        if profile['details']['mountType']['text'] not in (None, 'No')}
    seen = set()
    for row_number, row in enumerate(rows[1:], 2):
        if not any(cell.value is not None for cell in row):
            continue
        # The source table is rows 2–23. Unnamed annotations below it remain independent notes.
        if row_number > 23 and row[0].value is None:
            for column, cell in enumerate(row, 1):
                if cell.value is not None:
                    result['sheetNotes'].append(read_text(cell, f'Mounts!{get_column_letter(column)}{row_number}', issues,
                        error_code='invalid_mount_text', preserve_whitespace=True))
            continue
        record_issues = []

        def note(severity, code, location, message):
            entry = dict(severity=severity, code=code, location=location, message=message)
            record_issues.append(entry)
            issues.append(entry)

        fields = {key: read_text(row[column - 1], f'Mounts!{get_column_letter(column)}{row_number}', issues,
                                error_code='invalid_mount_text', preserve_whitespace=True)
                  for key, column in TEXT_COLUMNS.items()}
        raw_name = fields['nameSource']['text']
        if raw_name is None or fields['nameSource']['status'] == 'unavailable':
            note('error', 'missing_mount_name', f'Mounts!A{row_number}', 'Mount record has no valid name.')
            continue
        name = raw_name.strip()
        normalized = ' '.join(name.split()).casefold()
        if normalized in seen:
            note('error', 'duplicate_mount_name', f'Mounts!A{row_number}', f'Duplicate mount name: {name!r}.')
            continue
        seen.add(normalized)
        if name != raw_name:
            note('info', 'trimmed_mount_name', f'Mounts!A{row_number}', 'Display name trimmed; original name text retained separately.')
        species = fields['species']['text']
        if not species or fields['species']['status'] == 'unavailable':
            note('error', 'missing_mount_type', f'Mounts!B{row_number}', 'Mount species/type is required.')
        elif species not in recognized_types:
            note('warning', 'unrecognized_mount_type', f'Mounts!B{row_number}',
                 f'{species!r} is not a mount type documented by the imported classes; no compatibility exception inferred.')
        acquisition = fields['acquisition']
        if acquisition['status'] in ('unknown', 'unavailable'):
            note('warning', 'missing_mount_acquisition', acquisition['source'], 'Acquisition conditions are not recorded; no availability inferred.')
        elif re.search(r'\b(may|maybe|unknown|unclear|unconfirmed|possibly)\b|\?', acquisition['text'], re.IGNORECASE):
            note('warning', 'ambiguous_mount_acquisition', acquisition['source'], 'Acquisition text contains an uncertainty qualifier; preserve it as unverified.')
        numeric = {}
        for column, stat in enumerate(STATS, 8):
            cell = row[column - 1]
            source = f'Mounts!{get_column_letter(column)}{row_number}'
            value = None
            if cell.value is not None:
                try:
                    value = parse_growth(cell)
                except ValueError as error:
                    note('error', 'invalid_mount_growth', source, str(error))
            numeric[stat] = dict(value=value, status='unknown' if value is None else 'unverified', source=source)
        parsed_growth = parse_modifier_text(fields['growthText']['text'], fields['growthText']['source'], growth=True)
        parsed_flat = parse_modifier_text(fields['flatStatText']['text'], fields['flatStatText']['source'], growth=False)
        for parsed in (parsed_growth, parsed_flat):
            if parsed['state'] == 'needs_review':
                note('warning', 'unparsed_mount_modifiers', parsed['source'], 'Some modifier text is ambiguous or unsupported; original text retained, no inferred values.')
        differences = []
        for stat in STATS:
            written, number = parsed_growth['values'][stat], numeric[stat]['value']
            if written != number:
                differences.append(dict(stat=stat, written=written, numeric=number,
                    writtenSource=fields['growthText']['source'], numericSource=numeric[stat]['source']))
        comparison = ('unparsed' if parsed_growth['state'] != 'parsed' else 'conflict' if differences else 'consistent')
        if differences:
            note('warning', 'mount_growth_conflict', f'Mounts!E{row_number}:P{row_number}',
                 f'{name}: written and numeric growth entries differ for {", ".join(entry["stat"] for entry in differences)}. '
                 'A missing entry is an omission, not zero; neither version is selected for calculations.')
        total_cell = row[16]
        total = dict(value=None, formula=None, status='unknown', source=f'Mounts!Q{row_number}')
        if total_cell.value is not None:
            if total_cell.data_type == 'f':
                total['formula'] = total_cell.value
                if re.fullmatch(rf'=sum\(H{row_number}:P{row_number}\)', total_cell.value, re.IGNORECASE):
                    total['status'] = 'source_formula'
                else:
                    note('error', 'invalid_mount_total', total['source'], 'Unsupported total formula; importer does not evaluate formulas.')
            else:
                try:
                    total['value'] = parse_growth(total_cell)
                    total['status'] = 'unverified'
                except ValueError as error:
                    note('error', 'invalid_mount_total', total['source'], str(error))
                known = [entry['value'] for entry in numeric.values()]
                if total['value'] is not None and all(value is not None for value in known) and total['value'] != sum(known):
                    note('warning', 'mount_total_conflict', total['source'], 'Recorded total differs from all nine populated numeric growth fields.')
        result['records'].append(dict(name=name, **fields, numericGrowths=numeric, totalGrowth=total,
            parsed=dict(growths=parsed_growth, flatStats=parsed_flat),
            growthComparison=dict(status=comparison, differences=differences), validation=record_issues,
            source=f'Mounts!A{row_number}:Q{row_number}'))

    if 'Character Learnsets' in workbook.sheetnames:
        cell = workbook['Character Learnsets']['I6']
        result['abilityWarning'] = read_text(cell, 'Character Learnsets!I6', issues,
                                            error_code='invalid_mount_text', preserve_whitespace=True)
    if not result['abilityWarning'] or result['abilityWarning']['status'] != 'unverified':
        issues.append(dict(severity='warning', code='missing_mount_ability_warning', location='Character Learnsets!I6',
                           message='Mount ability alternative warning is absent; do not assume simultaneous activation.'))
    records = result['records']
    counts.update(imported=len(records), species=dict(Counter(record['species']['text'] for record in records)),
        numericGrowths=dict(recorded=sum(field['value'] is not None for record in records for field in record['numericGrowths'].values()),
                           unknown=sum(field['value'] is None for record in records for field in record['numericGrowths'].values()),
                           explicitZero=sum(field['value'] == 0 for record in records for field in record['numericGrowths'].values())),
        growthConflicts=[dict(name=record['name'], stats=[entry['stat'] for entry in record['growthComparison']['differences']])
                         for record in records if record['growthComparison']['differences']],
        ambiguousAcquisitions=sum(any(entry['code'] == 'ambiguous_mount_acquisition' for entry in record['validation']) for record in records),
        missingAcquisitions=sum(any(entry['code'] == 'missing_mount_acquisition' for entry in record['validation']) for record in records))
    if len(records) != 22:
        issues.append(dict(severity='error', code='mount_count_mismatch', location='Mounts', message=f'Expected 22 mounts, imported {len(records)}.'))
    return result, counts
