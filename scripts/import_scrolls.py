"""Read-only magic-scroll references; no spell legality or combat calculations."""
from collections import Counter
from datetime import date, datetime, time
import hashlib
import math
import re

from openpyxl.utils import get_column_letter

SHEET = 'Magic Scrolls'
HEADERS = ('Name', 'Source', 'Hit', 'Might', 'Range', 'Weight', 'Crit', 'Avo', 'Uses',
           'Description', 'Part 1 Location', 'Part 3 Location')
NUMBER_COLUMNS = dict(hit=3, might=4, weight=6, critical=7, avoidance=8, uses=9)
STATES = ('documented', 'unavailable', 'unknown', 'empty', 'unresolved')


def raw_cell(cell, source):
    value = cell.value
    raw_type = cell.data_type
    # Diagnostic serialization only: never interpret a range string as a date.
    if isinstance(value, (datetime, date, time)):
        value = value.isoformat()
    elif isinstance(value, float) and not math.isfinite(value):
        value, raw_type = repr(value), 'nonfinite-number'
    return dict(raw=value, rawType=raw_type, source=source)


def read_scrolls(workbook, issues):
    result = dict(records=[], generalNotes=[])
    counts = dict(expected=7, imported=0)

    def issue(severity, code, location, message, findings=None):
        entry = dict(severity=severity, code=code, location=location, message=message)
        issues.append(entry)
        if findings is not None:
            findings.append(entry)

    if SHEET not in workbook.sheetnames:
        issue('error', 'missing_sheet', SHEET, 'Required magic-scroll worksheet is missing.')
        return result, counts
    rows = list(workbook[SHEET].iter_rows())
    if not rows or tuple(cell.value for cell in rows[0][:12]) != HEADERS:
        issue('error', 'invalid_scroll_schema', f'{SHEET}!A1:L1', 'Unexpected magic-scroll headers.')
        return result, counts
    last_named = max((i for i, row in enumerate(rows, 1) if i > 1 and row[0].value is not None), default=1)

    def field(cell, findings, source, kind='text'):
        raw = raw_cell(cell, source)
        value = cell.value
        literal = cell.data_type not in ('f', 'e', 'd')
        if kind == 'number':
            valid = literal and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and '%' not in cell.number_format
            if not valid:
                issue('warning', 'unresolved_scroll_number', source, 'Required numeric reference is missing or malformed. Raw value retained; no numeric default supplied.', findings)
            return dict(**raw, value=(int(value) if value == int(value) else value) if valid else None,
                        state='parsed' if valid else 'unresolved', confidence='unverified' if valid else 'unknown')
        valid = literal and (value is None or isinstance(value, str))
        if not valid:
            issue('warning', 'unresolved_scroll_text', source, 'Expected literal text. Raw value retained without interpreting it as a range or condition.', findings)
        text = value if valid else None
        if kind == 'range':
            valid = valid and isinstance(text, str) and bool(re.fullmatch(r'\d+-\d+', text.strip()))
            if not valid:
                issue('warning', 'unresolved_scroll_range', source, 'Range must be literal range text such as 1-2 or 1-3; dates and numeric values are not converted.', findings)
            return dict(**raw, text=text, state='parsed' if valid else 'unresolved', confidence='unverified' if valid else 'unknown')
        state = 'unresolved' if not valid else 'empty' if text is None or not text.strip() else 'unavailable' if text.strip() == 'N/A' else 'unknown' if text.strip() == '?' else 'documented'
        if kind == 'acquisition' and state in ('empty', 'unknown', 'unresolved'):
            issue('warning', 'unresolved_scroll_acquisition', source, f'Acquisition is {state}; no availability or route inferred.', findings)
        elif kind == 'acquisition' and state == 'documented' and re.search(r'\?|\b(may|probably|possibly|unconfirmed|unknown)\b', text, re.IGNORECASE):
            issue('warning', 'uncertain_scroll_acquisition', source, 'Recorded condition contains an uncertainty qualifier. Preserve it as unverified community information.', findings)
        return dict(**raw, text=text, state=state, confidence='unknown' if state in ('empty', 'unknown', 'unresolved') else 'unverified')

    def note(cell):
        if cell.value is None:
            return
        source = f'{SHEET}!{cell.coordinate}'
        raw = raw_cell(cell, source)
        literal = isinstance(cell.value, str) and cell.data_type not in ('f', 'e')
        if not literal:
            issue('warning', 'unresolved_scroll_note', source, 'Non-text research note retained as raw diagnostic data; no association inferred.')
        result['generalNotes'].append(dict(**raw, text=cell.value if literal else None, confidence='unverified' if literal else 'unknown'))

    seen = set()
    for index, row in enumerate(rows, 1):
        for cell in row[12:]:
            note(cell)
        if index == 1 or not any(cell.value is not None for cell in row[:12]):
            continue
        name_cell = row[0]
        name = name_cell.value
        if name is None and index > last_named and all(cell.value is None or (isinstance(cell.value, str) and cell.data_type not in ('f', 'e')) for cell in row[:12]):
            # Text-only annotations below the last record are separate notes (B12/K12 in this source).
            for cell in row[:12]:
                note(cell)
            continue
        if not isinstance(name, str) or not name.strip() or name.strip() in ('N/A', '?', 'Name') or name_cell.data_type in ('f', 'e'):
            issue('error', 'invalid_scroll_name', f'{SHEET}!A{index}', 'Missing or invalid scroll name; no record identifier can be assigned.')
            continue
        normalized = ' '.join(name.split()).casefold()
        if normalized in seen:
            issue('error', 'duplicate_scroll', f'{SHEET}!A{index}', f'Duplicate scroll name {name!r}.')
            continue
        seen.add(normalized)
        findings = []
        def read(column, kind='text'):
            return field(row[column - 1], findings, f'{SHEET}!{get_column_letter(column)}{index}', kind)
        record = dict(id='magic-scroll-' + hashlib.sha256(name.encode('utf8')).hexdigest()[:20], name=name,
                      nameSource=read(1), tome=read(2), range=read(5, 'range'), description=read(10),
                      acquisition=dict(part1=read(11, 'acquisition'), part3=read(12, 'acquisition')),
                      confidence='unverified', validation=findings,
                      source=dict(sheet=SHEET, row=index, range=f'A{index}:L{index}'))
        for key, column in NUMBER_COLUMNS.items():
            record[key] = read(column, 'number')
        for key in ('tome', 'description'):
            if record[key]['state'] != 'documented':
                issue('warning', 'missing_scroll_text', record[key]['source'], f'{key} is not documented. No text supplied by inference.', findings)
        result['records'].append(record)
    if len(result['records']) != 7:
        issue('error', 'scroll_count_mismatch', SHEET, f"Expected 7 documented scrolls, imported {len(result['records'])}.")
    counts.update(imported=len(result['records']), generalReferenceCells=len(result['generalNotes']),
                  numericFields=dict(Counter(record[key]['state'] for record in result['records'] for key in NUMBER_COLUMNS)),
                  ranges=dict(Counter(record['range']['state'] for record in result['records'])),
                  acquisition={part: {state: sum(record['acquisition'][part]['state'] == state for record in result['records']) for state in STATES} for part in ('part1', 'part3')})
    return result, counts
