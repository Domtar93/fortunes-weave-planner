import { useState } from 'react'
import { DATA_STATUS_LABELS, type CharacterProfile, type ClassProfile } from './growths'
import { ACQUISITION_LABELS, filterScrolls, rawScrollValue, scrollData, type ScrollText } from './scrolls'
import { catalogReferences, sourceRangeUrl } from './catalogReferences'
import { PHASE_LABELS } from './dungeons'
import { useCatalogNavigation, type CatalogRequest } from './catalogNavigation'

function RecordedText({ label, field }: { label: string; field: ScrollText }) {
  return <div className="recorded-entry" role="group" aria-label={label}>
    <div className="recorded-heading"><h3>{label}</h3><span className="scroll-state">{ACQUISITION_LABELS[field.state]}</span></div>
    <p className="recorded-text">{field.text ?? (field.state === 'unresolved' ? `Unresolved · raw: ${rawScrollValue(field)}` : 'No source entry.')}</p>
    <p className="entry-source">{field.source} · {DATA_STATUS_LABELS[field.confidence]}</p>
  </div>
}

export default function MagicScrollBrowser({ character, selectedClass, navigation, onNavigateDungeon }: {
  character: CharacterProfile; selectedClass: ClassProfile; navigation?: CatalogRequest; onNavigateDungeon?: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [parts, setParts] = useState({ part1: 'all', part3: 'all' })
  const { selectedId, setSelectedId, panelRef, headingRef } = useCatalogNavigation(scrollData.records[0]?.id ?? '', navigation)
  const visible = filterScrolls({ search, ...parts })
  const selected = scrollData.records.find(record => record.id === selectedId)
  const related = catalogReferences.filter(reference => reference.scroll.id === selectedId)
  return <details ref={panelRef} className="progression-panel scroll-panel">
    <summary><span>Magic Scrolls</span><span>{scrollData.records.length} references <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Magic scroll reference browser">
      <p className="details-context reference-lead">Reference while planning {character.name} as {selectedClass.name}. Pick a scroll to see its stats, effect and where to find it. Recorded numeric properties are reference data, not a calculated combat forecast. Scrolls do not change growth percentages.</p>
      <details className="reader-disclosure"><summary>About this data</summary>
        <p className="details-key">Equip, learn and use rules are unverified. Character identity, class and Reason/Faith rank do not establish scroll legality here. Recorded effects and acquisition conditions remain community information; availability on every route is not inferred.</p>
        <p className="details-key">Documented means recorded, not independently confirmed. N/A, ?, and an empty source cell remain separate states.</p>
      </details>
      <div className="progression-tools scroll-tools">
        <div><label htmlFor="scroll-search">Search scroll name or source tome/archive</label><input id="scroll-search" type="search" value={search} placeholder="Name or archive…" onChange={event => setSearch(event.target.value)} /></div>
        {(['part1', 'part3'] as const).map((part, index) => <div key={part}><label htmlFor={`scroll-${part}`}>Part {index === 0 ? 1 : 3} acquisition</label><select id={`scroll-${part}`} value={parts[part]} onChange={event => setParts(current => ({ ...current, [part]: event.target.value }))}>
          <option value="all">All acquisition states</option>{Object.entries(ACQUISITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>)}
      </div>
      <p className="details-context catalog-count">{visible.length} / {scrollData.records.length} scrolls shown</p>
      <div className="mount-layout scroll-layout">
        <div className="mount-catalog"><ul aria-label="Magic scroll catalog">{visible.map(record => <li key={record.id}><button type="button" aria-label={`Inspect ${record.name}`} aria-pressed={record.id === selectedId} onClick={() => setSelectedId(record.id)}>
          <span className="mount-row-name">{record.name}</span><span className="mount-row-species">{record.tome.text ?? 'Source unrecorded'}</span>
          <span className="mount-row-state">Part 1: {ACQUISITION_LABELS[record.acquisition.part1.state]}</span><span className="mount-row-state">Part 3: {ACQUISITION_LABELS[record.acquisition.part3.state]}</span>
        </button></li>)}</ul>{visible.length === 0 && <p className="empty-state">No scrolls match. Clear the search or set both parts to All acquisition states. Your selected scroll stays open.</p>}</div>
        {selected && <section className="mount-detail scroll-detail" aria-label={`${selected.name} scroll details`}>
          <div className="character-details-heading"><div><span className="eyebrow">Magic scroll reference</span><h2 ref={headingRef} tabIndex={-1}>{selected.name}</h2></div><span className={`data-status ${selected.confidence}`}>{DATA_STATUS_LABELS[selected.confidence]}</span></div>
          <p className="entry-source">{selected.source.sheet}!{selected.source.range}</p>
          {!visible.some(record => record.id === selectedId) && <p className="details-context">Selected scroll is outside the filters; inspection is retained.</p>}
          <RecordedText label="Source tome / archive" field={selected.tome} />
          <dl className="scroll-properties">{([
            ['Might', selected.might], ['Hit', selected.hit], ['Range', selected.range], ['Weight', selected.weight],
            ['Crit', selected.critical], ['Avoidance', selected.avoidance], ['Uses', selected.uses],
          ] as const).map(([label, field]) => <div key={label}>
            <dt>{label}</dt><dd>{field.state === 'unresolved' ? 'Unresolved' : 'value' in field ? field.value : field.text}</dd>
            {field.state === 'unresolved' && <p className="scroll-raw">Raw: {rawScrollValue(field)}</p>}
            <span className="entry-source">{field.source} · {DATA_STATUS_LABELS[field.confidence]}</span>
          </div>)}</dl>
          <RecordedText label="Recorded description" field={selected.description} />
          <div className="scroll-acquisition"><RecordedText label="Part 1 acquisition information" field={selected.acquisition.part1} /><RecordedText label="Part 3 acquisition information" field={selected.acquisition.part3} /></div>
          {related.length > 0 && onNavigateDungeon && <section className="scroll-dungeon-links" aria-label="Dungeon location references"><h3>Dungeon location references</h3>
            <p className="details-context">Location-name navigation only. Chest rewards are not equated with scroll, archive or Greek/Latin item labels. Compare the original sources; differences remain unresolved.</p>
            {related.map(reference => <div key={`${reference.location.id}/${reference.part}`}>
              <p className="details-context">{PHASE_LABELS[reference.part]} chest labels at {reference.location.name}: {reference.location.chests.map(chest => `${chest.number}: ${chest[reference.part].raw ?? 'Unresolved'}`).join(' · ')}.</p>
              <a className="entry-source" href={sourceRangeUrl(`${reference.location.source.sheet}!${reference.location.source.range}`)} target="_blank" rel="noreferrer">{reference.location.source.sheet}!{reference.location.source.range}</a>
              <div className="comparison-actions"><button type="button" onClick={() => onNavigateDungeon(reference.location.id)}>View dungeon: {reference.location.name}</button></div>
            </div>)}
          </section>}
          {selected.validation.map(entry => <p className="class-source-warning" key={`${entry.code}/${entry.location}`}>{entry.location}: {entry.message}</p>)}
        </section>}
      </div>
      <details className="class-section mount-sheet-notes"><summary><span>General scroll research notes</span><span>Independent community notes <span aria-hidden="true">＋</span></span></summary>
        <p className="details-context">These cells are separate worksheet annotations, including notes below the table. Row alignment does not associate them with a scroll. Ingredient locations, trading chapters, possible story locks and the possible absence of Luna Λ remain unverified; cross-route availability is unresolved.</p>
        {scrollData.generalNotes.map(note => <div key={note.source}><p className="recorded-text">{note.text ?? `Unresolved · raw: ${rawScrollValue(note)}`}</p><p className="entry-source">{note.source} · {DATA_STATUS_LABELS[note.confidence]}</p></div>)}
      </details>
    </section>
  </details>
}
