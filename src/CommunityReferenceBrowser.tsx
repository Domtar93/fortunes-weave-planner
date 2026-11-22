import {useEffect,useMemo,useRef,useState} from 'react'
import {communityData,columnName,referenceDisplayValue,referenceFieldLabel,referenceRowLabel,referenceRows,type ReferenceSheet,type CommunityReferenceRequest} from './community'

const loaders=import.meta.glob<{default:ReferenceSheet}>('./data/community-sheets/*.json')
export default function CommunityReferenceBrowser({navigation}:{navigation?:CommunityReferenceRequest}) {
 const [opened,setOpened]=useState(false),[title,setTitle]=useState('Forging'),[search,setSearch]=useState(''),[page,setPage]=useState(0)
 const [loaded,setLoaded]=useState<ReferenceSheet>(),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const cache=useRef(new Map<string,ReferenceSheet>())
 const [arrival,setArrival]=useState<CommunityReferenceRequest>(),[navigationError,setNavigationError]=useState('')
 const targetRef=useRef<HTMLDetailsElement>(null),focused=useRef<number|undefined>(undefined)
 useEffect(()=>{
  if(!navigation)return
  setOpened(true)
  if(!communityData.combatArts.some(item=>item.row===navigation.row)){setNavigationError('That combat-art source row is unavailable. No substitute was selected.');return}
  setNavigationError('');setTitle('Combat Arts');setArrival(navigation)
 },[navigation])
 const info=communityData.sheets.find(s=>s.title===title)!
 useEffect(()=>{
  if(!opened)return
  let active=true;setLoaded(undefined);setError('')
  const cached=cache.current.get(title)
  if(cached){setLoaded(cached);return}
  const loader=loaders[`./data/community-sheets/${info.key}.json`]
  Promise.resolve().then(()=>{if(!loader)throw new Error('Missing bundled reference sheet.');return loader()}).then(module=>{
   cache.current.set(title,module.default);if(active)setLoaded(module.default)
  }).catch(()=>{if(active)setError('The bundled reference could not be opened. Retry without changing your build.')})
  return()=>{active=false}
 },[opened,title,info.key,retry])
 const activeSheet=loaded?.title===title?loaded:undefined
 const matching=useMemo(()=>activeSheet?referenceRows(activeSheet,search):[],[activeSheet,search])
 const activePage=Math.min(page,Math.max(0,Math.ceil(matching.length/20)-1))
 const normalRows=matching.slice(activePage*20,(activePage+1)*20)
 const target=arrival&&title==='Combat Arts'?activeSheet?.rows.find(row=>row.row===arrival.row):undefined
 const outside=!!target&&!normalRows.includes(target)
 const visible=target&&outside?[target,...normalRows]:normalRows
 useEffect(()=>{
  if(!opened||!target||!arrival||focused.current===arrival.sequence||!targetRef.current)return
  targetRef.current.focus({preventScroll:true});targetRef.current.scrollIntoView?.({behavior:'instant',block:'center'});focused.current=arrival.sequence
 },[opened,target,arrival])
 return <details className="progression-panel community-reference" open={opened} onToggle={event=>setOpened(event.currentTarget.open)}>
 <summary><span>Expanded Community Reference</span><span>27 source worksheets <span aria-hidden="true">＋</span></span></summary>
 {opened&&<section aria-label="Expanded community reference browser">
 <p className="details-context reference-lead">A searchable offline copy of the extra community research sheet: forging steps and costs, combat arts, skill effects, bloodmarks, trading, repairs, Thermae, character preferences and source discussions. Pick a worksheet, then search or page through its rows. Values remain unverified.</p>
 <details className="reader-disclosure"><summary>About this data</summary><p className="details-key">Comments, NPCs, datamines and enemy-only rows are source evidence, not selectable playable profiles. All populated cells, source formulas, errors and notes are retained.</p></details>
 <p className="class-source-warning">Reference conflicts: Armored Ornius Rider growth/movement; Meganius growth distribution; Ranger flat Charisma; eight class movements. New scroll ranges contain date serials. Existing corrected calculations and warnings remain in effect.</p>
 <div className="progression-tools"><div><label htmlFor="community-sheet">Reference worksheet</label><select id="community-sheet" value={title} onChange={event=>{setTitle(event.target.value);setPage(0);setSearch('');setArrival(undefined);setNavigationError('')}}>{communityData.sheets.map(s=><option key={s.key}>{s.title}</option>)}</select></div>
 <div><label htmlFor="community-search">Search reference rows and notes</label><input id="community-search" type="search" value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}}/></div></div>
 {title==='Forging'&&<p className="details-key">Search a weapon to see its base and grouped refinement rows. Blank step cells remain unrecorded; no numeric carry-forward is assumed. Source N1 note: skipping levels still requires intermediate materials/gold; each row lists that step’s new cost.</p>}
 {title==='Thermae'&&<p className="details-key">The source describes a random effect from the bath’s pool lasting the current chapter; another bath overwrites the prior effect.</p>}
 <a className="entry-source" href={`${communityData.sourceUrl}#gid=${info.gid}`} target="_blank" rel="noreferrer">Open {title} source</a>
 {navigationError&&<p role="alert">{navigationError}</p>}
 {target&&<div className="proficiency-arrival"><p role="status">Combat-art navigation target · {referenceRowLabel(activeSheet!,target)}. {outside?'Temporarily shown outside the current search or page. ':''}Search and page controls are unchanged.</p><button type="button" className="shortlist-button" onClick={()=>setArrival(undefined)}>Return to reference results</button></div>}
 {arrival&&activeSheet&&title==='Combat Arts'&&!target&&<p role="alert">The requested source row is missing. No substitute was selected.</p>}
 {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(x=>x+1)}>Retry reference</button></div>:!activeSheet?<p role="status">Opening bundled reference…</p>:<>
 <p className="details-context catalog-count">{matching.length} matching source rows · showing {matching.length?activePage*20+1:0}–{Math.min((activePage+1)*20,matching.length)}</p>
 <div className="comparison-actions"><button type="button" disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Previous reference page</button><button type="button" disabled={(activePage+1)*20>=matching.length} onClick={()=>setPage(activePage+1)}>Next reference page</button></div>
 {!matching.length&&<p className="empty-state">No source rows match this search. Try a shorter search or another worksheet.</p>}
 <div className="community-rows">{visible.map(row=><details className={`class-section${target===row?' community-navigation-target':''}`} key={`${title}-${row.row}`} open={target===row?true:undefined} tabIndex={target===row?-1:undefined} ref={target===row?targetRef:undefined}><summary>{referenceRowLabel(activeSheet,row)}</summary><dl className="community-fields">{row.cells.map(cell=>{
  const locator=`${columnName(cell.column)}${row.row}`
  return <div key={cell.column}><dt>{referenceFieldLabel(activeSheet,row.row,cell.column)}</dt>
   <dd className="recorded-text">{cell.error?`Source error · ${cell.error.type}: ${cell.error.message}`:referenceDisplayValue(cell)}{typeof cell.value==='boolean'?' (source boolean)':''}</dd>
   {cell.value!==null&&cell.formatted!==null&&cell.formatted!==String(cell.value)&&<dd className="details-key">Raw source value: {String(cell.value)}</dd>}
   {cell.note&&<dd className="recorded-text details-key">Note: {cell.note}</dd>}
   {cell.formula&&<dd className="recorded-text details-key">Source formula (not evaluated here): {cell.formula}</dd>}
   <dd><a className="entry-source" href={`${communityData.sourceUrl}#gid=${info.gid}&range=${locator}`} target="_blank" rel="noreferrer">{title}!{locator}</a></dd>
  </div>
 })}</dl></details>)}</div>
 </>}
 <details className="class-section"><summary>Data integrity and recorded source errors</summary><p className="details-key">Snapshot identity: {communityData.snapshotSha256}. Formula results are source evidence, not independently verified mechanics. Growth and flat stats remain separate in the calculator.</p>{communityData.issues.map(item=><p className="recorded-text details-key" key={`${item.sheet}!${item.cell}`}>{item.sheet}!{item.cell} · {item.message}</p>)}</details>
 </section>}</details>
}
