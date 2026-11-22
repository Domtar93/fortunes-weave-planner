"""Seven source scrolls, raw properties, acquisition semantics and isolated notes."""
import contextlib
from datetime import datetime
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
from import_scrolls import HEADERS, NUMBER_COLUMNS, read_scrolls
from import_data import import_workbook, main


class ScrollTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.catalog = cls.data['magicScrolls']
        cls.records = {record['name']: record for record in cls.catalog['records']}

    def fixture(self):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = 'Magic Scrolls'
        sheet.append(HEADERS)
        for record in self.records.values():
            fields = [record[key] for key in ('nameSource', 'tome', 'range', 'description', *NUMBER_COLUMNS)] + list(record['acquisition'].values())
            for field in fields: sheet[field['source'].split('!')[1]] = field['raw']
        for note in self.catalog['generalNotes']: sheet[note['source'].split('!')[1]] = note['raw']
        return workbook

    def changed(self, change):
        workbook = self.fixture()
        change(workbook)
        issues = []
        result, counts = read_scrolls(workbook, issues)
        workbook.close()
        return result, counts, issues

    def test_counts_all_numbers_text_ranges_unique_ids_and_confidence(self):
        result, counts, issues = self.changed(lambda w: None)
        self.assertEqual(result, self.catalog)
        self.assertEqual(counts['imported'], 7)
        self.assertEqual(counts['numericFields'], {'parsed': 42})
        self.assertEqual(counts['ranges'], {'parsed': 7})
        self.assertEqual(counts['generalReferenceCells'], 8)
        self.assertEqual(counts['acquisition']['part1'], dict(documented=4, unavailable=3, unknown=0, empty=0, unresolved=0))
        self.assertEqual(counts['acquisition']['part3'], dict(documented=3, unavailable=0, unknown=4, empty=0, unresolved=0))
        self.assertEqual(len({record['id'] for record in result['records']}), 7)
        self.assertEqual(len({record['name'] for record in result['records']}), 7)
        self.assertTrue(all(record['confidence'] == 'unverified' for record in result['records']))
        self.assertEqual(len(issues), 4)
        self.assertTrue(all(issue['severity'] == 'warning' for issue in issues))

    def test_fimbulvetr_night_full_properties_and_temples(self):
        record = self.records['Fimbulvetr Night']
        self.assertEqual(record['tome']['text'], 'Fimbulvetr Tome')
        self.assertEqual([record[key]['value'] for key in NUMBER_COLUMNS], [80, 30, 28, 10, 0, 1])
        self.assertEqual(record['range']['text'], '1-2')
        self.assertEqual(record['acquisition']['part1']['state'], 'unavailable')
        self.assertEqual(record['acquisition']['part1']['text'], 'N/A')
        self.assertIn("Smyrnos's Request", record['acquisition']['part3']['text'])
        self.assertIn("both Smyrnos's Temple and Jurah's Temple to be repaired", record['acquisition']['part3']['text'])

    def test_agnea_arrow_and_trial(self):
        record = self.records["Agnea's Arrow"]
        self.assertEqual(record['tome']['text'], 'Agnea Tome')
        self.assertEqual((record['hit']['value'], record['might']['value'], record['uses']['value']), (90, 25, 1))
        self.assertIn("Smyrnos's Trial", record['acquisition']['part3']['text'])

    def test_dark_spikes_greek_tau_and_both_methods(self):
        record = self.records['Dark Spikes Τ']
        self.assertEqual(ord(record['name'][-1]), 0x3A4)
        self.assertEqual((record['might']['value'], record['hit']['value'], record['uses']['value']), (20, 60, 2))
        self.assertIn('anti-cavalry', record['description']['text'])
        self.assertIn('Vandahl Trading Company', record['acquisition']['part3']['text'])
        self.assertIn('Uncharted Isle', record['acquisition']['part3']['text'])

    def test_mire_multiline_trade_chest_and_unknown_part_three(self):
        record = self.records['Mire Β']
        self.assertEqual((record['range']['text'], record['might']['value'], record['uses']['value']), ('1-3', 3, 5))
        self.assertIn('3 Torment Grass', record['acquisition']['part1']['text'])
        self.assertIn('\n・Dungeon Chest:', record['acquisition']['part1']['text'])
        self.assertEqual((record['acquisition']['part3']['state'], record['acquisition']['part3']['text']), ('unknown', '?'))

    def test_death_banshee_swarm_properties_and_effects_are_verbatim(self):
        death, banshee, swarm = [self.records[name] for name in ('Death Γ', 'Banshee Θ', 'Swarm Ζ')]
        self.assertEqual((death['critical']['value'], death['uses']['value']), (20, 5))
        self.assertIn('10 Pongo + 1 Glirmosa', death['acquisition']['part1']['text'])
        self.assertIn("\n・Dungeon Chest: Aditi's Cave", death['acquisition']['part1']['text'])
        self.assertEqual((banshee['range']['text'], banshee['uses']['value']), ('1-3', 2))
        self.assertIn('Immobilize', banshee['description']['text'])
        self.assertIn('Iapetus Cavern', banshee['acquisition']['part1']['text'])
        self.assertTrue(banshee['acquisition']['part1']['text'].endswith(' '))
        self.assertEqual((swarm['might']['value'], swarm['range']['text'], swarm['uses']['value']), (4, '1-2', 2))
        self.assertIn("Spd-3 on foe until unit's next phase", swarm['description']['text'])
        self.assertEqual([ord(name[-1]) for name in ('Mire Β', 'Death Γ', 'Banshee Θ', 'Swarm Ζ')], [0x392, 0x393, 0x398, 0x396])

    def test_every_raw_field_matches_unchanged_source_including_unicode_and_multiline(self):
        workbook = openpyxl.load_workbook(ROOT / 'data/source.xlsx', read_only=True, data_only=False)
        try:
            for record in self.records.values():
                fields = [record[key] for key in ('nameSource', 'tome', 'range', 'description', *NUMBER_COLUMNS)] + list(record['acquisition'].values())
                for field in fields:
                    cell = workbook['Magic Scrolls'][field['source'].split('!')[1]]
                    self.assertEqual(field['raw'], cell.value)
                    self.assertEqual(field['rawType'], cell.data_type)
                self.assertEqual(record['source']['range'], f"A{record['source']['row']}:L{record['source']['row']}")
        finally: workbook.close()

    def test_unknown_unavailable_blank_and_uncertain_recorded_text_remain_distinct(self):
        def change(workbook):
            sheet = workbook['Magic Scrolls']
            sheet['K2'], sheet['K3'], sheet['K4'], sheet['K5'] = None, '?', 'N/A', 'Maybe Chapter 10?\nRoute unconfirmed'
        result, _, issues = self.changed(change)
        self.assertEqual([record['acquisition']['part1']['state'] for record in result['records'][:4]], ['empty', 'unknown', 'unavailable', 'documented'])
        self.assertIsNone(result['records'][0]['acquisition']['part1']['raw'])
        self.assertEqual(result['records'][3]['acquisition']['part1']['confidence'], 'unverified')
        self.assertTrue(any(issue['code'] == 'uncertain_scroll_acquisition' for issue in issues))

    def test_missing_malformed_numeric_fields_preserve_raw_without_zero_or_coercion(self):
        for value in (None, '80', '?', '=80', True, float('nan'), float('inf'), datetime(2026, 1, 2)):
            for key, column in NUMBER_COLUMNS.items():
                with self.subTest(value=value, key=key):
                    result, _, issues = self.changed(lambda w: setattr(w['Magic Scrolls'].cell(2, column), 'value', value))
                    field = result['records'][0][key]
                    self.assertIsNone(field['value'])
                    self.assertEqual(field['state'], 'unresolved')
                    if value not in (None,) and not isinstance(value, (float, datetime)): self.assertEqual(field['raw'], value)
                    self.assertTrue(any(issue['code'] == 'unresolved_scroll_number' for issue in issues))
                    self.assertFalse(any(issue['severity'] == 'error' for issue in issues))
                    json.dumps(result, allow_nan=False)
        self.assertEqual(self.records['Fimbulvetr Night']['avoidance']['value'], 0)

    def test_date_number_and_formula_ranges_are_unresolved_but_literal_ranges_are_unchanged(self):
        for value in (datetime(2026, 1, 2), 1234, '=1-2', 'January 2', None):
            result, _, issues = self.changed(lambda w: setattr(w['Magic Scrolls']['E2'], 'value', value))
            self.assertEqual(result['records'][0]['range']['state'], 'unresolved')
            self.assertTrue(any(issue['code'] == 'unresolved_scroll_range' for issue in issues))
        for value in ('1-2', '1-3'):
            result, _, _ = self.changed(lambda w: setattr(w['Magic Scrolls']['E2'], 'value', value))
            self.assertEqual(result['records'][0]['range']['raw'], value)
            self.assertEqual(result['records'][0]['range']['text'], value)
            self.assertEqual(result['records'][0]['range']['state'], 'parsed')

    def test_notes_are_independent_including_tail_and_route_uncertainties(self):
        notes = {note['source']: note['text'] for note in self.catalog['generalNotes']}
        self.assertEqual(len(notes), 8)
        for fragment in ('Torment grass', 'Pongo', 'Glirmosa', 'Chapter 10', 'Ch10', 'story-locked', 'Luna Λ'):
            self.assertIn(fragment, ' '.join(notes.values()))
        self.assertNotIn('Nysaides', str(self.records))
        self.assertNotIn('Chapter 10', str(self.records))
        self.assertNotIn('story-locked', str(self.records))
        self.assertNotIn('Luna Λ', self.records)
        self.assertIn('Magic Scrolls!B12', notes)
        self.assertIn('Magic Scrolls!K12', notes)

    def test_duplicate_empty_invalid_names_missing_sheet_header_and_extra_record_fail(self):
        changes = [lambda w: setattr(w['Magic Scrolls']['A3'], 'value', ' FIMBULVETR   NIGHT '),
                   lambda w: setattr(w['Magic Scrolls']['A8'], 'value', None),
                   lambda w: setattr(w['Magic Scrolls']['A2'], 'value', ''),
                   lambda w: setattr(w['Magic Scrolls']['A2'], 'value', 17),
                   lambda w: w.remove(w['Magic Scrolls']),
                   lambda w: setattr(w['Magic Scrolls']['H1'], 'value', 'Changed'),
                   lambda w: setattr(w['Magic Scrolls']['A10'], 'value', 'Unexpected scroll')]
        for change in changes:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_stable_ids_survive_row_reordering(self):
        def change(workbook):
            sheet = workbook['Magic Scrolls']
            first, second = [[sheet.cell(row, col).value for col in range(1, 13)] for row in (2, 3)]
            for col, (a, b) in enumerate(zip(first, second), 1):
                sheet.cell(2, col).value = b
                sheet.cell(3, col).value = a
        result, _, _ = self.changed(change)
        self.assertEqual(result['records'][1]['id'], self.records['Fimbulvetr Night']['id'])
        self.assertEqual(result['records'][1]['source']['row'], 3)

    def test_read_only_blank_cells_and_failed_import_preserve_source_and_previous_json(self):
        before = hashlib.sha256((ROOT / 'data/source.xlsx').read_bytes()).hexdigest()
        scratch = ROOT / 'work/test-fixtures'
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            path, output, report = (Path(directory) / name for name in ('fixture.xlsx', 'data.json', 'report.json'))
            workbook = self.fixture()
            workbook['Magic Scrolls']['C2'] = None
            workbook.save(path); workbook.close()
            readonly = openpyxl.load_workbook(path, read_only=True)
            issues = []
            try: result, _ = read_scrolls(readonly, issues)
            finally: readonly.close()
            self.assertIsNone(result['records'][0]['hit']['value'])
            self.assertEqual(result['records'][0]['hit']['source'], 'Magic Scrolls!C2')
            # Use the complete shared fixture to exercise the production publish gate.
            from test_import_data import fixture
            workbook = fixture(self.data)
            workbook['Magic Scrolls']['A3'] = 'Fimbulvetr Night'
            workbook.save(path); workbook.close()
            output.write_text('previous snapshot', encoding='utf8')
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = main(['--source', str(path), '--output', str(output), '--report', str(report)])
            self.assertEqual(code, 1)
            self.assertEqual(output.read_text(encoding='utf8'), 'previous snapshot')
            self.assertEqual(json.loads(report.read_text(encoding='utf8'))['status'], 'failed')
        self.assertEqual(hashlib.sha256((ROOT / 'data/source.xlsx').read_bytes()).hexdigest(), before)
