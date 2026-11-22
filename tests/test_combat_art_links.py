import copy
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from import_community_reference import build,check_source_refresh

class CombatArtReferenceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.snapshot=json.loads((ROOT/'data/community/source.snapshot.json').read_text(encoding='utf-8'))
  cls.base=json.loads((ROOT/'src/data/growths.json').read_text(encoding='utf-8'))
  cls.core,_=build(json.dumps(cls.snapshot).encode(),cls.base)
 def test_contextual_mirror_origins(self):
  for name,row,origin in [('Haze Slice',26,'Sword!A94'),('Gale Blow',21,'Sword!A88'),('Flash Blow',17,'Sword!A84')]:
   records=[item for item in self.core['combatArts'] if item['name']==name and item['proficiency']=='Sword']
   self.assertEqual(len(records),1)
   self.assertEqual((records[0]['row'],records[0]['origin']['source']),(row,origin))
   self.assertEqual(records[0]['reference']['formula'],'='+origin)
   self.assertEqual(records[0]['effect']['status'],'unverified')
 def test_unknown_or_complex_formulas_are_not_evaluated_or_linked(self):
  snapshot=copy.deepcopy(self.snapshot)
  sheet=next(s for s in snapshot['spreadsheet']['sheets'] if s['properties']['title']=='Combat Arts')
  sheet['data'][0]['rowData'][25]['values'][0]['userEnteredValue']['formulaValue']='=IMPORTRANGE("https://example.com", "A1")'
  core,_=build(json.dumps(snapshot).encode(),self.base)
  self.assertFalse(any(item['row']==26 for item in core['combatArts']))
 def test_disagreeing_mirror_is_flagged_without_a_context_link(self):
  snapshot=copy.deepcopy(self.snapshot)
  sheet=next(s for s in snapshot['spreadsheet']['sheets'] if s['properties']['title']=='Combat Arts')
  sheet['data'][0]['rowData'][25]['values'][0]['effectiveValue']={'stringValue':'Different recorded name'}
  core,_=build(json.dumps(snapshot).encode(),self.base)
  self.assertFalse(any(item['row']==26 for item in core['combatArts']))
  self.assertTrue(any(item['kind']=='reference_disagreement' and item['cell']=='A26' for item in core['issues']))
 def test_all_context_links_have_distinct_rows_and_real_source_urls(self):
  records=self.core['combatArts']
  self.assertGreater(len(records),100)
  self.assertEqual(len({item['row'] for item in records}),len(records))
  self.assertTrue(all('#gid=1399016621&range=A' in item['reference']['url'] for item in records))
 def test_new_snapshot_requires_explicit_review_before_publishing(self):
  with self.assertRaisesRegex(ValueError,'No generated files were replaced'):
   check_source_refresh({'snapshotSha256':'old'},{'snapshotSha256':'new'})
  check_source_refresh({'snapshotSha256':'old'},{'snapshotSha256':'new'},accepted=True)
 def test_same_snapshot_and_fresh_setup_do_not_need_refresh_acceptance(self):
  check_source_refresh({'snapshotSha256':'same'},{'snapshotSha256':'same'})
  check_source_refresh(None,{'snapshotSha256':'new'})

if __name__=='__main__':unittest.main()
