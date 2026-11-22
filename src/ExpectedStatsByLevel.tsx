import {useState} from 'react'
import {STAT_NAMES,type CharacterProfile,type ClassProfile,type Stat} from './growths'
import {emptyObservations,formatExpected,GROWTH_RULE_REFERENCE,parseObservation,validLevel,type ComparisonLabel,type StatObservations} from './expectedStats'
import {baseStatCredits,projectCharacterAverage} from './characterBases'

// Session-only observations, kept per exact character profile. Never persisted.
export function useSessionObservations(characterName:string,targetLevel:number) {
 const [byCharacter,setByCharacter]=useState<Record<string,StatObservations>>({})
 const entry=Object.hasOwn(byCharacter,characterName)?byCharacter[characterName]:emptyObservations()
 const observations={...entry,targetLevel}
 const setObservations=(next:StatObservations)=>setByCharacter(current=>({...current,[characterName]:next}))
 return [observations,setObservations] as const
}

const COMPARISON_TEXT:Record<ComparisonLabel,string>={
 'Above simplified expectation':'Above average',
 'Below simplified expectation':'Below average',
 'Matches simplified expectation':'Matches average',
}

// "Compare with your game": type real stats beside the averages; optionally
// replace the level-1 bases with your own starting point. Uses the shared projection.
export default function ExpectedStatsByLevel({character,selectedClass,observations,onChange,defaultOpen=false}:{
 character:CharacterProfile;selectedClass:ClassProfile;observations:StatObservations;onChange:(next:StatObservations)=>void;defaultOpen?:boolean
}) {
 const {base,custom,result}=projectCharacterAverage(character,selectedClass,observations)
 const level=observations.targetLevel
 const setStat=(kind:'checkpointStats'|'actualStats',stat:Stat,value:string)=>onChange({...observations,[kind]:{...observations[kind],[stat]:value}})
 const statInput=(kind:'checkpointStats'|'actualStats',stat:Stat)=>{
  const value=observations[kind][stat],parsed=parseObservation(value),invalid=parsed!==null&&(!Number.isFinite(parsed)||parsed<0)
  const label=`${STAT_NAMES[stat]} · ${kind==='checkpointStats'?'Starting stat':'Your stat'}`
  return <>
   <label className="sr-only" htmlFor={`observation-${kind}-${stat}`}>{label}</label>
   <input id={`observation-${kind}-${stat}`} type="text" inputMode="decimal" autoComplete="off" value={value} aria-invalid={invalid||undefined} aria-describedby={invalid?`observation-error-${kind}-${stat}`:undefined} onChange={event=>setStat(kind,stat,event.target.value)}/>
   {invalid&&<span className="observation-error" id={`observation-error-${kind}-${stat}`}>Enter a non-negative number.</span>}
  </>
 }
 const checkpointInvalid=observations.checkpointLevel.trim()!==''&&!validLevel(parseObservation(observations.checkpointLevel))
 return <section className="compare-panel" aria-labelledby="compare-heading">
  <details open={defaultOpen||undefined}>
   <summary><span><h2 id="compare-heading">Compare with your game</h2><p>Type your unit’s real stats to see if they’re ahead of or behind average.</p></span><span className="toggle-icon" aria-hidden="true">＋</span></summary>
   <div className="compare-body">
    {result.error&&<p className="observation-error" role="alert">{result.error}</p>}
    {!result.error&&<p className="expected-interval" role="status">{custom?'Your starting point':'Level-1 base stats'}: level {result.intervalStart} → {level} · {result.levelUps} {result.levelUps===1?'level-up':'level-ups'}</p>}
    {!custom&&!base&&<p className="expected-guidance">Base stats are not available for this character. Use your own starting point below.</p>}
    {custom&&!result.explicitCheckpoint&&<p className="expected-guidance">Enter your starting level and starting stats, or switch back to level-1 base stats.</p>}
    <table className="compare-table" aria-label={`${character.name} stats compared with average at level ${level}`}>
     <thead><tr><th scope="col">Stat</th>{custom&&<th scope="col">Starting stat</th>}<th scope="col">Average</th><th scope="col">Your stat</th><th scope="col">Difference</th></tr></thead>
     <tbody>{result.rows.map(row=><tr key={row.stat} data-testid={`expected-row-${row.stat}`}>
      <th scope="row"><span className="stat-long">{STAT_NAMES[row.stat]}</span><span className="stat-short">{row.stat}</span>
       {(row.unsupported||row.inputErrors.length>0)&&<span className="expected-row-note">{row.unsupported&&<span>{row.unsupported}{result.levelUps===0&&' No level-ups are needed, so starting values remain unchanged.'}</span>}{row.inputErrors.map(error=><span key={error}>{error}</span>)}</span>}</th>
      {custom&&<td data-label="Starting stat">{statInput('checkpointStats',row.stat)}</td>}
      <td data-label="Average" className="compare-average">{formatExpected(row.projected)}</td>
      <td data-label="Your stat">{statInput('actualStats',row.stat)}</td>
      <td data-label="Difference" className={`compare-diff${row.difference===null?'':row.difference>0?' diff-up':row.difference<0?' diff-down':''}`}>
       {formatExpected(row.difference,true)}{row.comparison&&<span className="diff-label">{COMPARISON_TEXT[row.comparison]}</span>}
      </td>
     </tr>)}</tbody>
    </table>
    <p className="compare-note">Use unboosted stats (no equipment or temporary bonuses). Entries stay in this tab for each character and clear on refresh.</p>
    <details className="compare-options" open={custom||undefined}>
     <summary>Use my own starting point</summary>
     <fieldset className="expected-starting-point"><legend>Starting stats</legend>
      <label><input type="radio" name="expected-starting-point" checked={!custom} onChange={()=>onChange({...observations,startingPoint:'published'})}/>Level-1 base stats (automatic)</label>
      <label><input type="radio" name="expected-starting-point" checked={custom} onChange={()=>onChange({...observations,startingPoint:'custom'})}/>My own starting point</label>
     </fieldset>
     {custom&&<div className="checkpoint-level-field"><label htmlFor="reference-checkpoint-level">Starting level</label><input id="reference-checkpoint-level" type="text" inputMode="numeric" autoComplete="off" value={observations.checkpointLevel} placeholder="e.g. 10" aria-invalid={checkpointInvalid||undefined} aria-describedby="checkpoint-level-help" onChange={event=>onChange({...observations,checkpointLevel:event.target.value})}/><p id="checkpoint-level-help">The level where you recorded the starting stats. Then fill the Starting stat column above.</p></div>}
    </details>
    <details className="compare-sources"><summary>How averages are calculated</summary>
     <p className="details-context">Average = starting stat + level-ups × growth rate ÷ 100, where growth rate = character growth + class modifier (never below 0%, no upper limit). Fractions are kept internally and shown to one decimal place.</p>
     <p className="details-context">This is a simplified baseline: it assumes every level-up happened in {selectedClass.name} and starts from published level-1 stats, even for characters who join later. Recruitment auto-leveling, mounts, bonds, growth abilities, boosters, certification bonuses, minimum-gain rules and stat caps are not modeled, and no class or equipment flat bonus is added. Zero personal growth is unsupported without separate class base-growth data.</p>
     {base?.profileNote&&<p className="details-context">{base.profileNote}</p>}
     <p className="entry-source">Base stats: {baseStatCredits}</p>
     {base?.sources.map(source=><p key={source.url} className="entry-source"><a href={source.url} target="_blank" rel="noreferrer">{source.location}</a></p>)}
     <p className="entry-source"><a href={GROWTH_RULE_REFERENCE} target="_blank" rel="noreferrer">Growth rules and special cases · community reference</a></p>
     <p className="entry-source">Growth inputs: {character.source.sheet}!{character.source.range} · {selectedClass.source.sheet}!{selectedClass.source.range}.</p>
    </details>
   </div>
  </details>
 </section>
}
