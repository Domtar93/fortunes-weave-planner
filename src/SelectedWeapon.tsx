import { useState } from 'react'
import type { ClassProfile } from './growths'
import { weaponData } from './forging'
import { classWeaponSupport, familyEvidence, filterPlanningWeapons, WEAPON_FAMILIES, type WeaponFamilyFilter } from './weaponPlanning'
import { Source, reference, WeaponProperties, WeaponAcquisition, WeaponEvidence } from './WeaponReference'
import type { ExactWeaponReward } from './weaponDungeonReferences'

export default function SelectedWeapon({ characterName, selectedClass, weaponId, onSelect, onNavigateDungeon }: {
  characterName: string; selectedClass: ClassProfile; weaponId?: string; onSelect: (id: string | null) => void
  onNavigateDungeon: (reference: ExactWeaponReward) => void
}) {
  const [hasOpened, setHasOpened] = useState(false)
  const [search, setSearch] = useState(''), [family, setFamily] = useState<WeaponFamilyFilter>('all')
  const selected = weaponData.records.find(weapon => weapon.id === weaponId)
  const visible = filterPlanningWeapons(search, family)
  const outsideFilters = selected && !visible.some(weapon => weapon.id === selected.id)
  const evidence = selected ? familyEvidence(selected) : undefined
  const support = evidence ? classWeaponSupport(evidence, selectedClass.details.allowedWeaponsAndSkills) : undefined
  return <details className="progression-panel selected-weapon-panel" onToggle={event => { if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Selected Weapon</span><span>{characterName} · {selected?.name ?? 'None selected'} <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Main build selected weapon">
      <div className="character-details-heading"><div><span className="eyebrow">Main build equipment plan</span><h2>{characterName} · Weapon selection</h2></div></div>
      <p className="details-context">Choose a weapon for this build. Save a full loadout to keep your selection.</p>
      <div className="progression-tools selected-weapon-tools" role="group" aria-label="Selected weapon controls">
        <div><label htmlFor="selected-weapon-search">Search weapons</label><input id="selected-weapon-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search canonical names…" /></div>
        <div><label htmlFor="selected-weapon-family">Weapon family</label><select id="selected-weapon-family" value={family} onChange={event => setFamily(event.target.value as WeaponFamilyFilter)}><option value="all">All families</option>{WEAPON_FAMILIES.map(value => <option key={value}>{value}</option>)}<option value="unresolved">Unresolved family</option></select></div>
        <div><label htmlFor="selected-weapon-choice">Weapon for {characterName}</label><select id="selected-weapon-choice" value={selected?.id ?? ''} onChange={event => onSelect(event.target.value || null)}><option value="">No weapon selected</option>{outsideFilters && <optgroup label="Current choice outside filters"><option value={selected.id}>{selected.name}</option></optgroup>}{visible.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}</select></div>
        <button type="button" className="shortlist-button" disabled={!selected} onClick={() => onSelect(null)}>Clear weapon selection</button>
      </div>
      <p className="details-context">{visible.length} weapons match.</p>
      {outsideFilters && <p className="details-context" role="status">The selected weapon is outside these filters; your choice and its details are retained.</p>}
      {weaponId && !selected && <p className="class-source-warning">This weapon reference is no longer available. No replacement was selected.</p>}
      {!selected && <p className="details-context">Choose a weapon to inspect its properties, class context and documented dungeon sources.</p>}
      {selected && evidence && support && <section className="selected-weapon-reference" aria-label={`${selected.name} selected weapon reference`}>
        <div className="character-details-heading"><h3>{selected.name}</h3></div>
        <p className="selected-weapon-family">{evidence.family ?? 'Unresolved family'}</p>
        <div className={`selected-weapon-support ${support.outcome}`} role="group" aria-label="Weapon class compatibility">
          <strong>{support.message}</strong><details className="reader-disclosure"><summary>Class compatibility details</summary><p>{selectedClass.name}: {selectedClass.details.allowedWeaponsAndSkills.text ?? 'Not documented'} · <Source value={selectedClass.details.allowedWeaponsAndSkills.source} /></p>
          <p>{support.outcome === 'unresolved' ? support.reason : 'Provisional family comparison only. Current weapon rank and equip legality are unverified.'}</p>
          <details className="selected-weapon-explanation"><summary>Evidence and comparison limits</summary><p>Family follows the reviewed source row section; Forging has no explicit family column. No family is guessed from the weapon name.</p><p>{support.reason}</p><p>Proficiency XP, learnsets and class examination requirements do not prove current weapon rank or equip legality. Combat arts are reference text and are not automatically unlocked.</p></details></details>
        </div>
        <details className="reader-disclosure"><summary>Weapon source</summary><Source value={reference(selected)} /><p className="entry-source">Family classification: provisional · <Source value={evidence.source.cell} />{evidence.source.section && <> · <Source value={evidence.source.section} /></>}</p></details>
        {selected.primaryCompleteness === 'incomplete' && <p className="ability-issue">Some combat stats are missing.</p>}
        <div className="selected-weapon-columns"><div><WeaponProperties weapon={selected} /></div><aside aria-label="Selected weapon acquisition"><WeaponAcquisition weapon={selected} onNavigateDungeon={onNavigateDungeon} /></aside></div>
        <WeaponEvidence weapon={selected} />
      </section>}
    </section>}
  </details>
}
