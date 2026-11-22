import { formatPercent, signedPercent, type CharacterProfile, type ClassProfile } from './growths'
import { MOUNT_SPECIES, mountCompatibility, mountData } from './mounts'
import { mountId } from './mountPlanning'
import { previewWorkbookMountGrowth } from './mountGrowthPreviewModel'
import { listedMountGrowthTotal } from './mountWorkbookModel'

export default function QuickMountPicker({ character, selectedClass, selectedId, onSelect }: {
  character: CharacterProfile; selectedClass: ClassProfile; selectedId?: string; onSelect: (id: string | null) => void
}) {
  const type = selectedClass.details.mountType
  if (!['confirmed', 'unverified'].includes(type.status) || !MOUNT_SPECIES.some(species => species === type.text)) return null
  const choices = mountData.records.filter(mount => mountCompatibility(selectedClass, mount) === 'match')
  const selected = mountData.records.find(mount => mountId(mount) === selectedId)
  const outside = selected && !choices.includes(selected)
  const preview = previewWorkbookMountGrowth(character, selectedClass, selected)
  const total = selected ? listedMountGrowthTotal(selected) : null
  return <section className="quick-mount-picker" aria-label="Quick mount comparison">
    <label htmlFor="quick-mount"><span className="field-index" aria-hidden="true">03</span>Mount</label>
    <div className="select-wrap"><select id="quick-mount" title={`${type.text} · ${choices.length} matching references`} value={selected ? mountId(selected) : ''} onChange={event => onSelect(event.target.value || null)}>
      <option value="">No mount selected</option>
      {outside && <optgroup label="Current choice — different class type"><option value={mountId(selected)}>{selected.name}</option></optgroup>}
      {choices.map(mount => <option key={mountId(mount)} value={mountId(mount)}>{mount.name}</option>)}
    </select><span aria-hidden="true">⌄</span></div>
    <p className="field-caption">{selected?.name ?? `${type.text} · ${choices.length} matching references`}</p>
    {selected && <>
      <p className="quick-mount-caption">Personal + class + mount growth</p>
      <dl className="quick-mount-grid" aria-label="Growth preview with selected mount">{preview.rows.map(row => <div key={row.stat}>
        <dt>{row.stat}</dt><dd><strong data-testid={`quick-mount-${row.stat}`}>{row.combined === null ? '—' : formatPercent(row.combined)}</strong>
          <span>{row.contribution === null ? 'Unknown' : row.contribution === 0 ? '+0%' : signedPercent(row.contribution)} mount</span></dd>
      </div>)}</dl>
      {preview.state === 'applicable' && <p className="quick-mount-note">{total !== null && <>Listed growth total {signedPercent(total)}. </>}{preview.multiplier === 2 && <>Charioteer applies ×2. </>}
        {preview.workbookZeros ? 'Unlisted growths count as +0% in workbook comparison.' : 'Unrecorded growths stay unknown.'}</p>}
      {preview.state !== 'applicable' && <p className="quick-mount-note warning" role="status">{preview.message}</p>}
      <p className="quick-mount-note">Main growth cards show personal + class. Mount contributions are previewed here.</p>
    </>}
    {!selected && <p className="quick-mount-note">Choose a mount to compare growths here. No mount is selected automatically.</p>}
  </section>
}
