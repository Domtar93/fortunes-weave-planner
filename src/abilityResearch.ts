import raw from './data/ability-research.json'
import {communityData} from './community'
import {PROFICIENCIES,type Proficiency} from './growths'
import {proficiencyData,learnsetIdentity} from './proficiencies'
export interface ResearchSource {label:string;url:string}
interface ResearchDefinition {name:string;proficiency:Proficiency;description:string;reliability:'community';sources:ResearchSource[]}
export interface ScopedResearch {
 recordedName:string;characterName:string;proficiency:Proficiency;rank:string;source:string;currentName:string;sources:ResearchSource[];rationale:string;description?:string;notice?:string
}
interface AbilityResearch {schemaVersion:number;game:string;reviewedAt:string;sourceSnapshotSha256:string;definitions:ResearchDefinition[];reconciliations:ScopedResearch[];unresolved:ScopedResearch[]}
export function validateAbilityResearch(data:AbilityResearch):AbilityResearch {
 if(data.schemaVersion!==1||data.game!=="Fire Emblem: Fortune's Weave"||data.sourceSnapshotSha256!==communityData.snapshotSha256)throw new Error('Ability research belongs to a different game or reference snapshot.')
 const seen=new Set<string>()
 const sources=(items:ResearchSource[])=>{
  if(!items.length)throw new Error('Ability research needs supporting references.')
  for(const item of items)if(!item.label.trim()||new URL(item.url).protocol!=='https:')throw new Error('Invalid ability research citation.')
 }
 for(const item of data.definitions){
  const key=JSON.stringify([item.proficiency,item.name])
  if(seen.has(key)||!item.name.trim()||!item.description.trim()||!PROFICIENCIES.includes(item.proficiency)||item.reliability!=='community')throw new Error('Invalid or duplicate researched ability definition.')
  seen.add(key);sources(item.sources)
 }
 const scopedSeen=new Set<string>()
 for(const item of [...data.reconciliations,...data.unresolved]){
  if(!['recordedName','characterName','rank','source','currentName','rationale'].every(field=>typeof item[field as keyof ScopedResearch]==='string'&&String(item[field as keyof ScopedResearch]).trim())||!PROFICIENCIES.includes(item.proficiency))throw new Error('Ability research needs complete scoped identity fields.')
  const scopedKey=JSON.stringify([item.characterName,item.proficiency,item.rank,item.source])
  if(scopedSeen.has(scopedKey))throw new Error('Duplicate scoped ability research path.')
  scopedSeen.add(scopedKey)
  const identity=learnsetIdentity(item.characterName)
  const entry=proficiencyData.categories[item.proficiency]?.characters[identity]?.find(entry=>entry.rank===item.rank&&entry.source===item.source)
  const current=communityData.learnsets[item.proficiency]?.characters[identity]?.values[item.rank]?.[0]
  if(entry?.text!==item.recordedName||current!==item.currentName)throw new Error('Ability reconciliation no longer matches its exact source paths.')
  if(data.reconciliations.includes(item)&&!item.description?.trim())throw new Error('Ability reconciliation needs a description.')
  if(data.unresolved.includes(item)&&(!item.notice?.trim()||item.description))throw new Error('An unresolved ability needs a notice and cannot assert an effect.')
  sources(item.sources)
 }
 return data
}
export const abilityResearch=validateAbilityResearch(raw as AbilityResearch)
