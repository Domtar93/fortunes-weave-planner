import { useMemo, useState } from 'react'
import { previewWorkbookMountGrowth } from './mountGrowthPreviewModel'
import { formatPercent, signedPercent, type CharacterProfile, type ClassProfile } from './growths'
import type { MountRecord } from './mounts'
import { sourceRangeUrl } from './catalogReferences'

export default function MountGrowthPreview({ character, selectedClass, mount }: { character: CharacterProfile; selectedClass: ClassProfile; mount?: MountRecord }) {
  const [opened, setOpened] = useState(false)
  const result = useMemo(() => opened ? previewWorkbookMountGrowth(character, selectedClass, mount) : undefined, [opened, character, selectedClass, mount])
  return <details className="progression-panel" onToggle={event => { if (event.currentTarget.open) setOpened(true) }}><summary><span>Documented Mount Growth Preview</span><span>Character + class + mount</span></summary>
    {result && <section aria-label="Documented mount growth preview"><h2>{character.name} × {selectedClass.name}</h2><p>{mount?.name ?? 'No mount selected'}</p>
      <p className="details-context">Compare base growths with this mount’s contribution. Flat stat bonuses are separate.</p>
      <p className="mount-compatibility" role="status">{result.message}</p>
      <table className="mount-preview-table"><caption>Growth percentages · base character + class plus documented mount contribution</caption><colgroup><col className="mount-preview-stat" /><col className="mount-preview-base" /><col className="mount-preview-contribution" /><col className="mount-preview-total" /></colgroup><thead><tr><th scope="col">Stat</th><th scope="col">Base</th><th scope="col">Mount</th><th scope="col">Preview</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.stat}><th scope="row">{row.stat}</th><td>{formatPercent(row.base)}</td>
        <td>{row.contribution === null ? 'Unknown' : row.blankAsZero ? '+0%*' : signedPercent(row.contribution)}</td>
        <td data-testid={`mount-preview-${row.stat}`}>{row.combined === null ? 'Unavailable' : formatPercent(row.combined)}</td></tr>)}</tbody></table>
      {mount?.validation.filter(item => item.severity === 'warning' || item.severity === 'error').map((item, index) => <p className="class-source-warning" key={index}>{item.location}: {item.message}</p>)}
      <details className="reader-disclosure"><summary>Calculation sources & details</summary>{result.rows.filter(row => row.source).map(row => <p className="entry-source" key={row.stat}>{row.stat}: <a href={sourceRangeUrl(row.source!)} target="_blank" rel="noreferrer">{row.source}</a>{result.state === 'applicable' && row.recorded !== null && ` · ${row.recorded}% × ${row.multiplier}`}</p>)}<p className="entry-source">Calculation evidence: <a href={sourceRangeUrl('Character Learnsets!D30:L31')} target="_blank" rel="noreferrer">Character Learnsets!D30:L31</a>; species comparison: <a href={sourceRangeUrl('Character Learnsets!D5:F7')} target="_blank" rel="noreferrer">D5:F7</a>. * Unlisted modifiers count as +0% only for workbook comparison. Raw blanks are retained; conflicting or unresolved data stays unavailable.</p>
      <p className="overview-caveat">This preview does not establish ownership, route availability, current proficiency, equip legality, flat statistics or combat effects.</p></details>
    </section>}
  </details>
}
