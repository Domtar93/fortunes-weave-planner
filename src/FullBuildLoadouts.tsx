import { useMemo, useRef, useState, type FormEvent } from 'react'
import { browserStorage, validatedName, type StorageProvider } from './presets'
import { abilityReferences, createLoadout, LOADOUT_KEY, readLoadouts, resolveLoadout, updateLoadoutFromMain, writeLoadouts, type BuildLoadout, type FullBuildSelection } from './loadouts'
import { weaponData } from './forging'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { battalionData } from './battalions'
import LoadoutBackup from './LoadoutBackup'
import Portrait from './Portrait'
import { previewLoadoutImport } from './loadoutBackupModel'
import FullPlanComparison from './FullPlanComparison'
import ReferenceRecovery from './ReferenceRecovery'
import {createRecoveredLoadout} from './referenceRecoveryModel'

type Editor = { id: string; mode: 'rename' | 'duplicate' | 'delete' | 'update'; name: string; selection?: FullBuildSelection } | null
const updateLabels={characterName:'Character',className:'Class',weaponId:'Weapon',mountId:'Mount',battalionId:'Battalion'}
function updateChoice(selection:FullBuildSelection,key:keyof typeof updateLabels) {
  const value=selection[key]
  if(value===null)return 'Not selected'
  if(key==='weaponId')return weaponData.records.find(item=>item.id===value)?.name??`Unavailable source (${value})`
  if(key==='mountId')return mountData.records.find(item=>mountId(item)===value)?.name??`Unavailable source (${value})`
  if(key==='battalionId')return battalionData.records.find(item=>item.id===value)?.name??`Unavailable source (${value})`
  return value
}
export default function FullBuildLoadouts({ selection, onLoad, storage = browserStorage, initialOpen = false }: {
  initialOpen?: boolean;
  selection: FullBuildSelection; onLoad: (selection: FullBuildSelection) => void; storage?: StorageProvider
}) {
  const [snapshot, setSnapshot] = useState(() => readLoadouts(storage)), [name, setName] = useState('')
  const [opened, setOpened] = useState(initialOpen), [search, setSearch] = useState(''), [page, setPage] = useState(0)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>(), [editor, setEditor] = useState<Editor>(null)
  const trigger = useRef<HTMLButtonElement | null>(null), nameInput = useRef<HTMLInputElement | null>(null)
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return snapshot.loadouts.filter(item => !query || `${item.name}\n${item.characterName}\n${item.className}`.toLowerCase().includes(query))
  }, [snapshot.loadouts, search])
  const activePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1))
  const cards = useMemo(() => !opened ? [] : filtered.slice(activePage * 25, activePage * 25 + 25).map(loadout => {
    try { return { loadout, issue: null, entries: resolveLoadout(loadout).entries } }
    catch (error) { return { loadout, issue: error instanceof Error ? error.message : 'Saved sources could not be resolved.', entries: [] } }
  }), [opened, filtered, activePage])
  const attempt = (action: () => void) => { try { action() } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'The loadout action failed.' }) } }
  const commit = (next: BuildLoadout[], text: string) => {
    setSnapshot(writeLoadouts(snapshot, next, storage)); setFeedback({ error: false, text }); setEditor(null)
    if (editor?.mode === 'delete') nameInput.current?.focus(); else if (editor) trigger.current?.focus()
  }
  const save = (event: FormEvent) => {
    event.preventDefault(); attempt(() => {
      const loadout = createLoadout(name, selection, snapshot.loadouts)
      commit([...snapshot.loadouts, loadout], `Saved full loadout “${loadout.name}”.`); setName('')
    })
  }
  const edit = (event: FormEvent, loadout: BuildLoadout) => {
    event.preventDefault(); attempt(() => {
      if (!editor) return
      if (editor.mode === 'delete') { commit(snapshot.loadouts.filter(item => item.id !== loadout.id), `Deleted full loadout “${loadout.name}”.`); return }
      if (editor.mode === 'update') {
        if (!editor.selection || JSON.stringify(editor.selection)!==JSON.stringify(selection)) throw new Error('Main changed after the preview opened. Cancel and review Update from Main again. No saved loadout was changed.')
        const updated=updateLoadoutFromMain(loadout,editor.selection)
        commit(snapshot.loadouts.map(item=>item.id===loadout.id?updated:item),`Updated full loadout “${loadout.name}” from the reviewed Main build.`)
        return
      }
      const nextName = validatedName(editor.name, snapshot.loadouts, editor.mode === 'rename' ? loadout.id : undefined)
      const now = new Date().toISOString(), updatedAt = now < loadout.updatedAt ? loadout.updatedAt : now
      if (editor.mode === 'rename') commit(snapshot.loadouts.map(item => item.id === loadout.id ? { ...item, name: nextName, updatedAt } : item), `Renamed full loadout to “${nextName}”.`)
      else commit([...snapshot.loadouts, { ...loadout, abilities: loadout.abilities.map(reference => ({ ...reference })), id: crypto.randomUUID(), name: nextName, createdAt: now, updatedAt: now }], `Duplicated full loadout as “${nextName}”.`)
    })
  }
  return <details className="progression-panel preset-panel" open={opened} onToggle={event => setOpened(event.currentTarget.open)}>
    <summary><span>Full Build Loadouts</span><span>{snapshot.error ? 'Storage needs attention' : `${snapshot.loadouts.length} saved locally`} <span aria-hidden="true">＋</span></span></summary>
    {opened && <section aria-label="Saved full build loadouts">
      <p className="details-context">Save your current character, class, equipment and ordered abilities together in this browser.</p>
      <details className="reader-disclosure"><summary>About local saves</summary><p className="details-key">Unsaved choices reset on refresh. Loadouts use current workbook descriptions and growths. Saving does not automatically load a plan next time. Local saves belong to this browser and app address; back them up below.</p>{!snapshot.error && <div className="comparison-actions"><button type="button" onClick={() => {
        const next = readLoadouts(storage); setSnapshot(next); setEditor(null); setFeedback(next.error ? undefined : { error: false, text: 'Full loadouts read again. Stored data was not changed.' })
      }}>Retry reading full loadouts</button></div>}</details>
      {snapshot.error && <p role="alert" className="preset-feedback error">{snapshot.error}</p>}
      {snapshot.error && <div className="comparison-actions"><button type="button" onClick={() => {
        const next = readLoadouts(storage); setSnapshot(next); setEditor(null); setFeedback(next.error ? undefined : { error: false, text: 'Full loadouts read again. Stored data was not changed.' })
      }}>Retry reading full loadouts</button></div>}
      {snapshot.error && <p className="entry-source">Recovery key: {LOADOUT_KEY}. Existing data is retained; the app does not reset it.</p>}
      <form className="preset-save" onSubmit={save}>
        <div><label htmlFor="loadout-name">Loadout name</label><input ref={nameInput} id="loadout-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Alexandra — wing plan" /></div>
        <div><p className="comparison-pairing">{selection.characterName} × {selection.className}</p><p className="details-key">{selection.abilities.length}/8 planned abilities · main planner only</p></div>
        <button type="submit" disabled={!!snapshot.error}>Save main loadout</button>
      </form>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`preset-feedback ${feedback.error ? 'error' : ''}`}>{feedback.text}</p>}
      {!snapshot.error && !snapshot.loadouts.length && <p className="empty-state">No saved loadouts yet. Name your current build above, then save it.</p>}
      {snapshot.loadouts.length > 0 && <>
      <div className="selection-field loadout-search"><label htmlFor="loadout-search">Search saved loadouts</label><input id="loadout-search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Name, character or class" /></div>
      <p className="details-key">{filtered.length} matching of {snapshot.loadouts.length} saved · showing {filtered.length ? activePage * 25 + 1 : 0}–{Math.min((activePage + 1) * 25, filtered.length)}. Backup and comparison still include all saved loadouts.</p>
      <p className="details-key">Loading a loadout replaces this character's current main equipment and planned abilities with its saved choices.</p>
      </>}
      {filtered.length > 25 &&<div className="comparison-actions"><button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous loadout page</button><button type="button" disabled={(activePage + 1) * 25 >= filtered.length} onClick={() => setPage(activePage + 1)}>Next loadout page</button></div>}
      <ul className="preset-list">{cards.map(({ loadout, issue, entries }) => <li key={loadout.id} className="preset-card" aria-label={`Saved full loadout: ${loadout.name}`}>
        <h3>{loadout.name}</h3><div className="pairing-with-portrait"><Portrait name={loadout.characterName} size="small" /><p className="comparison-pairing">{loadout.characterName} × {loadout.className}</p></div>
        <p className="entry-source">Last modified <time dateTime={loadout.updatedAt}>{new Date(loadout.updatedAt).toLocaleString()}</time></p>
        <p>Weapon: {loadout.weaponId === null ? 'Not selected' : weaponData.records.find(item => item.id === loadout.weaponId)?.name ?? `Unavailable (${loadout.weaponId})`}</p>
        <p>Mount: {loadout.mountId === null ? 'Not selected' : mountData.records.find(item => mountId(item) === loadout.mountId)?.name ?? `Unavailable (${loadout.mountId})`}</p>
        <p>Battalion: {loadout.battalionId === null ? 'Not selected' : battalionData.records.find(item => item.id === loadout.battalionId)?.name ?? `Unavailable (${loadout.battalionId})`}</p>
        <details><summary>Planned abilities ({loadout.abilities.length}/8)</summary><ol>{loadout.abilities.map((reference, index) => <li key={JSON.stringify(reference)}>{entries[index]?.entry.text ?? 'Source unavailable'} · {reference.proficiency} {reference.rank}<p className="entry-source">{reference.source}</p></li>)}</ol><p className="details-key">Eight is a planning capacity, not a verified equip limit.</p></details>
        {issue && <p className="class-source-warning">{issue} All saved references are retained. Loading is blocked until they resolve.</p>}
        <div className="preset-load-actions" role="group" aria-label={`Load full loadout ${loadout.name}`}><button type="button" disabled={!!issue} onClick={() => attempt(() => {
          const resolved = resolveLoadout(loadout)
          onLoad({ characterName: loadout.characterName, className: loadout.className, weaponId: loadout.weaponId, mountId: loadout.mountId, battalionId: loadout.battalionId, abilities: abilityReferences(resolved.entries) })
          setFeedback({ error: false, text: `Loaded full loadout “${loadout.name}” into Main. Other characters and Build A/B were unchanged.` })
        })}>Load into Main</button></div>
        <div className="preset-manage-actions">{(['rename', 'duplicate', 'delete'] as const).map(mode => <button key={mode} type="button" disabled={!!snapshot.error} onClick={event => {
          trigger.current = event.currentTarget; setEditor({ id: loadout.id, mode, name: mode === 'rename' ? loadout.name : '' }); setFeedback(undefined)
        }}>{mode[0].toUpperCase() + mode.slice(1)} loadout</button>)}</div>
        <button type="button" className="shortlist-button" disabled={!!snapshot.error} onClick={event=>{
          trigger.current=event.currentTarget
          setEditor({id:loadout.id,mode:'update',name:loadout.name,selection:{...selection,abilities:selection.abilities.map(reference=>({...reference}))}})
          setFeedback(undefined)
        }}>Update from Main</button>
        {editor?.id === loadout.id && <form className="preset-editor" aria-label={`${editor.mode} full loadout ${loadout.name}`} onSubmit={event => edit(event, loadout)}>
          {editor.mode === 'update' && editor.selection ? <div className="loadout-update-preview"><h4>Review replacement of “{loadout.name}”</h4><p>Name, saved ID and creation date are retained. Confirmation replaces all character, class, equipment and ordered ability references in this saved loadout. Your active planner is unchanged.</p><dl className="community-fields">{(['characterName','className','weaponId','mountId','battalionId'] as const).map(key=><div key={key}><dt>{updateLabels[key]}</dt><dd>Saved: {updateChoice(loadout,key)}</dd><dd>Main preview: {updateChoice(editor.selection!,key)}</dd></div>)}</dl><p>Saved abilities: {loadout.abilities.map(ref=>`${ref.proficiency} ${ref.rank} · ${ref.source}`).join('; ')||'None'}</p><p className="recorded-text">Main preview abilities: {editor.selection.abilities.map(ref=>`${ref.proficiency} ${ref.rank} · ${ref.source}`).join('; ')||'None'}</p></div>
          : editor.mode === 'delete' ? <p>Delete saved full loadout “{loadout.name}”? This does not change the active planner.</p> : <div><label htmlFor={`loadout-edit-${loadout.id}`}>New loadout name</label><input autoFocus id={`loadout-edit-${loadout.id}`} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} /></div>}
          <div className="preset-manage-actions"><button autoFocus={editor.mode === 'delete'} type="button" onClick={() => { setEditor(null); trigger.current?.focus() }}>Cancel loadout edit</button><button type="submit">Confirm {editor.mode} loadout</button></div>
        </form>}
      </li>)}</ul>
      <div className="loadout-tools">
        <p className="eyebrow">Backup & tools</p>
        <LoadoutBackup loadouts={snapshot.loadouts} disabled={!!snapshot.error} onImport={incoming => {
          const preview = previewLoadoutImport(snapshot.loadouts, incoming)
          if (preview.conflicts.length) throw new Error('Import conflicts remain. No saved loadouts were changed.')
          commit([...snapshot.loadouts, ...preview.additions], `Imported ${preview.additions.length} full loadouts.`)
        }} />
        <FullPlanComparison main={selection} loadouts={snapshot.loadouts} />
        <ReferenceRecovery loadouts={snapshot.loadouts} disabled={!!snapshot.error} onRecover={(value,id,accepted,name)=>{
          const copy=createRecoveredLoadout(value,id,accepted,name,snapshot.loadouts)
          commit([...snapshot.loadouts,copy],`Saved recovered copy “${copy.name}”. Original loadouts were retained.`)
        }}/>
      </div>
    </section>}
  </details>
}
