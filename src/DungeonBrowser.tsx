import { useRef, useState } from 'react'
import { DATA_STATUS_LABELS, type CharacterProfile, type ClassProfile } from './growths'
import { activePhases, dungeonData, filterDungeons, hasUnresolvedRewards, PHASE_LABELS, REWARD_STATUS_LABELS, type DungeonNote, type DungeonPhase } from './dungeons'
import { catalogReferences, sourceRangeUrl, WORKBOOK_URL } from './catalogReferences'
import { weaponDungeonAudit, REFINED_CANDIDATE_LABEL, type ExactWeaponReward } from './weaponDungeonReferences'
import { useCatalogNavigation, type CatalogRequest } from './catalogNavigation'

function SourceLink({ source }: { source: string }) {
  return <a className="entry-source" href={sourceRangeUrl(source)} target="_blank" rel="noreferrer">{source}</a>
}
function Note({ entry }: { entry: DungeonNote }) {
  return <div><p className="recorded-text">{entry.text ?? `Unresolved note · raw: ${entry.raw ?? '(blank)'}`}</p><p className="entry-source"><SourceLink source={entry.source} /> · {DATA_STATUS_LABELS[entry.confidence]}</p></div>
}

export default function DungeonBrowser({ character, selectedClass, navigation, onNavigateScroll, onNavigateWeapon }: {
  character: CharacterProfile; selectedClass: ClassProfile; navigation?: CatalogRequest; onNavigateScroll: (id: string) => void; onNavigateWeapon?: (reference: ExactWeaponReward) => void
}) {
  const [search, setSearch] = useState(''), [reward, setReward] = useState('')
  const [phase, setPhase] = useState<DungeonPhase>('all')
  const [unresolvedOnly, setUnresolvedOnly] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const rewardRef = useRef<HTMLTableCellElement>(null)
  const { selectedId, setSelectedId, panelRef, headingRef } = useCatalogNavigation(dungeonData.records[0]?.id ?? '', navigation, hasOpened, rewardRef)
  const visible = filterDungeons({ search, reward, phase, unresolvedOnly })
  const selected = dungeonData.records.find(location => location.id === selectedId)
  const target = navigation?.reward?.locationId === selectedId ? navigation.reward : undefined
  const targetChest = selected?.chests.find(chest => chest.id === target?.chestId)
  const parts = activePhases(phase)
  const showingExtraPhase = !!target && !!targetChest && !parts.includes(target.part)
  const displayedParts = showingExtraPhase ? (['part1', 'part3'] as const) : parts
  const related = catalogReferences.filter(reference => reference.location.id === selectedId)
  const chestCount = dungeonData.records.reduce((total, location) => total + location.chests.length, 0)
  return <details ref={panelRef} className="progression-panel dungeon-panel" onToggle={event => { if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Dungeon Chests &amp; Rewards</span><span>{dungeonData.records.length} locations · {chestCount} chests <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Dungeon chest reference browser">
      <p className="details-context reference-lead">Reference while planning {character.name} as {selectedClass.name}. Pick a location to see what its chests hold. Each chest has Part I and Part III rewards. These are the same chest location, not two chests. No rewards enter build calculations or inventory.</p>
      <details className="reader-disclosure"><summary>About this data</summary>
        <p className="details-key">Community data is unverified. Route, chapter, story locks and Grand Megalith access are not evaluated. Dash placeholders do not prove a missing chest or an obtainable item.</p>
        <p className="details-key">Phase changes reward search and displayed columns. Unresolved includes dash placeholders and empty phase fields; access notes remain independent.</p>
        <p className="details-key">Source links open the named worksheet range on Google. The app continues to use its local workbook snapshot. <a href={`${WORKBOOK_URL}/edit`} target="_blank" rel="noreferrer">Open source workbook</a>.</p>
      </details>
      <div className="progression-tools dungeon-tools" role="group" aria-label="Dungeon catalog filters">
        <div><label htmlFor="dungeon-search">Search dungeon or reward names</label><input id="dungeon-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Location or reward…" /></div>
        <div><label htmlFor="dungeon-reward">Locations containing reward</label><input id="dungeon-reward" type="search" value={reward} onChange={event => setReward(event.target.value)} placeholder="Reward name…" /></div>
        <div><label htmlFor="dungeon-phase">Reward phase</label><select id="dungeon-phase" value={phase} onChange={event => setPhase(event.target.value as DungeonPhase)}><option value="all">All phases</option><option value="part1">Part I</option><option value="part3">Part III</option></select></div>
      </div>
      <label className="battalion-support-filter"><input type="checkbox" checked={unresolvedOnly} onChange={event => setUnresolvedOnly(event.target.checked)} />Locations with unresolved entries</label>
      <p className="details-context catalog-count">{visible.length} / {dungeonData.records.length} locations shown</p>
      <div className="mount-layout dungeon-layout">
        <div className="mount-catalog"><ul aria-label="Dungeon location catalog">{visible.map(location => <li key={location.id}><button type="button" aria-label={`Inspect ${location.name}`} aria-pressed={selectedId === location.id} onClick={() => setSelectedId(location.id)}>
          <span className="mount-row-name">{location.name}</span><span className="mount-row-species">{location.chests.length} chests · Part I / Part III</span>
          <span className="mount-row-state">{hasUnresolvedRewards(location) ? 'Placeholders / unresolved rewards' : 'Community · unverified'}{location.notes.length > 0 && ' · Access notes'}</span>
        </button></li>)}</ul>{visible.length === 0 && <p className="empty-state">No locations match. Clear the searches, set All phases or untick the unresolved filter. Your selected location stays open.</p>}</div>
        {selected && <section className="mount-detail dungeon-detail" aria-label={`${selected.name} dungeon details`}>
          <div className="character-details-heading"><div><span className="eyebrow">Dungeon reference</span><h2 ref={headingRef} tabIndex={-1}>{selected.name}</h2></div><span className={`data-status ${selected.confidence}`}>{DATA_STATUS_LABELS[selected.confidence]}</span></div>
          <p className="entry-source"><SourceLink source={`${selected.source.sheet}!${selected.source.range}`} /></p>
          {!visible.some(location => location.id === selectedId) && <p className="details-context">Selected location is outside the filters; inspection is retained.</p>}
          {target && targetChest && <p className="reference-arrival" role="status">Navigation target: Chest {targetChest.number} · {PHASE_LABELS[target.part]} · {targetChest[target.part].raw}. {showingExtraPhase && `Both phases are shown for this target; the ${PHASE_LABELS[phase as 'part1' | 'part3']} filter is retained.`}</p>}
          <table className="dungeon-reward-table"><caption>Chest rewards at {selected.name}</caption>
            <thead><tr><th scope="col">Chest / source</th>{displayedParts.map(part => <th scope="col" key={part}>{PHASE_LABELS[part]}</th>)}</tr></thead>
            <tbody>{selected.chests.map(chest => <tr key={chest.id}>
              <th scope="row"><span>Chest {chest.number}</span><SourceLink source={chest.source} /></th>
              {displayedParts.map(part => {
                const exact = weaponDungeonAudit.exact.find(entry => entry.chest.id === chest.id && entry.part === part)
                const candidate = weaponDungeonAudit.refinedCandidates.find(entry => entry.chest.id === chest.id && entry.part === part)
                const isTarget = targetChest?.id === chest.id && target?.part === part
                return <td key={part} data-label={PHASE_LABELS[part]} ref={isTarget ? rewardRef : undefined} tabIndex={isTarget ? -1 : undefined} className={isTarget ? 'reward-navigation-target' : undefined} aria-label={`Chest ${chest.number} · ${PHASE_LABELS[part]} · ${chest[part].raw ?? 'No source entry'}`}>
                  <span className="dungeon-phase-label" aria-hidden="true">{PHASE_LABELS[part]}</span><span className="reward-text">{chest[part].raw ?? (chest[part].status === 'unresolved' ? 'Unresolved · see raw source' : 'No source entry')}</span><span className={`reward-state ${chest[part].status}`}>{REWARD_STATUS_LABELS[chest[part].status]}</span>
                  {exact && onNavigateWeapon && <div className="comparison-actions reward-weapon-action"><button type="button" aria-label={`View weapon: ${exact.weapon.name} · Chest ${chest.number} · ${PHASE_LABELS[part]}`} onClick={() => onNavigateWeapon(exact)}>View weapon</button></div>}
                  {candidate && <p className="reward-base-candidate"><strong>{REFINED_CANDIDATE_LABEL}</strong><span>Recorded: {candidate.reward}</span><span>Suggested base: {candidate.weapon.name} · suffix {candidate.suffix}</span><span>{candidate.source}</span><span>Progression is unverified; base statistics do not establish this reward’s statistics.</span></p>}
                </td>
              })}
            </tr>)}</tbody>
          </table>
          {selected.chests.length === 0 && <p className="class-source-warning">No populated chest columns recorded for this location.</p>}
          {selected.warnings.map((entry, index) => <p className="class-source-warning" key={`${entry.code}/${entry.location}/${index}`}>{entry.location}: {entry.message}</p>)}
          <details className="class-section"><summary><span>Raw chest cells</span><span>Exact two-line source <span aria-hidden="true">＋</span></span></summary>
            {selected.chests.map(chest => <div className="dungeon-raw" key={chest.id}><h3>Chest {chest.number}</h3><p className="recorded-text">{chest.raw ?? '(blank)'}</p><SourceLink source={chest.source} /></div>)}
          </details>
          {selected.notes.length > 0 && <section className="dungeon-location-notes" aria-label="Location-specific source notes"><h3>Location-specific source notes</h3>{selected.notes.map(entry => <Note key={entry.source} entry={entry} />)}<p className="details-context">Recorded access text is unverified; no route/chapter eligibility is inferred.</p></section>}
          {related.length > 0 && <details className="class-section dungeon-scroll-references"><summary><span>Magic-scroll acquisition references</span><span>{related.length} location-name match <span aria-hidden="true">＋</span></span></summary>
            <p className="details-context">Navigation uses the location name only. Archive, translated, Greek and Latin reward labels are not treated as equivalent. Compare the original acquisition text with the chest table; differences remain unresolved.</p>
            {related.map(reference => <div key={`${reference.scroll.id}/${reference.part}`}><p className="recorded-text">{reference.scroll.acquisition[reference.part].text}</p><SourceLink source={reference.scroll.acquisition[reference.part].source} /><div className="comparison-actions"><button type="button" onClick={() => onNavigateScroll(reference.scroll.id)}>View {reference.scroll.name} · {PHASE_LABELS[reference.part]} acquisition</button></div></div>)}
          </details>}
        </section>}
      </div>
      <details className="class-section mount-sheet-notes"><summary><span>General dungeon research notes</span><span>Legends · discussions · uncertain corrections <span aria-hidden="true">＋</span></span></summary>
        <p className="details-context">H onward and unassociated footer comments are independent community material. Their row positions do not attach them to a location or chest. Comments mentioning different rewards or possible alternate locations are retained without corrections.</p>
        {dungeonData.generalNotes.map(entry => <Note key={entry.source} entry={entry} />)}
      </details>
    </section>}
  </details>
}
