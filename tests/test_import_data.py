"""Real-source regression checks plus disposable malformed-workbook fixtures."""
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
from import_data import STATS, import_workbook, main, parse_growth, read_profiles


def fixture(data):
    w = openpyxl.Workbook()
    w.remove(w.active)
    for title, key, column in [('Characters', 'characters', 2), ('Classes', 'classes', 25)]:
        s = w.create_sheet(title)
        s.cell(2, 1, 'Name')
        for index, stat in enumerate(STATS):
            s.cell(2, column + index, stat)
        for profile in data[key]:
            row = profile['source']['row']
            s.cell(row, 1, profile['name'])
            if profile['name'] != 'Commoner / Noble':
                for index, stat in enumerate(STATS):
                    s.cell(row, column + index, profile['growths'][stat])
    s = w['Classes']
    s['L1'] = 'Allowed Weapons and Skills'
    for column, header in enumerate(('License', 'Level', 'Renown', 'Primary Skills', 'Secondary Skills',
                                     'Mastery Ability', 'Description', 'Class Abilities', 'Description', 'Additional Unlock Req'), 2):
        s.cell(2, column, header)
    for column, header in enumerate(('Sword', 'Spear', 'Axe', 'Bow', 'Gauntlets', 'B. Magic', 'W. Magic',
                                     'Authority', 'Infantry', 'Riding', 'H. Armor', 'Flying'), 13):
        s.cell(2, column, header)
    for column, header in enumerate(STATS, 34): s.cell(2, column, header)
    s['AZ2'], s['BA2'] = 'Mov', 'Mount'
    for profile in data['classes']:
        fields = []
        for value in profile['details'].values():
            fields.extend(value.values() if 'source' not in value else [value])
        for field in fields:
            s[field['source'].split('!')[1]] = field.get('text', field.get('value'))
    s = w['Characters']
    for column, header in enumerate(('Inherent ability', 'Equippable ability/abilities',
                                      "Cai's Path", "Dietrich's Path", "Theodora's Path", "Leda's Path"), 23):
        s.cell(2, column, header)
    for profile in data['characters']:
        values = [profile['personal'][key]['text'] for key in ('inherent', 'equippable')]
        values += [profile['recruitment'][route]['text'] for route in ('Cai', 'Dietrich', 'Theodora', 'Leda')]
        for column, value in enumerate(values, 23):
            s.cell(profile['source']['row'], column, value)
    for index, value in enumerate(('Name', *STATS), 1):
        s.cell(42, index, value)
    w.create_sheet('Research Queue').append(['ID', 'Priority', 'Area', 'Location', 'Finding', 'Confidence', 'Status'])
    s = w.create_sheet('Character Learnsets')
    for index, col in enumerate(range(25, 34), 4):
        letter = openpyxl.utils.get_column_letter(col)
        s.cell(27, index, f'=sumif(Classes!$A:$A,$D$4,Classes!{letter}:{letter})')
    # Recreate the reconciled proficiency sources for all existing malformed-workbook tests.
    from import_proficiencies import MATRIX_HEADERS, COVERAGE_HEADERS, GLOSSARY_HEADERS
    proficiency = data['proficiencies']
    matrix = w.create_sheet('Proficiency Matrix')
    matrix.append(MATRIX_HEADERS)
    for category, content in proficiency['categories'].items():
        sheet = w.create_sheet(category)
        for rank, source in zip(content['ranks'], content['rankSources']):
            sheet[source.split('!')[1]] = rank
        for name, entries in content['characters'].items():
            for entry in entries:
                address = entry['source'].split('!')[1]
                sheet[address] = entry['text']
                sheet.cell(openpyxl.utils.cell.coordinate_from_string(address)[1], 1, name)
                row = int(entry['matrixSource'].split('!A')[1].split(':')[0])
                for col, value in enumerate((name, category, entry['rank'], entry['matrixText'], entry['evidence'],
                                              entry['source'], entry['note'], entry['sourceUrl']), 1):
                    matrix.cell(row, col, value)
    coverage = w.create_sheet('Proficiency Coverage')
    coverage.append(COVERAGE_HEADERS)
    for record in proficiency['coverage']: coverage.append(record['values'])
    glossary = w.create_sheet('Ability Glossary')
    glossary.append(GLOSSARY_HEADERS)
    for record in proficiency['glossary'].values():
        glossary.append([record[key] for key in ('name', 'proficiencies', 'occurrences', 'description',
                                                'evidence', 'example', 'note', 'reference')])
    from import_mounts import HEADERS, TEXT_COLUMNS
    mounts = w.create_sheet('Mounts')
    for column, header in enumerate(HEADERS, 2): mounts.cell(1, column, header)
    for record in data['mounts']['records']:
        row = int(record['source'].split('!A')[1].split(':')[0])
        for key, column in TEXT_COLUMNS.items(): mounts.cell(row, column, record[key]['text'])
        for entry in record['numericGrowths'].values(): mounts[entry['source'].split('!')[1]] = entry['value']
        total = record['totalGrowth']
        mounts[total['source'].split('!')[1]] = total['formula'] if total['formula'] is not None else total['value']
    for entry in data['mounts']['sheetNotes']: mounts[entry['source'].split('!')[1]] = entry['text']
    warning = data['mounts']['abilityWarning']
    if warning: w['Character Learnsets']['I6'] = warning['text']
    from import_battalions import HEADERS as BATTALION_HEADERS, TEXT_COLUMNS as BATTALION_TEXT_COLUMNS
    battalions = w.create_sheet('Battalions')
    battalions.append(BATTALION_HEADERS)
    for record in data['battalions']['records']:
        row = record['source']['row']
        for key, column in BATTALION_TEXT_COLUMNS.items(): battalions.cell(row, column, record[key]['text'])
        battalions.cell(row, 4, record['gatherLimit']['value'])
    for note in data['battalions']['generalNotes']: battalions[note['source'].split('!')[1]] = note['value']
    # Include the new reference source so all pre-existing malformed fixtures remain complete.
    from import_scrolls import HEADERS as SCROLL_HEADERS, NUMBER_COLUMNS
    scrolls = w.create_sheet('Magic Scrolls')
    scrolls.append(SCROLL_HEADERS)
    for record in data['magicScrolls']['records']:
        fields = [record[key] for key in ('nameSource', 'tome', 'range', 'description', *NUMBER_COLUMNS)]
        fields += list(record['acquisition'].values())
        for field in fields: scrolls[field['source'].split('!')[1]] = field['raw']
    for note in data['magicScrolls']['generalNotes']: scrolls[note['source'].split('!')[1]] = note['raw']
    from import_dungeons import HEADERS as DUNGEON_HEADERS
    dungeons = w.create_sheet('Dungeon Chests')
    dungeons.append(DUNGEON_HEADERS)
    for record in data['dungeons']['records']:
        dungeons.cell(record['source']['row'], 1, record['name'])
        for chest in record['chests']: dungeons[chest['source'].split('!')[1]] = chest['raw']
        for note in record['notes']: dungeons[note['source'].split('!')[1]] = note['raw']
    for note in data['dungeons']['generalNotes']: dungeons[note['source'].split('!')[1]] = note['raw']
    from datetime import datetime
    from import_forging import HEADERS as FORGING_HEADERS, COLUMNS as FORGING_COLUMNS
    forging = w.create_sheet('Forging')
    forging.append(FORGING_HEADERS)
    for record in data['forging']['records'] + data['forging']['preliminary']:
        for key in FORGING_COLUMNS:
            field = record[key]
            cell = forging[field['source'].split('!')[1]]
            cell.value = datetime.fromisoformat(field['raw']) if field['rawType'] == 'd' else field['raw']
            if field['numberFormat'] is not None: cell.number_format = field['numberFormat']
    for note in data['forging']['generalNotes']: forging[note['source'].split('!')[1]] = note['raw']
    return w


class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = ROOT / 'work/test-fixtures'
        cls.scratch.mkdir(parents=True, exist_ok=True)
        cls.source = ROOT / 'data/source.xlsx'
        cls.before = hashlib.sha256(cls.source.read_bytes()).hexdigest()
        cls.data, cls.report = import_workbook(cls.source)

    def run_fixture(self, change):
        w = fixture(self.data)
        change(w)
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            path = Path(directory) / 'fixture.xlsx'
            w.save(path)
            w.close()
            return import_workbook(path)

    def test_expected_counts_reconcile_with_named_source_rows(self):
        self.assertEqual(self.report['status'], 'passed')
        self.assertEqual(self.report['importedCounts'], {'characters': 64, 'classes': 59})
        self.assertEqual(self.report['characters']['namedRows'], 64)
        self.assertEqual(self.report['classes']['namedRows'], 59)
        self.assertEqual(self.report['characters']['repeatedHeaders'], 1)
        self.assertEqual(self.report['classes']['blankRows'], 0)
        self.assertEqual(self.report['classes']['lastNamedRow'], 61)
        self.assertEqual(self.report['classes']['lastPopulatedRow'], 69)
        self.assertEqual(len(self.report['classes']['sheetNotes']), 3)
        self.assertFalse(any(i['severity'] == 'error' for i in self.report['issues']))

    def test_source_hash_and_committed_json_match_read_only_import(self):
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), self.before)
        self.assertEqual(self.report['sourceSha256'], self.before)
        self.assertEqual(json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf-8')), self.data)

    def test_required_source_values(self):
        characters = {p['name']: p['growths'] for p in self.data['characters']}
        classes = {p['name']: p['growths'] for p in self.data['classes']}
        self.assertEqual(characters['Sofia']['Mag'], 45)
        self.assertEqual(characters['Alexandra']['HP'], 30)
        self.assertEqual(characters['Alexandra']['Str'], 35)
        self.assertEqual(classes['Gladiator']['HP'], 10)
        self.assertEqual(classes['Gladiator']['Str'], 10)
        self.assertEqual(classes['The Calamity']['Mag'], 15)

    def test_repeated_header_excluded_and_mu_profiles_distinct(self):
        names = [p['name'] for p in self.data['characters']]
        self.assertNotIn('Name', names)
        self.assertIn('Mu', names)
        self.assertIn('Mu (with growth)', names)
        self.assertEqual(len(names), len(set(names)))

    def test_commoner_zero_is_supported_by_all_nine_formulas(self):
        commoner = next(p for p in self.data['classes'] if p['name'] == 'Commoner / Noble')
        self.assertEqual(commoner['growths'], dict.fromkeys(STATS, 0))
        self.assertEqual(len(self.report['zeroModifierEvidence']), 9)
        self.assertIn('SUMIF', commoner['notes'][0])

    def test_commoner_blank_is_rejected_without_complete_evidence(self):
        _, report = self.run_fixture(lambda w: w['Character Learnsets'].__setitem__('D27', '=0'))
        errors = [i for i in report['issues'] if i['code'] == 'invalid_growth']
        self.assertEqual(len(errors), 9)
        self.assertEqual(report['status'], 'failed')

    def test_partially_blank_commoner_is_not_zero_filled(self):
        _, report = self.run_fixture(lambda w: w['Classes'].__setitem__('Y3', 5))
        self.assertEqual(len([i for i in report['issues'] if i['code'] == 'invalid_growth']), 8)

    def test_disputed_source_values_and_research_note_are_preserved(self):
        profile = next(p for p in self.data['classes'] if p['name'] == 'Armored Ornius Rider')
        self.assertEqual(profile['growths']['Spd'], 10)
        self.assertEqual(profile['growths']['Dex'], 5)
        self.assertIn('DATA-12', profile['notes'][0])
        self.assertEqual(len([i for i in self.report['issues'] if i['severity'] == 'warning'
                              and i['code'] == 'research_uncertainty']), 1)
        self.assertEqual(len(self.report['researchQueue']), 19)

    def test_missing_growth_is_flagged_at_its_cell(self):
        _, report = self.run_fixture(lambda w: w['Characters'].__setitem__('D57', None))
        self.assertTrue(any(i['code'] == 'invalid_growth' and i['location'] == 'Characters!D57' for i in report['issues']))
        self.assertEqual(report['status'], 'failed')

    def test_malformed_class_growth_is_not_replaced_with_zero(self):
        data, report = self.run_fixture(lambda w: w['Classes'].__setitem__('AA58', '.'))
        self.assertNotIn('The Calamity', [p['name'] for p in data['classes']])
        self.assertTrue(any(i['location'] == 'Classes!AA58' for i in report['issues']))

    def test_duplicate_name_case_and_whitespace_are_flagged(self):
        _, report = self.run_fixture(lambda w: w['Characters'].__setitem__('A4', '  alexandra  '))
        self.assertTrue(any(i['code'] == 'duplicate_name' for i in report['issues']))
        self.assertEqual(report['status'], 'failed')

    def test_missing_name_is_flagged(self):
        _, report = self.run_fixture(lambda w: w['Characters'].__setitem__('A3', None))
        self.assertTrue(any(i['code'] == 'invalid_name' for i in report['issues']))

    def test_schema_and_missing_sheets_are_flagged(self):
        def change(w):
            w['Classes']['Y2'] = 'Spd'
            w.remove(w['Research Queue'])
        _, report = self.run_fixture(change)
        self.assertTrue(any(i['code'] == 'invalid_schema' for i in report['issues']))
        self.assertTrue(any(i['code'] == 'missing_sheet' for i in report['issues']))

    def test_missing_profile_count_and_extra_class_rows_are_flagged(self):
        def change(w):
            for col in range(1, 11): w['Characters'].cell(67, col).value = None
            w['Classes']['A63'] = 'Unexpected class'
        _, report = self.run_fixture(change)
        self.assertTrue(any(i['code'] == 'count_mismatch' for i in report['issues']))
        self.assertTrue(any(i['code'] == 'invalid_growth' and i['location'] == 'Classes!Y63'
                            for i in report['issues']))

    def test_numeric_validation_and_percentage_units(self):
        w = openpyxl.Workbook()
        cell = w.active['A1']
        for value in [None, '', '.', '45', '=1+2', True, float('nan'), float('inf')]:
            with self.subTest(value=value):
                cell.value = value
                with self.assertRaises(ValueError): parse_growth(cell)
        for value in [0, -15, 125, 12.5]:
            cell.value = value
            self.assertEqual(parse_growth(cell), value)
        cell.value = 0.45
        cell.number_format = '0%'
        self.assertEqual(parse_growth(cell), 45)
        w.close()

    def test_numeric_growths_do_not_treat_broken_headers_as_profiles(self):
        w = openpyxl.Workbook()
        w.active.title = 'Characters'
        w.active.append([])
        w.active.append([])
        w.active.append(['Name', 1, 2, 3, 4, 5, 6, 7, 8, 9])
        issues = []
        profiles, _ = read_profiles(w.active, 2, issues)
        self.assertEqual(profiles, [])
        self.assertEqual(issues[0]['code'], 'invalid_name')
        w.close()

    def test_failed_cli_writes_report_and_preserves_previous_json(self):
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            root = Path(directory)
            source, output, report = [root / name for name in ('bad.xlsx', 'growths.json', 'report.json')]
            w = fixture(self.data)
            w['Classes']['AA58'] = '.'
            w.save(source)
            w.close()
            output.write_text('previous valid snapshot', encoding='utf-8')
            before = source.read_bytes()
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = main(['--source', str(source), '--output', str(output), '--report', str(report)])
            self.assertEqual(code, 1)
            self.assertEqual(output.read_text(encoding='utf-8'), 'previous valid snapshot')
            self.assertEqual(json.loads(report.read_text(encoding='utf-8'))['status'], 'failed')
            self.assertEqual(source.read_bytes(), before)

    def test_cannot_overwrite_input_with_output_or_report(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            main(['--source', str(self.source), '--output', str(self.source)])

    def test_all_384_character_fields_match_supplied_reference(self):
        reference = json.loads((ROOT / 'tests/fixtures/character-details.reference.json').read_text(encoding='utf-8'))
        self.assertEqual(len(reference['characters']), 64)
        profiles = {p['name']: p for p in self.data['characters']}
        for expected in reference['characters']:
            actual = profiles[expected['name']]
            for group in ('personal', 'recruitment'):
                for key, text in expected[group].items():
                    with self.subTest(character=expected['name'], field=key):
                        self.assertEqual(actual[group][key]['text'], text or None)
                        self.assertTrue(actual[group][key]['source'].startswith('Characters!'))
        self.assertEqual(self.data['schemaVersion'], 2)
        self.assertEqual(self.report['characterTextCounts'], {
            'confirmed': 0, 'unverified': 345, 'unknown': 6, 'unavailable': 33,
        })

    def test_character_metadata_has_cell_provenance_and_no_guessed_values(self):
        profiles = {p['name']: p for p in self.data['characters']}
        self.assertEqual(profiles['Alexandra']['personal']['inherent'], {
            'text': 'Silver Maiden', 'status': 'unverified', 'source': 'Characters!W3',
        })
        self.assertEqual(profiles['Aswan']['personal']['equippable'], {
            'text': None, 'status': 'unknown', 'source': 'Characters!X5',
        })
        self.assertEqual(profiles['Bonaventure']['recruitment']['Cai'], {
            'text': '-', 'status': 'unavailable', 'source': 'Characters!Y8',
        })
        self.assertEqual(profiles['Mu']['personal']['inherent']['source'], 'Characters!W40')
        self.assertEqual(profiles['Mu (with growth)']['personal']['inherent']['source'], 'Characters!W41')

    def test_character_text_missing_is_unknown_and_explicit_na_is_unavailable(self):
        def change(w):
            w['Characters']['W3'] = None
            w['Characters']['X3'] = 'N/A'
            w['Characters']['Y3'] = '   '
        data, report = self.run_fixture(change)
        self.assertEqual(report['status'], 'passed')
        profile = data['characters'][0]
        self.assertEqual(profile['personal']['inherent']['status'], 'unknown')
        self.assertIsNone(profile['personal']['inherent']['text'])
        self.assertEqual(profile['personal']['equippable']['status'], 'unavailable')
        self.assertEqual(profile['personal']['equippable']['text'], 'N/A')
        self.assertEqual(profile['recruitment']['Cai']['status'], 'unknown')

    def test_character_text_malformed_values_are_flagged(self):
        for value in (123, True, '=1+2', '#N/A'):
            with self.subTest(value=value):
                _, report = self.run_fixture(lambda w: w['Characters'].__setitem__('W3', value))
                self.assertEqual(report['status'], 'failed')
                self.assertTrue(any(i['code'] == 'invalid_character_text' and i['location'] == 'Characters!W3'
                                    for i in report['issues']))

    def test_reordered_character_text_headers_are_not_silently_mapped(self):
        _, report = self.run_fixture(lambda w: w['Characters'].__setitem__('W2', 'Recruitment'))
        self.assertEqual(report['status'], 'failed')
        self.assertTrue(any(i['code'] == 'invalid_character_schema' for i in report['issues']))


if __name__ == '__main__':
    unittest.main()

