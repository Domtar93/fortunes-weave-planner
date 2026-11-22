import {useMemo,useState} from 'react'
import {growthData,signedPercent,STAT_NAMES,STATS,type CharacterProfile,type ClassProfile,type Stat} from './growths'
import {formatExpected,type StatObservations} from './expectedStats'
import {projectCharacterAverage} from './characterBases'

type RankBy=Stat|'all'
const TOP=8
const finite=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value)

// Unlock text comes straight from the research sheet; only the first line is shown.
export function classRequirement(profile:ClassProfile):string {
 const parts:string[]=[]
 const level=profile.details.level.text?.trim()
 if(level)parts.push(level)
 const unlock=profile.details.additionalUnlocks.text?.trim()
 if(unlock){parts.push(unlock.split(/\n/u)[0].trim());if(/only ONE unit/iu.test(unlock))parts.push('one unit at a time')}
 return parts.join(' · ')
}

// Ranks every class for this character by the growth rate of one stat (or all nine),
// using the same projection as the stat sheet. It never changes the build on its own.
export default function ClassFinder({character,selectedClass,observations,onSelectClass,onCompareClass}:{
 character:CharacterProfile;selectedClass:ClassProfile;observations:StatObservations
 onSelectClass?:(name:string)=>void;onCompareClass?:(name:string)=>void
}) {
 const [open,setOpen]=useState(false)
 const [choice,setChoice]=useState<RankBy|null>(null)
 const [showAll,setShowAll]=useState(false)
 // Default to the character's own best personal growth.
 const bestPersonal=STATS.reduce((best,stat)=>(character.growths[stat]??-Infinity)>(character.growths[best]??-Infinity)?stat:best,STATS[0])
 const rankBy:RankBy=choice??bestPersonal
 const level=observations.targetLevel
 const ranking=useMemo(()=>{
  if(!open)return []
  return growthData.classes.map((profile,order)=>{
   const {result}=projectCharacterAverage(character,profile,observations)
   if(rankBy==='all'){
    const growth=result.rows.every(row=>finite(row.effective))?result.rows.reduce((sum,row)=>sum+row.effective!,0):null
    const average=result.rows.every(row=>finite(row.projected))?result.rows.reduce((sum,row)=>sum+row.projected!,0):null
    return {profile,order,growth,average,modifier:STATS.reduce((sum,stat)=>sum+(profile.growths[stat]??0),0)}
   }
   const row=result.rows[STATS.indexOf(rankBy)]
   return {profile,order,growth:row.effective,average:row.projected,modifier:profile.growths[rankBy]}
  }).sort((a,b)=>(finite(b.growth)?b.growth:-Infinity)-(finite(a.growth)?a.growth:-Infinity)||a.order-b.order)
 },[open,character,observations,rankBy])
 // Competition ranking: classes with the same growth share a rank (1, 1, 3 …).
 const value=(growth:number|null)=>finite(growth)?growth:-Infinity
 const rankOf=(growth:number|null)=>ranking.filter(entry=>value(entry.growth)>value(growth)).length+1
 const current=ranking.find(entry=>entry.profile.name===selectedClass.name)
 const currentRank=current?rankOf(current.growth):-1
 const ties=current?ranking.filter(entry=>entry!==current&&value(entry.growth)===value(current.growth)).length:0
 const visible=showAll?ranking:ranking.slice(0,TOP)
 const label=rankBy==='all'?'all stats':STAT_NAMES[rankBy]
 return <details className="class-finder" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><span><strong>Find the best class</strong><span className="finder-hint">Rank all {growthData.classes.length} classes by any stat for {character.name}</span></span><span className="toggle-icon" aria-hidden="true">+</span></summary>
  {open&&<div className="finder-body">
   <div className="finder-controls">
    <label htmlFor="finder-stat">Rank classes by</label>
    <div className="select-wrap"><select id="finder-stat" value={rankBy} onChange={event=>setChoice(event.target.value as RankBy)}>
     {STATS.map(stat=><option key={stat} value={stat}>{STAT_NAMES[stat]}</option>)}
     <option value="all">All stats (total)</option>
    </select><span aria-hidden="true">⌄</span></div>
    {current&&<p className="finder-current-rank" data-testid="finder-current-rank">{selectedClass.name} ranks <strong>#{currentRank}</strong> of {ranking.length} for {label}{ties>0?` (tied with ${ties} other${ties===1?'':'s'})`:''}.</p>}
   </div>
   <ol className="finder-list" aria-label={`Classes ranked by ${label} growth`}>
    {visible.map(entry=>{
     const isCurrent=entry.profile.name===selectedClass.name,requirement=classRequirement(entry.profile),rank=rankOf(entry.growth)
     return <li key={entry.profile.name} className={`finder-row${isCurrent?' is-current':''}${rank<=3?' is-top':''}`}>
      <span className="finder-rank" aria-hidden="true">{rank}</span>
      <div className="finder-main">
       <p className="finder-name"><strong>{entry.profile.name}</strong>{isCurrent&&<span className="finder-current">Current</span>}</p>
       <p className="finder-meta">Class {signedPercent(entry.modifier)}{requirement&&<> · {requirement}</>}</p>
      </div>
      <p className="finder-metric finder-growth"><strong>{finite(entry.growth)?`${entry.growth}%`:'—'}</strong><span>growth</span></p>
      <p className="finder-metric finder-avg"><strong>{formatExpected(entry.average)}</strong><span>avg at Lv {level}</span></p>
      <div className="finder-actions">{!isCurrent&&<>
       {onSelectClass&&<button type="button" aria-label={`Use ${entry.profile.name}`} onClick={()=>onSelectClass(entry.profile.name)}>Use</button>}
       {onCompareClass&&<button type="button" aria-label={`Compare with ${entry.profile.name}`} onClick={()=>onCompareClass(entry.profile.name)}>Compare</button>}
      </>}</div>
     </li>
    })}
   </ol>
   {ranking.length>TOP&&<button type="button" className="link-button finder-more" onClick={()=>setShowAll(value=>!value)}>{showAll?`Show top ${TOP} only`:`Show all ${ranking.length} classes`}</button>}
   <p className="compare-note">Ranked by growth rate; classes with the same rate share a rank. Requirements are copied from the research sheet and are unverified. Whether {character.name} can use a class (gender, route or one-unit limits) is not checked.</p>
  </div>}
 </details>
}
