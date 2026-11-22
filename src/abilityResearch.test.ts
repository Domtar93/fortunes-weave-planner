import {describe,it,expect} from 'vitest'
import {abilityResearch,validateAbilityResearch} from './abilityResearch'
import {resolveAbilityInformation} from './abilityInfo'
const clone=()=>structuredClone(abilityResearch)
describe('reviewed ability research',()=>{
 it('contains game-specific citations and stays bound to the supplied reference snapshot',()=>{
  expect(validateAbilityResearch(clone())).toEqual(abilityResearch)
  const data=clone();data.sourceSnapshotSha256='changed'
  expect(()=>validateAbilityResearch(data)).toThrow(/different game or reference snapshot/)
 })
 it('rejects duplicate exact definitions',()=>{
  const data=clone();data.definitions.push({...data.definitions[0]})
  expect(()=>validateAbilityResearch(data)).toThrow(/duplicate/)
 })
 it('rejects conflicting research rows for the same old source path',()=>{
  const data=clone();data.reconciliations.push({...data.reconciliations[0]})
  expect(()=>validateAbilityResearch(data)).toThrow(/Duplicate scoped/)
 })
 it('requires a current exact source match for a reconciliation',()=>{
  const data=clone();data.reconciliations[0].rank='D'
  expect(()=>validateAbilityResearch(data)).toThrow(/exact source paths/)
 })
 it('requires a description for a reconciled name and no invented effect on an unresolved record',()=>{
  const data=clone();data.reconciliations[0].description=''
  expect(()=>validateAbilityResearch(data)).toThrow(/needs a description/)
  const other=clone();other.unresolved[0].description='Res+5'
  expect(()=>validateAbilityResearch(other)).toThrow(/cannot assert an effect/)
 })
 it('rejects malformed missing identities before undefined fields can match missing data',()=>{
  const data=clone();data.unresolved[0].characterName=''
  expect(()=>validateAbilityResearch(data)).toThrow(/complete scoped identity/)
  const other=clone();delete (other.unresolved[0] as Partial<typeof other.unresolved[0]>).recordedName
  expect(()=>validateAbilityResearch(other)).toThrow(/complete scoped identity/)
 })
 it('rejects missing citations and unsafe URL schemes',()=>{
  const data=clone();data.definitions[0].sources=[]
  expect(()=>validateAbilityResearch(data)).toThrow(/supporting references/)
  const other=clone();other.definitions[0].sources[0].url='javascript:alert(1)'
  expect(()=>validateAbilityResearch(other)).toThrow(/Invalid ability research citation/)
 })
 it('separates Counter Fliers range2 from range3 without changing the penalty',()=>{
  const base=resolveAbilityInformation({name:'Counter Fliers',proficiency:'Authority'})
  const upgrade=resolveAbilityInformation({name:'Counter Fliers+',proficiency:'Authority'})
  expect(base.description).toBe('Flying foes within 2 spaces have Hit and Avo reduced by 5.')
  expect(upgrade.description).toBe('Flying foes within 3 spaces have Hit and Avo reduced by 5.')
  expect(base.descriptionKind).toBe('web-reference')
  expect(upgrade.descriptionKind).toBe('web-reference')
 })
 it.each([['Killer Spike','Axe'],["Mind's-Eye Blow",'Gauntlet'],['Excalibur','Reason'],['Sagittae','Reason'],['Aura','Faith'],["Agnea's Arrow",'Reason']] as const)('fills actual base description for %s while retaining its recorded facts',(name,proficiency)=>{
  const info=resolveAbilityInformation({name,proficiency})
  expect(info.description).toBeTruthy();expect(info.descriptionKind).toBe('web-reference')
  expect(info.references.some(ref=>ref.url.startsWith('https://'))).toBe(true)
  expect(info.facts.length).toBeGreaterThan(0)
 })
 it('retains Rsl rather than replacing it with Res on the historical Brilliant Blow path',()=>{
  const info=resolveAbilityInformation({name:'Brilliant Blow',characterName:'Orchel',proficiency:'Spear',rank:'A',source:"'Spear'!E47"})
  expect(info.description).toContain('Rsl+7')
  expect(info.description).not.toContain('Res+7')
  expect(info.notice).toBe('Current references call this Brilliant Strike.')
 })
 it('keeps the exact upgrade conditions, sequence and damage proportions found in the public references',()=>{
  const texts=[
   resolveAbilityInformation({name:'Arrowcrack+',proficiency:'Bow'}).description,
   resolveAbilityInformation({name:'Haphazard+',proficiency:'Bow'}).description,
   resolveAbilityInformation({name:'Double Throw+',proficiency:'Spear'}).description,
   resolveAbilityInformation({name:'One-Two Punch+',proficiency:'Gauntlet'}).description,
   resolveAbilityInformation({name:'Crosswise Cut+',proficiency:'Sword'}).description,
  ]
  expect(texts[0]).toContain('50% chance of Atk+15')
  expect(texts[1]).toContain('Four consecutive strikes; each deals 90% damage')
  expect(texts[2]).toContain('requires a range 1–2 spear')
  expect(texts[3]).toContain('User attacks second; Avo+20')
  expect(texts[4]).toContain('Dexterity +2 (maximum +10) until map ends')
 })
 it('never substitutes base or similarly named effects for the two still undocumented upgrades',()=>{
  for(const [name,proficiency] of [['Greater Hexblade+','Sword'],['Spirit Blow+','Gauntlet']] as const){
   const info=resolveAbilityInformation({name,proficiency})
   expect(info.descriptionKind).toBe('recorded-values')
   expect(info.description).toBe('Recorded upgrade values: Might +15; Hit +20.')
   expect(info.description).not.toMatch(/magical|no additional|no special|Res\/2/iu)
  }
 })
})
