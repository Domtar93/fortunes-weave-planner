import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from import_community_reference import build, artifacts, status

class CommunityReferenceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.bytes=(ROOT/'data/community/source.snapshot.json').read_bytes()
  cls.snapshot=json.loads(cls.bytes)
  cls.base=json.loads((ROOT/'src/data/growths.json').read_text(encoding='utf-8'))
  cls.core,cls.sheets=build(cls.bytes,cls.base)
 def mutated(self,title,row,column,value):
  doc=copy.deepcopy(self.snapshot)
  sheet=next(s for s in doc['spreadsheet']['sheets'] if s['properties']['title']==title)
  cell=sheet['data'][0]['rowData'][row-1]['values'][column-1]
  cell['effectiveValue']={'stringValue':value} if isinstance(value,str) else {'numberValue':value}
  return json.dumps(doc).encode()
 def test_all_sheets_profiles_and_categories(self):
  self.assertEqual((len(self.sheets),len(self.core['characters']),len(self.core['learnsets'])),(27,64,12))
  self.assertNotIn('Rounded to 5s',self.core['characters'])
  self.assertNotIn('Aurora (NPC)',self.core['characters'])
  self.assertIn('Mu (with growth)',self.core['characters'])
 def test_all_5481_rank_cells_and_blank_states(self):
  values=[value for c in self.core['learnsets'].values() for p in c['characters'].values() for value in p['values'].values()]
  self.assertEqual(len(values),5481)
  self.assertTrue(any(v[0] is None and v[1]=='unknown' for v in values))
  self.assertTrue(any(v[1]=='compound' for v in values))
  self.assertEqual(self.core['learnsets']['Reason']['sheet'],'Black Magic')
  self.assertEqual(self.core['learnsets']['Faith']['sheet'],'White Magic')
 def test_known_descriptions_and_markers(self):
  character=self.core['characters']['Alexandra']
  self.assertEqual(character['inherentDescription']['value'],'Grants Hit/Avo+5 to unit for each adjacent ally.')
  self.assertEqual(self.core['characters']['Aswan']['equippableDescription']['status'],'unavailable')
  self.assertEqual(status(None),'unknown');self.assertEqual(status(0),'unverified')
 def test_multiline_recruitment_and_anatolia_not_split(self):
  character=self.core['characters']['Anatolia']
  self.assertIn('\n',character['inherent']['value'])
  self.assertIn('10/5',character['recruitment']['Dietrich']['value'])
  self.assertIn('\n',character['recruitment']['Dietrich']['value'])
 def test_notes_formulas_and_errors_preserved(self):
  cells=[c for sheet in self.sheets.values() for row in sheet['rows'] for c in row['cells']]
  self.assertEqual(sum(bool(c['note']) for c in cells),346)
  self.assertEqual(sum(bool(c['error']) for c in cells),20)
  self.assertTrue(any(c['formula'] for c in cells))
  self.assertEqual(sum(x['kind']=='date_serial' for x in self.core['issues']),7)
 def test_stable_namespace_and_deterministic_output(self):
  core,sheets=build(self.bytes,self.base)
  self.assertEqual(core,self.core);self.assertEqual(sheets,self.sheets)
  self.assertIn(hashlib.sha256(self.bytes).hexdigest()[:12],core['namespace'])
 def test_bad_schema_is_rejected(self):
  with self.assertRaisesRegex(ValueError,'schema'):build(self.mutated('Characters',2,35,'Moved description'),self.base)
 def test_numeric_growth_change_is_rejected(self):
  # Effective formatted percentages are also source evidence, so mutate both in this fixture.
  doc=json.loads(self.mutated('Characters',60,2,0.99));sheet=next(s for s in doc['spreadsheet']['sheets'] if s['properties']['title']=='Characters')
  sheet['data'][0]['rowData'][59]['values'][1]['formattedValue']='99%'
  with self.assertRaisesRegex(ValueError,'growth disagreement'):build(json.dumps(doc).encode(),self.base)
 def test_malformed_description_rejected(self):
  with self.assertRaisesRegex(ValueError,'Malformed character reference'):build(self.mutated('Characters',60,35,123),self.base)
 def test_missing_tab_rejected(self):
  doc=copy.deepcopy(self.snapshot);doc['spreadsheet']['sheets'].pop()
  with self.assertRaisesRegex(ValueError,'27'):build(json.dumps(doc).encode(),self.base)
 def test_duplicate_profile_rejected(self):
  with self.assertRaisesRegex(ValueError,'duplicate character'):build(self.mutated('Characters',10,1,'Alexandra'),self.base)
 def test_generated_artifacts_are_current(self):
  for path,text in artifacts().items():self.assertEqual(path.read_text(encoding='utf-8'),text,str(path))
 def test_original_source_integrity(self):
  expected={'data/source.xlsx':'4983c89549294cc309423486e48811e4df8b90d4feb34caed6a3eef43e6a4254','src/data/growths.json':'38bf94be20c5ff9f3f3f0fad7eed0391d06f3d34c37fdb5d7b7d6275fd7fc112','data/import-report.json':'2523f802f334854c7aaa1bd98044a800d400117a58d3315a5dcfb080493e01f5','src/data/weapon-families.json':'cd1d2e8eeec444c44e683dcb7dcac9a6dd7ae5a1ecf3f7d3ef7b4784f7a6784a'}
  for name,digest in expected.items():self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest)

if __name__=='__main__':unittest.main()
