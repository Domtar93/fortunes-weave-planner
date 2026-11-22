import { PHASE_LABELS } from './dungeons'
import { weaponDungeonAudit, REFINED_CANDIDATE_LABEL, type ExactWeaponReward } from './weaponDungeonReferences'
import { sourceRangeUrl } from './catalogReferences'
import { weaponData, weaponFieldText, WEAPON_FIELDS, type WeaponFieldKey, type WeaponForgingRecord } from './forging'

const statKeys: WeaponFieldKey[] = ['hit', 'might', 'attackRange', 'weight', 'critical', 'durability', 'maxRefinement']
function Source({ value }: { value: string }) { return <a className="entry-source" href={sourceRangeUrl(value)} target="_blank" rel="noreferrer">{value}</a> }
const reference = (weapon: WeaponForgingRecord) => `${weapon.source.sheet}!${weapon.source.range}`
function RawFields({ weapon }: { weapon: WeaponForgingRecord }) {
  return <details className="class-section"><summary>Raw source cells · {weapon.name} · row {weapon.source.row}</summary><dl className="weapon-raw">{(Object.keys(WEAPON_FIELDS) as WeaponFieldKey[]).map(key => <div key={key}><dt>{WEAPON_FIELDS[key]} · <Source value={weapon[key].source} /></dt><dd className="recorded-text">{String(weapon[key].raw ?? '(blank)')}<span className="entry-source">Type {weapon[key].rawType} · format {weapon[key].numberFormat ?? '(none)'}{'excelSerial' in weapon[key] && weapon[key].excelSerial !== null ? ` · Excel serial ${weapon[key].excelSerial}` : ''}</span></dd></div>)}</dl></details>
}

export { Source, RawFields, reference }

export function WeaponProperties({ weapon: selected }: { weapon: WeaponForgingRecord }) {
  return <>
          <dl className="weapon-stats">{statKeys.map(key => <div key={key}><dt>{WEAPON_FIELDS[key]}</dt><dd className={weaponFieldText(selected, key) === 'Not documented' ? 'weapon-value-missing' : undefined}>{weaponFieldText(selected, key)}</dd></div>)}</dl>
          <details className="reader-disclosure"><summary>Might & refinement details</summary><p className="details-context">{selected.might.kind === 'span' ? `Documented endpoints: ${selected.might.lower} and ${selected.might.upper}.` : selected.might.kind === 'single' ? `Single documented Might: ${selected.might.value}.` : 'Might is not documented or cannot be safely parsed.'} Endpoints do not establish unrefined/final Might or intermediate steps. Maximum refinement is a recorded limit. No progression formula or effect-unlock level is known here.</p></details>
          {selected.attackRange.state === 'source-display' && <p className="class-source-warning">Attack range uses the original Excel d-m display ({selected.attackRange.text}); see source details for the original encoding.</p>}
          <div className="recorded-entry"><h3>Special effects</h3><p className="recorded-text">{weaponFieldText(selected, 'effects')}</p><details className="reader-disclosure"><summary>Source</summary><Source value={selected.effects.source} /></details></div>
          <div className="recorded-entry"><h3>Combat art / additional note</h3><p className="recorded-text">{weaponFieldText(selected, 'additionalNote')}</p><details className="reader-disclosure"><summary>Source</summary><Source value={selected.additionalNote.source} /></details></div>
  </>
}

export function WeaponAcquisition({ weapon, onNavigateDungeon }: { weapon: WeaponForgingRecord; onNavigateDungeon?: (reference: ExactWeaponReward) => void }) {
  const sources = weaponDungeonAudit.exact.filter(entry => entry.weapon.id === weapon.id)
  const candidates = weaponDungeonAudit.refinedCandidates.filter(entry => entry.weapon.id === weapon.id)
  return <>
          <section className="weapon-dungeon-sources" aria-label="Documented Dungeon Sources"><h3>Documented Dungeon Sources</h3>
            <p className="details-context">Recorded chest locations. Route access may vary.</p>
            {sources.length === 0 && <p>No exact dungeon chest match documented.</p>}
            {sources.map(entry => <div className="recorded-entry" key={`${entry.chest.id}/${entry.part}`}><h4>{entry.location.name} · Chest {entry.chest.number} · {PHASE_LABELS[entry.part]}</h4><p className="recorded-text">Recorded reward: {entry.reward}</p><details className="reader-disclosure"><summary>Source</summary><Source value={entry.source} /></details>
              {onNavigateDungeon && <div className="comparison-actions"><button type="button" onClick={() => onNavigateDungeon(entry)}>View dungeon: {entry.location.name.trim()} · Chest {entry.chest.number} · {PHASE_LABELS[entry.part]}</button></div>}
            </div>)}
          </section>
          {candidates.length > 0 && <details className="class-section"><summary>Possible refined-label references · {candidates.length}</summary><p className="details-context">{REFINED_CANDIDATE_LABEL}. These are informational suggestions, not exact acquisition links. No refined statistics are calculated.</p>{candidates.map(entry => <div className="recorded-entry" key={`${entry.chest.id}/${entry.part}`}><p className="recorded-text">{entry.location.name} · Chest {entry.chest.number} · {PHASE_LABELS[entry.part]} · Recorded: {entry.reward}</p><p>Suggested base: {entry.weapon.name} · documented suffix {entry.suffix}</p><Source value={entry.source} /></div>)}</details>}
  </>
}

export function WeaponEvidence({ weapon: selected }: { weapon: WeaponForgingRecord }) {
  const relationships = weaponData.relationships.filter(entry => entry.mainId === selected.id)
  return <>
          {relationships.map(relation => {
            const preliminary = weaponData.preliminary.find(entry => entry.id === relation.preliminaryId)!
            return <details className="weapon-evidence reader-disclosure" key={preliminary.id} aria-label={`Preliminary comparison ${preliminary.name}`}><summary>Source values differ · {relation.differences.map(diff => WEAPON_FIELDS[diff.field]).join(', ')}</summary><h3>{relation.match === 'exact-name' ? 'Exact-name preliminary evidence' : 'Possible spelling variant · manual confirmation required'}</h3>
              <p className="details-context">{relation.match === 'possible-spelling' ? `${preliminary.name} and ${selected.name} remain separate, not merged. ` : ''}Main values are retained; preliminary entries never fill blanks or overwrite them.</p>
              <p><Source value={reference(selected)} /> · <Source value={reference(preliminary)} /></p>
              <div className="weapon-comparison"><table><caption>{selected.name} / {preliminary.name} source differences</caption><thead><tr><th>Field</th><th>Main · row {selected.source.row}</th><th>Preliminary · row {preliminary.source.row}</th></tr></thead><tbody>{relation.differences.map(diff => <tr key={diff.field}><th scope="row">{WEAPON_FIELDS[diff.field]}<span className="entry-source">{diff.kind}</span></th><td>{weaponFieldText(selected, diff.field)}</td><td>{weaponFieldText(preliminary, diff.field)}</td></tr>)}</tbody></table></div>
              <RawFields weapon={preliminary} />
            </details>
          })}
          <details className="class-section"><summary>Validation findings · {selected.validation.length}</summary>{selected.validation.length ? selected.validation.map((warning, index) => <p className="class-source-warning" key={index}>{warning.location}: {warning.message}</p>) : <p className="details-context">No field-level findings. Community reliability remains unverified.</p>}</details>
          <RawFields weapon={selected} />
  </>
}
