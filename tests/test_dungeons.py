"""Paired phase rewards, sparse chest numbering, source notes and publish safety."""
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
from import_dungeons import HEADERS, parse_chest, read_dungeons
from import_data import main


class DungeonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.catalog = cls.data['dungeons']
        cls.records = {record['name']: record for record in cls.catalog['records']}

    def fixture(self):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = 'Dungeon Chests'
        sheet.append(HEADERS)
        for record in self.records.values():
            sheet.cell(record['source']['row'], 1, record['name'])
            for chest in record['chests']: sheet[chest['source'].split('!')[1]] = chest['raw']
            for note in record['notes']: sheet[note['source'].split('!')[1]] = note['raw']
        for note in self.catalog['generalNotes']: sheet[note['source'].split('!')[1]] = note['raw']
        return workbook

    def changed(self, change):
        workbook = self.fixture()
        change(workbook)
        issues = []
        result, counts = read_dungeons(workbook, issues)
        workbook.close()
        return result, counts, issues

    def pairs(self, name):
        return [(chest['number'], chest['part1']['raw'], chest['part3']['raw']) for chest in self.records[name]['chests']]

    def test_counts_phase_fields_and_unique_ids(self):
        result, counts, issues = self.changed(lambda w: None)
        self.assertEqual(result, self.catalog)
        self.assertEqual((counts['locations'], counts['chests'], counts['phaseFields']), (31, 90, 180))
        self.assertEqual(counts['phases']['part1'], dict(documented=86, placeholder=4, empty=0, unresolved=0))
        self.assertEqual(counts['phases']['part3'], dict(documented=90, placeholder=0, empty=0, unresolved=0))
        self.assertEqual(len({record['id'] for record in result['records']}), 31)
        self.assertEqual(len({chest['id'] for record in result['records'] for chest in record['chests']}), 90)
        self.assertEqual([issue['code'] for issue in issues], ['dungeon_phase_placeholder'])

    def test_corroios_exact_three_pairs(self):
        self.assertEqual(self.pairs('Corroios Fort Ruins'), [(1, 'Poisonbone Chain', 'Large Bullion'), (2, 'Magic Staff', 'Horsekiller Bow +2'), (3, 'Tactics Manual', 'Talisman')])

    def test_nowah_four_chests_with_upgrade_and_icon(self):
        pairs = self.pairs("Nowah's Cave")
        self.assertEqual(len(pairs), 4)
        self.assertEqual(pairs[1], (2, 'Tactics Manual', 'Killing Edge +3'))
        self.assertEqual(pairs[3], (4, 'Pure Water', 'Goddess Icon'))

    def test_uncharted_sparse_column_keeps_only_chest_two(self):
        self.assertEqual(self.pairs('Uncharted Isle'), [(2, 'Thick Foreign Tome', 'Talisman')])
        self.assertEqual(self.records['Uncharted Isle']['chests'][0]['source'], 'Dungeon Chests!C9')

    def test_palace_dash_is_not_a_missing_chest_or_item(self):
        record = self.records['Palace of Sand']
        self.assertEqual([chest['number'] for chest in record['chests']], [1, 2, 3, 4])
        self.assertTrue(all(chest['part1'] == dict(raw='-', status='placeholder') for chest in record['chests']))
        self.assertEqual([chest['part3']['raw'] for chest in record['chests']], ['Salamander', 'Giant Shell', 'Large Bullion', 'Extra Large Bullion'])
        self.assertIn('not an obtainable item', record['warnings'][0]['message'])

    def test_southern_passage_does_not_replace_latin_z(self):
        self.assertEqual(self.pairs('Southern Passage')[1], (2, 'Swarm Z', 'Black Pearl'))
        self.assertEqual(ord(self.pairs('Southern Passage')[1][1][-1]), ord('Z'))
        self.assertEqual(self.data['magicScrolls']['records'][-1]['name'], 'Swarm Ζ')

    def test_all_cells_raw_phase_order_chest_numbers_and_names_match_read_only_source(self):
        workbook = openpyxl.load_workbook(ROOT / 'data/source.xlsx', read_only=True, data_only=False)
        try:
            sheet = workbook['Dungeon Chests']
            for record in self.records.values():
                self.assertEqual(record['name'], sheet.cell(record['source']['row'], 1).value)
                for chest in record['chests']:
                    cell = sheet[chest['source'].split('!')[1]]
                    self.assertEqual(chest['raw'], cell.value)
                    self.assertEqual(chest['rawType'], cell.data_type)
                    self.assertEqual(chest['number'], cell.column - 1)
                    first, second = cell.value.split('\n')
                    self.assertEqual((chest['part1']['raw'], chest['part3']['raw']), (first, second))
            self.assertEqual(self.records['Cougar Woodlands ']['name'], 'Cougar Woodlands ')
            self.assertEqual(self.records["Beast's Path"]['chests'][1]['part1']['raw'], 'Concoction ')
        finally: workbook.close()

    def test_repeated_reward_names_remain_separate_chests_and_phases(self):
        cougar = self.records['Cougar Woodlands ']['chests']
        self.assertEqual([chest['part1']['raw'] for chest in cougar].count('Bullion'), 2)
        shadowy = self.records['Shadowy Cave']['chests']
        self.assertEqual([chest['part1']['raw'] for chest in shadowy].count('Coin'), 2)
        self.assertEqual([chest['part3']['raw'] for chest in shadowy].count('Large Bullion'), 2)
        self.assertEqual(len(shadowy), 5)

    def test_bad_line_count_numeric_formula_and_error_cells_never_guess_phases(self):
        for value in ('Only one line', 'Part I\nPart III\nAnother line', 'Part I\nPart III\n', '=1+2', '#VALUE!', 123, True):
            result, counts, issues = self.changed(lambda w: setattr(w['Dungeon Chests']['B2'], 'value', value))
            chest = result['records'][0]['chests'][0]
            self.assertEqual(chest['raw'], value)
            self.assertEqual(chest['part1'], dict(raw=None, status='unresolved'))
            self.assertEqual(chest['part3'], dict(raw=None, status='unresolved'))
            self.assertEqual(counts['chests'], 90)
            self.assertTrue(any(issue['code'] == 'unresolved_chest_lines' for issue in issues))
            self.assertFalse(any(issue['severity'] == 'error' for issue in issues))

    def test_empty_phase_stays_in_place_and_crlf_is_parsed_without_trimming_display(self):
        for raw, first, second in [('\nReward III', '', 'Reward III'), ('Reward I\n', 'Reward I', ''), (' Reward I \r\n Reward III ', ' Reward I ', ' Reward III ')]:
            result, _, _ = self.changed(lambda w: setattr(w['Dungeon Chests']['B2'], 'value', raw))
            chest = result['records'][0]['chests'][0]
            self.assertEqual((chest['part1']['raw'], chest['part3']['raw']), (first, second))
            self.assertEqual(chest['part1']['status'], 'documented' if first else 'empty')
            self.assertEqual(chest['part3']['status'], 'documented' if second else 'empty')

    def test_notes_follow_explicit_names_and_g_column_without_attaching_independent_discussion(self):
        enno = self.records['Enno Isle*']
        self.assertEqual(enno['notes'][0]['source'], 'Dungeon Chests!A34')
        self.assertIn('Theodora only in P1', enno['notes'][0]['text'])
        self.assertEqual(self.records['Cave Behind the Falls']['notes'][0]['text'], 'Grand Megalith access (Hypatia)')
        self.assertEqual(self.records['Palace of Sand']['notes'][0]['text'], 'Grand Megalith access (Magellan)')
        notes = {entry['source']: entry['text'] for entry in self.catalog['generalNotes']}
        for source in ['Dungeon Chests!H26', 'Dungeon Chests!H27', 'Dungeon Chests!A35', 'Dungeon Chests!A36', 'Dungeon Chests!D36']: self.assertIn(source, notes)
        self.assertIn('Uncharted Isle?', notes['Dungeon Chests!H27'])
        self.assertEqual(self.records['Rubess Forest']['notes'], [])
        self.assertNotIn('Archive Τ', str(self.records['Rubess Forest']))
        self.assertNotIn('door is locked', str(self.records))
        self.assertEqual(len(self.records), 31)

    def test_name_duplicates_missing_names_schema_sheet_and_missing_chest_count_fail(self):
        for change in [lambda w: setattr(w['Dungeon Chests']['A3'], 'value', ' CORROIOS  FORT RUINS '),
                       lambda w: setattr(w['Dungeon Chests']['A2'], 'value', None),
                       lambda w: setattr(w['Dungeon Chests']['A2'], 'value', 1),
                       lambda w: setattr(w['Dungeon Chests']['B1'], 'value', 'Wrong header'),
                       lambda w: w.remove(w['Dungeon Chests']),
                       lambda w: setattr(w['Dungeon Chests']['C9'], 'value', None)]:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_placeholders_count_mismatch_warns_without_reassigning_a_malformed_phase(self):
        result, counts, issues = self.changed(lambda w: setattr(w['Dungeon Chests']['B30'], 'value', '-\nSalamander\nAmbiguous'))
        self.assertEqual(counts['phases']['part1']['placeholder'], 3)
        self.assertEqual(next(record for record in result['records'] if record['name'] == 'Palace of Sand')['chests'][0]['part1']['status'], 'unresolved')
        self.assertTrue(any(issue['code'] == 'dungeon_placeholder_count_mismatch' for issue in issues))
        self.assertFalse(any(issue['severity'] == 'error' for issue in issues))

    def test_location_and_chest_ids_survive_row_moves(self):
        def change(workbook):
            sheet = workbook['Dungeon Chests']
            rows = [[sheet.cell(row, col).value for col in range(1, 8)] for row in (2, 3)]
            for column, (a, b) in enumerate(zip(*rows), 1):
                sheet.cell(2, column).value = b
                sheet.cell(3, column).value = a
        result, _, _ = self.changed(change)
        moved = result['records'][1]
        original = self.records['Corroios Fort Ruins']
        self.assertEqual(moved['id'], original['id'])
        self.assertEqual([chest['id'] for chest in moved['chests']], [chest['id'] for chest in original['chests']])
        self.assertEqual(moved['source']['row'], 3)

    def test_failed_import_preserves_previous_json_and_source_bytes(self):
        from test_import_data import fixture
        before = hashlib.sha256((ROOT / 'data/source.xlsx').read_bytes()).hexdigest()
        scratch = ROOT / 'work/test-fixtures'
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            path, output, report = (Path(directory) / name for name in ('source.xlsx', 'data.json', 'report.json'))
            workbook = fixture(self.data)
            workbook['Dungeon Chests']['A3'] = 'Corroios Fort Ruins'
            workbook.save(path); workbook.close()
            output.write_text('previous data', encoding='utf8')
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = main(['--source', str(path), '--output', str(output), '--report', str(report)])
            self.assertEqual(code, 1)
            self.assertEqual(output.read_text(encoding='utf8'), 'previous data')
            self.assertEqual(json.loads(report.read_text(encoding='utf8'))['status'], 'failed')
        self.assertEqual(hashlib.sha256((ROOT / 'data/source.xlsx').read_bytes()).hexdigest(), before)
