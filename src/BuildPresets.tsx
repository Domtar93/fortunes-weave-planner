import { useRef, useState, type FormEvent } from 'react'
import type { BuildSelection } from './comparison'
import Portrait from './Portrait'
import { browserStorage, createPreset, PRESET_KEY, readPresets, selectionIssue, validatedName, writePresets, type BuildPreset, type StorageProvider } from './presets'

export type BuildDestination = 'main' | 'a' | 'b'
const destinations: { key: BuildDestination; label: string }[] = [{ key: 'main', label: 'Main planner' }, { key: 'a', label: 'Build A' }, { key: 'b', label: 'Build B' }]
type Editor = { id: string; mode: 'rename' | 'duplicate' | 'delete'; name: string } | null

export default function BuildPresets({ selections, onLoad, storage = browserStorage }: {
  selections: Record<BuildDestination, BuildSelection>
  onLoad: (destination: BuildDestination, selection: BuildSelection) => void
  storage?: StorageProvider
}) {
  const [snapshot, setSnapshot] = useState(() => readPresets(storage))
  const [source, setSource] = useState<BuildDestination>('main')
  const [name, setName] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const editorTrigger = useRef<HTMLButtonElement | null>(null)
  const nameInput = useRef<HTMLInputElement | null>(null)
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null)
  const attempt = (action: () => void) => {
    try { action() } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'The build action failed.' }) }
  }
  const commit = (presets: BuildPreset[], message: string) => {
    setSnapshot(writePresets(snapshot, presets, storage))
    setFeedback({ error: false, text: message })
    if (editor?.mode === 'delete') nameInput.current?.focus()
    else if (editor) editorTrigger.current?.focus()
    setEditor(null)
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    attempt(() => {
      const preset = createPreset(name, selections[source], snapshot.presets)
      commit([...snapshot.presets, preset], `Saved “${preset.name}” from ${destinations.find(item => item.key === source)!.label}.`)
      setName('')
    })
  }
  const edit = (event: FormEvent, preset: BuildPreset) => {
    event.preventDefault()
    attempt(() => {
      if (!editor) return
      if (editor.mode === 'delete') { commit(snapshot.presets.filter(item => item.id !== preset.id), `Deleted “${preset.name}”.`); return }
      const nextName = validatedName(editor.name, snapshot.presets, editor.mode === 'rename' ? preset.id : undefined)
      const now = new Date().toISOString()
      if (editor.mode === 'rename') {
        commit(snapshot.presets.map(item => item.id === preset.id ? { ...item, name: nextName, updatedAt: now < item.updatedAt ? item.updatedAt : now } : item), `Renamed build to “${nextName}”.`)
      } else {
        commit([...snapshot.presets, { ...preset, id: crypto.randomUUID(), name: nextName, createdAt: now, updatedAt: now }], `Duplicated build as “${nextName}”.`)
      }
    })
  }
  const retry = <div className="comparison-actions"><button type="button" onClick={() => {
    const next = readPresets(storage); setSnapshot(next); setEditor(null)
    setFeedback(next.error ? null : { error: false, text: 'Saved builds read again. No stored data was changed.' })
  }}>Retry reading saved builds</button></div>
  return <details className="progression-panel preset-panel">
    <summary><span>My Character Builds</span><span>{snapshot.error ? 'Storage needs attention' : `${snapshot.presets.length} saved locally`} <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Named character builds">
      <p className="details-context">Save just a character and class pairing. To include equipment and abilities, use Full Build Loadouts above.</p>
      {snapshot.error && <p className="preset-feedback error" role="alert">{snapshot.error}</p>}
      {snapshot.error ? retry : <details className="reader-disclosure"><summary>About local saves</summary><p className="details-key">Saved builds stay in this browser and app address. They hold only a character and class, not equipment or abilities.</p>{retry}</details>}
      {snapshot.error && <p className="entry-source">Storage key: {PRESET_KEY}. Recovery is read-only; the app does not reset damaged or outdated data.</p>}
      <form className="preset-save" onSubmit={save}>
        <div><label htmlFor="preset-source">Save selection from</label><select id="preset-source" value={source} onChange={event => setSource(event.target.value as BuildDestination)}>{destinations.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
          <p className="comparison-pairing">{selections[source].characterName} × {selections[source].className}</p></div>
        <div><label htmlFor="preset-name">Build name</label><input ref={nameInput} id="preset-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Alexandra — frontline" /></div>
        <button type="submit" disabled={!!snapshot.error}>Save build</button>
      </form>
      {feedback && <p className={`preset-feedback ${feedback.error ? 'error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      {!snapshot.error && snapshot.presets.length === 0 && <p className="empty-state">No saved builds yet. Name a pairing above, then save it.</p>}
      <ul className="preset-list">{snapshot.presets.map(preset => {
        const issue = selectionIssue(preset)
        return <li key={preset.id} className="preset-card" aria-label={`Saved build: ${preset.name}`}>
          <h3>{preset.name}</h3><div className="pairing-with-portrait"><Portrait name={preset.characterName} size="small" /><p className="comparison-pairing">{preset.characterName} <span>× {preset.className}</span></p></div>
          <p className="entry-source">Last modified <time dateTime={preset.updatedAt}>{new Date(preset.updatedAt).toLocaleString()}</time></p>
          {issue && <p className="class-source-warning">{issue} Its saved identifiers have been retained.</p>}
          <div className="preset-load-actions" role="group" aria-label={`Load ${preset.name}`}>
            {destinations.map(item => <button key={item.key} type="button" disabled={!!issue} onClick={() => attempt(() => {
              const problem = selectionIssue(preset)
              if (problem) throw new Error(problem)
              onLoad(item.key, { characterName: preset.characterName, className: preset.className })
              setFeedback({ error: false, text: `Loaded “${preset.name}” into ${item.label}.` })
            })}>Load into {item.label}</button>)}
          </div>
          <div className="preset-manage-actions">{(['rename', 'duplicate', 'delete'] as const).map(mode => <button key={mode} type="button" onClick={event => { editorTrigger.current = event.currentTarget; setEditor({ id: preset.id, mode, name: mode === 'rename' ? preset.name : '' }); setFeedback(null) }}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
          {editor?.id === preset.id && <form className="preset-editor" aria-label={`${editor.mode === 'delete' ? 'Delete' : editor.mode === 'rename' ? 'Rename' : 'Duplicate'} ${preset.name}`} onSubmit={event => edit(event, preset)}>
            {editor.mode === 'delete' ? <p>Delete “{preset.name}”? This removes this saved preset from this browser.</p> : <div><label htmlFor={`edit-${preset.id}`}>New build name</label><input autoFocus id={`edit-${preset.id}`} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} /></div>}
            <div className="preset-manage-actions"><button autoFocus={editor.mode === 'delete'} type="button" onClick={() => { setEditor(null); editorTrigger.current?.focus() }}>Cancel</button><button type="submit">{editor.mode === 'delete' ? 'Confirm delete' : editor.mode === 'rename' ? 'Confirm rename' : 'Confirm duplicate'}</button></div>
          </form>}
        </li>
      })}</ul>
    </section>
  </details>
}
