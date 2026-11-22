"""Read-only sidecar import of the supplied provisional Forging section interpretation.

No family column exists. Section locations are research assumptions, never name guesses.
The existing weapon importer remains the authority for identities and properties.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import openpyxl
from import_forging import read_forging

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = (
    ('Sword', 19, 38, 'Wooden Sword', 'Royal Sword'),
    ('Spear', 39, 60, 'Wooden Spear', 'Chosen Lance'),
    ('Axe', 61, 79, 'Wooden Axe', "Credna's Mallet"),
    ('Bow', 80, 94, 'Wooden Bow', "Kalla's Bow"),
    ('Gauntlets', 95, 109, 'Wooden Gauntlets', 'Breidablik'),
)
BASIS = 'Provisional interpretation of source row sections supplied for Increment 17. Forging has no explicit weapon-family column; names and effects are not used to infer family.'


def classify_sections(forging):
    records = forging['records']
    if len(records) != 91 or len(forging['preliminary']) != 5:
        raise ValueError('Expected 91 canonical weapons and five separate preliminary records.')
    if [r['source']['row'] for r in records] != list(range(19, 110)):
        raise ValueError('Canonical source rows no longer match the reviewed section boundaries.')
    by_row = {r['source']['row']: r for r in records}
    result, counts = [], Counter()
    for family, first, last, first_name, last_name in SECTIONS:
        if by_row[first]['name'] != first_name or by_row[last]['name'] != last_name:
            raise ValueError(f'{family} boundary anchors changed; review source sections before classifying.')
        for row in range(first, last + 1):
            record = by_row[row]
            if record['section'] != 'main' or record['source']['sheet'] != 'Forging':
                raise ValueError('Family evidence requires canonical Forging source records.')
            result.append(dict(weaponId=record['id'], name=record['name'], family=family, status='provisional',
                               source=dict(sheet='Forging', row=row, cell=f'Forging!A{row}', section=f'Forging!A{first}:J{last}'),
                               ambiguityWarning=None))
            counts[family] += 1
    if len({r['weaponId'] for r in result}) != 91:
        raise ValueError('Duplicate canonical identities in family evidence.')
    return dict(schemaVersion=1, basis=BASIS, counts=dict(counts), records=result)


def import_families(source, snapshot):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != snapshot['metadata']['sourceSha256']:
        raise ValueError('Workbook hash differs from the imported snapshot. Reconcile source data first.')
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=False)
    try:
        issues = []
        forging, _ = read_forging(workbook, issues)
    finally:
        workbook.close()
    if any(item['severity'] == 'error' for item in issues):
        raise ValueError('Existing Forging validation failed; family evidence was not published.')
    if forging != snapshot['forging']:
        raise ValueError('Workbook weapon records differ from the imported snapshot.')
    return dict(sourceSha256=digest, **classify_sections(forging))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/source.xlsx')
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'src/data/growths.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/weapon-families.json')
    args = parser.parse_args(argv)
    try:
        if args.output.resolve() in (args.source.resolve(), args.snapshot.resolve()):
            raise ValueError('Output must not overwrite the source workbook or imported snapshot.')
        snapshot = json.loads(args.snapshot.read_text(encoding='utf8'))
        data = import_families(args.source, snapshot)
    except (ValueError, KeyError, OSError) as error:
        print(f'Family import failed: {error}')
        return 1
    args.output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print(f"Imported {len(data['records'])} provisional canonical family records: {data['counts']}; five preliminary entries excluded.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
