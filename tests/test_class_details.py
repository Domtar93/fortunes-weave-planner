"""Workbook-backed class-detail regressions and dynamic row-discovery failures."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_data import import_workbook, main
from test_import_data import fixture


class ClassDetailTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.report = import_workbook(ROOT / 'data/source.xlsx')
        cls.classes = {profile['name']: profile for profile in cls.data['classes']}
        cls.scratch = ROOT / 'work/test-fixtures'
        cls.scratch.mkdir(parents=True, exist_ok=True)

    def run_fixture(self, change):
        workbook = fixture(self.data)
        change(workbook)
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            path = Path(directory) / 'classes.xlsx'
            workbook.save(path)
            workbook.close()
            return import_workbook(path)

    def test_gladiator_requirements_mastery_movement_and_separate_units(self):
        profile = self.classes['Gladiator']
        details = profile['details']
        self.assertEqual(details['license']['text'], 'Beginner')
        self.assertEqual(details['level']['text'], 'Lv. 5')
        self.assertEqual(details['renown']['text'], 'Lv. 1')
        self.assertEqual(details['masteryAbility']['text'], 'Attack Basics')
        self.assertEqual(details['masteryDescription']['text'], 'Grants Str +1.')
        self.assertEqual(details['movement']['value'], 4)
        self.assertEqual(details['mountType']['text'], 'No')
        self.assertEqual(profile['growths']['HP'], 10)
        self.assertEqual(profile['growths']['Str'], 10)
        self.assertEqual(details['flatStatBonuses']['HP']['value'], 1)
        self.assertEqual(details['flatStatBonuses']['Str']['value'], 1)

    def test_dancer_descriptions_and_multiline_restrictions_are_verbatim(self):
        details = self.classes['Dancer']['details']
        self.assertEqual(details['license']['text'], 'Advanced')
        self.assertEqual(details['level']['text'], 'Lv. 35')
        self.assertEqual(details['masteryAbility']['text'], 'Special Dance')
        self.assertEqual(details['masteryDescription']['text'],
                         'When using Dance, grants Dex/Spd +3 to target ally for the current phase.')
        self.assertEqual(details['abilities']['text'], 'Combat Arts +2, Dance')
        self.assertEqual(details['abilityDescriptions']['text'],
                         'Unit can equip +2 combat arts.\nAllows the use of the Dance combat art.')
        self.assertEqual(details['additionalUnlocks']['text'],
                         'Leda route: Complete Chapter 9 request "Great Dancer\'s Sucessor"\n\nLimited to only ONE unit at a time.')
        # Preserve this source inconsistency rather than guessing a correction.
        self.assertEqual(details['allowedWeaponsAndSkills']['text'], 'Sword, Bow, Battalions, Infantry')
        self.assertIsNone(details['proficiencyExperience']['Bow']['value'])
        self.assertEqual(details['proficiencyExperience']['Axe']['value'], 2)

    def test_armored_ornius_rider_keeps_mount_requirement_and_growth_dispute(self):
        profile = self.classes['Armored Ornius Rider']
        details = profile['details']
        self.assertEqual(details['license']['text'], 'Specialty')
        self.assertEqual(details['primaryRequirements']['text'], 'Riding: D')
        self.assertEqual(details['masteryAbility']['text'], 'Sense Threat')
        self.assertEqual(details['mountType']['text'], 'Ornius')
        self.assertEqual(profile['growths']['Spd'], 10)
        self.assertEqual(profile['growths']['Dex'], 5)
        self.assertEqual(profile['growths']['Mag'], -5)
        self.assertIn('DATA-12', profile['notes'][0])

    def test_avatar_has_all_detail_groups_and_correct_final_row_sources(self):
        details = self.classes['The Avatar']['details']
        self.assertEqual(details['masteryAbility']['text'], 'Divine Law')
        self.assertEqual(details['level']['text'], 'Lv. 45')
        self.assertIn('Lotus of Reincarnation', details['additionalUnlocks']['text'])
        self.assertIn('Multiplies black magic and white magic uses by 3.', details['abilityDescriptions']['text'])
        self.assertEqual(details['flatStatBonuses']['Mag']['value'], 9)
        self.assertEqual(details['mountType']['source'], 'Classes!BA61')
        self.assertEqual(len(details['proficiencyExperience']), 12)
        self.assertEqual(len(details['flatStatBonuses']), 9)
        self.assertEqual(len(self.data['classes']), 59)

    def test_xp_blank_zero_and_positive_have_distinct_meaning(self):
        xp = self.classes['Gladiator']['details']['proficiencyExperience']
        self.assertEqual(xp['Authority'], {'value': 0, 'status': 'unverified', 'source': 'Classes!T4'})
        self.assertEqual(xp['Spear'], {'value': None, 'status': 'unavailable', 'source': 'Classes!N4'})
        self.assertEqual(xp['Sword']['value'], 1)
        self.assertEqual(sum(len(c['details']['proficiencyExperience']) for c in self.data['classes']), 708)
        self.assertEqual(sum(v['value'] is None for c in self.data['classes']
                             for v in c['details']['proficiencyExperience'].values()), 455)

    def test_missing_descriptions_flat_bonuses_and_movement_remain_unknown(self):
        def change(w):
            for coordinate in ('H4', 'J4', 'AI4', 'AZ4', 'BA4'):
                w['Classes'][coordinate] = None
        data, report = self.run_fixture(change)
        self.assertEqual(report['status'], 'passed')
        details = next(c for c in data['classes'] if c['name'] == 'Gladiator')['details']
        for field in (details['masteryDescription'], details['abilityDescriptions'],
                      details['flatStatBonuses']['Str'], details['movement'], details['mountType']):
            self.assertEqual(field['status'], 'unknown')
        self.assertIsNone(details['flatStatBonuses']['Str']['value'])

    def test_class_text_preserves_leading_trailing_whitespace_and_line_breaks(self):
        raw = '  Route condition\n\nOne unit only.  '
        data, report = self.run_fixture(lambda w: w['Classes'].__setitem__('K4', raw))
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(next(c for c in data['classes'] if c['name'] == 'Gladiator')['details']['additionalUnlocks']['text'], raw)

    def test_discovers_avatar_after_row_62_without_hard_coded_range(self):
        def change(w):
            sheet = w['Classes']
            for column in range(1, 54):
                sheet.cell(90, column).value = sheet.cell(61, column).value
                sheet.cell(61, column).value = None
            sheet['F67'] = 'Workbook research annotation before the relocated class'
        data, report = self.run_fixture(change)
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(len(data['classes']), 59)
        self.assertEqual(report['classes']['lastNamedRow'], 90)
        self.assertEqual(report['classes']['annotationRows'], [67])
        avatar = next(c for c in data['classes'] if c['name'] == 'The Avatar')
        self.assertEqual(avatar['details']['mountType']['source'], 'Classes!BA90')
        self.assertEqual(avatar['details']['flatStatBonuses']['Mag']['value'], 9)

    def test_new_complete_class_after_range_is_counted_and_count_mismatch_flagged(self):
        def change(w):
            sheet = w['Classes']
            for column in range(1, 54): sheet.cell(80, column).value = sheet.cell(4, column).value
            sheet['A80'] = 'Additional test class'
        data, report = self.run_fixture(change)
        self.assertEqual(len(data['classes']), 60)
        self.assertEqual(report['classes']['lastNamedRow'], 80)
        self.assertEqual(report['status'], 'failed')
        self.assertTrue(any(issue['code'] == 'count_mismatch' and issue['location'] == 'classes'
                            for issue in report['issues']))

    def test_unnamed_structured_tail_row_is_flagged_but_footer_annotations_retained(self):
        self.assertEqual([note['source'] for note in self.report['classes']['sheetNotes']],
                         ['Classes!F67', 'Classes!F68', 'Classes!F69'])
        _, report = self.run_fixture(lambda w: w['Classes'].__setitem__('Y80', 10))
        self.assertEqual(report['status'], 'failed')
        self.assertTrue(any(issue['code'] == 'invalid_name' and issue['location'] == 'Classes!A80'
                            for issue in report['issues']))

    def test_duplicate_class_and_shifted_detail_headers_are_rejected(self):
        _, report = self.run_fixture(lambda w: w['Classes'].__setitem__('A5', 'gladiator'))
        self.assertTrue(any(issue['code'] == 'duplicate_name' for issue in report['issues']))
        for coordinate in ('H2', 'M2', 'AH2', 'AZ2', 'BA2'):
            with self.subTest(coordinate=coordinate):
                _, report = self.run_fixture(lambda w: w['Classes'].__setitem__(coordinate, 'Wrong header'))
                self.assertEqual(report['status'], 'failed')
                self.assertTrue(any(issue['code'] == 'invalid_class_schema' for issue in report['issues']))

    def test_malformed_xp_flat_movement_and_descriptions_fail_validation(self):
        for coordinate, value in [('M4', -1), ('M4', '0'), ('M4', True), ('AH4', '=1+2'),
                                   ('AH4', '.'), ('AZ4', 'four'), ('H4', 123)]:
            with self.subTest(coordinate=coordinate, value=value):
                _, report = self.run_fixture(lambda w: w['Classes'].__setitem__(coordinate, value))
                self.assertEqual(report['status'], 'failed')
                self.assertTrue(any(issue['location'] == f'Classes!{coordinate}' for issue in report['issues']))

    def test_incomplete_base_stats_are_not_imported_or_used(self):
        def change(w):
            for column in range(43, 52): w['Classes'].cell(4, column).value = 'WIP: not a usable stat'
        data, report = self.run_fixture(change)
        self.assertEqual(report['status'], 'passed')
        profile = next(c for c in data['classes'] if c['name'] == 'Gladiator')
        self.assertEqual(profile, self.classes['Gladiator'])
        self.assertNotIn('baseStats', profile['details'])

    def test_failed_class_detail_import_preserves_previous_json(self):
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            root = Path(directory)
            source, output, report_path = [root / name for name in ('bad.xlsx', 'growths.json', 'report.json')]
            w = fixture(self.data)
            w['Classes']['M4'] = 'unverified text, not a number'
            w.save(source)
            w.close()
            output.write_text('previous valid snapshot', encoding='utf-8')
            before = source.read_bytes()
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = main(['--source', str(source), '--output', str(output), '--report', str(report_path)])
            self.assertEqual(code, 1)
            self.assertEqual(output.read_text(encoding='utf-8'), 'previous valid snapshot')
            self.assertEqual(json.loads(report_path.read_text(encoding='utf-8'))['status'], 'failed')
            self.assertEqual(source.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
