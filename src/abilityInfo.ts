import {communityData} from './community'
import {growthData,type Proficiency} from './growths'
import {proficiencyData} from './proficiencies'
import {sourceRangeUrl} from './catalogReferences'
import packed from './data/ability-info-runtime.json'
import {unpackRuntimeData} from './runtimeCodec.js'
import {abilityResearch,type ScopedResearch} from './abilityResearch'
import {resolvePersonalAbilityResearch} from './personalAbilityResearch'

export interface AbilityFact { label:string;value:string }
export type AbilityDescriptionKind='spreadsheet'|'web-reference'|'source-reconciliation'|'recorded-values'|'compound'|'unresolved'|'reviewed-personal'
export const ABILITY_DESCRIPTION_LABELS:Record<AbilityDescriptionKind,string>={spreadsheet:'Spreadsheet description', 'web-reference':'Researched community description','source-reconciliation':'Reviewed historical-name reconciliation','recorded-values':'Summary of recorded values; additional effects are not established by this row',compound:'Separate descriptions; original unlock annotations retained',unresolved:'Conflicting unlock record; no effect inferred','reviewed-personal':'Reviewed character ability variants; source wording preserved in details'}
export interface AbilityInformation { description:string|null;alternatives:string[];hasConflict:boolean;references:{label:string;url:string}[];facts:AbilityFact[];descriptionKind?:AbilityDescriptionKind;notice?:string;parts?:{label:string;information:AbilityInformation}[] }
export interface AbilityInformationInput { name:string|null;proficiency?:Proficiency;fallback?:string|null;characterName?:string;rank?:string;source?:string;personalKind?:'inherent'|'equippable' }
interface Candidate { description:string|null;priority:number;label?:string;url?:string;facts?:AbilityFact[];proficiency?:Proficiency|null;kind?:string;descriptionKind?:AbilityDescriptionKind }
interface IndexedRecord {name:string;proficiency:Proficiency|null;kind:string;description:string|null;reference:{label:string;url:string};facts:AbilityFact[]}
export const abilityNameKey=(value:string)=>value.normalize('NFC').trim().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ').replace(/\s+(?=\+{1,2}$)/u,'').toLocaleLowerCase()
// Explicit typographic/footnote variants in the older sheet. Recorded names and
// source notes remain unchanged; this is not fuzzy matching between game skills.
const displayAliases:Record<string,string>={
 'narrow defence':'narrow defense',"mind's eye blow":"mind's-eye blow",
 'mire β':'mire b','fitting flier':'flitting flier','fitting flier+':'flitting flier+',
 'armored move*':'armored move','armored move+*':'armored move+','bowblock+*':'bowblock+',
 'build +5':'build','build+5':'build','build +10':'build','build+10':'build',
 'beat down':'beatdown',
}
export function meaningfulAbilityText(value:unknown):value is string {
 if(typeof value!=='string'||!value.trim()||/^(?:\?|[-—]+|n\/?a|none|description)$/iu.test(value.trim()))return false
 return !/^(?:effect not (?:yet )?(?:documented|sourced)|not yet (?:documented|sourced)|mechanical description not sourced|no effect linked in this view|description (?:not|un)available)/iu.test(value.trim())
}
const index=new Map<string,Candidate[]>()
function add(name:string,description:unknown,priority:number,label?:string,url?:string,facts?:AbilityFact[],proficiency?:Proficiency|null,kind?:string,descriptionKind?:AbilityDescriptionKind){
 const text=meaningfulAbilityText(description)?description.trim():null
 if(!text&&!facts?.length)return
 const key=abilityNameKey(name),items=index.get(key)??[]
 items.push({description:text,priority,label,url,facts,proficiency,kind,descriptionKind});index.set(key,items)
}
// Immutable lookup built once. Never scan thousands of learnset cells on a click.
for(const item of (unpackRuntimeData(packed) as {records:IndexedRecord[]}).records){
 if(item.kind!=='alias')add(item.name,item.description,item.kind==='skill-note'?-1:0,item.reference.label,item.reference.url,item.facts,item.proficiency,item.kind)
}
for(const item of abilityResearch.definitions)for(const ref of item.sources)add(item.name,item.description,-2,ref.label,ref.url,undefined,item.proficiency,undefined,'web-reference')
for(const item of communityData.skills)add(item.name,item.description.value,1,item.description.source,item.description.url,undefined,undefined,'skill')
for(const profile of growthData.classes){
 const d=profile.details
 for(const [ability,description] of [[d.masteryAbility,d.masteryDescription],[d.abilities,d.abilityDescriptions]])
  if(ability.text)add(ability.text,description.text,3,description.source,sourceRangeUrl(description.source))
}
for(const [name,item] of Object.entries(proficiencyData.glossary))add(name,item.description,4,item.source,item.reference?.startsWith('https://')?item.reference:sourceRangeUrl(item.source))

// Display enrichment only: original unlock identities, evidence and saves stay intact.
export function resolveAbilityInformation(input:AbilityInformationInput):AbilityInformation {
 const {name,proficiency,fallback,characterName,rank,source}=input
 const result:AbilityInformation={description:null,alternatives:[],hasConflict:false,references:[],facts:[]}
 if(!name?.trim())return result
 if(!proficiency&&characterName&&input.personalKind){
  const personal=resolvePersonalAbilityResearch(characterName,input.personalKind,name)
  if(personal)return personal
 }
 const recordedKey=abilityNameKey(name),key=Object.hasOwn(displayAliases,recordedKey)?displayAliases[recordedKey]:recordedKey
 const applicable=(items:Candidate[])=>items.filter(item=>!proficiency||!item.proficiency||item.proficiency===proficiency)
 let candidates=applicable(index.get(key)??[])
 const scoped=(item:ScopedResearch)=>item.recordedName===name&&item.characterName===characterName&&item.proficiency===proficiency&&item.rank===rank&&item.source===source
 const reconciliation=abilityResearch.reconciliations.find(scoped)
 const unresolved=abilityResearch.unresolved.find(scoped)
 if(reconciliation){
  result.notice=`Current references call this ${reconciliation.currentName}.`
  candidates=[...candidates,...reconciliation.sources.map(ref=>({description:reconciliation.description!,priority:-3,label:ref.label,url:ref.url,descriptionKind:'source-reconciliation' as const}))]
 }
 if(unresolved){
  result.notice=unresolved.notice;result.descriptionKind='unresolved'
  result.references.push(...unresolved.sources)
 }
 if(/^build\s*\+(?:5|10)$/u.test(recordedKey))result.facts.push({label:'Upgrade notation',value:'Base and upgraded values are shown as written.'})
 if(!candidates.some(item=>item.description)&&/\+{1,2}$/u.test(key)){
  const base=applicable(index.get(key.replace(/\+{1,2}$/u,''))??[])
  // Show the supplied base/upgrade notation verbatim, never invent variant values.
  candidates=[...candidates,...base.filter(item=>item.description&&(['skill','skill-note'].includes(item.kind??'')&&/\([^)]*\d[^)]*\)/u.test(item.description)||/\d\/\d/u.test(item.description))).map(item=>({...item,priority:item.priority+5}))]
  if(candidates.some(item=>item.description))result.facts.push({label:'Upgrade notation',value:'Base and upgraded values are shown as written.'})
 }
 if(characterName&&Object.hasOwn(communityData.characters,characterName)){
  const character=communityData.characters[characterName]
  for(const kind of ['inherent','equippable'] as const)if(typeof character[kind].value==='string'&&abilityNameKey(String(character[kind].value))===key){
   const f=character[kind==='inherent'?'inherentDescription':'equippableDescription']
   if(meaningfulAbilityText(f.value))candidates=[...candidates,{description:f.value.trim(),priority:-1,label:f.source,url:f.url}]
  }
 }
 if(meaningfulAbilityText(fallback))candidates=[...candidates,{description:fallback.trim(),priority:10}]
 const ordered=[...candidates].sort((a,b)=>a.priority-b.priority),described=ordered.filter(item=>item.description)
 if(described.length){
  const best=described.filter(item=>item.priority===described[0].priority)
  const distinct=[...new Set(best.map(item=>item.description!))]
  result.hasConflict=distinct.length>1
  result.description=distinct.length===1?distinct[0]:null
  result.descriptionKind=best[0].descriptionKind??'spreadsheet'
  result.alternatives=[...new Set(described.map(item=>item.description!))].filter(text=>text!==result.description)
 }
 const references=new Map<string,{label:string;url:string}>()
 for(const item of ordered)if(item.label&&item.url)references.set(item.url,{label:item.label,url:item.url})
 result.references=[...result.references,...references.values()]
 result.facts.push(...(ordered.find(item=>item.facts?.length)?.facts??[]).map(({label,value})=>({label,value})))
 if(!result.description&&!result.hasConflict&&!unresolved){
  const parts=splitAbilityNames(name).map(label=>({label,name:label.replace(/\s*\((?:[EDCBAS]\+?|base|prologue|Lv\.\s*\d+)\)\s*$/iu,'').trim()}))
  if(parts.length>1||parts.length===1&&parts[0].name!==name.trim()){
   const children=parts.map(part=>({label:part.label,information:resolveAbilityInformation({name:part.name,proficiency,characterName})}))
   if(children.some(part=>part.information.description||part.information.parts?.length)){
    result.parts=children;result.descriptionKind='compound'
    for(const child of children)for(const ref of child.information.references)if(!result.references.some(item=>item.url===ref.url))result.references.push(ref)
   }
  }
  if(!result.parts?.length&&result.facts.length){
   const ownFacts=result.facts.filter(fact=>fact.label!=='Upgrade notation')
   if(ownFacts.length){
    result.description=`Recorded${/\+$/u.test(name.trim())?' upgrade':''} values: ${ownFacts.map(fact=>`${fact.label} ${fact.value}`).join('; ')}.`
    result.descriptionKind='recorded-values'
   }
  }
 }
 return result
}

// Preserve raw annotations on each display child. Never infer a child's unlock
// rank or apply a parent source identity to independently resolved child names.
export function splitAbilityNames(value:string):string[]{
 const normalized=value.replace(/\r\n?/gu,'\n').replace(/\n\s*(?=\()/gu,' ')
 const parts:string[]=[];let depth=0,start=0
 for(let index=0;index<normalized.length;index++){
  const char=normalized[index]
  if(char==='(')depth++
  else if(char===')')depth=Math.max(0,depth-1)
  else if(depth===0&&[',','/','\n'].includes(char)){const part=normalized.slice(start,index).trim();if(part)parts.push(part);start=index+1}
 }
 const last=normalized.slice(start).trim();if(last)parts.push(last)
 return parts
}
