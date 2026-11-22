"""Provisional source-section evidence, independently reproducible without editing the workbook."""
from copy import deepcopy
import contextlib
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_weapon_families import classify_sections, import_families, main, SECTIONS


class WeaponFamilyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = json.loads((ROOT / 'src/data/growths.json').read_text(encoding='utf8'))
        cls.evidence = json.loads((ROOT / 'src/data/weapon-families.json').read_text(encoding='utf8'))

    def test_exact_family_counts_rows_and_boundaries(self):
        data = classify_sections(self.snapshot['forging'])
        self.assertEqual(data['counts'], {'Sword': 20, 'Spear': 22, 'Axe': 19, 'Bow': 15, 'Gauntlets': 15})
        self.assertEqual(sum(data['counts'].values()), 91)
        self.assertEqual(len({r['weaponId'] for r in data['records']}), 91)
        for family, first, last, first_name, last_name in SECTIONS:
            records = [r for r in data['records'] if r['family'] == family]
            self.assertEqual([r['source']['row'] for r in records], list(range(first, last + 1)))
            self.assertEqual((records[0]['name'], records[-1]['name']), (first_name, last_name))
            self.assertTrue(all(r['status'] == 'provisional' and r['source']['section'] == f'Forging!A{first}:J{last}' for r in records))

    def test_no_family_guessing_from_names_and_preliminary_is_separate(self):
        source = deepcopy(self.snapshot['forging'])
        source['records'][1]['name'] = 'Unrelated Γ axe-like name'
        data = classify_sections(source)
        self.assertEqual(data['records'][1]['family'], 'Sword')
        self.assertEqual(data['records'][1]['name'], source['records'][1]['name'])
        self.assertFalse({r['weaponId'] for r in data['records']} & {r['id'] for r in source['preliminary']})

    def test_rejects_shifted_rows_missing_extra_and_duplicate_id(self):
        for change in (
            lambda d: d['records'][0]['source'].update(row=20),
            lambda d: d['records'].pop(),
            lambda d: d['records'].append(deepcopy(d['records'][0])),
            lambda d: d['records'][1].update(id=d['records'][0]['id']),
            lambda d: d['preliminary'].pop(),
        ):
            source = deepcopy(self.snapshot['forging']); change(source)
            with self.assertRaises(ValueError): classify_sections(source)

    def test_rejects_changed_section_anchors_and_noncanonical_records(self):
        for change in (
            lambda d: d['records'][20].update(name='Moved boundary'),
            lambda d: d['records'][1].update(section='preliminary'),
            lambda d: d['records'][1]['source'].update(sheet='Other sheet'),
        ):
            source = deepcopy(self.snapshot['forging']); change(source)
            with self.assertRaises(ValueError): classify_sections(source)

    def test_real_workbook_read_only_reproduces_sidecar_and_preserves_source_json(self):
        paths = [ROOT / p for p in ('data/source.xlsx', 'src/data/growths.json', 'data/import-report.json')]
        before = [hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]
        self.assertEqual(import_families(paths[0], self.snapshot), self.evidence)
        self.assertEqual([hashlib.sha256(p.read_bytes()).hexdigest() for p in paths], before)
        self.assertEqual(before[0], '4983c89549294cc309423486e48811e4df8b90d4feb34caed6a3eef43e6a4254')

    def test_snapshot_hash_mismatch_fails_before_publication(self):
        snapshot = deepcopy(self.snapshot); snapshot['metadata']['sourceSha256'] = 'stale'
        with self.assertRaisesRegex(ValueError, 'hash differs'): import_families(ROOT / 'data/source.xlsx', snapshot)

    def test_cli_failure_keeps_existing_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'work') as directory:
            directory = Path(directory); snapshot = deepcopy(self.snapshot)
            snapshot['metadata']['sourceSha256'] = 'stale'
            source = directory / 'snapshot.json'; source.write_text(json.dumps(snapshot), encoding='utf8')
            output = directory / 'families.json'; output.write_text('KEEP', encoding='utf8')
            with contextlib.redirect_stdout(io.StringIO()): result = main(['--snapshot', str(source), '--output', str(output)])
            self.assertEqual(result, 1); self.assertEqual(output.read_text(encoding='utf8'), 'KEEP')

    def test_cli_refuses_to_overwrite_inputs(self):
        with contextlib.redirect_stdout(io.StringIO()):
            for output in ('data/source.xlsx', 'src/data/growths.json'):
                self.assertEqual(main(['--output', str(ROOT / output)]), 1)


if __name__ == '__main__': unittest.main()
