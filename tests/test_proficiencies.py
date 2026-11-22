"""Original rank columns, matrix evidence, and uncertainty must survive import intact."""
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_proficiencies import read_proficiencies, entry_state
from test_import_data import fixture


class ProficiencyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.proficiency = cls.data['proficiencies']

    def entries(self, category, name='Alexandra'):
        return {value['rank']: value for value in self.proficiency['categories'][category]['characters'][name]}

    def changed(self, change):
        workbook = fixture(self.data)
        change(workbook)
        issues = []
        result, counts = read_proficiencies(workbook, self.data['characters'], issues)
        workbook.close()
        return result, counts, issues

    def test_all_categories_identities_and_source_rank_cells(self):
        categories = self.proficiency['categories']
        self.assertEqual(len(categories), 12)
        expected = {profile['name'] for profile in self.data['characters']} - {'Mu (with growth)'}
        self.assertEqual(len(expected), 63)
        self.assertEqual(sum(len(entries) for category in categories.values() for entries in category['characters'].values()), 4284)
        for category in categories.values():
            self.assertEqual(set(category['characters']), expected)
            for entries in category['characters'].values():
                self.assertEqual([entry['rank'] for entry in entries], category['ranks'])
                self.assertTrue(all(entry['source'] and entry['matrixSource'] for entry in entries))

    def test_alexandra_sword_exact_unlocks_and_unknown_s(self):
        entries = self.entries('Sword')
        self.assertEqual({rank: entry['text'] for rank, entry in entries.items()},
                         {'D': 'Haze Slice', 'C': 'Rend Armor', 'B': 'Gale Blow', 'A': 'Lunging Gale', 'S': None, 'S+': 'Swordfaire'})
        self.assertEqual(entries['S']['state'], 'unknown')
        self.assertEqual(entries['S+']['source'], "'Sword'!G2")

    def test_flying_intermediate_ranks_and_explicit_na(self):
        entries = self.entries('Flying')
        self.assertEqual(list(entries), ['D', 'C+', 'B', 'A', 'S', 'S+'])
        self.assertEqual([entries[rank]['text'] for rank in ('D', 'C+', 'B', 'A', 'S')],
                         ['Read the Winds', 'Flitting Flier', 'N/A', 'Airfighter', 'Flitting Flier+'])
        self.assertEqual(entries['B']['state'], 'unavailable')
        self.assertEqual(entries['S+']['state'], 'unknown')

    def test_riding_does_not_shift_vanguard_to_c(self):
        entries = self.entries('Riding')
        self.assertEqual(list(entries), ['D', 'C', 'C+', 'B', 'A', 'S', 'S+'])
        self.assertEqual(entries['D']['text'], 'Knightly Senses')
        self.assertEqual(entries['C+']['text'], 'Vanguard')
        for rank in ('C', 'B'): self.assertEqual(entries[rank]['state'], 'unavailable')
        self.assertEqual(entries['A']['state'], 'unknown')

    def test_mu_mapping_is_only_alias_and_preserves_distinct_growths(self):
        self.assertEqual(self.proficiency['profileMapping'], {'Mu (with growth)': 'Mu'})
        mu = {profile['name']: profile for profile in self.data['characters'] if profile['name'].startswith('Mu')}
        self.assertNotEqual(mu['Mu']['growths'], mu['Mu (with growth)']['growths'])
        self.assertNotIn('Mu (with growth)', self.proficiency['categories']['Sword']['characters'])

    def test_compound_and_placeholder_text_is_not_split_or_shifted(self):
        self.assertEqual(self.entries('Spear', 'Eshmel')['A']['text'], 'Graceful Blow\n(A+), Frozen Spear\n(A+)')
        self.assertEqual(self.entries('Spear', 'Eshmel')['A']['state'], 'compound')
        self.assertEqual(self.entries('Reason', 'Anatolia')['D']['text'], 'Fire/Wandering Wall')
        self.assertEqual(self.entries('Axe', 'Tobias')['D']['state'], 'compound')
        self.assertEqual(self.entries('Sword', 'Halvin')['S']['state'], 'placeholder')
        for raw, expected in [(None, 'unknown'), (' ', 'unknown'), ('N/A', 'unavailable'), ('?', 'placeholder'),
                               ('Ability?', 'placeholder'), ('One/Two', 'compound'), ('One\nTwo', 'compound')]:
            self.assertEqual(entry_state(raw, 'Community-listed / unverified'), expected)

    def test_glossary_missing_effects_stay_missing_and_evidence_is_preserved(self):
        glossary = self.proficiency['glossary']
        self.assertEqual(len(glossary), 322)
        self.assertEqual(sum(bool(value['description']) for value in glossary.values()), 8)
        self.assertFalse(glossary['Haze Slice']['description'])
        self.assertEqual(glossary['Flitting Flier']['evidence'], 'Unofficial guide; unverified')
        self.assertIn('mount-bond ability', glossary['Flitting Flier']['note'])

    def test_whitespace_differences_preserve_both_source_versions(self):
        entry = self.entries('Faith', 'Dietrich')['B']
        self.assertEqual(entry['text'], ' Silence')
        self.assertEqual(entry['matrixText'], 'Silence')
        blank = self.entries('Infantry', 'Fianna')['C']
        self.assertEqual(blank['text'], ' ')
        self.assertEqual(blank['state'], 'unknown')

    def test_duplicate_matrix_and_missing_records_are_rejected(self):
        for change in [lambda w: w['Proficiency Matrix'].append([w['Proficiency Matrix'].cell(2, col).value for col in range(1, 9)]),
                       lambda w: w['Proficiency Matrix'].delete_rows(2)]:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_source_mismatch_and_alias_are_rejected(self):
        for sheet, address, value in [('Proficiency Matrix', 'D2', 'Invented'), ('Sword', 'A2', 'Alex'),
                                       ('Proficiency Matrix', 'F2', "'Sword'!C2")]:
            _, _, issues = self.changed(lambda w: setattr(w[sheet][address], 'value', value))
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_rank_header_and_evidence_conflicts_are_rejected(self):
        for sheet, address, value in [('Flying', 'C1', 'C'), ('Sword', 'C1', 'D'),
                                      ('Proficiency Matrix', 'E2', 'Confirmed'), ('Proficiency Coverage', 'D2', 999)]:
            _, _, issues = self.changed(lambda w: setattr(w[sheet][address], 'value', value))
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_missing_sheets_and_nonliteral_unlocks_are_rejected(self):
        _, _, issues = self.changed(lambda w: w.remove(w['Ability Glossary']))
        self.assertTrue(any(issue['code'] == 'missing_sheet' for issue in issues))
        for value in (42, '=1+1', '#VALUE!'):
            _, _, issues = self.changed(lambda w: setattr(w['Sword']['B2'], 'value', value))
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))

    def test_malformed_glossary_and_duplicate_raw_names_are_rejected(self):
        for change in [lambda w: setattr(w['Ability Glossary']['C2'], 'value', 'many'),
                       lambda w: setattr(w['Ability Glossary']['D2'], 'value', '=1+1'),
                       lambda w: setattr(w['Ability Glossary']['A3'], 'value', '?')]:
            _, _, issues = self.changed(change)
            self.assertTrue(any(issue['severity'] == 'error' for issue in issues))


if __name__ == '__main__':
    unittest.main()
