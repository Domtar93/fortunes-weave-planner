import {describe,it,expect} from 'vitest'
import {communityData,communityEntries,communityGlossary,isCommunitySource,referenceRows,referenceRowLabel,referenceFieldLabel,referenceDisplayValue,type ReferenceSheet} from './community'
import dungeonSheet from './data/community-sheets/sheet-1237340812.json'
import classSheet from './data/community-sheets/sheet-1311471322.json'
import characterSheet from './data/community-sheets/sheet-942420165.json'
import artsSheet from './data/community-sheets/sheet-1399016621.json'
import skillsSheet from './data/community-sheets/sheet-1001971105.json'
import dataminedSheet from './data/community-sheets/sheet-46984412.json'
import {growthData,PROFICIENCIES} from './growths'
import {learnsetIdentity,proficiencyData} from './proficiencies'
import {isShortlistable,resolvePlanningEntry,planningRequirements,shortlistReducer} from './shortlist'
import {createLoadout,resolveLoadout,abilityReferences} from './loadouts'
import {formatShortlistText} from './shortlistText'
import {sourceRangeUrl} from './catalogReferences'
import {resolveShortlistTarget} from './proficiencyNavigation'

describe('additional community evidence and planning',()=>{
 it('retains phase and growth/flat/base header hierarchy and secondary table headings',()=>{
  expect(referenceFieldLabel(dungeonSheet,3,3)).toBe('Part I · Chest 1')
  expect(referenceFieldLabel(dungeonSheet,3,8)).toBe('Part III · Chest 1')
  expect(referenceFieldLabel(classSheet,3,25)).toBe('Growth modifier (%) · HP')
  expect(referenceFieldLabel(classSheet,3,34)).toBe('Flat stat bonus (points) · HP')
  expect(referenceFieldLabel(classSheet,3,43)).toBe('Base stats (work in progress) · HP')
  expect(referenceFieldLabel(characterSheet,3,2)).toBe('Growth rates (%) · HP')
  expect(referenceFieldLabel(characterSheet,3,12)).toBe('Base stats (reference only) · HP')
  expect(referenceFieldLabel(artsSheet,3,2)).toBe('Cost')
  expect(referenceFieldLabel(skillsSheet,3,3)).toBe('Description')
  expect(referenceFieldLabel(dataminedSheet,3,12)).toBe('Boon/Bane · Sword')
  expect(referenceFieldLabel(dataminedSheet,3,24)).toBe('Personal Skills · Inherent ability')
  expect(referenceFieldLabel(dataminedSheet,3,30)).toBe("Recruitment · Cai's Path")
 })
 it('keeps formatted display separate from raw numeric values and never infers blank zeros',()=>{
  const cell={column:1,value:0.1,formatted:'10%',note:null,formula:null,error:null}
  expect(referenceDisplayValue(cell)).toBe('10%');expect(cell.value).toBe(0.1)
  expect(referenceDisplayValue({...cell,value:1,formatted:'+1'})).toBe('+1')
  expect(referenceDisplayValue({...cell,value:null,formatted:null})).toBe('Unknown / blank')
  expect(referenceDisplayValue({...cell,value:0,formatted:'0'})).toBe('0')
 })
 it('retains all 64 profiles and exactly 12 categories / 5,481 cells without modifying corrected records',()=>{
  expect(Object.keys(communityData.characters)).toHaveLength(64)
  expect(PROFICIENCIES.reduce((n,p)=>n+Object.keys(communityData.learnsets[p].characters).reduce((m,c)=>m+communityEntries(p,c).length,0),0)).toBe(5481)
  expect(growthData.characters).toHaveLength(64);expect(growthData.classes).toHaveLength(59)
  expect(proficiencyData.categories.Axe.ranks).toEqual(['D','C','B','A','S+'])
 })
 it.each(PROFICIENCIES)('has unique source references and strict missing states for %s',p=>{
  const entries=Object.keys(communityData.learnsets[p].characters).flatMap(name=>communityEntries(p,name))
  expect(new Set(entries.map(e=>e.source)).size).toBe(entries.length)
  for(const entry of entries){expect(entry.reliability).toBe('unverified');expect(sourceRangeUrl(entry.source)).toBe(entry.sourceUrl);if(entry.text===null)expect(isShortlistable(entry)).toBe(false)}
 })
 it('can plan newly populated entries using distinct sources and unchanged existing identities',()=>{
  const item=communityEntries('Sword','Benditz').find(e=>e.rank==='B')!
  expect(item.text).toBe('Flash Blow');expect(proficiencyData.categories.Sword.characters.Benditz.find(e=>e.rank==='B')!.text).toBeNull()
  const next=shortlistReducer({byCharacter:{}},{type:'add',characterName:'Benditz',proficiency:'Sword',rank:item.rank,source:item.source})
  const planned=next.byCharacter.Benditz[0]
  expect(isCommunitySource(planned.entry.source)).toBe(true)
  expect(resolveShortlistTarget('Benditz',[planned],planned.id)).toEqual({target:planned})
  const text=formatShortlistText({id:'Benditz',displayName:'Benditz'},[planned],growthData.metadata)
  expect(text).toContain('Flash Blow');expect(text).toContain(item.sourceUrl);expect(text).toContain('unverified')
 })
 it('preserves new plus-sign requirements in saving, restoring, comparison resolution and text export',()=>{
  const item=communityEntries('Reason','Alexandra').find(e=>e.rank==='S+')!
  const planned=resolvePlanningEntry('Alexandra','Reason','S+',item.source)!
  expect(planningRequirements([planned])[0].ranks).toEqual(['S+'])
  const loadout=createLoadout('Expanded',{characterName:'Alexandra',className:'Gladiator',weaponId:null,mountId:null,battalionId:null,abilities:abilityReferences([planned])},[],'2026-10-28T00:00:00.000Z','expanded')
  expect(resolveLoadout(JSON.parse(JSON.stringify(loadout))).entries[0]).toEqual(planned)
  expect(formatShortlistText({id:'Alexandra',displayName:'Alexandra'},[planned],growthData.metadata)).toContain('Reason (Black Magic) S+')
 })
 it('keeps both Mu plans separate and rejects stale snapshot sources',()=>{
  const item=communityEntries('Sword',learnsetIdentity('Mu (with growth)')).find(isShortlistable)!
  const a=resolvePlanningEntry('Mu','Sword',item.rank,item.source)!,b=resolvePlanningEntry('Mu (with growth)','Sword',item.rank,item.source)!
  expect(a.id).not.toBe(b.id);expect(a.learnsetCharacter).toBe(b.learnsetCharacter)
  expect(resolvePlanningEntry('Mu','Sword',item.rank,item.source.replace(communityData.namespace,'Community stale'))).toBeNull()
 })
 it('does not silently choose between differing skill descriptions',()=>{
  const first=communityData.skills[0]
  expect(communityGlossary(first.name)?.description).toBe(first.description.value)
  communityData.skills.push({...first,description:{...first.description,value:'Conflicting fixture'}})
  try{expect(communityGlossary(first.name)).toBeUndefined()}finally{communityData.skills.pop()}
 })
 it('searches forging children by base name while keeping notes unassociated',()=>{
  const sheet:ReferenceSheet={title:'Forging',gid:1,key:'one',rows:[{row:2,cells:[{column:1,value:'Hero’s Spear',formatted:null,note:null,formula:null,error:null},{column:4,value:'Base',formatted:null,note:null,formula:null,error:null}]},{row:3,cells:[{column:4,value:1,formatted:null,note:'Greek Γ',formula:null,error:null}]},{row:4,cells:[{column:15,value:'Independent note',formatted:null,note:null,formula:null,error:null}]}]}
  expect(referenceRows(sheet,'Hero’s Spear')).toHaveLength(2)
  expect(referenceRows(sheet,'Greek Γ')).toHaveLength(1)
  expect(referenceRowLabel(sheet,sheet.rows[2])).toBe('Forging · row 4')
 })
})
