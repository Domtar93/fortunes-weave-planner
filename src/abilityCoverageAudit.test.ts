import {describe,expect,it} from 'vitest'
import rawIndex from './data/ability-info.json'
import {communityData,communityEntries} from './community'
import {proficiencyData} from './proficiencies'
import {PROFICIENCIES,type Proficiency} from './growths'
import {resolveAbilityInformation,type AbilityInformation,type AbilityInformationInput} from './abilityInfo'
import {abilityResearch} from './abilityResearch'

// Independent, complete-corpus audit: raw definitions and both unlock tables are
// enumerated independently of the resolver's lookup/index construction.
const described=(info:AbilityInformation):boolean=>Boolean(info.description||info.hasConflict||info.parts?.some(part=>described(part.information)))
const contextRows=(kind:'original'|'additional')=>{
 const rows:AbilityInformationInput[]=[]
 for(const proficiency of PROFICIENCIES){
  const characters=kind==='original'?proficiencyData.categories[proficiency].characters:communityData.learnsets[proficiency].characters
  for(const characterName of Object.keys(characters)){
   const entries=kind==='original'?proficiencyData.categories[proficiency].characters[characterName]:communityEntries(proficiency,characterName)
   for(const entry of entries)if(entry.text&&(entry.state==='documented'||entry.state==='compound'))rows.push({name:entry.text,characterName,proficiency,rank:entry.rank,source:entry.source})
  }
 }
 return rows
}
const original=contextRows('original'),additional=contextRows('additional')

describe('independent full ability coverage audit',()=>{
 it('covers every imported definition, including all89 partial upgraded rows and Agnea’s Arrow',()=>{
  expect(rawIndex.records).toHaveLength(595)
  expect(rawIndex.records.filter(record=>record.kind!=='skill-note')).toHaveLength(535)
  const uncovered:string[]=[],summaries:string[]=[],conflicts:string[]=[]
  for(const record of rawIndex.records){
   const info=resolveAbilityInformation({name:record.name,proficiency:record.proficiency as Proficiency|undefined})
   if(!described(info))uncovered.push(record.reference.label+' '+record.name)
   if(info.hasConflict)conflicts.push(record.reference.label+' '+record.name)
   if(info.descriptionKind==='recorded-values')summaries.push(record.reference.label+' '+record.name)
  }
  expect(uncovered).toEqual([])
  expect(conflicts).toEqual([])
  const blankUpgrades=rawIndex.records.filter(record=>record.name.endsWith('+')&&!record.description)
  expect(blankUpgrades).toHaveLength(89)
  let researchedUpgrades=0
  for(const record of blankUpgrades){
   const info=resolveAbilityInformation({name:record.name,proficiency:record.proficiency as Proficiency|undefined})
   const researched=abilityResearch.definitions.some(definition=>definition.name===record.name&&definition.proficiency===record.proficiency)
   if(researched)researchedUpgrades++
   expect(info.descriptionKind,record.name).toBe(researched?'web-reference':'recorded-values')
  }
  expect(summaries).toHaveLength(89-researchedUpgrades)
  const agnea=resolveAbilityInformation({name:"Agnea's Arrow",proficiency:'Reason'})
  expect(agnea.descriptionKind).toBe('web-reference')
  expect(agnea.description?.toLowerCase()).toContain('fire')
 })
 it('retains both Magic and Resistance in the complete Authority name-cell note and its explicit upgrade notation',()=>{
  const notes=rawIndex.records.filter(record=>record.kind==='skill-note')
  expect(notes).toHaveLength(60)
  for(const note of notes)expect(note.reference.label).toMatch(/!A\d+ \(note\)$/u)
  for(const name of ['Lend Magic','Lend Magic++']){
   const info=resolveAbilityInformation({name,proficiency:'Authority'})
   expect(info.description).toContain('Mag/Res +2/3/5')
   expect(info.hasConflict).toBe(false)
   expect(info.references).toContainEqual(expect.objectContaining({label:'Authority!A81 (note)'}))
   expect(info.descriptionKind).toBe('spreadsheet')
  }
 })
 it('covers every named unlock path in both workbooks while retaining the exact conflicting Resistance unlock warning',()=>{
  const unique=(rows:AbilityInformationInput[])=>new Set(rows.filter(row=>{
   const entries=row.source?.startsWith('Community ')?communityEntries(row.proficiency!,row.characterName!):proficiencyData.categories[row.proficiency!].characters[row.characterName!]
   return entries.find(entry=>entry.source===row.source&&entry.rank===row.rank)?.state==='documented'
  }).map(row=>JSON.stringify([row.proficiency,row.name])))
  expect(unique(original).size).toBe(307)
  expect(unique(additional).size).toBe(301)
  const unresolved:AbilityInformationInput[]=[]
  for(const input of [...original,...additional]){
   const info=resolveAbilityInformation(input)
   if(!described(info))unresolved.push(input)
  }
  expect(unresolved).toEqual([])
  const info=resolveAbilityInformation({name:'Lend Resistance',characterName:'Ninae',proficiency:'Authority',rank:'S',source:"'Authority'!F42"})
  expect(info.descriptionKind).toBe('web-reference')
  expect(info.notice).toContain('Lend Strength++')
  expect(info.description).toBe("Grants Res+2 to an ally until unit's next phase.")
  expect(info.facts).toEqual([])
 })
 it('represents all53 compound texts as separate described children while retaining rank, level and story annotations',()=>{
  const compounds=new Map<string,AbilityInformationInput>()
  for(const input of [...original,...additional]){
   const entries=input.source?.startsWith('Community ')?communityEntries(input.proficiency!,input.characterName!):proficiencyData.categories[input.proficiency!].characters[input.characterName!]
   if(entries.find(entry=>entry.source===input.source&&entry.rank===input.rank)?.state==='compound')compounds.set(JSON.stringify([input.proficiency,input.name]),input)
  }
  expect(compounds.size).toBe(53)
  const unresolvedChildren:string[]=[]
  for(const input of compounds.values()){
   const info=resolveAbilityInformation(input)
   expect(info.descriptionKind,input.name!).toBe('compound')
   expect(info.parts?.length,input.name!).toBeGreaterThan(0)
   for(const part of info.parts??[])if(!described(part.information))unresolvedChildren.push(input.name+' → '+part.label)
   for(const annotation of input.name!.match(/\([^)]*\)/gu)??[])expect(info.parts!.some(part=>part.label.includes(annotation)),input.name!).toBe(true)
  }
  expect(unresolvedChildren).toEqual([])
 })
 it('does not inflate a partial upgrade row into complete stats or inherit an unstated special effect',()=>{
  for(const [name,expected] of [
   ['Astra+',[{label:'Hit',value:'+20'}]],
   ['Arrowcrack+',[{label:'Cost',value:'4'}]],
   ['Blaze Blow+',[{label:'Might',value:'+10'}]],
   ['Battle Rush+',[{label:'Might',value:'0'}]],
  ] as const){
   const info=resolveAbilityInformation({name,proficiency:name==='Arrowcrack+'?'Bow':name==='Battle Rush+'?'Gauntlet':'Sword'})
   expect(info.facts).toEqual(expected)
   if(info.descriptionKind==='recorded-values'){
    expect(info.description).toMatch(/^Recorded upgrade values:/u)
    expect(info.description).not.toMatch(/no (?:special|additional|extra) effect|same (?:effect|as)|Str\/2|five|5 times/iu)
   }else{
    expect(info.descriptionKind).toBe('web-reference')
    expect(abilityResearch.definitions.some(definition=>definition.name===name)).toBe(true)
   }
  }
 })
 it('keeps contextual historical-name reconciliation out of unrelated profiles and source cells',()=>{
  const source={name:'Brilliant Blow',characterName:'Orchel',proficiency:'Spear' as const,rank:'A',source:"'Spear'!E47"}
  expect(resolveAbilityInformation(source).descriptionKind).toBe('source-reconciliation')
  for(const input of [{...source,characterName:'Alexandra'},{...source,rank:'B'},{...source,source:"'Spear'!E48"},{...source,proficiency:'Sword' as const}])expect(resolveAbilityInformation(input).description).toBeNull()
 })
 it('does not rewrite source rows, ranks, annotations, original glossary data or unlock identities during full-corpus display resolution',()=>{
  const before=JSON.stringify([rawIndex,communityData,proficiencyData,original,additional])
  for(const input of [...original,...additional])resolveAbilityInformation(input)
  for(const record of rawIndex.records)resolveAbilityInformation({name:record.name,proficiency:record.proficiency as Proficiency|undefined})
  expect(JSON.stringify([rawIndex,communityData,proficiencyData,original,additional])).toBe(before)
 })
})
