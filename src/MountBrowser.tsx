import { useState } from 'react'
import MountReference from './MountReference'
import { mountId } from './mountPlanning'
import { useCatalogNavigation, type CatalogRequest } from './catalogNavigation'
import { DATA_STATUS_LABELS, type CharacterProfile, type ClassProfile } from './growths'
import { COMPATIBILITY_LABELS, filterMounts, MOUNT_SPECIES, mountCompatibility, mountData } from './mounts'

export default function MountBrowser({ character, selectedClass, navigation }: { character: CharacterProfile; selectedClass: ClassProfile; navigation?: CatalogRequest }) {
  const [species, setSpecies] = useState('all')
  const [search, setSearch] = useState('')
  const validNavigation = navigation && mountData.records.some(record => mountId(record) === navigation.id) ? navigation : undefined
  const { selectedId, setSelectedId, panelRef, headingRef } = useCatalogNavigation(mountData.records[0] ? mountId(mountData.records[0]) : '', validNavigation)
  const mount = mountData.records.find(record => mountId(record) === selectedId)
  const visible = filterMounts(species, search)
  const revealed = validNavigation && selectedId === validNavigation.id && mount && !visible.some(record => mountId(record) === selectedId) ? mount : undefined
  const catalog = revealed ? mountData.records.filter(record => mountId(record) === mountId(revealed) || visible.includes(record)) : visible
  const compatibility = mount ? mountCompatibility(selectedClass, mount) : 'unknown'

  return <details ref={panelRef} className="progression-panel mount-panel">
    <summary><span>Mounts &amp; Compatibility</span><span>{mountData.records.length} mounts · Reference only <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Mount reference browser">
      <p className="details-context reference-lead">Inspecting mounts for {character.name} as {selectedClass.name}. Pick a mount to see its growths, flat bonuses, abilities and whether it suits this class.</p>
      <details className="reader-disclosure"><summary>About this data</summary><p className="details-key">Mount bonuses and ability effects are not included in the growth calculator. Every mount remains inspectable regardless of class type.</p></details>
      <div className="proficiency-buttons mount-filters" role="group" aria-label="Mount species filters">
        {['all', ...MOUNT_SPECIES].map(value => <button key={value} type="button" aria-pressed={species === value}
          onClick={() => setSpecies(value)}>{value === 'all' ? 'All mounts' : value}</button>)}
      </div>
      <div className="progression-tools mount-search"><div><label htmlFor="mount-search">Search mount names</label>
        <input id="mount-search" type="search" value={search} placeholder="Find a mount…" onChange={event => setSearch(event.target.value)} /></div>
        <p className="details-context catalog-count">{visible.length} / {mountData.records.length} mounts shown</p>
      </div>
      {revealed && <p className="details-context" role="status">Navigation target {revealed.name} is temporarily revealed outside the retained filters.</p>}
      <div className="mount-layout">
        <div className="mount-catalog">
          <ul aria-label="Mount catalog">{catalog.map(record => {
            const conflict = record.growthComparison.differences.length > 0
            return <li key={mountId(record)}><button type="button" aria-label={`Inspect ${record.name}`} aria-pressed={selectedId === mountId(record)}
              onClick={() => setSelectedId(mountId(record))}>
              <span className="mount-row-name">{record.name}</span><span className="mount-row-species">{record.species.text ?? 'Unknown species'}</span>
              <span className={`mount-row-state ${conflict ? 'uncertainty' : ''}`}>{conflict ? 'Growth conflict · review' : 'Community · unverified'}</span>
            </button></li>
          })}</ul>
          {catalog.length === 0 && <p className="empty-state">No mounts match these filters. Try All mounts or clear the search.</p>}
        </div>
        {mount && <section className="mount-detail" aria-label={`${mount.name} mount details`}>
          <MountReference mount={mount} headingRef={headingRef}>
          {!visible.some(record => mountId(record) === selectedId) && <p className="details-context">Selected mount is outside the current filters; its inspection remains open.</p>}
          <div className={`mount-compatibility ${compatibility}`} role="group" aria-label="Mount compatibility">
            <strong>{COMPATIBILITY_LABELS[compatibility]}</strong>
            <p>{selectedClass.name}: {selectedClass.details.mountType.text ?? 'Unknown'} · {mount.name}: {mount.species.text ?? 'Unknown'}</p>
            <p className="entry-source">{selectedClass.details.mountType.source} · {mount.species.source}</p>
            <p>Source classification only; game legality and acquisition eligibility are not verified.</p>
          </div>
          </MountReference>
        </section>}
      </div>
      <details className="class-section mount-sheet-notes"><summary><span>Worksheet research notes</span><span>Independent · unverified <span aria-hidden="true">＋</span></span></summary>
        <p className="details-context">These source annotations are retained for research. Ability restrictions, multipliers and other suggested mechanics are not applied.</p>
        {mountData.sheetNotes.map(entry => <div key={entry.source}><p className="recorded-text">{entry.text}</p><p className="entry-source">{entry.source} · {DATA_STATUS_LABELS[entry.status]}</p></div>)}
      </details>
    </section>
  </details>
}
