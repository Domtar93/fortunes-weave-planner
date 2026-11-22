"""Mount source reconciliation without zero defaults or inferred ability effects."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_data import import_workbook, main, parse_growth, read_source_text
from import_mounts import read_mounts, parse_modifier_text
from test_import_data import fixture


class MountTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.mounts = {record['name']: record for record in cls.data['mounts']['records']}

    def changed(self, change):
        workbook = fixture(self.data)
        change(workbook)
        issues = []
        data, counts = read_mounts(workbook, self.data['classes'], issues, read_text=read_source_text, parse_growth=parse_growth)
        workbook.close()
        return data, counts, issues

    def test_exact_counts_species_and_raw_source_fields(self):
        self.assertEqual(len(self.mounts), 22)
        counts = {species: sum(record['species']['text'] == species for record in self.mounts.values())
                  for species in ('Ornius', 'Horse', 'Pegasus', 'Bau', 'Elephant')}
        self.assertEqual(counts, dict(Ornius=6, Horse=6, Pegasus=6, Bau=3, Elephant=1))
        workbook = openpyxl.load_workbook(ROOT / 'data/source.xlsx', read_only=True)
        try:
            for row, record in zip(workbook['Mounts'].iter_rows(min_row=2, max_row=23), self.mounts.values()):
                for column, field in enumerate(('nameSource', 'species', 'abilities', 'flatStatText', 'growthText', 'acquisition', 'communityNotes'), 1):
                    self.assertEqual(record[field]['text'], row[column - 1].value)
                    self.assertEqual(record[field]['source'], f'Mounts!{openpyxl.utils.get_column_letter(column)}{row[0].row}')
        finally:
            workbook.close()

    def test_wild_ornius_abilities_growths_and_acquisition(self):
        record = self.mounts['Wild Ornius']
        self.assertEqual(record['species']['text'], 'Ornius')
        self.assertEqual(record['abilities']['text'], 'Paired Run, Paired Stealth')
        self.assertEqual(record['numericGrowths']['Spd']['value'], 10)
        self.assertEqual(record['numericGrowths']['Dex']['value'], 15)
        self.assertEqual(record['acquisition']['text'], "Elissa Pass, Sparrow's Thoroughfare, Mount Ouranos, Faro Forest")
        self.assertEqual(record['numericGrowths']['HP']['value'], None)

    def test_wild_horse_numeric_contributions(self):
        growths = self.mounts['Wild Horse']['numericGrowths']
        self.assertEqual({stat: growths[stat]['value'] for stat in ('HP', 'Spd', 'Dex', 'Def', 'Res')},
                         dict(HP=5, Spd=5, Dex=5, Def=5, Res=5))
        self.assertIsNone(growths['Str']['value'])

    def test_bucephalus_and_foal_are_distinct_and_growths_reconcile(self):
        parent = self.mounts["Bucephalus (Alexandra's mount)"]
        foal = self.mounts["Bucephalus's Foal"]
        self.assertEqual(parent['species']['text'], 'Pegasus')
        self.assertEqual(parent['acquisition']['text'], 'Recruit Alexandra')
        self.assertIn("Alexandra recruited outside of Cai's Path", foal['acquisition']['text'])
        self.assertNotEqual(parent['source'], foal['source'])
        self.assertEqual(foal['growthComparison']['status'], 'consistent')
        self.assertEqual(foal['numericGrowths']['Str']['value'], 5)
        self.assertIsNone(foal['numericGrowths']['Mag']['value'])

    def test_elephant_is_single_record_with_part_three_uncertainty(self):
        record = self.mounts['Saramis War Elephant']
        self.assertEqual(record['species']['text'], 'Elephant')
        self.assertEqual(record['flatStatText']['text'], 'Str 5, Dex 5, Def 5, Lck 5')
        self.assertEqual(record['numericGrowths']['HP']['value'], 5)
        self.assertEqual(record['acquisition']['text'], "Part III Quest (may require Cai's path completed)")
        self.assertEqual(record['acquisition']['status'], 'unverified')
        self.assertTrue(any(issue['code'] == 'ambiguous_mount_acquisition' for issue in record['validation']))

    def test_meganius_conflict_keeps_both_versions_without_zero_filling(self):
        record = self.mounts['Meganius']
        self.assertEqual(record['growthComparison']['status'], 'conflict')
        self.assertEqual({entry['stat']: (entry['written'], entry['numeric']) for entry in record['growthComparison']['differences']},
                         {'Dex': (5, 15), 'Def': (15, None), 'Res': (None, 5)})
        self.assertEqual(record['parsed']['growths']['values']['Str'], 5)
        self.assertEqual(record['numericGrowths']['Str']['value'], 5)
        self.assertEqual(record['growthText']['text'], 'Str 5%, Def 15%, Dex 5% ')

    def test_independent_notes_and_alternative_warning_stay_unaltered(self):
        record = self.mounts['White Ornius']
        self.assertNotIn('Paired Alertness', record['abilities']['text'])
        self.assertEqual(record['communityNotes']['text'], 'Paired Alertness - Grants Ddg +5/10 ')
        self.assertEqual(self.data['mounts']['abilityWarning']['text'], '>>> Only one option, not both')
        self.assertEqual(self.data['mounts']['abilityWarning']['source'], 'Character Learnsets!I6')
        self.assertTrue(any('double the stats' in entry['text'] for entry in self.data['mounts']['sheetNotes']))

    def test_numeric_omission_zero_negative_and_over_100_are_distinct(self):
        def change(workbook):
            sheet = workbook['Mounts']
            sheet['H2'], sheet['I2'], sheet['J2'] = 0, -5, 125
        result, _, issues = self.changed(change)
        growths = result['records'][0]['numericGrowths']
        self.assertEqual([growths[stat]['value'] for stat in ('HP', 'Str', 'Mag', 'Def')], [0, -5, 125, None])
        self.assertEqual(growths['HP']['status'], 'unverified')
        self.assertEqual(growths['Def']['status'], 'unknown')
        self.assertFalse(any(issue['severity'] == 'error' for issue in issues))

    def test_missing_fields_and_ambiguous_conditions_warn_without_inventing_text(self):
        def change(workbook):
            for cell in ('C2', 'D2', 'E2', 'F2', 'G2'): workbook['Mounts'][cell] = None
        result, _, issues = self.changed(change)
        for field in ('abilities', 'flatStatText', 'growthText', 'acquisition', 'communityNotes'):
            self.assertIsNone(result['records'][0][field]['text'])
        self.assertTrue(any(issue['code'] == 'missing_mount_acquisition' for issue in issues))
        self.assertEqual(result['records'][0]['parsed']['growths']['state'], 'unknown')

    def test_missing_type_duplicate_name_and_bad_numeric_values_fail(self):
        for cell, value in [('B2', None), ('A3', ' wild   ORNIUS '), ('K2', '10'), ('K2', '=5+5'), ('K2', True), ('K2', '#VALUE!')]:
            _, _, issues = self.changed(lambda w: setattr(w['Mounts'][cell], 'value', value))
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues), (cell, value))

    def test_unknown_species_and_unsupported_parsing_are_retained_with_warnings(self):
        def change(workbook):
            workbook['Mounts']['B2'] = 'Dragon'
            workbook['Mounts']['E2'] = 'Spd 10% or 20%, Dex 15%'
        result, _, issues = self.changed(change)
        record = result['records'][0]
        self.assertEqual(record['species']['text'], 'Dragon')
        self.assertEqual(record['parsed']['growths']['state'], 'needs_review')
        self.assertIsNone(record['parsed']['growths']['values']['Spd'])
        self.assertTrue(any(issue['code'] == 'unrecognized_mount_type' for issue in issues))
        self.assertFalse(any(issue['severity'] == 'error' for issue in issues))
        parsed = parse_modifier_text('Str 2, Str 3', 'fixture', growth=False)
        self.assertEqual(parsed['state'], 'needs_review')

    def test_total_formulas_are_retained_without_evaluation(self):
        self.assertEqual(self.mounts['Wild Ornius']['totalGrowth'], dict(value=None, formula='=suM(H2:P2)', status='source_formula', source='Mounts!Q2'))
        _, _, issues = self.changed(lambda w: setattr(w['Mounts']['Q2'], 'value', '=SUM(H2:Z2)'))
        self.assertTrue(any(issue['code'] == 'invalid_mount_total' for issue in issues))

    def test_missing_sheet_bad_headers_missing_name_and_extra_records_fail(self):
        def extra(workbook):
            for col in range(1, 18):
                cell = workbook['Mounts'].cell(24, col)
                cell.value = workbook['Mounts'].cell(2, col).value if col < 17 else None
            workbook['Mounts']['A24'] = 'Extra Ornius'
        for change in [lambda w: w.remove(w['Mounts']), lambda w: setattr(w['Mounts']['K1'], 'value', 'Dex'),
                       lambda w: setattr(w['Mounts']['A2'], 'value', None), extra]:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_failed_mount_import_preserves_previous_frontend_json(self):
        workbook = fixture(self.data)
        workbook['Mounts']['K2'] = 'invalid'
        with tempfile.TemporaryDirectory(dir=ROOT / 'work') as directory:
            source, output, report = (Path(directory) / name for name in ('source.xlsx', 'data.json', 'report.json'))
            workbook.save(source)
            workbook.close()
            before = source.read_bytes()
            output.write_text('previous snapshot', encoding='utf8')
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                status = main(['--source', str(source), '--output', str(output), '--report', str(report)])
            self.assertEqual(status, 1)
            self.assertEqual(output.read_text(encoding='utf8'), 'previous snapshot')
            self.assertEqual(source.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
