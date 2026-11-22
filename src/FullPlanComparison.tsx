import { useMemo, useState } from 'react'
import { compareFullPlans } from './fullPlanComparisonModel'
import type { BuildLoadout, FullBuildSelection } from './loadouts'
import { formatPercent, STATS } from './growths'
import { formatPercentagePoints } from './comparison'
import type { MainBuildOverviewData } from './buildOverview'
import { learnsetSourceLink } from './shortlist'
import FullPlanMountComparison from './FullPlanMountComparison'

function Plan({ label, data }: { label: string; data: MainBuildOverviewData }) {
  return <section className="preset-card" aria-label={`Full plan ${label} details`}><h3>{label}: {data.character.name} × {data.selectedClass.name}</h3>
    <p>Weapon: {data.weapon?.record.name ?? 'Not selected'}</p>{data.weapon && <><p className="overview-caveat">{data.weapon.support.message} Family: {data.weapon.family.family ?? 'Unknown'} · provisional.</p><p className="entry-source">{data.weapon.record.source.sheet}!{data.weapon.record.source.range}</p></>}
    <p>Mount: {data.mount?.record.name ?? 'Not selected'}</p>{data.mount && <p className="overview-caveat">{data.mount.message}</p>}
    <p>Battalion: {data.battalion?.record.name ?? 'Not selected'}</p>{data.battalion && <p className="overview-caveat">{data.battalion.message} Authority requirement: {data.battalion.record.authorityRank.text ?? 'Unknown'} · reference only.</p>}
    <h4>Planned abilities ({data.entries.length}/8)</h4>{data.entries.length ? <ol>{data.entries.map(entry => <li key={entry.id}>{entry.entry.text} · {entry.proficiency} {entry.entry.rank}<p className="entry-source">{entry.entry.evidence} · <a href={learnsetSourceLink(entry.entry)} target="_blank" rel="noreferrer">{entry.entry.source}</a></p></li>)}</ol> : <p>No abilities shortlisted.</p>}
    {[...data.classNotes, ...[data.weapon, data.mount, data.battalion].flatMap(item => item?.warnings.map(warning => `${warning.source}: ${warning.message}`) ?? [])].map((text, index) => <p className="class-source-warning" key={index}>{text}</p>)}
  </section>
}
export default function FullPlanComparison({ main, loadouts }: { main: FullBuildSelection; loadouts: BuildLoadout[] }) {
  const [opened, setOpened] = useState(false), [left, setLeft] = useState('main'), [right, setRight] = useState('main')
  const options = useMemo(() => new Map([['main', main], ...loadouts.map(item => [`loadout:${item.id}`, item] as const)]), [main, loadouts])
  const result = useMemo(() => {
    if (!opened) return undefined
    try {
      const a = options.get(left), b = options.get(right)
      if (!a || !b) throw new Error('A selected saved loadout is no longer available. Choose another plan; no selection was substituted.')
      return { value: compareFullPlans(a, b) }
    } catch (error) { return { error: error instanceof Error ? error.message : 'These plans could not be compared.' } }
  }, [opened, options, left, right])
  const control = (label: string, value: string, change: (value: string) => void) => <div><label htmlFor={`full-plan-${label}`}>Full plan {label}</label><select id={`full-plan-${label}`} value={value} onChange={event => change(event.target.value)}>
    {!options.has(value) && <option value={value}>Unavailable saved loadout</option>}<option value="main">Current Main</option>{loadouts.map(item => <option key={item.id} value={`loadout:${item.id}`}>{item.name} · {item.characterName} × {item.className}</option>)}
  </select></div>
  return <details className="full-plan-comparison" onToggle={event => { if (event.currentTarget.open) setOpened(true) }}><summary>Compare Full Plans</summary>{opened && <section aria-label="Full build plan comparison">
    <p className="details-key">Compare current Main and saved loadouts without loading or changing them. Growth columns are personal + class only. Equipment effects, mount growth and ability effects are not applied to these columns. Eight abilities is a planning capacity.</p>
    <div className="comparison-inputs">{control('A', left, setLeft)}{control('B', right, setRight)}</div>
    {result?.error && <p role="alert" className="preset-feedback error">{result.error}</p>}
    {result?.value && <><div className="full-plan-pair"><Plan label="A" data={result.value.a} /><Plan label="B" data={result.value.b} /></div>
      <table className="comparison-contribution-table"><caption>Base growth comparison · percentages and B minus A percentage points</caption><thead><tr><th scope="col">Stat</th><th scope="col">A</th><th scope="col">B</th><th scope="col">B − A</th></tr></thead><tbody>{STATS.map(stat => <tr key={stat}><th scope="row">{stat}</th><td data-testid={`full-plan-A-${stat}`}>{formatPercent(result.value!.growth.a.combined[stat])}</td><td data-testid={`full-plan-B-${stat}`}>{formatPercent(result.value!.growth.b.combined[stat])}</td><td>{formatPercentagePoints(result.value!.growth.difference[stat])}</td></tr>)}</tbody></table>
      <p className="overview-caveat">Planning reference only. Class lists and mount species do not establish equip legality, current proficiency, ownership or availability.</p>
      <FullPlanMountComparison a={result.value.a} b={result.value.b} />
    </>}
  </section>}</details>
}
