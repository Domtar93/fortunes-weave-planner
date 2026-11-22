"""Read-only weapon references: documented endpoints, never refinement progressions."""
from collections import Counter
from datetime import datetime
import hashlib
import math
import re

from openpyxl.utils import get_column_letter
from openpyxl.utils.datetime import to_excel
from openpyxl.cell.read_only import EmptyCell
from import_scrolls import raw_cell

SHEET = 'Forging'
HEADERS = ('Name', 'Hit', 'Might', 'Range', 'Weight', 'Crit', 'Durability', 'Effects', 'Max refine', None)
COLUMNS = dict(nameSource=1, hit=2, might=3, attackRange=4, weight=5, critical=6,
               durability=7, effects=8, maxRefinement=9, additionalNote=10)
PRIMARY = ('hit', 'might', 'attackRange', 'weight', 'critical')
REQUIRED = (*PRIMARY, 'durability', 'maxRefinement')
PRELIMINARY_ROWS = (2, 4, 6, 9, 15)


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def parse_might(value):
    result = dict(kind='unresolved', value=None, lower=None, upper=None)
    if value is None or (isinstance(value, str) and not value.strip()):
        return dict(result, kind='missing')
    if finite_number(value):
        return dict(result, kind='single', value=value)
    if isinstance(value, str):
        single = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*', value)
        span = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*', value)
        if single and math.isfinite(float(single[1])):
            return dict(result, kind='single', value=float(single[1]))
        if span:
            low, high = map(float, span.groups())
            if math.isfinite(low) and math.isfinite(high) and low <= high:
                return dict(result, kind='span', lower=low, upper=high)
    return result


def read_forging(workbook, issues):
    result = dict(records=[], preliminary=[], relationships=[], generalNotes=[])
    counts = dict(expectedMain=91, expectedPreliminary=5, main=0, preliminary=0)

    def finding(severity, code, source, message, target=None):
        entry = dict(severity=severity, code=code, location=source, message=message)
        issues.append(entry)
        if target is not None: target.append(entry)

    if SHEET not in workbook.sheetnames:
        finding('error', 'missing_sheet', SHEET, 'Required Forging worksheet is missing.')
        return result, counts
    rows = list(workbook[SHEET].iter_rows())
    if not rows or tuple(cell.value for cell in rows[0][:10]) != HEADERS:
        finding('error', 'invalid_forging_schema', f'{SHEET}!A1:J1', 'Unexpected weapon reference columns.')
        return result, counts

    def base(cell, source):
        return dict(**raw_cell(cell, source), numberFormat=cell.number_format)

    def literal(cell):
        value = cell.value
        if cell.data_type == 'f':
            numeric = re.fullmatch(r'=([+-]?\d+(?:\.\d+)?)', value)
            text = re.fullmatch(r'="((?:[^"]|"")*)"', value)
            if numeric and math.isfinite(float(numeric[1])): return float(numeric[1]), 'literal-formula'
            if text: return text[1].replace('""', '"'), 'literal-formula'
            return None, 'unresolved'
        if cell.data_type == 'e': return None, 'unresolved'
        return value, 'documented'

    def field(cell, source, kind, findings):
        raw = base(cell, source)
        value, state = literal(cell)
        if state == 'literal-formula':
            finding('info', 'forging_literal_formula', source, 'Literal Excel constant retained as raw formula; only its explicit number/text is displayed. No formula or gameplay progression is evaluated.', findings)
        missing = value is None and state != 'unresolved'
        if isinstance(value, str) and not value.strip(): missing = True
        if kind == 'number':
            valid = finite_number(value) and '%' not in cell.number_format and cell.data_type != 'd'
            if not valid and not missing:
                finding('warning', 'unresolved_forging_number', source, 'Expected a finite reference number; raw source retained with no numeric default.', findings)
            return dict(**raw, value=value if valid else None, state='missing' if missing else state if valid else 'unresolved')
        if kind == 'might':
            parsed = parse_might(value) if state != 'unresolved' and cell.data_type != 'd' else parse_might(False)
            if parsed['kind'] == 'unresolved':
                finding('warning', 'unresolved_forging_might', source, 'Might is not an unambiguous single value or two documented endpoints. No curve or intermediate value inferred.', findings)
            text = value if isinstance(value, str) else str(int(value) if value == int(value) else value) if finite_number(value) else None
            return dict(**raw, text=text, **parsed)
        if kind == 'range':
            serial = None
            if isinstance(value, datetime) and cell.number_format == 'd-m':
                text = f'{value.day}-{value.month}'
                serial = to_excel(value, workbook.epoch)
                state = 'source-display'
                finding('warning', 'date_encoded_weapon_range', source, f'Excel date encoding retained; original d-m format displays {text}. This source display is used as range text, without calendar or combat inference.', findings)
            elif finite_number(value) and value == int(value) and cell.data_type != 'd':
                text = str(int(value))
            elif isinstance(value, str) and re.fullmatch(r'\s*\d+(?:\s*-\s*\d+)?\s*', value):
                text = value
            else:
                text = None
                if not missing: finding('warning', 'unresolved_forging_range', source, 'Unrecognized range text/encoding; raw value retained without guessing.', findings)
                state = 'missing' if missing else 'unresolved'
            return dict(**raw, text=text, state=state, excelSerial=serial)
        valid = isinstance(value, str) and state != 'unresolved'
        if not valid and not missing:
            finding('warning', 'unresolved_forging_text', source, 'Expected literal reference text; raw value retained.', findings)
        return dict(**raw, text=value if valid else None, state='missing' if missing else state if valid else 'unresolved')

    seen = {'main': set(), 'preliminary': set()}
    for row_number, row in enumerate(rows, 1):
        for column, cell in enumerate(row[10:], 11):
            if cell.value is not None:
                source = f'{SHEET}!{get_column_letter(column)}{row_number}'
                value, state = literal(cell)
                result['generalNotes'].append(dict(**base(cell, source), text=value if isinstance(value, str) else None,
                                                   state=state if isinstance(value, str) else 'unresolved', confidence='unverified'))
        if row_number == 1 or not any(cell.value is not None for cell in row[:10]): continue
        name = row[0].value
        section = 'main' if row_number >= 19 else 'preliminary'
        if not isinstance(name, str) or not name.strip() or row[0].data_type in ('f', 'e'):
            finding('error', 'invalid_weapon_name', f'{SHEET}!A{row_number}', 'Missing or invalid weapon name; record has no usable identifier.')
            continue
        normalized = ' '.join(name.split()).casefold()
        if normalized in seen[section]:
            finding('error', 'duplicate_weapon_name', f'{SHEET}!A{row_number}', f'Duplicate name within {section} records: {name!r}.')
            continue
        seen[section].add(normalized)
        findings = []
        record = dict(id=f'forging-{section}-' + hashlib.sha256(name.encode('utf8')).hexdigest()[:20], name=name,
                      section=section, source=dict(sheet=SHEET, row=row_number, range=f'A{row_number}:J{row_number}'),
                      reliability='unverified', validation=findings)
        for key, column in COLUMNS.items():
            kind = 'might' if key == 'might' else 'range' if key == 'attackRange' else 'text' if key in ('nameSource', 'effects', 'additionalNote') else 'number'
            cell = row[column - 1] if len(row) >= column else EmptyCell()
            record[key] = field(cell, f'{SHEET}!{get_column_letter(column)}{row_number}', kind, findings)
        def available(key):
            return record[key]['kind'] in ('single', 'span') if key == 'might' else record[key]['state'] not in ('missing', 'unresolved')
        record['missingFields'] = [key for key in REQUIRED if not available(key)]
        record['primaryCompleteness'] = 'complete' if all(available(key) for key in PRIMARY) else 'incomplete'
        record['completeness'] = 'incomplete' if record['missingFields'] else 'complete'
        if record['missingFields']:
            finding('warning', 'incomplete_weapon_record', f'{SHEET}!A{row_number}:J{row_number}',
                    'Not documented/unresolved reference properties: ' + ', '.join(record['missingFields']) + '. No zeros or mechanics supplied.', findings)
        result['records' if section == 'main' else 'preliminary'].append(record)

    def comparable(record, key):
        entry = record[key]
        if key == 'might': return (entry['kind'], entry['value'], entry['lower'], entry['upper'])
        return entry.get('value', entry.get('text'))

    for preliminary in result['preliminary']:
        exact = [record for record in result['records'] if record['name'] == preliminary['name']]
        candidate = [record for record in result['records'] if preliminary['name'] == 'Veronique' and record['name'] == 'Veroquine']
        for main in exact or candidate:
            match = 'exact-name' if exact else 'possible-spelling'
            differences = []
            for key in COLUMNS:
                if comparable(main, key) == comparable(preliminary, key): continue
                a, b = comparable(main, key), comparable(preliminary, key)
                missing = a is None or b is None or key in main['missingFields'] or key in preliminary['missingFields']
                kind = 'missing-data' if missing else 'wording' if key in ('nameSource', 'effects', 'additionalNote') else 'numeric'
                differences.append(dict(field=key, kind=kind, mainSource=main[key]['source'], preliminarySource=preliminary[key]['source']))
            result['relationships'].append(dict(mainId=main['id'], preliminaryId=preliminary['id'], match=match, differences=differences))
            finding('warning', 'possible_weapon_spelling' if match == 'possible-spelling' else 'weapon_source_difference',
                    f"Forging!A{preliminary['source']['row']}:J{preliminary['source']['row']} / A{main['source']['row']}:J{main['source']['row']}",
                    'Possible Veronique/Veroquine spelling variant; manual confirmation required. Records remain separate.' if match == 'possible-spelling' else
                    f"Exact-name preliminary evidence for {main['name']}; differing fields: {', '.join(entry['field'] for entry in differences) or 'none'}. Main values are never overwritten.", main['validation'])
    counts.update(main=len(result['records']), preliminary=len(result['preliminary']),
                  exactRelationships=sum(entry['match'] == 'exact-name' for entry in result['relationships']),
                  possibleSpellingRelationships=sum(entry['match'] == 'possible-spelling' for entry in result['relationships']),
                  completeness=dict(Counter(record['completeness'] for record in result['records'])),
                  primaryCompleteness=dict(Counter(record['primaryCompleteness'] for record in result['records'])),
                  primaryIncompleteNames=[record['name'] for record in result['records'] if record['primaryCompleteness'] == 'incomplete'],
                  mainMightKinds=dict(Counter(record['might']['kind'] for record in result['records'])),
                  mainRangeStates=dict(Counter(record['attackRange']['state'] for record in result['records'])),
                  numericalDifferences=sum(diff['kind'] == 'numeric' for relation in result['relationships'] if relation['match'] == 'exact-name' for diff in relation['differences']),
                  generalReferenceCells=len(result['generalNotes']))
    if counts['main'] != 91 or counts['preliminary'] != 5:
        finding('error', 'forging_count_mismatch', SHEET, f"Expected 91 main and 5 preliminary records; imported {counts['main']} and {counts['preliminary']}.")
    if tuple(record['source']['row'] for record in result['preliminary']) != PRELIMINARY_ROWS:
        finding('error', 'forging_preliminary_layout', SHEET, 'Preliminary record rows differ from the documented evidence block.')
    return result, counts
