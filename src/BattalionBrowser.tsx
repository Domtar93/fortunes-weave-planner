import { useState } from 'react'
import BattalionReference from './BattalionReference'
import { useCatalogNavigation, type CatalogRequest } from './catalogNavigation'
import { DATA_STATUS_LABELS, type CharacterProfile, type ClassProfile } from './growths'
import { AUTHORITY_TIERS, BATTALION_CATEGORIES, BATTALION_SUPPORT_LABELS, battalionData, battalionSupport, filterBattalions } from './battalions'

export default function BattalionBrowser({ character, selectedClass, navigation }: { character: CharacterProfile; selectedClass: ClassProfile; navigation?: CatalogRequest }) {
  const [category, setCategory] = useState('all')
  const [rank, setRank] = useState('all')
  const [search, setSearch] = useState('')
  const [classSupportOnly, setClassSupportOnly] = useState(false)
  const validNavigation = navigation && battalionData.records.some(record => record.id === navigation.id) ? navigation : undefined
  const { selectedId, setSelectedId, panelRef, headingRef } = useCatalogNavigation(battalionData.records[0]?.id ?? '', validNavigation)
  const selected = battalionData.records.find(record => record.id === selectedId)
  const visible = filterBattalions({ search, category, rank, classSupportOnly }, selectedClass)
  const revealed = validNavigation && selectedId === validNavigation.id && selected && !visible.some(record => record.id === selectedId) ? selected : undefined
  const catalog = revealed ? battalionData.records.filter(record => record.id === revealed.id || visible.some(item => item.id === record.id)) : visible
  const support = battalionSupport(selectedClass)
  const experience = selectedClass.details.proficiencyExperience.Authority
  const allowed = selectedClass.details.allowedWeaponsAndSkills
  const mountType = selectedClass.details.mountType

  return <details ref={panelRef} className="progression-panel battalion-panel">
    <summary><span>Battalions &amp; Gambits</span><span>{battalionData.records.length} references <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Battalion reference browser">
      <p className="details-context reference-lead">Reference for {character.name} as {selectedClass.name}. Pick a battalion to see its gambit, flat stat bonuses and where to get it. Battalion bonuses are flat stat points and are not added to growth percentages.</p>
      <div className="progression-context battalion-class-context" role="group" aria-label="Class battalion context">
        <div><span className="eyebrow">Documented class context</span><h3>{selectedClass.name} · {BATTALION_SUPPORT_LABELS[support]}</h3></div>
        <p className="recorded-text">Allowed types: {allowed.text ?? 'Unknown'}</p><p className="entry-source">{allowed.source} · {DATA_STATUS_LABELS[allowed.status]}</p>
        <p>Authority XP bonus: {experience.value === null ? 'Not listed' : `${experience.value > 0 ? '+' : ''}${experience.value}`} · Mount classification: {mountType.text ?? 'Unknown'}</p>
        <p className="entry-source">{experience.source} · {mountType.source}</p>
        {experience.value === 0 && <p>Authority can be used without bonus proficiency experience, as recorded.</p>}
        <p>Authority XP is not {character.name}’s actual Authority rank. This browser does not infer current rank or enforce equip eligibility.</p>
        {support === 'not_listed_mounted' && <p className="uncertainty">The class does not list battalions while mounted. Dismounting permission has not been verified.</p>}
      </div>
      <div className="proficiency-buttons battalion-categories" role="group" aria-label="Battalion categories">
        {['all', ...BATTALION_CATEGORIES].map(value => <button key={value} type="button" aria-pressed={category === value}
          onClick={() => setCategory(value)}>{value === 'all' ? 'All categories' : value}</button>)}
      </div>
      <div className="progression-tools">
        <div><label htmlFor="battalion-search">Search battalion names</label><input id="battalion-search" type="search" value={search} placeholder="Find a battalion…" onChange={event => setSearch(event.target.value)} /></div>
        <div><label htmlFor="battalion-rank">Required Authority rank (catalog)</label><select id="battalion-rank" value={rank} onChange={event => setRank(event.target.value)}>
          <option value="all">All required ranks</option>{AUTHORITY_TIERS.map(value => <option key={value} value={value}>{value}</option>)}
        </select></div>
      </div>
      <label className="battalion-support-filter"><input type="checkbox" checked={classSupportOnly} onChange={event => setClassSupportOnly(event.target.checked)} />Only show when class lists battalions</label>
      <p className="details-context catalog-count">{visible.length} / {battalionData.records.length} battalions shown</p>
      <details className="reader-disclosure"><summary>About these filters</summary><p className="details-key">The rank filter selects the exact recorded requirement, not character progression. Clear the class-support filter to browse every class pairing.</p></details>
      {revealed && <p className="details-context" role="status">Navigation target {revealed.name} is temporarily revealed outside the retained filters.</p>}
      <div className="mount-layout battalion-layout">
        <div className="mount-catalog battalion-catalog"><ul aria-label="Battalion catalog">
          {catalog.map(record => <li key={record.id}><button type="button" aria-label={`Inspect ${record.name}`} aria-pressed={selectedId === record.id} onClick={() => setSelectedId(record.id)}>
            <span className="mount-row-name">{record.name}</span><span className="mount-row-species">{record.category.text} · Authority {record.authorityRank.text}</span>
            <span className="mount-row-state">{record.reliability === 'unverified' ? 'Community · unverified' : DATA_STATUS_LABELS[record.reliability]}{record.parsedStats.state !== 'parsed' && ' · Stats unresolved'}</span>
          </button></li>)}
        </ul>{catalog.length === 0 && <p className="empty-state">No battalions match these filters. Try All categories, clear the search or untick the class filter. Your selected battalion stays open.</p>}</div>
        {selected && <section className="mount-detail battalion-detail" aria-label={`${selected.name} battalion details`}>
          <BattalionReference record={selected} headingRef={headingRef} />
          {!visible.some(record => record.id === selectedId) && <p className="details-context">Selected battalion is outside the filters; inspection is retained.</p>}
        </section>}
      </div>
      <details className="class-section mount-sheet-notes"><summary><span>General battalion research notes</span><span>Independent reference block <span aria-hidden="true">＋</span></span></summary>
        <p className="details-context">These worksheet notes and the rank/Normal/Affinity reference cells are independent community material. Their row positions do not associate them with individual battalions, and no mechanics are applied.</p>
        {battalionData.generalNotes.map(note => <div key={note.source}><p className="recorded-text">{note.value}</p><p className="entry-source">{note.source} · {note.status}</p></div>)}
      </details>
    </section>
  </details>
}
