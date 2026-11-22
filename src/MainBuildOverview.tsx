import AbilityEffect from './AbilityEffect'
import { PROFICIENCY_NAMES } from './growths'
import { PLANNING_SLOTS, learnsetSourceLink } from './shortlist'
import { sourceRangeUrl } from './catalogReferences'
import type { MainBuildOverviewData, OverviewWarning } from './buildOverview'
import { ABILITY_DESCRIPTION_LABELS, resolveAbilityInformation } from './abilityInfo'
import BuildOverviewCopy from './BuildOverviewCopy'

function Warnings({ entries }: { entries: readonly OverviewWarning[] }) {
  return entries.length > 0 && <ul className="overview-warnings" aria-label="Source warnings">{entries.map((entry, index) => <li key={`${entry.source}/${index}`}><strong>{entry.source}</strong> · {entry.message}</li>)}</ul>
}
function Missing({ unavailable }: { unavailable: boolean }) {
  return <p className="overview-missing">{unavailable ? 'Selected reference unavailable. No replacement selected.' : 'Not selected.'}</p>
}

// Presentational only: no copied selection state, mutation callbacks, storage or calculations.
export default function MainBuildOverview({ data }: { data: MainBuildOverviewData }) {
  const { character, selectedClass, weapon, mount, battalion, entries, unavailable } = data
  return <details className="progression-panel main-build-overview">
    <summary><span>Main Build Overview</span><span>{character.name} · {selectedClass.name} <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Main build planning overview">
      <div className="character-details-heading"><div><span className="eyebrow">Main build · session planning</span><h2>{character.name} <span>× {selectedClass.name}</span></h2></div></div>
      <p className="overview-disclaimer">Your current equipment and ability plan. Use Copy or Download to share it.</p>
      <BuildOverviewCopy key={character.name} data={data} />
      {data.classNotes.length > 0 && <div className="overview-class-notes" role="group" aria-label="Class source notes">{data.classNotes.map(note => <p key={note}>{note}</p>)}</div>}
      <div className="overview-equipment">
        <section className="overview-item" aria-label="Overview weapon"><h3>Weapon</h3>{weapon ? <>
          <h4>{weapon.record.name}</h4><p>{weapon.family.family ?? 'Unresolved weapon family'}</p>
          <p className={`overview-context ${weapon.support.outcome}`}><strong>{weapon.support.message}</strong></p>
          <details className="reader-disclosure"><summary>Source & compatibility details</summary><p className="overview-caveat">Family context does not prove current rank or equip legality.</p>
          {weapon.support.outcome === 'unresolved' && <p className="overview-caveat">{weapon.support.reason}</p>}
          {weapon.record.completeness === 'incomplete' && <p className="overview-warning">Incomplete source data · {weapon.record.primaryCompleteness === 'incomplete' ? 'Primary combat stats missing.' : 'Some reference properties missing.'}</p>}
          <p className="entry-source"><a href={sourceRangeUrl(`${weapon.record.source.sheet}!${weapon.record.source.range}`)} target="_blank" rel="noreferrer">{weapon.record.source.sheet}!{weapon.record.source.range}</a> · Community data · Unverified</p>
          </details><Warnings entries={weapon.warnings} />
        </> : <Missing unavailable={unavailable.weapon} />}</section>
        <section className="overview-item" aria-label="Overview mount"><h3>Mount</h3>{mount ? <>
          <h4>{mount.record.name}</h4><p>Species: {mount.record.species.text ?? 'Unknown'}</p>
          <p className={`overview-context ${mount.outcome}`}><strong>{mount.message}</strong></p>
          <details className="reader-disclosure"><summary>Source & compatibility details</summary><p className="overview-caveat">Species context does not prove ownership or equip legality. No mount bonuses applied.</p>
          <p className="entry-source"><a href={sourceRangeUrl(mount.record.source)} target="_blank" rel="noreferrer">{mount.record.source}</a> · Community data · Unverified</p>
          </details><Warnings entries={mount.warnings} />
        </> : <Missing unavailable={unavailable.mount} />}</section>
        <section className="overview-item" aria-label="Overview battalion"><h3>Battalion</h3>{battalion ? <>
          <h4>{battalion.record.name}</h4><p>Category: {battalion.record.category.text ?? 'Unknown'}</p><p>Required Authority rank: {battalion.record.authorityRank.text ?? 'Unknown'}</p>
          <p className={`overview-context ${battalion.outcome}`}><strong>{battalion.message}</strong></p>
          <details className="reader-disclosure"><summary>Source & compatibility details</summary><p className="overview-caveat">The character’s current Authority rank is not tracked. This requirement is reference information only; no battalion stats or gambit effects applied.</p>
          <p className="entry-source"><a href={sourceRangeUrl(`${battalion.record.source.sheet}!${battalion.record.source.range}`)} target="_blank" rel="noreferrer">{battalion.record.source.sheet}!{battalion.record.source.range}</a> · {battalion.record.reliability}</p>
          </details><Warnings entries={battalion.warnings} />
        </> : <Missing unavailable={unavailable.battalion} />}</section>
      </div>
      <section className="overview-abilities" aria-label="Overview planned abilities"><h3>Planned abilities <span>{entries.length}/{PLANNING_SLOTS}</span></h3>
        <p className="overview-caveat">Edit and reorder these choices in Abilities.</p>
        {character.name === 'Mu (with growth)' && entries.length > 0 && <p className="overview-caveat">This profile uses Mu’s source learnset through the existing explicit mapping; its session plan remains separate.</p>}
        {entries.length === 0 ? <p className="overview-missing">No abilities shortlisted.</p> : <ol aria-label="Overview ability order">{entries.map(planned => { const information=resolveAbilityInformation({name: planned.entry.text, proficiency: planned.proficiency, fallback: planned.glossary?.description, characterName: character.name, rank:planned.entry.rank, source:planned.entry.source}); return <li key={planned.id} data-overview-source-id={planned.id}>
          <strong>{planned.entry.text}</strong><span>{planned.proficiency}{PROFICIENCY_NAMES[planned.proficiency] !== planned.proficiency ? ` (${PROFICIENCY_NAMES[planned.proficiency]})` : ''} · {planned.entry.rank}</span>
          <AbilityEffect className="shortlist-effect" information={information} />
          <details className="reader-disclosure"><summary>Sources & details</summary>{information.descriptionKind && <p className="entry-source">Description basis: {ABILITY_DESCRIPTION_LABELS[information.descriptionKind]}</p>}{information.references.map(ref=><p key={ref.url+ref.label}><a className="entry-source" href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a></p>)}<a className="entry-source" href={learnsetSourceLink(planned.entry)} target="_blank" rel="noreferrer">{planned.entry.source}</a>
          <span className="overview-caveat">{planned.entry.evidence ?? 'Evidence not documented'} · {planned.entry.reliability}</span>
          {planned.entry.note && <span className="overview-caveat">{planned.entry.note}</span>}{planned.glossary?.note && <span className="overview-caveat">{planned.glossary.note}</span>}
          </details>
        </li>})}</ol>}
      </section>
    </section>
  </details>
}
