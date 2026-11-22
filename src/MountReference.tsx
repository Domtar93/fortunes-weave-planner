import type { ReactNode, RefObject } from 'react'
import { DATA_STATUS_LABELS, signedPercent, STATS, STAT_NAMES, type SourceText } from './growths'
import { mountData, type MountRecord } from './mounts'
import { sourceRangeUrl } from './catalogReferences'
import { canUseWorkbookMountZeros, listedMountGrowthTotal } from './mountWorkbookModel'
import MountAbilityEffects from './MountAbilityEffects'

function MountText({ label, field }: { label: string; field: SourceText }) {
  return <div className="recorded-entry" role="group" aria-label={label}>
    <div className="recorded-heading"><h3>{label}</h3></div>
    <p className="recorded-text">{field.text ?? 'Not recorded in the workbook.'}</p>
    <details className="reader-disclosure"><summary>Source details</summary><p className="entry-source"><a href={sourceRangeUrl(field.source)} target="_blank" rel="noreferrer">{field.source}</a> · {DATA_STATUS_LABELS[field.status]}</p></details>
  </div>
}

export default function MountReference({ mount, headingRef, children }: { mount: MountRecord; headingRef?: RefObject<HTMLHeadingElement | null>; children?: ReactNode }) {
  const workbookZeros = canUseWorkbookMountZeros(mount), listedTotal = listedMountGrowthTotal(mount)
  return <>
          <div className="character-details-heading"><div><span className="eyebrow">Mount reference</span><h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{mount.name}</h2></div></div>
          <p>Species: {mount.species.text ?? 'Unknown'}</p><details className="reader-disclosure"><summary>Mount source</summary><p className="entry-source"><a href={sourceRangeUrl(mount.source)} target="_blank" rel="noreferrer">{mount.source}</a> · {mount.species.source} · Unverified</p></details>
          {children}
          {mount.validation.filter(entry => entry.severity === 'warning' || entry.severity === 'error').map(entry =>
            <p className="class-source-warning" key={`${entry.code}/${entry.location}`}><strong>{entry.location}</strong> — {entry.message}</p>)}
          <div className="mount-reference-columns"><div>
          <div className="mount-text-grid">
            <MountText label="Listed ability names" field={mount.abilities} />
            <MountText label="Flat stat modifiers (points, source text)" field={mount.flatStatText} />
          </div>
          <MountAbilityEffects mount={mount} />
          <details className="reader-disclosure"><summary>About listed mount abilities</summary><p className="mount-ability-caution">Listed abilities may be alternatives, not cumulative benefits. No movement, Canto or other ability effect is applied.
            {mountData.abilityWarning && <span className="entry-source"> {mountData.abilityWarning.source}: {mountData.abilityWarning.text}</span>}</p></details>
          <MountText label="Written growth modifiers (%)" field={mount.growthText} />
          <MountText label="Acquisition locations & recorded route/story conditions" field={mount.acquisition} />
          </div><div>
          <p className="details-context">Written and numeric versions stay separate. {workbookZeros ? '* Unlisted modifiers display +0% for workbook comparison; raw source blanks are retained.' : '“Not listed” is an omission, not a verified zero.'} </p>
          <div className="mount-growth-table"><table>
            <caption className="sr-only">{mount.name} written versus numeric growth modifiers</caption>
            <thead><tr><th scope="col">Stat</th><th scope="col">Written %</th><th scope="col">Numeric %</th></tr></thead>
            <tbody>{STATS.map(stat => {
              const written = mount.parsed.growths.values[stat]
              const numeric = mount.numericGrowths[stat]
              const conflict = mount.growthComparison.differences.some(entry => entry.stat === stat)
              return <tr key={stat} className={conflict ? 'growth-conflict' : ''}><th scope="row">{STAT_NAMES[stat]} ({stat}){conflict && <span className="conflict-tag">Differs</span>}</th>
                <td>{written === null ? workbookZeros ? '+0%*' : 'Not listed' : signedPercent(written)}</td>
                <td>{numeric.value === null ? workbookZeros ? '+0%*' : 'Not listed' : signedPercent(numeric.value)}</td></tr>
            })}</tbody>
          </table></div>
          {listedTotal !== null && <p className="mount-total">Listed growth modifiers total: {signedPercent(listedTotal)}</p>}
          <details className="reader-disclosure"><summary>Growth table sources</summary><p className="entry-source">Written: {mount.growthText.source}</p>{STATS.map(stat => <p className="entry-source" key={stat}>{stat}: {mount.numericGrowths[stat].source}</p>)}<p className="entry-source mount-total">Source total ({mount.totalGrowth.source}): {mount.totalGrowth.formula ?? (mount.totalGrowth.value === null ? 'Unknown' : signedPercent(mount.totalGrowth.value))}
            {mount.totalGrowth.formula && ' · Original formula retained.'}</p></details>
          <details className="class-section mount-parsing"><summary><span>Parsing &amp; validation</span><span>Separate from raw text <span aria-hidden="true">＋</span></span></summary>
            <p className="details-context">Growth text: {mount.parsed.growths.state} · Flat-stat text: {mount.parsed.flatStats.state}. Parsed tokens are reference annotations and do not change calculated totals.</p>
            <p className="recorded-text">Parsed flat points: {STATS.filter(stat => mount.parsed.flatStats.values[stat] !== null).map(stat => `${stat} ${mount.parsed.flatStats.values[stat]}`).join(', ') || 'None parsed'}</p>
            {[...mount.parsed.growths.unparsed, ...mount.parsed.flatStats.unparsed].map((token, index) => <p className="recorded-text" key={index}>Unparsed token: {token}</p>)}
            {mount.validation.length === 0 ? <p className="details-context">No additional row validation findings. Community data remains unverified.</p>
              : mount.validation.map(entry => <p className="details-context" key={`${entry.code}/${entry.location}`}>{entry.code} · {entry.location}: {entry.message}</p>)}
          </details>
          </div></div>
          <details className="reader-disclosure mount-notes"><summary>Community reference notes</summary><MountText label="Independent community reference notes (column G)" field={mount.communityNotes} />
            <p className="details-context">Column G is an independent reference-note field. Its text is not assigned as an effect of this mount’s listed abilities.</p></details>
  </>
}
