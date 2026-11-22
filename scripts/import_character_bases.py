"""Build offline level-1 baselines from reviewed, read-only web snapshots.

Does not fetch the network or change the original workbook/growth records.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATS = ('HP', 'Str', 'Mag', 'Spd', 'Dex', 'Def', 'Res', 'Lck', 'Cha')
SERENES_URL = 'https://serenesforest.net/fortunes-weave/characters/base-stats/'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/12Lrk_M4_cgy6P0_WB9QXknDLDjyKtbeUkhWk32pTGqo/edit?gid=0'
OUTPUT = ROOT / 'src/data/character-bases.json'


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
        elif tag == 'tr' and self.table is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, value):
        if self.cell is not None:
            self.cell.append(value)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def stat_values(values, location, *, text=False):
    if len(values) != 9:
        raise ValueError(f'{location}: expected nine base stats')
    result = {}
    for stat, raw in zip(STATS, values):
        value = int(raw) if text and isinstance(raw, str) and raw.isdecimal() else raw
        if type(value) is not int or value < 0:
            raise ValueError(f'{location}: missing or malformed {stat} base stat: {raw!r}')
        result[stat] = value
    return result


def read_serenes(html):
    if 'These are the Level 1 stats' not in html:
        raise ValueError('Serenes snapshot no longer establishes level 1')
    parser = Tables()
    parser.feed(html)
    records = {}
    repeated_headers = 0
    header = ['Name', *STATS]
    for table in parser.tables:
        if not table or table[0] != header:
            continue
        for index, row in enumerate(table[1:], 2):
            if row == header:
                repeated_headers += 1
                continue
            if len(row) != 10 or not row[0].strip() or row[0] == 'Name':
                raise ValueError(f'Serenes row {index}: malformed character row')
            name = row[0].strip()
            if name in records:
                raise ValueError(f'Serenes duplicate character: {name}')
            records[name] = stat_values(row[1:], name, text=True)
        # Later tables are headed Playable? / NPCs and repeat some names. They
        # are reference-only; never merge those variants into the player roster.
        break
    if not records:
        raise ValueError('No named level-1 base-stat tables found')
    return records, repeated_headers


def read_research(snapshot):
    rows = snapshot['values']
    if rows[0] != ['Character', 'Level', *STATS, 'Beginner', 'Specialty', 'Notes']:
        raise ValueError('Research sheet headers changed')
    records = {}
    for row_number, row in enumerate(rows[1:], 2):
        if len(row) < 11 or not isinstance(row[0], str) or not row[0].strip():
            raise ValueError(f'Research sheet row {row_number}: missing character')
        name = row[0].strip()
        if name in records or name == 'Name':
            raise ValueError(f'Research sheet duplicate/header character: {name}')
        if type(row[1]) is not int or row[1] != 1:
            raise ValueError(f'{name}: expected explicitly documented level 1')
        records[name] = {'stats': stat_values(row[2:11], name), 'row': row_number}
    return records


def build_bases(research, html, profile_names):
    primary = read_research(research)
    secondary, headers = read_serenes(html)
    if len(profile_names) != 64 or len(set(profile_names)) != 64:
        raise ValueError('Expected exactly 64 distinct existing growth profiles')
    characters = []
    for name in profile_names:
        source_name = 'Mu' if name == 'Mu (with growth)' else name
        if source_name not in secondary:
            raise ValueError(f'{name}: missing published level-1 baseline')
        sheet_record = primary.get(source_name)
        stats = dict(sheet_record['stats'] if sheet_record else secondary[source_name])
        conflicts = []
        if sheet_record:
            for stat in STATS:
                if stats[stat] != secondary[source_name][stat]:
                    conflicts.append({'stat': stat, 'used': stats[stat], 'alternative': secondary[source_name][stat], 'alternativeUrl': SERENES_URL})
        sources = [{'url': SERENES_URL, 'location': f'{source_name} · level-1 table'}]
        if sheet_record:
            sources.insert(0, {'url': SHEET_URL, 'location': f"'Base Stats'!A{sheet_record['row']}:K{sheet_record['row']}"})
        characters.append({'name': name, 'sourceCharacter': source_name, 'level': 1, 'stats': stats,
                           'sources': sources, 'conflicts': conflicts,
                           'profileNote': 'Uses Mu’s same level-1 bases; this separate profile changes level-up growth only.' if name != source_name else None})
    return {'schemaVersion': 1, 'reviewedAt': '2026-11-12', 'basis': 'Published level-1 base stats; not recruitment stats or an autolevel simulation.',
            'credits': 'u/averysillyman; level-up data by Aggro Incarnate; supplemental tables from Serenes Forest.',
            'counts': {'profiles': len(characters), 'uniqueCharacters': len({x['sourceCharacter'] for x in characters}),
                       'researchCharacters': len(primary), 'repeatedHeadersExcluded': headers},
            'referenceOnlyCharacters': sorted(set(secondary) - {x['sourceCharacter'] for x in characters}),
            'characters': characters}


def generate(root=ROOT):
    paths = [root / 'data/base-stats/research-sheet.json', root / 'data/base-stats/serenes-base-stats.html']
    research = json.loads(paths[0].read_text(encoding='utf-8'))
    html = paths[1].read_text(encoding='utf-8')
    names = [profile['name'] for profile in json.loads((root / 'src/data/growths.json').read_text(encoding='utf-8'))['characters']]
    result = build_bases(research, html, names)
    result['sourceHashes'] = {str(path.relative_to(root)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    return json.dumps(result, ensure_ascii=False, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    text = generate()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding='utf-8') != text:
            raise SystemExit('Character base-stat JSON is stale; run python scripts/import_character_bases.py')
    else:
        OUTPUT.write_text(text, encoding='utf-8')
    data = json.loads(text)
    print(f"Validated {data['counts']['profiles']} profiles / {data['counts']['uniqueCharacters']} characters; "
          f"{sum(len(x['conflicts']) for x in data['characters'])} source disagreement(s).")


if __name__ == '__main__':
    main()
