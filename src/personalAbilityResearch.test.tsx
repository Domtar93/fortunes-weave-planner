import {afterEach,describe,expect,it} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import CharacterDetails from './CharacterDetails'
import {personalAbilityResearch,validatePersonalAbilityResearch,resolvePersonalAbilityResearch} from './personalAbilityResearch'
import {resolveAbilityInformation} from './abilityInfo'
import {communityData} from './community'
import {growthData} from './growths'

afterEach(cleanup)
const clone=()=>structuredClone(personalAbilityResearch)
const profile=(name:string)=>growthData.characters.find(character=>character.name===name)!

describe('reviewed personal ability information',()=>{
 it('binds every reviewed field to both input snapshots and exact unchanged source text',()=>{
  expect(validatePersonalAbilityResearch(clone())).toEqual(personalAbilityResearch)
  for(const field of ['sourceSnapshotSha256','originalSourceSha256'] as const){
   const changed=clone();changed[field]='changed'
   expect(()=>validatePersonalAbilityResearch(changed)).toThrow(/source snapshots/)
  }
 })
 it.each(['recordedName','characterName','originalSource','companionName','companionDescription','companionSource'] as const)('rejects stale %s mappings instead of silently reassigning effects',field=>{
  const changed=clone();changed.records[0][field]='changed'
  expect(()=>validatePersonalAbilityResearch(changed)).toThrow(/exact source fields/)
 })
 it('rejects duplicate scopes, variants and missing supporting effects',()=>{
  const duplicate=clone();duplicate.records.push({...duplicate.records[0]})
  expect(()=>validatePersonalAbilityResearch(duplicate)).toThrow(/Duplicate personal/)
  const variant=clone();variant.records[0].variants.push({...variant.records[0].variants[0]})
  expect(()=>validatePersonalAbilityResearch(variant)).toThrow(/duplicate personal ability variant/)
  const missing=clone();missing.records[0].variants=[]
  expect(()=>validatePersonalAbilityResearch(missing)).toThrow(/reviewed effects/)
 })
 it('rejects unsafe citations and unsupported level values',()=>{
  const unsafe=clone();unsafe.records[0].variants[0].sources[0].url='javascript:alert(1)'
  expect(()=>validatePersonalAbilityResearch(unsafe)).toThrow(/citation/)
  for(const level of [-1,0,2.5,NaN]){
   const changed=clone();changed.records[0].variants[0].level=level
   expect(()=>validatePersonalAbilityResearch(changed)).toThrow(/level/)
  }
  const missing=clone();missing.records[0].variants[0].sources=[]
  expect(()=>validatePersonalAbilityResearch(missing)).toThrow(/supporting references/)
 })
 it('recovers Celestial Flow alone without giving it the mislabeled second effect',()=>{
  render(<CharacterDetails character={profile('Anatolia')}/>)
  const inherent=screen.getByRole('group',{name:'Inherent ability'})
  expect(inherent.querySelector('.ability-effect')?.textContent).toBe('Avoid +3.')
  expect(inherent.querySelector('.ability-effect')?.textContent).not.toMatch(/\+5|Shining|Meridian/)
  const details=inherent.querySelector('details')!
  expect(details.open).toBe(false)
  expect(details.textContent).toContain('Shining Dragon Strike')
  expect(inherent.querySelector('a[href="https://yuphastemple.com/anatolia/"]')).toBeTruthy()
 })
 it('replaces Nuzzuo’s repeated name placeholder with the corroborated conditional effect',()=>{
  render(<CharacterDetails character={profile('Nuzzuo')}/>)
  const inherent=screen.getByRole('group',{name:'Inherent ability'})
  expect(inherent.querySelector('.ability-effect')?.textContent).toBe('Attack +3 in combat when the unit is effective against the foe.')
  expect(inherent.querySelector('details')?.open).toBe(false)
 })
 it('separates named personal variants and verified acquisition levels without adding bonuses together',()=>{
  render(<CharacterDetails character={profile('Alexandra')}/>)
  const equippable=screen.getByRole('group',{name:'Equippable abilities'})
  expect(within(equippable).getByRole('heading',{name:'Soar · Level 20'})).toBeTruthy()
  expect(within(equippable).getByRole('heading',{name:'Soar+ · Level 35'})).toBeTruthy()
  const effects=[...equippable.querySelectorAll('.ability-effect')].map(element=>element.textContent)
  expect(effects).toHaveLength(2)
  expect(effects[0]).toContain('+3');expect(effects[1]).toContain('+5')
  expect(effects.join('')).not.toContain('+8')
 })
 it('keeps disputed Continuum levels out of its displayed variants',()=>{
  const info=resolvePersonalAbilityResearch('Anatolia','equippable','Continuum')!
  expect(info.parts?.map(part=>part.label)).toEqual(['Continuum','Continuum+'])
  expect(info.parts?.map(part=>part.information.description)).toEqual(['After avoiding an attack, restores 5 HP to the unit.','After avoiding an attack, restores 10 HP to the unit.'])
  expect(info.alternatives.some(text=>text.includes('Do not infer the unlock level'))).toBe(true)
 })
 it('retains verified levels for single equippable effects and late-level exceptions',()=>{
  expect(resolvePersonalAbilityResearch('Cai','equippable','Flamekeeper')!.parts?.[0].label).toBe('Flamekeeper · Level 35')
  for(const [name,ability,levels] of [['Eshmel','Scorching Sun',[45,60]],['Hong Hua','Amplify Magic',[50,60]],['Troy','Modified Weapon',[50,60]],['Mikaela','Redblade’s Will',[20,35]]] as const){
   const info=resolvePersonalAbilityResearch(name,'equippable',ability)!
   expect(info.parts?.map(part=>Number(part.label.match(/Level (\d+)/u)?.[1]))).toEqual(levels)
  }
 })
 it('keeps both Mu personal plans source-scoped while showing the same verified variants',()=>{
  const normal=resolvePersonalAbilityResearch('Mu','equippable','Warrior’s Blood')!
  const alternative=resolvePersonalAbilityResearch('Mu (with growth)','equippable','Warrior’s Blood')!
  const effects=(info:typeof normal)=>info.parts?.map(part=>({label:part.label,description:part.information.description}))
  expect(effects(normal)).toEqual(effects(alternative))
  expect(personalAbilityResearch.records.filter(record=>record.characterName.startsWith('Mu')&&record.personalKind==='equippable').map(record=>record.originalSource)).toEqual(['Characters!X40','Characters!X41'])
 })
 it('fixes Talimun’s mixed effects and retains chance and attacking/defending conditions',()=>{
  render(<CharacterDetails character={profile('Talimun')}/>)
  const equippable=screen.getByRole('group',{name:'Equippable abilities'})
  expect(within(equippable).getByRole('heading',{name:'Cannoning Flair'})).toBeTruthy()
  expect(within(equippable).getByRole('heading',{name:'Winds of Victory'})).toBeTruthy()
  const effects=[...equippable.querySelectorAll('.ability-effect')].map(element=>element.textContent)
  expect(effects).toEqual(['Hit +30 in combat while using artillery.','Luck% chance: Hit +15 when attacking, or Avoid +15 when attacked.'])
  expect(effects.join('')).not.toMatch(/Luck \+3|Luck \+5/)
  expect(equippable.querySelector('details')?.textContent).toContain('Grants Lck+5')
 })
 it.each([['Bertrand',2],['Orchel',3],['Theodora',2]] as const)('pairs %s’s individually reviewed named skills instead of duplicating a combined paragraph',(name,count)=>{
  render(<CharacterDetails character={profile(name)}/>)
  const equippable=screen.getByRole('group',{name:'Equippable abilities'})
  expect(equippable.querySelectorAll('.ability-parts h4')).toHaveLength(count)
  expect(equippable.querySelectorAll('.ability-effect')).toHaveLength(count)
 })
 it('never assigns personal effects across characters or arbitrary source names',()=>{
  expect(resolvePersonalAbilityResearch('Sofia','inherent','Celestial Flow')).toBeUndefined()
  expect(resolvePersonalAbilityResearch('Anatolia','inherent','Meridian Rotation')).toBeUndefined()
  expect(resolvePersonalAbilityResearch('toString','inherent','Celestial Flow')).toBeUndefined()
  expect(resolveAbilityInformation({name:'Celestial Flow',characterName:'Anatolia',proficiency:'Sword',personalKind:'inherent'}).description).toBeNull()
 })
 it('preserves source disagreements instead of silently selecting an outside correction',()=>{
  const advice=resolvePersonalAbilityResearch('Bonaventure','inherent','Sage Advice')!
  expect(advice.description).toBe('Grants Def+3 to adjacent allies.')
  expect(advice.notice).toContain('Dexterity +3')
  expect(advice.references.some(reference=>reference.url==='https://annasnotebook.net/en/characters/bonaventure/')).toBe(true)
  const insight=resolvePersonalAbilityResearch('Tialla','equippable','Tactician’s Insight')!
  expect(insight.notice).toContain('next combat')
  expect(insight.parts?.[1].information.description).toContain("foe throughout their next combat")
 })
 it('resolves all64 profiles without changing source inputs or gameplay percentages',()=>{
  const before=JSON.stringify([growthData,communityData])
  expect(growthData.characters).toHaveLength(64)
  for(const character of growthData.characters)for(const personalKind of ['inherent','equippable'] as const){
   resolveAbilityInformation({name:character.personal[personalKind].text,characterName:character.name,personalKind})
  }
  expect(JSON.stringify([growthData,communityData])).toBe(before)
  expect(profile('Sofia').growths.Mag).toBe(45)
 })
})
