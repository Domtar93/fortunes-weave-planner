import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react'
import type {BuildLoadout} from './loadouts'
import {communityData} from './community'
import {MAX_BACKUP_BYTES} from './loadoutBackupModel'
import {downloadShortlistText} from './shortlistDownload'
import {formatReferenceRecovery,parseReferenceRecovery,previewReferenceRecovery,suggestedRecoveryName,RECOVERY_FILENAME,type ReferenceRecoveryPackage} from './referenceRecoveryModel'

export default function ReferenceRecovery({loadouts,disabled,onRecover}:{loadouts:BuildLoadout[];disabled:boolean;onRecover:(value:ReferenceRecoveryPackage,id:string,accepted:ReadonlySet<string>,name:string)=>void}) {
 const [opened,setOpened]=useState(false),[incoming,setIncoming]=useState<ReferenceRecoveryPackage>(),[id,setId]=useState(''),[name,setName]=useState('')
 const [accepted,setAccepted]=useState<Set<string>>(new Set()),[feedback,setFeedback]=useState<{error:boolean;text:string}>(),[manual,setManual]=useState<string>()
 const sequence=useRef(0),mounted=useRef(false),area=useRef<HTMLTextAreaElement>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++}},[])
 useEffect(()=>{if(manual!==undefined){area.current?.focus();area.current?.select()}},[manual])
 const preview=useMemo(()=>{
  if(!incoming||!id)return undefined
  try{return {value:previewReferenceRecovery(incoming,id)}}catch(error){return {error:error instanceof Error?error.message:'The recovery preview could not be created.'}}
 },[incoming,id])
 const read=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0];event.currentTarget.value='';const request=++sequence.current
  setIncoming(undefined);setId('');setName('');setAccepted(new Set());setFeedback(undefined);setManual(undefined)
  if(!file)return
  try{
   if(file.size>MAX_BACKUP_BYTES)throw new Error('Reference recovery file exceeds the 5 MiB limit.')
   const value=parseReferenceRecovery(await file.text())
   if(!mounted.current||request!==sequence.current)return
   setIncoming(value);setFeedback({error:false,text:`Read ${value.loadouts.length} saved loadouts and their reference evidence. Choose one to review; nothing was saved.`})
  }catch(error){if(mounted.current&&request===sequence.current)setFeedback({error:true,text:error instanceof Error?error.message:'The recovery file could not be read.'})}
 }
 const download=()=>{
  let text:string|undefined
  setManual(undefined)
  try{text=formatReferenceRecovery(loadouts);downloadShortlistText(text,RECOVERY_FILENAME,'application/json;charset=utf-8');setFeedback({error:false,text:'Reference recovery download started. The browser controls final disk storage.'})}
  catch(error){if(text!==undefined)setManual(text);setFeedback({error:true,text:text!==undefined?'The recovery download could not start. Copy the selected JSON into a UTF-8 .json file.':error instanceof Error?error.message:'Reference recovery backup could not be prepared.'})}
 }
 const value=preview?.value,needsApproval=value?.mappings.some(row=>row.status==='changed'&&!accepted.has(row.key))
 return <details className="loadout-backup reference-recovery" onToggle={event=>setOpened(event.currentTarget.open)}><summary>Reference refresh & recovery</summary>
 {opened&&<section aria-label="Reference refresh and recovery">
 <p className="details-context">Before a source refresh, download your normal loadout backup and this reference recovery backup. It records the saved community unlock names and exact old sources, so a future version can show a reviewed mapping. Files stay on your computer.</p>
 <p className="details-key">Recovery creates a new named copy. It never overwrites or loads the old save. Changed unlocks need individual approval; unknown, unavailable, compound or missing targets block that plan. Evidence in an imported file remains unverified.</p>
 <p className="details-key">Already stale with no recovery file? Keep the normal JSON backup. Open the preserved previous release and export recovery evidence there. If that release is unavailable, rebuild the affected choices manually; the app cannot invent old unlock names from cell addresses.</p>
 <div className="comparison-actions"><button type="button" disabled={disabled} onClick={download}>Download reference recovery backup</button></div>
 <label htmlFor="reference-recovery-file">Choose reference recovery JSON</label><input id="reference-recovery-file" type="file" accept=".json,application/json" disabled={disabled} onChange={read}/>
 {feedback&&<p role={feedback.error?'alert':'status'} className={`preset-feedback ${feedback.error?'error':''}`}>{feedback.text}</p>}
 {manual!==undefined&&<><label htmlFor="reference-recovery-json">Reference recovery JSON for manual copying</label><textarea id="reference-recovery-json" className="shortlist-copy-text" ref={area} rows={8} readOnly value={manual}/><button type="button" onClick={()=>{area.current?.focus();area.current?.select()}}>Select recovery JSON</button></>}
 {incoming&&<><p className="entry-source">Old snapshot: {incoming.snapshotSha256}<br/>Current snapshot: {communityData.snapshotSha256}</p>
 <label htmlFor="reference-recovery-plan">Loadout to review</label><select id="reference-recovery-plan" value={id} onChange={event=>{
  const next=event.target.value,item=incoming.loadouts.find(loadout=>loadout.id===next)
  setId(next);setName(item?suggestedRecoveryName(item.name,loadouts):'');setAccepted(new Set());setFeedback(undefined)
 }}><option value="">Choose a saved loadout…</option>{incoming.loadouts.map(item=><option key={item.id} value={item.id}>{item.name} · {item.characterName} × {item.className}</option>)}</select>
 <button type="button" className="shortlist-button" onClick={()=>{sequence.current++;setIncoming(undefined);setId('');setAccepted(new Set());setFeedback(undefined)}}>Cancel reference recovery</button>
 </>}
 {preview?.error&&<p role="alert">{preview.error}</p>}
 {value&&<form className="reference-recovery-preview" aria-label="Reference recovery preview" onSubmit={event=>{
  event.preventDefault();if(!incoming)return
  try{onRecover(incoming,id,accepted,name);setId('');setAccepted(new Set());setFeedback({error:false,text:'Recovered copy saved locally. Original saves and the active planner are unchanged.'})}
  catch(error){setFeedback({error:true,text:error instanceof Error?error.message:'Recovery could not be saved. Original saves are unchanged.'})}
 }}>
 <h3>{value.loadout.name} · {value.loadout.characterName} × {value.loadout.className}</h3>
 <p className="details-key">Weapon, mount and battalion references are retained and validated. Ability order is retained; only the reviewed community source paths change.</p>
 {!value.mappings.length&&<p>No ability references to update. This loadout can be restored as a copy.</p>}
 <ol className="recovery-mappings">{value.mappings.map((row,index)=><li key={row.key}>
 <h4>{index+1}. {row.proficiency} {row.rank} · {row.status==='changed'?'Changed unlock':row.status==='blocked'?'Blocked':row.status==='source-update'?'Source update':'Unchanged'}</h4>
 <div className="source-comparison-pair"><div><h5>Previous saved evidence</h5><p className="recorded-text">{row.oldText}</p>{row.oldUrl?<a className="entry-source" href={row.oldUrl} target="_blank" rel="noreferrer">{row.oldSource}</a>:<p className="entry-source">{row.oldSource}</p>}</div><div><h5>Current candidate</h5><p className="recorded-text">{row.newText??'No usable current unlock'}</p>{row.newUrl&&<a className="entry-source" href={row.newUrl} target="_blank" rel="noreferrer">{row.newSource}</a>}</div></div>
 <p className={row.status==='blocked'||row.status==='changed'?'class-source-warning':'details-key'}>{row.reason}</p>
 {row.status==='changed'&&<label className="recovery-approval"><input type="checkbox" checked={accepted.has(row.key)} onChange={event=>setAccepted(current=>{const next=new Set(current);if(event.target.checked)next.add(row.key);else next.delete(row.key);return next})}/>Approve changed unlock {row.proficiency} {row.rank}</label>}
 </li>)}</ol>
 {value.blockingIssues.length>0&&<div role="alert">{value.blockingIssues.map((message,index)=><p key={index}>{message}</p>)}<p>Recovery of this plan is blocked. The old save remains available for backup or manual rebuilding.</p></div>}
 <label htmlFor="recovered-name">Recovered copy name</label><input id="recovered-name" value={name} onChange={event=>setName(event.target.value)}/>
 <div className="comparison-actions"><button type="submit" disabled={disabled||!name.trim()||!!value.blockingIssues.length||!!needsApproval}>Create recovered copy</button></div>
 </form>}
 </section>}</details>
}
