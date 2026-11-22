import raw from './data/personal-ability-research.json'
import {communityData} from './community'
import {growthData} from './growths'
import type {AbilityInformation} from './abilityInfo'

type PersonalKind = 'inherent' | 'equippable'
interface Citation {label:string;url:string}
export interface PersonalVariant {
 name:string;description:string;level?:number;reliability:'community';sources:Citation[]
}
export interface PersonalResearchRecord {
 characterName:string;personalKind:PersonalKind;recordedName:string;originalSource:string
 companionName:string;companionDescription:string;companionSource:string
 variants:PersonalVariant[];notes:string[];notice?:string
}
export interface PersonalResearch {
 schemaVersion:number;game:string;reviewedAt:string;sourceSnapshotSha256:string;originalSourceSha256:string
 records:PersonalResearchRecord[]
}

// Each review is bound to both unchanged inputs and exact character/field paths.
// A newline is never evidence of an upgrade, level, or name/effect pairing.
export function validatePersonalAbilityResearch(data:PersonalResearch):PersonalResearch {
 if(data.schemaVersion!==1||data.game!=="Fire Emblem: Fortune's Weave"||data.sourceSnapshotSha256!==communityData.snapshotSha256||data.originalSourceSha256!==growthData.metadata.sourceSha256)
  throw new Error('Personal ability research needs review against the current source snapshots.')
 const seen=new Set<string>()
 for(const record of data.records){
  if(!['inherent','equippable'].includes(record.personalKind))throw new Error('Invalid personal ability field.')
  const identity=JSON.stringify([record.characterName,record.personalKind])
  if(seen.has(identity))throw new Error('Duplicate personal ability research path.')
  seen.add(identity)
  const profile=growthData.characters.find(character=>character.name===record.characterName)
  const companion=Object.hasOwn(communityData.characters,record.characterName)?communityData.characters[record.characterName]:undefined
  const original=profile?.personal[record.personalKind]
  const names=companion?.[record.personalKind]
  const description=companion?.[record.personalKind==='inherent'?'inherentDescription':'equippableDescription']
  if(!record.recordedName?.trim()||original?.text!==record.recordedName||original?.source!==record.originalSource||names?.value!==record.companionName||description?.value!==record.companionDescription||description?.source!==record.companionSource)
   throw new Error('Personal ability research no longer matches its exact source fields.')
  if(!record.variants.length)throw new Error('Personal ability research needs reviewed effects.')
  const variantNames=new Set<string>()
  for(const variant of record.variants){
   if(!variant.name.trim()||!variant.description.trim()||variant.reliability!=='community'||variantNames.has(variant.name))throw new Error('Invalid or duplicate personal ability variant.')
   variantNames.add(variant.name)
   if(variant.level!==undefined&&(!Number.isInteger(variant.level)||variant.level<1))throw new Error('Invalid reviewed personal ability level.')
   if(!variant.sources.length)throw new Error('Personal ability research needs supporting references.')
   for(const reference of variant.sources)if(!reference.label.trim()||new URL(reference.url).protocol!=='https:')throw new Error('Invalid personal ability citation.')
  }
 }
 return data
}

export const personalAbilityResearch=validatePersonalAbilityResearch(raw as PersonalResearch)
const reviewed=new Map(personalAbilityResearch.records.map(record=>[JSON.stringify([record.characterName,record.personalKind]),record]))

export function resolvePersonalAbilityResearch(characterName:string,kind:PersonalKind,name:string):AbilityInformation|undefined {
 const record=reviewed.get(JSON.stringify([characterName,kind]))
 if(!record||record.recordedName!==name)return undefined
 const companion=communityData.characters[characterName]
 const field=companion[kind==='inherent'?'inherentDescription':'equippableDescription']
 const references=new Map<string,Citation>([[field.url,{label:field.source,url:field.url}]])
 const information=(variant:PersonalVariant):AbilityInformation=>({
  description:variant.description,descriptionKind:'reviewed-personal',alternatives:[],hasConflict:false,facts:[],references:variant.sources,
 })
 for(const variant of record.variants)for(const reference of variant.sources)references.set(reference.url,reference)
 // Source wording and review rationale stay available in the existing disclosure.
 const result:AbilityInformation={description:null,descriptionKind:'reviewed-personal',alternatives:[record.companionDescription,...record.notes],hasConflict:false,facts:[],references:[...references.values()],...(record.notice?{notice:record.notice}:{})}
 if(record.variants.length===1&&record.variants[0].level===undefined&&record.variants[0].name===record.recordedName)result.description=record.variants[0].description
 else result.parts=record.variants.map(variant=>({label:`${variant.name}${variant.level===undefined?'':` · Level ${variant.level}`}`,information:information(variant)}))
 return result
}
