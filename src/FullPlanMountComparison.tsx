import {useMemo,useState} from 'react'
import type {MainBuildOverviewData} from './buildOverview'
import {previewWorkbookMountGrowth} from './mountGrowthPreviewModel'
import {formatPercent,signedPercent} from './growths'
import {formatPercentagePoints} from './comparison'
import {sourceRangeUrl} from './catalogReferences'

export default function FullPlanMountComparison({a,b}:{a:MainBuildOverviewData;b:MainBuildOverviewData}) {
 const [opened,setOpened]=useState(false)
 const result=useMemo(()=>opened?{
  a:previewWorkbookMountGrowth(a.character,a.selectedClass,a.mount?.record),
  b:previewWorkbookMountGrowth(b.character,b.selectedClass,b.mount?.record),
 }:undefined,[opened,a,b])
 return <details className="class-section" onToggle={event=>setOpened(event.currentTarget.open)}><summary>Compare documented mount growths</summary>
 {result&&<section aria-label="Full-plan documented mount comparison">
 <p className="details-key">Separate community-workbook preview, unverified. Includes compatible mount growth and Charioteer’s documented ×2 multiplier. Flat bonuses and equipment/ability effects are excluded. Unknown or disputed totals stay unavailable.</p>
 <p>A · {a.mount?.record.name??'No mount'}: {result.a.message}</p><p>B · {b.mount?.record.name??'No mount'}: {result.b.message}</p>
 <table className="mount-preview-table"><caption>Mount-inclusive growth preview · B minus A percentage points</caption><thead><tr><th scope="col">Stat</th><th scope="col">A preview</th><th scope="col">B preview</th><th scope="col">B − A</th></tr></thead><tbody>{result.a.rows.map((left,i)=>{
  const right=result.b.rows[i],known=left.combined!==null&&right.combined!==null
  return <tr key={left.stat}><th scope="row">{left.stat}</th><td data-testid={`full-mount-A-${left.stat}`}>{left.combined===null?'Unavailable':formatPercent(left.combined)}<small>Mount: {left.contribution===null?'Unknown':`${signedPercent(left.contribution)}${left.blankAsZero?'*':''}`}</small></td><td data-testid={`full-mount-B-${left.stat}`}>{right.combined===null?'Unavailable':formatPercent(right.combined)}<small>Mount: {right.contribution===null?'Unknown':`${signedPercent(right.contribution)}${right.blankAsZero?'*':''}`}</small></td><td>{known?formatPercentagePoints(right.combined!-left.combined!):'Unavailable'}</td></tr>
 })}</tbody></table>
 <p className="entry-source">* Explicit workbook interpretation of unlisted mount modifiers as +0% for consistent evidence. Raw blanks are unchanged. <a href={sourceRangeUrl('Character Learnsets!D30:L31')} target="_blank" rel="noreferrer">Recorded calculation formulas</a>. Compare the original base-growth table above independently.</p>
 </section>}</details>
}
