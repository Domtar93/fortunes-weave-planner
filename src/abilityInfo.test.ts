import {describe,it,expect} from 'vitest'
import {abilityNameKey,meaningfulAbilityText,resolveAbilityInformation} from './abilityInfo'
import {communityData} from './community'
import {proficiencyData} from './proficiencies'

describe('reader-facing ability information',()=>{
 it('handles legacy spelling, spacing and footnotes without inventing effects for distinct names',()=>{
  expect(resolveAbilityInformation({name:'Steady Shot +',proficiency:'Infantry'}).description).toBeTruthy()
  expect(resolveAbilityInformation({name:'Fitting Flier+',proficiency:'Flying'}).description).toContain('AS+2 (+4)')
  expect(resolveAbilityInformation({name:'Build +5',proficiency:'Armor'}).description).toBe('Grants Bld+5 (+10).')
  expect(resolveAbilityInformation({name:'Mire Β',proficiency:'Reason'}).description).toBeTruthy()
  expect(resolveAbilityInformation({name:'Armored Move+*',proficiency:'Armor'}).description).toContain('Mov+1 (+2)')
  expect(resolveAbilityInformation({name:"Mind's Eye Blow",proficiency:'Gauntlet'}).facts).toContainEqual({label:'Might',value:'+7'})
  const pairs=new Map<string,{name:string;proficiency:keyof typeof proficiencyData.categories}>()
  for(const [proficiency,category] of Object.entries(proficiencyData.categories))for(const entries of Object.values(category.characters))for(const entry of entries)if(entry.text&&entry.state==='documented')pairs.set(proficiency+entry.text,{name:entry.text,proficiency:proficiency as keyof typeof proficiencyData.categories})
  expect(pairs.size).toBe(307)
  const missing=[...pairs.values()].filter(input=>{const info=resolveAbilityInformation(input);return !info.description&&!info.hasConflict&&!info.facts.length}).map(input=>input.name).sort()
  // Historical names need their exact record context; direct research fills the
  // formerly absent Counter Fliers and Defensive Formation+ definitions.
  expect(missing).toEqual(['Brilliant Blow','Lancefaire','Superior Bowblock'])
 })
 it('puts the supplied Swordfaire cell-note effect first for either workbook choice',()=>{
  const info=resolveAbilityInformation({name:'Swordfaire',proficiency:'Sword',fallback:'Effect not yet documented. Mechanical description not sourced in the glossary.'})
  expect(info.description).toBe('When unit is equipped with a sword, grants Hit/Avo+10 and Atk+3.')
  expect(info.hasConflict).toBe(false)
  expect(info.references.some(ref=>ref.label.includes('(note)')&&ref.url.includes('#gid='))).toBe(true)
 })
 it.each([['Spearfaire','Spear'],['Axefaire','Axe'],['Bowfaire','Bow'],['Fistfaire','Gauntlet'],['Black Magic Mastery','Reason'],['White Magic Mastery','Faith']] as const)('resolves supplied %s descriptions',(name,proficiency)=>{
  expect(resolveAbilityInformation({name,proficiency}).description).toBeTruthy()
 })
 it('shows contextual combat-art effects and numeric zero alongside signed bonuses',()=>{
  const info=resolveAbilityInformation({name:'Haze Slice',proficiency:'Sword'})
  expect(info.description).toBe('Grants Avo+10 during combat')
  expect(info.facts).toEqual(expect.arrayContaining([{label:'Might',value:'+3'},{label:'Hit',value:'0'},{label:'Range',value:'1'}]))
 })
 it('finds Authority and Armor effects in the dedicated combat-art appendix',()=>{
  expect(resolveAbilityInformation({name:'Lend Strength',proficiency:'Authority'}).description).toContain('Str +2/3/5')
  expect(resolveAbilityInformation({name:'Defense Stance',proficiency:'Armor'}).description).toContain('Def+3')
  expect(resolveAbilityInformation({name:'Narrow Defence',proficiency:'Armor'}).description).toBe('Grants Shld+3 when attacked. Trigger % = 25.')
 })
 it('preserves supplied upgrade notation without inventing variant values',()=>{
  const info=resolveAbilityInformation({name:'Lend Strength++',proficiency:'Authority'})
  expect(info.description).toContain('Str +2/3/5')
  expect(info.facts).toContainEqual({label:'Upgrade notation',value:'Base and upgraded values are shown as written.'})
  expect(resolveAbilityInformation({name:'Swordfaire++',proficiency:'Sword'}).description).toBeNull()
 })
 it('retains useful spell facts when the effect cell is actually blank',()=>{
  const info=resolveAbilityInformation({name:'Excalibur',proficiency:'Reason'})
  expect(info.description).toContain('Effective against flying foes')
  expect(info.descriptionKind).toBe('web-reference')
  expect(info.facts).toEqual(expect.arrayContaining([{label:'Might',value:'15'},{label:'Range',value:'1-2'}]))
 })
 it('matches apostrophe typography and Unicode without conflating plus ranks or different names',()=>{
  expect(abilityNameKey('  Mind’s-Eye  Blow ')).toBe(abilityNameKey("Mind's-Eye Blow"))
  expect(resolveAbilityInformation({name:'Mind’s-Eye Blow',proficiency:'Gauntlet'}).facts).toContainEqual({label:'Hit',value:'+30'})
  expect(abilityNameKey('α+')).not.toBe(abilityNameKey('α'))
  expect(resolveAbilityInformation({name:'Unlisted α++'}).description).toBeNull()
 })
 it('does not use template headers, placeholders or unrelated proficiency definitions',()=>{
  expect(meaningfulAbilityText('Description')).toBe(false)
  expect(resolveAbilityInformation({name:'Swordfaire',proficiency:'Armor'}).description).toBeNull()
  expect(resolveAbilityInformation({name:null,fallback:'known'}).description).toBeNull()
 })
 it('does not mutate learnset identities or source data when resolving every documented ability',()=>{
  const before=JSON.stringify(communityData)
  const names=new Map<string,{name:string;proficiency:keyof typeof communityData.learnsets}>()
  for(const [proficiency,category] of Object.entries(communityData.learnsets))for(const character of Object.values(category.characters))for(const [name,state] of Object.values(character.values))if(name&&state==='documented')names.set(proficiency+name,{name,proficiency:proficiency as keyof typeof communityData.learnsets})
  expect(names.size).toBe(301)
  const noInformation=[],factsOnly=[]
  let described=0
  for(const input of names.values()){
   const info=resolveAbilityInformation(input)
   if(info.description)described++
   else if(!info.hasConflict&&info.facts.length)factsOnly.push(input.name)
   if(!info.description&&!info.hasConflict&&!info.facts.length)noInformation.push(input.name)
  }
  expect(noInformation).toEqual([])
  expect(described).toBe(301)
  expect(factsOnly).toEqual([])
  expect(JSON.stringify(communityData)).toBe(before)
 })
})
