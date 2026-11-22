import { useState } from 'react'
import { useCatalogNavigation, type CatalogRequest } from './catalogNavigation'
import { PHASE_LABELS } from './dungeons'
import { weaponDungeonAudit, type ExactWeaponReward } from './weaponDungeonReferences'
import { Source, RawFields, reference, WeaponProperties, WeaponAcquisition, WeaponEvidence } from './WeaponReference'
import { filterWeapons, weaponData, weaponFieldText, type CompletenessFilter, type ConflictFilter } from './forging'

export default function WeaponForgingBrowser({ characterName, className, navigation, onNavigateDungeon }: { characterName: string; className: string; navigation?: CatalogRequest; onNavigateDungeon?: (reference: ExactWeaponReward) => void }) {
  const [hasOpened, setHasOpened] = useState(false)
  const { selectedId, setSelectedId, panelRef, headingRef } = useCatalogNavigation(weaponData.records[0]?.id ?? '', navigation, hasOpened)
  const [name, setName] = useState(''), [effect, setEffect] = useState(''), [combatArt, setCombatArt] = useState('')
  const [completeness, setCompleteness] = useState<CompletenessFilter>('all'), [conflict, setConflict] = useState<ConflictFilter>('all')
  const visible = filterWeapons({ name, effect, combatArt, completeness, conflict })
  const selected = weaponData.records.find(weapon => weapon.id === selectedId)
  const sources = weaponDungeonAudit.exact.filter(entry => entry.weapon.id === selectedId)
  const origin = sources.find(entry => entry.location.id === navigation?.reward?.locationId && entry.chest.id === navigation?.reward?.chestId && entry.part === navigation?.reward?.part)
  return <details ref={panelRef} className="progression-panel weapon-panel" onToggle={event => { if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Weapons &amp; Forging</span><span>{weaponData.records.length} main · {weaponData.preliminary.length} preliminary <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Weapon and forging reference browser">
      <p className="details-context reference-lead">Reference for {characterName} as {className}. Pick a weapon to see its stats, effects, forging steps and where to find it. Community data · unverified. Weapons do not enter build calculations or saved presets.</p>
      <div className="progression-tools weapon-tools" role="group" aria-label="Weapon catalog filters">
        <div><label htmlFor="weapon-name">Weapon name</label><input id="weapon-name" type="search" value={name} onChange={event => setName(event.target.value)} placeholder="Search names…" /></div>
        <div><label htmlFor="weapon-effect">Special-effect text</label><input id="weapon-effect" type="search" value={effect} onChange={event => setEffect(event.target.value)} placeholder="Search effects…" /></div>
        <div><label htmlFor="weapon-art">Combat art / note search</label><input id="weapon-art" type="search" value={combatArt} onChange={event => setCombatArt(event.target.value)} placeholder="Search combat arts…" /></div>
        <div><label htmlFor="weapon-completeness">Record completeness</label><select id="weapon-completeness" value={completeness} onChange={event => setCompleteness(event.target.value as CompletenessFilter)}><option value="all">All records</option><option value="complete">Complete numeric reference</option><option value="incomplete">Incomplete numeric reference</option><option value="primary-incomplete">Missing primary combat stats</option></select></div>
        <div><label htmlFor="weapon-conflicts">Source conflicts / differences</label><select id="weapon-conflicts" value={conflict} onChange={event => setConflict(event.target.value as ConflictFilter)}><option value="all">All records</option><option value="any">Any linked source difference</option><option value="numeric">Numeric discrepancy</option><option value="wording">Wording difference</option><option value="missing-data">Missing-data difference</option><option value="possible-spelling">Possible spelling variant</option></select></div>
      </div>
      <p className="details-context catalog-count">{visible.length} / {weaponData.records.length} main weapons shown</p>
      <details className="reader-disclosure"><summary>What “complete” means</summary><p className="details-key">Complete covers Hit, Might, range, weight, critical, durability and maximum refinement; optional descriptions may be absent. Four lack primary combat stats; Silver Spear also lacks durability.</p></details>
      <div className="mount-layout weapon-layout">
        <div className="mount-catalog"><ul aria-label="Main weapon catalog">{visible.map(weapon => <li key={weapon.id}><button type="button" aria-label={`Inspect weapon ${weapon.name}`} aria-pressed={selectedId === weapon.id} onClick={() => setSelectedId(weapon.id)}><span className="mount-row-name">{weapon.name}</span><span className="mount-row-species">Might {weaponFieldText(weapon, 'might')} · Range {weaponFieldText(weapon, 'attackRange')}</span><span className="mount-row-state">{weapon.completeness === 'complete' ? 'Complete numeric reference' : 'Incomplete reference'}{weaponData.relationships.some(entry => entry.mainId === weapon.id) && ' · Source difference'}</span></button></li>)}</ul>{!visible.length && <p className="empty-state">No weapons match. Clear the searches or reset the record and source-conflict filters. Your selected weapon stays open.</p>}</div>
        {selected && <section className="mount-detail weapon-detail" aria-label={`${selected.name} weapon details`}>
          <div className="character-details-heading"><div><span className="eyebrow">Main weapon reference</span><h2 ref={headingRef} tabIndex={-1}>{selected.name}</h2></div><span className="data-status unverified">Unverified</span></div>
          <Source value={reference(selected)} />
          <p className="details-context">{selected.completeness === 'complete' ? 'Complete numeric reference' : 'Incomplete reference'} · {selected.primaryCompleteness === 'complete' ? 'Primary combat stats documented' : 'Primary combat stats missing'}</p>
          {!visible.some(weapon => weapon.id === selectedId) && <p className="details-context">Selected weapon is outside the filters; inspection is retained.</p>}
          {origin && <p className="reference-arrival" role="status">From {origin.location.name} · Chest {origin.chest.number} · {PHASE_LABELS[origin.part]} · Recorded reward: {origin.reward} · {origin.source}</p>}
          <WeaponProperties weapon={selected} />
          <WeaponAcquisition weapon={selected} onNavigateDungeon={onNavigateDungeon} />
          <WeaponEvidence weapon={selected} />
        </section>}
      </div>
      <details className="class-section mount-sheet-notes"><summary>Preliminary evidence · five separate contributions</summary><p className="details-context">These five entries are reference evidence, not additional canonical weapons. Inspect each source alongside the linked main record above.</p>{weaponData.preliminary.map(entry => <div className="recorded-entry" key={entry.id}><h3>{entry.name} · row {entry.source.row}</h3><Source value={reference(entry)} /><p className="recorded-text">Might: {weaponFieldText(entry, 'might')} · Effects: {weaponFieldText(entry, 'effects')}</p><RawFields weapon={entry} /></div>)}</details>
      <details className="class-section mount-sheet-notes"><summary>Independent forging research notes · unverified</summary><p className="details-context">K onward contains independent comments. Their row positions do not attach them to a weapon. The effect-unlock observation is not a per-weapon progression table.</p>{weaponData.generalNotes.map(note => <div className="recorded-entry" key={note.source}><p className="recorded-text">{note.text ?? String(note.raw)}</p><Source value={note.source} /><span className="entry-source">Unverified</span></div>)}</details>
    </section>}
  </details>
}


