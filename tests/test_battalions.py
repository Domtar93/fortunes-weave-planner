"""Battalion reference integrity, distribution controls and all-or-nothing flat parsing."""
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
from import_battalions import read_battalions, parse_battalion_stats
from import_data import read_source_text, main
from test_import_data import fixture


class BattalionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.records = {record['name']: record for record in cls.data['battalions']['records']}

    def changed(self, change):
        workbook = fixture(self.data)
        change(workbook)
        issues = []
        result, counts = read_battalions(workbook, self.data['classes'], issues, read_text=read_source_text)
        workbook.close()
        return result, counts, issues

    def test_counts_distributions_and_class_support_audit(self):
        _, counts, issues = self.changed(lambda w: None)
        self.assertEqual(counts['imported'], 69)
        self.assertEqual(counts['categories'], dict(Physical=18, Defense=18, Support=17, Magical=16))
        self.assertEqual(counts['authorityRanks'], dict(E=10, D=13, C=15, B=16, A=15))
        self.assertEqual(counts['gatherLimits'], {'8': 10, '10': 13, '14': 15, '18': 16, '22': 15})
        self.assertEqual(counts['classSupport'], dict(listedUnmounted=39, notListedMounted=20, otherOrUnknown=0))
        self.assertEqual(counts['parsedStats'], {'parsed': 69})
        self.assertEqual(issues, [])
        self.assertEqual(len({record['id'] for record in self.records.values()}), 69)

    def test_all_raw_source_fields_and_unicode_are_preserved(self):
        workbook = openpyxl.load_workbook(ROOT / 'data/source.xlsx', read_only=True)
        try:
            for row in workbook['Battalions'].iter_rows(min_row=2, max_row=70, max_col=7):
                record = self.records[row[0].value]
                for key, column in [('nameSource', 1), ('category', 2), ('authorityRank', 3), ('ability', 5), ('flatStatText', 6), ('acquisition', 7)]:
                    self.assertEqual(record[key]['text'], row[column - 1].value)
                    self.assertEqual(record[key]['source'], f'Battalions!{openpyxl.utils.get_column_letter(column)}{row[0].row}')
                self.assertEqual(record['reliability'], 'unverified')
                self.assertNotIn('notes', record)
        finally:
            workbook.close()
        self.assertIn('Mahón', self.records['Bronze-Shield Guard']['acquisition']['text'])
        self.assertIn('Aurora´s Stargazers', self.records)

    def test_bronze_shield_guard_full_reference(self):
        record = self.records['Bronze-Shield Guard']
        self.assertEqual((record['category']['text'], record['authorityRank']['text'], record['gatherLimit']['value']), ('Defense', 'E', 8))
        self.assertEqual(record['ability']['text'], 'Tri-Front Formation')
        self.assertEqual(record['parsedStats']['values']['Def'], 2)
        self.assertEqual(record['parsedStats']['values']['Cha'], 3)
        self.assertIsNone(record['parsedStats']['values']['HP'])
        self.assertEqual(record['acquisition']['text'], 'Da Mina, Breston, Alecto, Mahón Castle Town, Mons, Bombae, Kassite, Grand Aragon, Megaira, Messalina Orchards, Aguiño, Callianera Port, Port of Pandora, Twalinn, Zoste, Barsk Post Town, Shama Port, Whill, Benetnasch')

    def test_mage_pupils_priest_alias_and_bai_ze(self):
        mage, priest, bai = (self.records[name] for name in ('Mage Pupils', 'Priest Trainees', 'Bai Ze Squad'))
        self.assertEqual((mage['category']['text'], mage['authorityRank']['text'], mage['ability']['text']), ('Magical', 'E', 'Scattered Flames'))
        self.assertEqual((mage['parsedStats']['values']['Mag'], mage['parsedStats']['values']['Cha']), (2, 2))
        self.assertEqual((priest['category']['text'], priest['authorityRank']['text'], priest['ability']['text']), ('Support', 'E', 'Splash Recover'))
        self.assertEqual(priest['flatStatText']['text'], 'Res+1 Luck +1 Cha +3')
        self.assertEqual(priest['parsedStats']['values']['Lck'], 1)
        self.assertEqual((bai['category']['text'], bai['authorityRank']['text'], bai['gatherLimit']['value'], bai['ability']['text']), ('Support', 'A', 22, 'Column Recovery+'))
        self.assertEqual({stat: bai['parsedStats']['values'][stat] for stat in ('Mag', 'Res', 'Lck', 'Cha')}, dict(Mag=3, Res=3, Lck=2, Cha=8))

    def test_compact_stat_tokens_all_nine_keys_and_explicit_zero(self):
        raw = 'HP+12 Str -2 Mag+2 Spd+0 Dex +3 Def+4 Res +5 Luck+6 Cha+7'
        result = parse_battalion_stats(raw, 'fixture')
        self.assertEqual(result['state'], 'parsed')
        self.assertEqual(result['values'], dict(HP=12, Str=-2, Mag=2, Spd=0, Dex=3, Def=4, Res=5, Lck=6, Cha=7))
        self.assertEqual(parse_battalion_stats('Mag+2, Cha+3', 'fixture')['values']['Mag'], 2)
        self.assertEqual(parse_battalion_stats('HP125.5', 'fixture')['values']['HP'], 125.5)

    def test_missing_ambiguous_and_duplicate_stats_expose_no_partial_numbers(self):
        for raw in (None, '', '?', 'Mag+2 or +4', 'Mag+2 Cha+?', 'Luck+2 Lck+3', 'Mag+2%', 'Mag+2 unexplained'):
            result = parse_battalion_stats(raw, 'fixture')
            self.assertIn(result['state'], ('unknown', 'unresolved'))
            self.assertTrue(all(value is None for value in result['values'].values()))
        result, _, issues = self.changed(lambda w: setattr(w['Battalions']['F5'], 'value', 'Mag+2 or +4'))
        self.assertEqual(result['records'][3]['flatStatText']['text'], 'Mag+2 or +4')
        self.assertTrue(any(issue['code'] == 'unresolved_battalion_stats' for issue in issues))
        self.assertFalse(any(issue['severity'] == 'error' for issue in issues))

    def test_general_reference_cells_remain_independent(self):
        notes = {entry['source']: entry['value'] for entry in self.data['battalions']['generalNotes']}
        self.assertIn('Physical (Sword)', notes['Battalions!K3'])
        self.assertEqual(notes['Battalions!J17'], 8)
        self.assertEqual(notes['Battalions!K17'], 10)
        self.assertIn('*inflicts* poison', notes['Battalions!I36'])
        self.assertNotIn('poison', str(self.records['Alecto Morningstars']).lower())

    def test_stable_ids_survive_row_reordering(self):
        def change(workbook):
            sheet = workbook['Battalions']
            first, second = [sheet.cell(2, col).value for col in range(1, 8)], [sheet.cell(3, col).value for col in range(1, 8)]
            for col, (a, b) in enumerate(zip(first, second), 1):
                sheet.cell(2, col, b)
                sheet.cell(3, col, a)
        result, _, issues = self.changed(change)
        self.assertEqual(result['records'][1]['id'], self.records['Bronze-Shield Guard']['id'])
        self.assertEqual(result['records'][1]['source']['row'], 3)
        self.assertEqual(issues, [])

    def test_duplicate_missing_name_bad_gather_and_missing_classifications_fail(self):
        for cell, value in [('A3', ' bronze-shield   GUARD '), ('A2', None), ('B2', None), ('C2', 'S'),
                            ('D2', '8'), ('D2', '=8'), ('D2', True), ('D2', 9), ('D2', None)]:
            _, _, issues = self.changed(lambda w: setattr(w['Battalions'][cell], 'value', value))
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues), (cell, value))

    def test_distribution_mismatches_missing_sheet_and_bad_headers_fail(self):
        for change in [lambda w: setattr(w['Battalions']['B2'], 'value', 'Physical'),
                       lambda w: setattr(w['Battalions']['C2'], 'value', 'D'),
                       lambda w: setattr(w['Battalions']['D2'], 'value', 10),
                       lambda w: w.remove(w['Battalions']), lambda w: setattr(w['Battalions']['F1'], 'value', 'Growths')]:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_missing_fields_ambiguous_acquisition_and_nonliteral_text(self):
        def change(workbook):
            workbook['Battalions']['E2'], workbook['Battalions']['F2'], workbook['Battalions']['G2'] = None, None, 'May require route completion?'
        result, _, issues = self.changed(change)
        self.assertIsNone(result['records'][0]['ability']['text'])
        self.assertEqual(result['records'][0]['parsedStats']['state'], 'unknown')
        self.assertTrue(any(issue['code'] == 'ambiguous_battalion_acquisition' for issue in issues))
        for cell, value in [('E2', 3), ('F2', '=1+1'), ('G2', '#VALUE!')]:
            _, _, issues = self.changed(lambda w: setattr(w['Battalions'][cell], 'value', value))
            self.assertTrue(any(issue['code'] == 'invalid_battalion_text' for issue in issues))

    def test_failed_battalion_import_preserves_snapshot_and_workbook(self):
        workbook = fixture(self.data)
        workbook['Battalions']['D2'] = 'bad'
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
