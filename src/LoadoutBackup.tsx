import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { BACKUP_FILENAME, formatLoadoutBackup, MAX_BACKUP_BYTES, parseLoadoutBackup, previewLoadoutImport } from './loadoutBackupModel'
import type { BuildLoadout } from './loadouts'
import { downloadShortlistText } from './shortlistDownload'

export default function LoadoutBackup({ loadouts, disabled, onImport }: { loadouts: BuildLoadout[]; disabled: boolean; onImport: (incoming: BuildLoadout[]) => void }) {
  const [incoming, setIncoming] = useState<BuildLoadout[]>(), [feedback, setFeedback] = useState<{ error: boolean; text: string }>()
  const [manual, setManual] = useState<string>(), area = useRef<HTMLTextAreaElement>(null), sequence = useRef(0), mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++ } }, [])
  useEffect(() => { if (manual !== undefined) { area.current?.focus(); area.current?.select() } }, [manual])
  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; const request = ++sequence.current
    setIncoming(undefined); setFeedback(undefined)
    if (!file) return
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('The loadout backup exceeds the 5 MiB limit.')
      const payload = parseLoadoutBackup(await file.text())
      if (!mounted.current || request !== sequence.current) return
      setIncoming(payload.loadouts); setFeedback({ error: false, text: `Read ${payload.loadouts.length} saved loadouts for review. Nothing has been imported yet.` })
    } catch (error) { if (mounted.current && request === sequence.current) setFeedback({ error: true, text: error instanceof Error ? error.message : 'The backup could not be read.' }) }
  }
  const download = () => {
    const text = formatLoadoutBackup(loadouts)
    try {
      downloadShortlistText(text, BACKUP_FILENAME, 'application/json;charset=utf-8')
      setManual(undefined); setFeedback({ error: false, text: 'Backup download started. The browser controls final storage.' })
    } catch { setManual(text); setFeedback({ error: true, text: 'The browser could not start the backup download. Copy the selected JSON into a UTF-8 .json file manually.' }) }
  }
  const preview = useMemo(() => incoming ? previewLoadoutImport(loadouts, incoming) : undefined, [loadouts, incoming])
  return <details className="loadout-backup"><summary>Back up or import full loadouts</summary><section aria-label="Full loadout backup and restore">
    <p className="details-key">Backup contains your explicitly saved loadouts, not unsaved session choices or character/class presets. Files stay on your computer. Import adds records after review and never overwrites a local save.</p>
    <div className="comparison-actions"><button type="button" disabled={disabled} onClick={download}>Download loadout backup</button></div>
    <label htmlFor="loadout-import">Choose full-loadout JSON backup</label><input id="loadout-import" type="file" accept=".json,application/json" disabled={disabled} onChange={read} />
    {feedback && <p className={`preset-feedback ${feedback.error ? 'error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    {manual !== undefined && <><label htmlFor="loadout-backup-text">Loadout backup JSON for manual copying</label><textarea id="loadout-backup-text" className="shortlist-copy-text" ref={area} rows={8} readOnly wrap="soft" value={manual} /><button type="button" onClick={() => { area.current?.focus(); area.current?.select() }}>Select backup JSON</button></>}
    {preview && <div className="preset-card" aria-label="Loadout import preview"><p>{preview.additions.length} new · {preview.skipped.length} identical skipped · {preview.conflicts.length} conflicts</p>
      <ul>{preview.additions.slice(0, 25).map(item => <li key={item.id}>{item.name} · {item.characterName} × {item.className}</li>)}</ul>
      {preview.additions.length > 25 && <p className="details-key">Showing the first 25 names. Confirm imports all {preview.additions.length} new loadouts; nothing is omitted from the import.</p>}
      {preview.conflicts.length > 0 && <div role="alert">{preview.conflicts.map(text => <p key={text}>{text}</p>)}<p>Import is blocked. Rename or remove conflicting records in a copy of the backup, then choose it again.</p></div>}
      <div className="comparison-actions"><button type="button" disabled={disabled || !!preview.conflicts.length || !preview.additions.length} onClick={() => {
        try { onImport(incoming!); setIncoming(undefined); setFeedback({ error: false, text: `Imported ${preview.additions.length} full loadouts. The main planner was not changed.` }) }
        catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Import failed. Local saves were not replaced.' }) }
      }}>Confirm loadout import</button><button type="button" onClick={() => { sequence.current++; setIncoming(undefined); setFeedback(undefined) }}>Cancel loadout import</button></div>
    </div>}
  </section></details>
}
