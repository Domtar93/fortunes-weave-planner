import copy
import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from import_community_reference import build,artifacts
from import_ability_info import build_ability_info

class AbilityInformationTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.core,cls.sheets=build((ROOT/'data/community/source.snapshot.json').read_bytes(),json.loads((ROOT/'src/data/growths.json').read_text(encoding='utf-8')))
  cls.info=build_ability_info(cls.core,cls.sheets)
 def records(self,name):return [r for r in self.info['records'] if r['name']==name]
 def test_rank_notes_are_deduplicated_and_linked(self):
  records=self.records('Swordfaire')
  self.assertEqual(len(records),1)
  self.assertIn('Hit/Avo+10 and Atk+3',records[0]['description'])
  self.assertIn('(note)',records[0]['reference']['label'])
 def test_dedicated_skill_notes_retain_complete_magic_and_resistance_effect(self):
  record=next(r for r in self.records('Lend Magic') if r['kind']=='skill-note')
  self.assertIn('Mag/Res +2/3/5',record['description'])
  self.assertEqual(record['reference']['label'],'Authority!A81 (note)')
 def test_provisional_rank_notes_are_not_presented_as_ability_effects(self):
  self.assertFalse(any(r['description'] in ['~A','~B','~C'] for r in self.info['records']))
 def test_character_specific_range_notes_do_not_become_global_effects(self):
  self.assertFalse(any("Anatolia's has extra range" in (r['description'] or '') for r in self.info['records']))
 def test_contextual_appendix_definitions_are_included(self):
  self.assertTrue(any('Str +2/3/5' in (r['description'] or '') for r in self.records('Lend Strength')))
  self.assertTrue(any('Def+3' in (r['description'] or '') for r in self.records('Defense Stance')))
 def test_numeric_zero_and_signed_facts_are_preserved(self):
  facts={f['label']:f['value'] for f in self.records('Haze Slice')[0]['facts']}
  self.assertEqual(facts['Hit'],'0');self.assertEqual(facts['Might'],'+3')
 def test_blank_effect_does_not_erase_spell_stats(self):
  record=self.records('Excalibur')[0]
  self.assertIsNone(record['description'])
  self.assertIn(dict(label='Range',value='1-2'),[{k:f[k] for k in ['label','value']} for f in record['facts']])
 def test_upgrades_do_not_inherit_or_invent_effects_during_import(self):
  self.assertFalse(self.records('Lend Strength++'))
 def test_import_does_not_modify_inputs(self):
  original=copy.deepcopy((self.core,self.sheets))
  build_ability_info(self.core,self.sheets)
  self.assertEqual((self.core,self.sheets),original)
 def test_generated_artifacts_are_fresh(self):
  for path,text in artifacts().items():self.assertEqual(path.read_text(encoding='utf-8'),text,path.name)
 def test_error_blank_and_date_serial_facts_are_omitted(self):
  sheets=copy.deepcopy(self.sheets)
  sheet=next(s for s in sheets.values() if s['title']=='Black Magic')
  header=next(r for r in sheet['rows'] if any(c['value']=='Name' for c in r['cells']))
  target=next(r for r in sheet['rows'] if r['row']>header['row'] and any(c['value']=='Excalibur' for c in r['cells']))
  range_column=next(c['column'] for c in header['cells'] if c['value']=='Range')
  next(c for c in target['cells'] if c['column']==range_column).update(value=45800,formatted='5/23')
  records=build_ability_info(self.core,sheets)['records']
  record=next(r for r in records if r['name']=='Excalibur')
  self.assertFalse(any(f['label']=='Range' for f in record['facts']))
if __name__=='__main__':unittest.main()
