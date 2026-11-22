"""Forging source regressions and conservative parsing / publication gates."""
from copy import deepcopy
from datetime import datetime
import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_forging import COLUMNS, HEADERS, read_forging, parse_might
from import_data import import_workbook, main
from test_import_data import fixture


def forging_fixture(data):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = 'Forging'
    sheet.append(HEADERS)
    for record in data['records'] + data['preliminary']:
        for key in COLUMNS:
            field = record[key]
            cell = sheet[field['source'].split('!')[1]]
            cell.value = datetime.fromisoformat(field['raw']) if field['rawType'] == 'd' else field['raw']
            if field['numberFormat'] is not None: cell.number_format = field['numberFormat']
    for note in data['generalNotes']:
        sheet[note['source'].split('!')[1]] = note['raw']
    return workbook


class ForgingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.data = cls.snapshot['forging']
        cls.by_name = {record['name']: record for record in cls.data['records']}

    def read_modified(self, change):
        workbook = forging_fixture(self.data)
        change(workbook['Forging'])
        issues = []
        data, counts = read_forging(workbook, issues)
        workbook.close()
        return data, counts, issues

    def test_counts_and_primary_completeness(self):
        self.assertEqual(len(self.data['records']), 91)
        self.assertEqual([r['source']['row'] for r in self.data['records']], list(range(19, 110)))
        self.assertEqual([r['source']['row'] for r in self.data['preliminary']], [2, 4, 6, 9, 15])
        self.assertEqual([r['name'] for r in self.data['records'] if r['primaryCompleteness'] == 'incomplete'],
                         ['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus'])
        self.assertEqual(sum(r['completeness'] == 'incomplete' for r in self.data['records']), 5)

    def test_relationships_do_not_merge_spelling_candidate(self):
        relations = self.data['relationships']
        self.assertEqual(sum(r['match'] == 'exact-name' for r in relations), 4)
        possible = [r for r in relations if r['match'] == 'possible-spelling']
        self.assertEqual(len(possible), 1)
        main_record = self.by_name['Veroquine']
        preliminary = next(r for r in self.data['preliminary'] if r['name'] == 'Veronique')
        self.assertEqual((possible[0]['mainId'], possible[0]['preliminaryId']), (main_record['id'], preliminary['id']))
        self.assertNotEqual(main_record['id'], preliminary['id'])
        self.assertNotIn('Veronique', self.by_name)

    def test_wooden_sword_zero_critical_and_exact_effect_wording(self):
        record = self.by_name['Wooden Sword']
        self.assertEqual([record[k]['value'] for k in ('hit', 'weight', 'critical', 'durability', 'maxRefinement')], [90, 2, 0, 10, 9])
        self.assertEqual(record['might']['text'], '2-20')
        self.assertEqual(record['attackRange']['text'], '1')
        self.assertEqual(record['effects']['text'], 'Grants Spd+5.')
        preliminary = next(r for r in self.data['preliminary'] if r['name'] == 'Wooden Sword')
        self.assertNotEqual(preliminary['effects']['text'], record['effects']['text'])
        self.assertEqual(preliminary['maxRefinement']['raw'], '=9')
        self.assertEqual(preliminary['maxRefinement']['value'], 9)
        self.assertEqual(preliminary['maxRefinement']['state'], 'literal-formula')

    def test_zanbato_numeric_conflict_and_sources(self):
        record = self.by_name['Zanbato']
        self.assertEqual([record[k]['value'] for k in ('hit', 'weight', 'critical', 'durability', 'maxRefinement')], [80, 7, 0, 20, 3])
        preliminary = next(r for r in self.data['preliminary'] if r['name'] == 'Zanbato')
        self.assertEqual((record['might']['raw'], preliminary['might']['raw']), ('14-19', '7-19'))
        relation = next(r for r in self.data['relationships'] if r['mainId'] == record['id'])
        numeric = [d for d in relation['differences'] if d['kind'] == 'numeric']
        self.assertEqual(numeric, [dict(field='might', kind='numeric', mainSource='Forging!C25', preliminarySource='Forging!C4')])

    def test_levin_range_display_preserves_excel_encoding(self):
        record = self.by_name['Levin Sword']
        self.assertEqual([record[k]['value'] for k in ('hit', 'weight', 'maxRefinement')], [70, 8, 3])
        self.assertEqual(record['might']['text'], '12-20')
        self.assertEqual(record['attackRange'], dict(raw='2026-02-01T00:00:00', rawType='d', source='Forging!D28', numberFormat='d-m', text='1-2', state='source-display', excelSerial=46054.0))
        self.assertEqual(record['additionalNote']['text'], 'Combat art: Lightning Strike')
        self.assertIn('magical attack', record['effects']['text'])
        self.assertEqual(sum(r['attackRange']['state'] == 'source-display' for r in self.data['records']), 15)

    def test_silver_spear_blank_not_backfilled_from_preliminary(self):
        record = self.by_name['Silver Spear']
        self.assertEqual([record[k]['value'] for k in ('hit', 'weight', 'critical', 'maxRefinement')], [85, 6, 0, 3])
        self.assertEqual(record['might']['text'], '20-25')
        self.assertEqual(record['durability']['state'], 'missing')
        self.assertIsNone(record['durability']['value'])
        self.assertEqual(record['primaryCompleteness'], 'complete')
        self.assertEqual(record['completeness'], 'incomplete')
        self.assertEqual(next(r for r in self.data['preliminary'] if r['name'] == 'Silver Spear')['durability']['value'], 20)

    def test_single_might_and_zero_refinement(self):
        record = self.by_name["Ursa's Right Claw"]
        self.assertEqual(record['might']['kind'], 'single')
        self.assertEqual(record['might']['value'], 15)
        self.assertIsNone(record['might']['lower'])
        self.assertIsNone(record['might']['upper'])
        self.assertEqual(record['maxRefinement']['value'], 0)
        self.assertEqual(record['maxRefinement']['state'], 'documented')
        self.assertEqual(record['additionalNote']['text'], 'Combat art: Violent Claw')

    def test_safe_might_endpoints_no_interpolation(self):
        self.assertEqual(parse_might(' 9-22 '), dict(kind='span', lower=9., upper=22., value=None))
        self.assertEqual(parse_might('15')['value'], 15)
        self.assertEqual(parse_might(0)['value'], 0)
        for value in ('22-9', '1-2-3', '9 to 22', '=9+2', True, float('nan'), float('inf')):
            with self.subTest(value=value): self.assertEqual(parse_might(value)['kind'], 'unresolved')
        for value in (None, '', '   '): self.assertEqual(parse_might(value)['kind'], 'missing')

    def test_unicode_multiline_and_typos_remain_exact(self):
        data, _, _ = self.read_modified(lambda sheet: setattr(sheet['J19'], 'value', 'Écho — Δ\nSecond line +5'))
        self.assertEqual(data['records'][0]['additionalNote']['raw'], 'Écho — Δ\nSecond line +5')
        self.assertEqual(data['records'][0]['additionalNote']['text'], 'Écho — Δ\nSecond line +5')
        self.assertIn('atttack', self.by_name['Salamander']['effects']['text'])
        self.assertIn('atttack', self.by_name['Zerberus']['effects']['text'])
        self.assertEqual(self.by_name['Dodge Gauntlets']['effects']['raw'], '="+10 avoid"')
        self.assertEqual(self.by_name['Dodge Gauntlets']['effects']['text'], '+10 avoid')

    def test_independent_notes_never_assigned_to_weapon(self):
        self.assertEqual(len(self.data['generalNotes']), 5)
        note = next(n for n in self.data['generalNotes'] if n['source'] == 'Forging!K18')
        self.assertEqual(note['confidence'], 'unverified')
        self.assertEqual(note['text'], 'Most effects unlock halfway or at full refine (especially the combat art upgrades)')
        self.assertNotIn(note['text'], json.dumps(self.data['records']))

    def test_malformed_numeric_values_remain_unknown(self):
        for value in ('not known', '=1+2', True, '#VALUE!'):
            with self.subTest(value=value):
                data, _, issues = self.read_modified(lambda sheet: setattr(sheet['B19'], 'value', value))
                field = data['records'][0]['hit']
                self.assertIsNone(field['value'])
                self.assertEqual(field['raw'], value)
                self.assertEqual(field['state'], 'unresolved')
                self.assertTrue(any(i['code'] == 'unresolved_forging_number' for i in issues))
        data, _, _ = self.read_modified(lambda sheet: setattr(sheet['B19'], 'number_format', '0%'))
        self.assertIsNone(data['records'][0]['hit']['value'])

    def test_unknown_date_format_is_not_guessed(self):
        data, _, issues = self.read_modified(lambda sheet: setattr(sheet['D28'], 'number_format', 'yyyy-mm-dd'))
        field = next(r for r in data['records'] if r['name'] == 'Levin Sword')['attackRange']
        self.assertIsNone(field['text'])
        self.assertEqual(field['state'], 'unresolved')
        self.assertTrue(any(i['code'] == 'unresolved_forging_range' for i in issues))

    def test_optional_descriptions_missing_is_not_no_effects(self):
        data, _, _ = self.read_modified(lambda sheet: setattr(sheet['H19'], 'value', None))
        self.assertIsNone(data['records'][0]['effects']['text'])
        self.assertEqual(data['records'][0]['effects']['state'], 'missing')
        self.assertEqual(data['records'][0]['completeness'], 'complete')

    def test_duplicate_invalid_name_schema_missing_sheet_and_tail(self):
        for change, expected in (
            (lambda s: setattr(s['A20'], 'value', ' Wooden   Sword '), 'duplicate_weapon_name'),
            (lambda s: setattr(s['A19'], 'value', None), 'invalid_weapon_name'),
            (lambda s: setattr(s['B1'], 'value', 'Unexpected'), 'invalid_forging_schema'),
            (lambda s: setattr(s['A110'], 'value', 'Extra weapon'), 'forging_count_mismatch'),
        ):
            with self.subTest(expected=expected):
                _, _, issues = self.read_modified(change)
                self.assertTrue(any(i['code'] == expected and i['severity'] == 'error' for i in issues))
        issues = []
        read_forging(openpyxl.Workbook(), issues)
        self.assertEqual(issues[0]['code'], 'missing_sheet')

    def test_ids_stable_when_main_rows_move(self):
        def change(sheet):
            # Moving whole main rows changes source references, not name-based identities.
            sheet.move_range('A19:J109', rows=1)
        data, _, _ = self.read_modified(change)
        self.assertEqual({r['name']: r['id'] for r in data['records']}, {r['name']: r['id'] for r in self.data['records']})
        self.assertEqual(data['records'][0]['source']['row'], 20)

    def test_read_only_import_reproduces_snapshot_and_previous_sections(self):
        source = ROOT / 'data/source.xlsx'
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        data, report = import_workbook(source)
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(data, self.snapshot)
        self.assertEqual(before, hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertEqual(before, '4983c89549294cc309423486e48811e4df8b90d4feb34caed6a3eef43e6a4254')
        old = deepcopy(data)
        del old['forging']
        previous = (json.dumps(old, indent=2, ensure_ascii=False) + '\n').replace('\n', '\r\n').encode('utf8')
        self.assertEqual(hashlib.sha256(previous).hexdigest(), 'ba7c1f836224a9bf9a4d1638f69c7bd10aae3fd79dfc7fc28fcecbdb298fc212')

    def test_cli_errors_do_not_publish_partial_data(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'work') as directory:
            folder = Path(directory)
            source, output, report = (folder / name for name in ('source.xlsx', 'output.json', 'report.json'))
            workbook = fixture(self.snapshot)
            workbook['Forging']['A110'] = 'Unexpected extra weapon'
            workbook.save(source)
            workbook.close()
            output.write_text('KEEP EXISTING JSON', encoding='utf8')
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                status = main(['--source', str(source), '--output', str(output), '--report', str(report)])
            self.assertEqual(status, 1)
            self.assertEqual(output.read_text(encoding='utf8'), 'KEEP EXISTING JSON')
            self.assertEqual(json.loads(report.read_text(encoding='utf8'))['status'], 'failed')


if __name__ == '__main__': unittest.main()



