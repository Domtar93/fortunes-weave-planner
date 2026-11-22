"""Offline base-stat provenance, validation, coverage and reproducibility."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_character_bases import build_bases, generate, read_research, read_serenes


class CharacterBasesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.research = json.loads((ROOT / 'data/base-stats/research-sheet.json').read_text(encoding='utf-8'))
        cls.html = (ROOT / 'data/base-stats/serenes-base-stats.html').read_text(encoding='utf-8')
        cls.names = [r['name'] for r in json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf-8'))['characters']]
        cls.data = build_bases(cls.research, cls.html, cls.names)
        cls.records = {r['name']: r for r in cls.data['characters']}

    def test_all_existing_profiles_have_nine_documented_bases(self):
        self.assertEqual([r['name'] for r in self.data['characters']], self.names)
        self.assertEqual(len(self.records), 64)
        self.assertEqual(self.data['counts']['uniqueCharacters'], 63)
        for record in self.records.values():
            self.assertEqual(len(record['stats']), 9)
            self.assertEqual(record['level'], 1)
            self.assertTrue(record['sources'])

    def test_primary_and_supplemental_coverage(self):
        self.assertEqual(self.data['counts']['researchCharacters'], 54)
        self.assertEqual(sum(len(r['sources']) == 1 for r in self.records.values()), 9)

    def test_known_character_bases(self):
        self.assertEqual(self.records['Alexandra']['stats']['HP'], 24)
        self.assertEqual(self.records['Alexandra']['stats']['Str'], 7)
        self.assertEqual(self.records['Sofia']['stats']['Mag'], 11)

    def test_mu_variants_are_distinct_records_with_shared_bases(self):
        self.assertEqual(self.records['Mu']['stats'], self.records['Mu (with growth)']['stats'])
        self.assertIsNot(self.records['Mu']['stats'], self.records['Mu (with growth)']['stats'])
        self.assertIn('level-up growth only', self.records['Mu (with growth)']['profileNote'])

    def test_disagreement_preserves_primary_and_alternative(self):
        self.assertEqual(self.records['Bonaventure']['stats']['Spd'], 7)
        self.assertEqual(self.records['Bonaventure']['conflicts'][0]['alternative'], 6)
        self.assertEqual(sum(len(r['conflicts']) for r in self.records.values()), 1)

    def test_repeated_headers_and_npc_tables_do_not_become_characters(self):
        records, headers = read_serenes(self.html)
        self.assertEqual(headers, 3)
        self.assertEqual(len(records), 63)
        self.assertNotIn('Name', records)
        self.assertNotIn('Aurora', records)

    def test_duplicate_names_are_rejected(self):
        snapshot = copy.deepcopy(self.research)
        snapshot['values'].append(snapshot['values'][1])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            read_research(snapshot)
        duplicate_html = self.html.replace('<td>Eshmel</td>', '<td>Alexandra</td>', 1)
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            read_serenes(duplicate_html)

    def test_missing_malformed_and_negative_numbers_are_rejected(self):
        for value in (None, '', '24', True, -1, 2.5):
            with self.subTest(value=value):
                snapshot = copy.deepcopy(self.research)
                snapshot['values'][1][2] = value
                with self.assertRaisesRegex(ValueError, 'malformed'):
                    read_research(snapshot)

    def test_wrong_level_and_headers_are_rejected(self):
        snapshot = copy.deepcopy(self.research)
        snapshot['values'][1][1] = 21
        with self.assertRaisesRegex(ValueError, 'level 1'):
            read_research(snapshot)
        snapshot['values'][0][2] = 'Growth'
        with self.assertRaisesRegex(ValueError, 'headers'):
            read_research(snapshot)

    def test_missing_baseline_is_never_inferred(self):
        names = self.names.copy()
        names[0] = 'Unrecorded character'
        with self.assertRaisesRegex(ValueError, 'missing published'):
            build_bases(self.research, self.html, names)

    def test_level_one_context_is_required(self):
        with self.assertRaisesRegex(ValueError, 'level 1'):
            read_serenes(self.html.replace('These are the Level 1 stats', 'Unknown level stats'))

    def test_fresh_json_and_read_only_generation(self):
        paths = [ROOT / 'data/source.xlsx', ROOT / 'src/data/growths.json', ROOT / 'data/base-stats/research-sheet.json', ROOT / 'data/base-stats/serenes-base-stats.html']
        before = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
        self.assertEqual(generate(), (ROOT / 'src/data/character-bases.json').read_text(encoding='utf-8'))
        self.assertEqual(before, [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths])


if __name__ == '__main__':
    unittest.main()
