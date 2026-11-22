import { useState } from 'react'
import type { ClassProfile } from './growths'
import { filterMounts, mountData, MOUNT_SPECIES } from './mounts'
import { mountId, MOUNT_PLANNING_MESSAGES, planningMountCompatibility } from './mountPlanning'
import MountReference from './MountReference'
import { sourceRangeUrl } from './catalogReferences'

export default function SelectedMount({ characterName, selectedClass, selectedMountId, onSelect, onNavigateCatalog }: {
  characterName: string; selectedClass: ClassProfile; selectedMountId?: string
  onSelect: (id: string | null) => void; onNavigateCatalog: (id: string) => void
}) {
  const [hasOpened, setHasOpened] = useState(false)
  const [search, setSearch] = useState(''), [species, setSpecies] = useState('all')
  const selected = mountData.records.find(record => mountId(record) === selectedMountId)
  const visible = filterMounts(species, search)
  const outsideFilters = selected && !visible.includes(selected)
  const compatibility = planningMountCompatibility(selectedClass, selected)
  const type = selectedClass.details.mountType
  return <details className="progression-panel selected-mount-panel" onToggle={event => { if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Selected Mount</span><span>{characterName} · {selected?.name ?? 'None selected'} <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Main build selected mount">
      <div className="character-details-heading"><div><span className="eyebrow">Main build equipment plan</span><h2>{characterName} · Mount selection</h2></div></div>
      <p className="details-context">Choose a mount for this build. Use the mount growth preview to compare its contribution.</p>
      <div className="progression-tools selected-weapon-tools" role="group" aria-label="Selected mount controls">
        <div><label htmlFor="selected-mount-search">Search mounts</label><input id="selected-mount-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search mount names…" /></div>
        <div><label htmlFor="selected-mount-species">Mount species</label><select id="selected-mount-species" value={species} onChange={event => setSpecies(event.target.value)}><option value="all">All species</option>{MOUNT_SPECIES.map(value => <option key={value}>{value}</option>)}</select></div>
        <div><label htmlFor="selected-mount-choice">Mount for {characterName}</label><select id="selected-mount-choice" value={selected ? mountId(selected) : ''} onChange={event => onSelect(event.target.value || null)}><option value="">No mount selected</option>{outsideFilters && <optgroup label="Current choice outside filters"><option value={mountId(selected)}>{selected.name}</option></optgroup>}{visible.map(record => <option key={mountId(record)} value={mountId(record)}>{record.name}</option>)}</select></div>
        <button type="button" className="shortlist-button" disabled={!selected} onClick={() => onSelect(null)}>Clear mount selection</button>
      </div>
      <p className="details-context">{visible.length} mounts match.</p>
      {outsideFilters && <p className="details-context" role="status">The selected mount is outside these filters; your choice and its details are retained.</p>}
      {selectedMountId && !selected && <p className="class-source-warning">This mount reference is no longer available. No replacement was selected.</p>}
      {!selected && <p className="details-context">Choose a mount to see its growths, abilities and locations.</p>}
      {selected && <>
        <div className={`mount-compatibility ${compatibility}`} role="group" aria-label="Selected mount class compatibility">
          <strong>{MOUNT_PLANNING_MESSAGES[compatibility]}</strong><details className="reader-disclosure"><summary>Class compatibility details</summary>
          <p>{selectedClass.name}: {type.text ?? 'Unknown'} · {selected.name}: {selected.species.text ?? 'Unknown'}</p>
          <p className="entry-source"><a href={sourceRangeUrl(type.source)} target="_blank" rel="noreferrer">{type.source}</a> · <a href={sourceRangeUrl(selected.species.source)} target="_blank" rel="noreferrer">{selected.species.source}</a></p>
          <p>Documented species context only; equip legality, ownership and acquisition eligibility are unverified. Locations do not establish availability on every route or phase.</p></details>
        </div>
        <section className="selected-mount-reference" aria-label={`${selected.name} selected mount reference`}>
          <div className="comparison-actions"><button type="button" onClick={() => onNavigateCatalog(mountId(selected))}>View in Mount Reference</button></div>
          <MountReference mount={selected} />
        </section>
      </>}
    </section>}
  </details>
}
