import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout, redirect_stderr
import io
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_mount_growth_rules import build, extract_rules, main

class MountGrowthRuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sidecar = json.loads((ROOT/'src/data/mount-growth-rules.json').read_text(encoding='utf8'))

    def fixture(self):
        w = openpyxl.Workbook(); s = w.active; s.title = 'Character Learnsets'
        for item in self.sidecar['sources']: s[item['source'].split('!')[1]] = item['formula']
        return w

    def test_sidecar_matches_readonly_workbook_and_keeps_bytes(self):
        source = ROOT/'data/source.xlsx'; before = hashlib.sha256(source.read_bytes()).hexdigest()
        self.assertEqual(build(), self.sidecar); self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), before)
        self.assertEqual(len(self.sidecar['sources']), 30); self.assertEqual(self.sidecar['status'], 'unverified-workbook-calculation')

    def test_records_exact_species_conditional_and_charioteer_multiplier_evidence(self):
        self.assertEqual(self.sidecar['normalMultiplier'], 1); self.assertEqual(self.sidecar['doubledMultiplier'], 2)
        self.assertEqual(self.sidecar['doubledClass'], 'Charioteer')
        formulas = {x['source']: x['formula'] for x in self.sidecar['sources']}
        self.assertEqual(formulas['Character Learnsets!F7'], '=D7=D5')
        self.assertIn('*2', formulas['Character Learnsets!D30']); self.assertEqual(formulas['Character Learnsets!L31'], '=L28+L30')

    def test_rejects_changed_multiplier_conditions_and_output_formulas(self):
        for cell in ['D5', 'D7', 'F7', 'D28', 'E30', 'L31']:
            with self.subTest(cell=cell):
                w = self.fixture(); w.active[cell] = '=123'
                with self.assertRaisesRegex(ValueError, cell): extract_rules(w, 'digest')
                w.close()

    def test_rejects_missing_formula_instead_of_inventing_a_rule(self):
        w = self.fixture(); w.active['D30'] = None
        with self.assertRaisesRegex(ValueError, 'D30'): extract_rules(w, 'digest')
        w.close()

    def test_rejects_changed_string_literals_even_when_only_whitespace_differs(self):
        for cell, old, changed in [('D5', '"Mount"', '"Mo unt"'), ('D30', '"CharioteerTRUE"', '"Chari oteerTRUE"')]:
            with self.subTest(cell=cell):
                workbook = self.fixture(); workbook.active[cell] = workbook.active[cell].value.replace(old, changed)
                with self.assertRaisesRegex(ValueError, cell): extract_rules(workbook, 'digest')
                workbook.close()

    def test_accepts_harmless_formula_formatting_outside_string_literals(self):
        workbook = self.fixture(); workbook.active['D30'] = workbook.active['D30'].value.replace('if(', 'IF ( ').replace(',', ', ')
        self.assertEqual(len(extract_rules(workbook, 'digest')['sources']), 30)
        workbook.close()

    def test_rejects_snapshot_hash_mismatch_before_publishing(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'work') as d:
            snapshot = Path(d)/'snapshot.json'; snapshot.write_text(json.dumps({'metadata': {'sourceSha256': 'wrong'}}))
            with self.assertRaisesRegex(ValueError, 'hashes differ'): build(snapshot=snapshot)

    def test_keeps_source_blank_fields_and_disputes_out_of_rule_sidecar(self):
        self.assertIn('Unknown, never zero', self.sidecar['missingValuePolicy'])
        self.assertNotIn('mounts', self.sidecar); self.assertNotIn('numericGrowths', self.sidecar)

    def test_cli_rejects_input_overwrite_paths_before_reading_or_writing(self):
        for target in [ROOT/'data/source.xlsx', ROOT/'data/../data/source.xlsx', ROOT/'src/data/growths.json']:
            before = target.read_bytes()
            with self.subTest(target=target), patch('import_mount_growth_rules.build') as read, redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error: main(['--output', str(target)])
                self.assertEqual(error.exception.code, 2); read.assert_not_called()
                self.assertEqual(target.read_bytes(), before)

    def test_cli_check_is_readonly_and_fails_stale_artifacts_without_repairing_them(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'work') as folder:
            output = Path(folder)/'rules.json'
            output.write_text(json.dumps(self.sidecar, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
            before = output.read_bytes(), output.stat().st_mtime_ns
            with patch('import_mount_growth_rules.build', return_value=self.sidecar), redirect_stdout(io.StringIO()): main(['--check', '--output', str(output)])
            self.assertEqual((output.read_bytes(), output.stat().st_mtime_ns), before)
            output.write_text('stale', encoding='utf-8')
            with patch('import_mount_growth_rules.build', return_value=self.sidecar):
                with self.assertRaisesRegex(ValueError, 'stale'): main(['--check', '--output', str(output)])
            self.assertEqual(output.read_text(encoding='utf-8'), 'stale')

    def test_cli_failed_evidence_check_preserves_existing_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'work') as folder:
            output = Path(folder)/'rules.json'; output.write_text('previous artifact', encoding='utf-8')
            with patch('import_mount_growth_rules.build', side_effect=ValueError('Unsupported formula')):
                with self.assertRaisesRegex(ValueError, 'Unsupported formula'): main(['--output', str(output)])
            self.assertEqual(output.read_text(encoding='utf-8'), 'previous artifact')

    def test_cli_publishes_a_complete_sidecar_after_validation(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'work') as folder:
            output = Path(folder)/'rules.json'; output.write_text('old', encoding='utf-8')
            with patch('import_mount_growth_rules.build', return_value=self.sidecar), redirect_stdout(io.StringIO()): main(['--output', str(output)])
            self.assertEqual(json.loads(output.read_text(encoding='utf-8')), self.sidecar)
            self.assertFalse(output.with_suffix('.json.tmp').exists())

if __name__ == '__main__': unittest.main()
