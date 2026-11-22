import { useState } from 'react'
import type { ClassProfile } from './growths'
import { BATTALION_CATEGORIES, battalionData, filterBattalions } from './battalions'
import { BATTALION_CLASS_MESSAGES, classBattalionSupport } from './battalionPlanning'
import BattalionReference from './BattalionReference'
import { sourceRangeUrl } from './catalogReferences'

export default function SelectedBattalion({ characterName, selectedClass, battalionId, onSelect, onNavigateCatalog }: {
  characterName: string; selectedClass: ClassProfile; battalionId?: string
  onSelect: (id: string | null) => void; onNavigateCatalog: (id: string) => void
}) {
  const [hasOpened, setHasOpened] = useState(false)
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all')
  const selected = battalionData.records.find(record => record.id === battalionId)
  const visible = filterBattalions({ search, category, rank: 'all', classSupportOnly: false }, selectedClass)
  const outsideFilters = selected && !visible.some(record => record.id === selected.id)
  const allowed = selectedClass.details.allowedWeaponsAndSkills
  const support = classBattalionSupport(allowed)
  return <details className="progression-panel selected-battalion-panel" onToggle={event => { if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Selected Battalion</span><span>{characterName} · {selected?.name ?? 'None selected'} <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Main build selected battalion">
      <div className="character-details-heading"><div><span className="eyebrow">Main build equipment plan</span><h2>{characterName} · Battalion selection</h2></div></div>
      <p className="details-context">Choose a battalion for this build. Its stat modifiers are shown separately from growth rates.</p>
      <div className="progression-tools selected-weapon-tools" role="group" aria-label="Selected battalion controls">
        <div><label htmlFor="selected-battalion-search">Search battalions</label><input id="selected-battalion-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search battalion names…" /></div>
        <div><label htmlFor="selected-battalion-category">Battalion category</label><select id="selected-battalion-category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{BATTALION_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></div>
        <div><label htmlFor="selected-battalion-choice">Battalion for {characterName}</label><select id="selected-battalion-choice" value={selected?.id ?? ''} onChange={event => onSelect(event.target.value || null)}><option value="">No battalion selected</option>{outsideFilters && <optgroup label="Current choice outside filters"><option value={selected.id}>{selected.name}</option></optgroup>}{visible.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}</select></div>
        <button type="button" className="shortlist-button" disabled={!selected} onClick={() => onSelect(null)}>Clear battalion selection</button>
      </div>
      <p className="details-context">{visible.length} battalions match.</p>
      {outsideFilters && <p className="details-context" role="status">The selected battalion is outside these filters; your choice and its details are retained.</p>}
      <div className={`selected-weapon-support ${support}`} role="group" aria-label="Battalion class compatibility">
        <strong>{BATTALION_CLASS_MESSAGES[support]}</strong><details className="reader-disclosure"><summary>Class compatibility details</summary><p>{selectedClass.name}: {allowed.text ?? 'Not documented'} · <a href={sourceRangeUrl(allowed.source)} target="_blank" rel="noreferrer">{allowed.source}</a></p>
        <p>Class allowed-types context only; equip legality is unverified. Dismounting permission is not established.</p>
        <p>Required Authority rank is a battalion requirement, not {characterName}’s current rank. Individual Authority training is not tracked. Class XP bonuses, certification requirements and learnset unlocks do not prove current rank.</p></details>
      </div>
      {battalionId && !selected && <p className="class-source-warning">This battalion reference is no longer available. No replacement was selected.</p>}
      {!selected && <p className="details-context">Choose a battalion to inspect its recorded modifiers, ability and acquisition information.</p>}
      {selected && <section className="selected-battalion-reference" aria-label={`${selected.name} selected battalion reference`}>
        <div className="comparison-actions"><button type="button" onClick={() => onNavigateCatalog(selected.id)}>View in Battalions &amp; Gambits</button></div>
        <BattalionReference record={selected} />
      </section>}
    </section>}
  </details>
}
