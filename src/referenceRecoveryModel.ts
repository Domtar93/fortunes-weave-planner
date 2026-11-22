import {communityData,communityEntries} from './community'
import {PROFICIENCIES,type Proficiency} from './growths'
import {learnsetIdentity} from './proficiencies'
import {isShortlistable,resolvePlanningEntry,learnsetSourceLink} from './shortlist'
import {createLoadout,resolveLoadout,validateLoadoutPayload,type AbilityReference,type BuildLoadout,type FullBuildSelection} from './loadouts'
import {MAX_BACKUP_BYTES} from './loadoutBackupModel'

export const RECOVERY_FILENAME='fortunes-weave-reference-recovery.json'
export interface RecoveryEvidence extends AbilityReference { characterName:string; text:string; url:string }
export interface ReferenceRecoveryPackage { format:'fortunes-weave-reference-recovery';version:1;snapshotSha256:string;loadouts:BuildLoadout[];evidence:RecoveryEvidence[] }
export interface RecoveryMapping { key:string; proficiency:Proficiency;rank:string;oldSource:string;oldText:string;oldUrl?:string;newSource?:string;newText?:string;newUrl?:string;status:'unchanged'|'source-update'|'changed'|'blocked';reason:string }
export interface RecoveryPreview { loadout:BuildLoadout;selection:FullBuildSelection;mappings:RecoveryMapping[];blockingIssues:string[] }
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
const evidenceKey=(name:string,ref:AbilityReference)=>JSON.stringify([name,ref.proficiency,ref.rank,ref.source])
const anyCommunity=(source:string)=>source.startsWith('Community ')

export function validateReferenceRecovery(value:unknown):ReferenceRecoveryPackage {
 if(!object(value)||!exact(value,['format','version','snapshotSha256','loadouts','evidence'])||value.format!=='fortunes-weave-reference-recovery'||value.version!==1||typeof value.snapshotSha256!=='string'||!/^[0-9a-f]{64}$/u.test(value.snapshotSha256)||!Array.isArray(value.evidence))throw new Error('Unsupported or damaged reference recovery file.')
 const payload=validateLoadoutPayload({schemaVersion:1,loadouts:value.loadouts})
 const namespace=`Community ${value.snapshotSha256.slice(0,12)}: `,keys=new Set<string>(),needed=new Set<string>()
 for(const item of value.evidence){
  if(!object(item)||!exact(item,['characterName','proficiency','rank','source','text','url'])||typeof item.characterName!=='string'||!PROFICIENCIES.includes(item.proficiency as Proficiency)||typeof item.rank!=='string'||typeof item.source!=='string'||typeof item.text!=='string'||!item.text.trim()||item.text.length>4096||typeof item.url!=='string')throw new Error('Damaged recovery ability evidence.')
  const category=communityData.learnsets[item.proficiency as Proficiency],prefix=`${namespace}${category.sheet}!`
  if(!item.source.startsWith(prefix)||!new RegExp('^[A-Z]+[1-9]\\d*$','u').test(item.source.slice(prefix.length)))throw new Error('Recovery evidence does not match its snapshot/category source.')
  const cell=item.source.slice(prefix.length)
  if(!item.url.startsWith(`${communityData.sourceUrl}#gid=`)||!new RegExp(`^\\d+&range=${cell}$`,'u').test(item.url.slice(communityData.sourceUrl.length+5)))throw new Error('Invalid recovery source link.')
  const key=evidenceKey(item.characterName,item as unknown as AbilityReference)
  if(keys.has(key))throw new Error('Duplicate recovery ability evidence.')
  keys.add(key)
 }
 for(const loadout of payload.loadouts)for(const ref of loadout.abilities)if(anyCommunity(ref.source)){
  const key=evidenceKey(loadout.characterName,ref)
  if(!keys.has(key))throw new Error('Recovery evidence is missing for a saved community reference.')
  needed.add(key)
 }
 if(keys.size!==needed.size)throw new Error('Recovery evidence contains unrelated source records.')
 return value as unknown as ReferenceRecoveryPackage
}
export function formatReferenceRecovery(loadouts:BuildLoadout[]):string {
 validateLoadoutPayload({schemaVersion:1,loadouts})
 const evidence=new Map<string,RecoveryEvidence>()
 for(const loadout of loadouts)for(const ref of loadout.abilities)if(anyCommunity(ref.source)){
  const planned=resolvePlanningEntry(loadout.characterName,ref.proficiency,ref.rank,ref.source)
  if(!planned||!planned.entry.text||!planned.entry.sourceUrl)throw new Error('Some saved community references are already stale. Keep a normal JSON backup, then restore the previous release to export its reference recovery file. No missing unlock names were invented.')
  evidence.set(evidenceKey(loadout.characterName,ref),{...ref,characterName:loadout.characterName,text:planned.entry.text,url:planned.entry.sourceUrl})
 }
 const value:ReferenceRecoveryPackage={format:'fortunes-weave-reference-recovery',version:1,snapshotSha256:communityData.snapshotSha256,loadouts,evidence:[...evidence.values()]}
 const text=JSON.stringify(validateReferenceRecovery(value),null,2)+'\n'
 if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)throw new Error('Reference recovery backup exceeds 5 MiB. Use the normal backup and preserve the previous release; this recovery file would be too large to read.')
 return text
}
export function parseReferenceRecovery(text:string):ReferenceRecoveryPackage {
 if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)throw new Error('Reference recovery file exceeds the 5 MiB limit.')
 return validateReferenceRecovery(JSON.parse(text.replace(/^\uFEFF/u,'')))
}
export function previewReferenceRecovery(value:ReferenceRecoveryPackage,id:string):RecoveryPreview {
 const validated=validateReferenceRecovery(value),loadout=validated.loadouts.find(item=>item.id===id)
 if(!loadout)throw new Error('Choose a loadout from the recovery file.')
 const evidence=new Map(validated.evidence.map(item=>[evidenceKey(item.characterName,item),item]))
 const mappings:RecoveryMapping[]=[],abilities:AbilityReference[]=[],blockingIssues:string[]=[]
 for(const ref of loadout.abilities){
  const old=evidence.get(evidenceKey(loadout.characterName,ref))
  const candidates=anyCommunity(ref.source)?communityEntries(ref.proficiency,learnsetIdentity(loadout.characterName)).filter(e=>e.rank===ref.rank):[]
  const planned=anyCommunity(ref.source)?candidates.length===1&&isShortlistable(candidates[0])?resolvePlanningEntry(loadout.characterName,ref.proficiency,ref.rank,candidates[0].source):null:resolvePlanningEntry(loadout.characterName,ref.proficiency,ref.rank,ref.source)
  const next=planned?.entry
  const originalReference=!anyCommunity(ref.source)
  const oldText=old?.text??(originalReference?'Original-workbook reference retained; historical unlock text is not captured in this recovery file.':'Old unlock evidence unavailable')
  const key=JSON.stringify([ref.source,next?.source??null,oldText,next?.text??null])
  const status=!next?'blocked':originalReference?'unchanged':oldText!==next.text?'changed':ref.source===next.source?'unchanged':'source-update'
  const reason=status==='blocked'?'No identifiable single current unlock exists at this exact profile, proficiency and rank. No substitute or removal is inferred.':status==='changed'?'The recorded unlock text changed. Individual approval is required.':status==='source-update'?'Same recorded unlock text; source reference changes to the current snapshot.':originalReference?'Original-workbook source path retained and currently resolvable. Historical text is not inferred.':'The current reference is unchanged.'
  mappings.push({key,proficiency:ref.proficiency,rank:ref.rank,oldSource:ref.source,oldText,oldUrl:old?.url??(next?learnsetSourceLink(next):undefined),newSource:next?.source,newText:next?.text??undefined,newUrl:next?learnsetSourceLink(next):undefined,status,reason})
  if(!next)blockingIssues.push(`${ref.proficiency} ${ref.rank}: ${reason}`)
  else abilities.push({proficiency:ref.proficiency,rank:ref.rank,source:next.source})
 }
 if(new Set(abilities.map(ref=>JSON.stringify(ref))).size!==abilities.length)blockingIssues.push('Two old references resolve to the same current source. No entries were merged.')
 const selection:FullBuildSelection={characterName:loadout.characterName,className:loadout.className,weaponId:loadout.weaponId,mountId:loadout.mountId,battalionId:loadout.battalionId,abilities}
 if(!blockingIssues.length)try{resolveLoadout(selection)}catch(error){blockingIssues.push(error instanceof Error?error.message:'The recovered selection is unresolved.')}
 return {loadout,selection,mappings,blockingIssues}
}
export function createRecoveredLoadout(value:ReferenceRecoveryPackage,id:string,accepted:ReadonlySet<string>,name:string,existing:BuildLoadout[],now=new Date().toISOString(),newId:string=crypto.randomUUID()):BuildLoadout {
 const preview=previewReferenceRecovery(value,id)
 if(preview.blockingIssues.length)throw new Error('Recovery is blocked by unresolved references. Original saves are unchanged.')
 if(preview.mappings.some(row=>row.status==='changed'&&!accepted.has(row.key)))throw new Error('Review and individually approve every changed unlock before creating a copy.')
 return createLoadout(name,preview.selection,existing,now,newId)
}
export function suggestedRecoveryName(original:string,existing:BuildLoadout[]):string {
 const names=new Set(existing.map(item=>item.name.toLocaleLowerCase()))
 for(let n=1;n<=existing.length+1;n++){
  const name=`${original} (recovered${n===1?'':` ${n}`})`
  if(!names.has(name.toLocaleLowerCase()))return name
 }
 throw new Error('Choose a unique recovery name.')
}
