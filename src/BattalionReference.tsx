import type { RefObject } from 'react'

import { DATA_STATUS_LABELS, STATS, STAT_NAMES, type SourceText } from './growths'

import type { Battalion } from './battalions'

import { sourceRangeUrl } from './catalogReferences'



function ReferenceText({ label, field }: { label: string; field: SourceText }) {

  return <div className="recorded-entry" role="group" aria-label={label}>

    <div className="recorded-heading"><h3>{label}</h3></div>

    <p className="recorded-text">{field.text ?? 'Not recorded in the workbook.'}</p><details className="reader-disclosure"><summary>Source details</summary><p className="entry-source"><a href={sourceRangeUrl(field.source)} target="_blank" rel="noreferrer">{field.source}</a> · {DATA_STATUS_LABELS[field.status]}</p></details>

  </div>

}



export default function BattalionReference({ record: selected, headingRef }: { record: Battalion; headingRef?: RefObject<HTMLHeadingElement | null> }) {

  return <>

          <div className="character-details-heading"><div><span className="eyebrow">Battalion reference</span><h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{selected.name}</h2></div></div>

          <details className="reader-disclosure"><summary>Battalion source</summary><p className="entry-source"><a href={sourceRangeUrl(`${selected.source.sheet}!${selected.source.range}`)} target="_blank" rel="noreferrer">{selected.source.sheet}!{selected.source.range}</a> · {DATA_STATUS_LABELS[selected.reliability]}</p></details>

          <div className="battalion-reference-columns"><div>

          <div className="battalion-facts">

            <ReferenceText label="Category" field={selected.category} /><ReferenceText label="Required Authority rank" field={selected.authorityRank} />

            <div className="recorded-entry" role="group" aria-label="Gather limit"><div className="recorded-heading"><h3>Gather limit</h3></div>

              <p className="recorded-text">{selected.gatherLimit.value ?? 'Unknown'}</p><details className="reader-disclosure"><summary>Source</summary><p className="entry-source">{selected.gatherLimit.source} · {DATA_STATUS_LABELS[selected.gatherLimit.status]}</p></details></div>

          </div>

          

          <ReferenceText label="Listed ability / gambit name" field={selected.ability} />

          

          <ReferenceText label="Acquisition information" field={selected.acquisition} />

          </div><div>

          <ReferenceText label="Flat stat bonuses" field={selected.flatStatText} />

          <div className="battalion-parsed" role="group" aria-label="Parsed flat stat modifiers">

            <h3>Stat modifiers · points</h3>

            <dl className="battalion-stat-grid">{STATS.map(stat => <div key={stat}><dt>{STAT_NAMES[stat]} ({stat})</dt><dd>{selected.parsedStats.values[stat] === null ? 'Not listed' : `${selected.parsedStats.values[stat]! > 0 ? '+' : ''}${selected.parsedStats.values[stat]}`}</dd></div>)}</dl>

            <details className="reader-disclosure"><summary>Parsing & source details</summary><p className="details-context">Parsing: {selected.parsedStats.state}. Omitted stats remain unlisted. These flat modifiers do not change growth rates.</p><p className="entry-source">{selected.parsedStats.source} · Luck is recognized as Lck; source text is unchanged.</p></details>

          </div>

          {selected.validation.map(entry => <p className="class-source-warning" key={`${entry.code}/${entry.location}`}>{entry.location}: {entry.message}</p>)}

          </div></div>

  </>

}

