import {useMemo} from 'react'
import {combineGrowths,formatPercent,growthData,signedPercent,STAT_NAMES,STATS,type CharacterProfile,type ClassProfile,type Stat} from './growths'
import {formatExpected,type StatObservations} from './expectedStats'
import {projectCharacterAverage} from './characterBases'
import ClassFinder from './ClassFinder'
import StatRadar from './StatRadar'
import Portrait from './Portrait'

const finite=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value)
// Differences smaller than the displayed precision read as "same".
const EPSILON=0.05
export function signedDelta(value:number,digits=1):string {
 if(Math.abs(value)<(digits===0?0.5:EPSILON))return `±${(0).toFixed(digits)}`
 return `${value>0?'+':'−'}${Math.abs(value).toFixed(digits)}`
}
const deltaClass=(value:number)=>Math.abs(value)<EPSILON?'diff-same':value>0?'diff-up':'diff-down'

// The main result: one tile per stat with the average value at the chosen level
// and the growth rate that produces it. Calculations come from the existing models.
export default function StatSheet({character,selectedClass,observations,compareClassName='',onCompareClass,onSelectClass}:{
 character:CharacterProfile;selectedClass:ClassProfile;observations:StatObservations
 compareClassName?:string;onCompareClass?:(name:string)=>void;onSelectClass?:(name:string)=>void
}) {
 const {base,custom,result}=projectCharacterAverage(character,selectedClass,observations)
 const compareClass=compareClassName&&compareClassName!==selectedClass.name?growthData.classes.find(profile=>profile.name===compareClassName)??null:null
 const compared=compareClass?projectCharacterAverage(character,compareClass,observations).result:null
 // Growth rates depend only on the pairing; typing observations never recomputes them.
 // Malformed source growth shows "—" for that stat instead of breaking the page.
 const combined=useMemo(():Partial<Record<Stat,number>>=>{
  try {return combineGrowths(character.growths,selectedClass.growths)}
  catch {return Object.fromEntries(STATS.filter(stat=>Number.isFinite(character.growths[stat])&&Number.isFinite(selectedClass.growths[stat])).map(stat=>[stat,character.growths[stat]+selectedClass.growths[stat]]))}
 },[character,selectedClass])
 const level=observations.targetLevel
 const conflicts=new Map((base?.conflicts??[]).map(conflict=>[conflict.stat as Stat,conflict]))
 // With a class path, name each class's share of the level-ups: "9 level-ups as Commoner, 30 as Cavalier".
 const pathActive=(observations.classPath?.length??0)>0
 const levelUpText=pathActive&&result.segments.length>0
  ?result.segments.map((segment,index)=>`${segment.levelUps}${index===0?` ${segment.levelUps===1?'level-up':'level-ups'}`:''} as ${segment.label}`).join(', ')
  :`${result.levelUps} ${result.levelUps===1?'level-up':'level-ups'} as ${selectedClass.name}`
 const basis=result.error?null:custom
  ?result.explicitCheckpoint?`From your level ${result.intervalStart} stats · ${pathActive?levelUpText:`${result.levelUps} level-ups as ${selectedClass.name}`}`:'Enter your starting level and stats in Compare with your game'
  :base?`From level-1 base stats · ${levelUpText}`:'Base stats are not available for this character'

 // Strongest growths: every stat at or above the third-highest effective rate (ties included).
 const ranked=result.rows.filter(row=>finite(row.effective)&&row.effective>0).sort((a,b)=>b.effective!-a.effective!)
 const threshold=ranked.length>=3?ranked[2].effective!:ranked.at(-1)?.effective??Infinity
 const strengths=ranked.filter(row=>row.effective!>=threshold)
 const strong=new Set(strengths.map(row=>row.stat))

 const deltas=STATS.map((stat,index)=>{
  const row=result.rows[index],other=compared?.rows[index]
  return {stat,
   value:other&&finite(row.projected)&&finite(other.projected)?row.projected-other.projected:null,
   growth:other&&finite(row.effective)&&finite(other.effective)?row.effective-other.effective:null}
 })
 const known=deltas.filter(delta=>delta.value!==null) as {stat:Stat;value:number;growth:number|null}[]
 const total=known.reduce((sum,delta)=>sum+delta.value,0)
 const higher=known.filter(delta=>delta.value>=EPSILON).length,lower=known.filter(delta=>delta.value<=-EPSILON).length
 const growthTotal=deltas.reduce((sum,delta)=>sum+(delta.growth??0),0)

 const statTotal=result.rows.every(row=>finite(row.projected))?result.rows.reduce((sum,row)=>sum+row.projected!,0):null
 const growthSum=result.rows.every(row=>finite(row.effective))?result.rows.reduce((sum,row)=>sum+row.effective!,0):null

 return <section className="stat-sheet" aria-labelledby="stat-sheet-heading">
  <div className="unit-hero">
   <div className="unit-identity">
    <div className="unit-banner">
     <Portrait name={character.name}/>
     <div className="unit-title">
      <p className="unit-name">{character.name}</p>
      <p className="unit-class">{selectedClass.name}<span className="unit-level" aria-label={`Level ${level}`}><small>Lv</small>{level}</span></p>
     </div>
    </div>
    <div className="stat-sheet-heading">
     <h2 id="stat-sheet-heading">Average stats at level {level}</h2>
     {basis&&<p>{basis}</p>}
    </div>
    <dl className="unit-totals">
     <div><dt>Stat total</dt><dd data-testid="stat-total">{formatExpected(statTotal)}</dd></div>
     <div><dt>Growth total</dt><dd data-testid="growth-total">{growthSum===null?'—':`${growthSum}%`}</dd></div>
     {compareClass&&known.length>0&&<div><dt>vs {compareClass.name}</dt><dd className={deltaClass(total)}>{signedDelta(total)}</dd></div>}
    </dl>
    {strengths.length>0&&<p className="sheet-strengths"><span className="sheet-tools-label">Strongest growths</span>
     {strengths.map(row=><span className="strength-chip" key={row.stat}>{STAT_NAMES[row.stat]} <strong>{row.effective}%</strong></span>)}</p>}
    {onCompareClass&&<div className="compare-class-field">
     <label htmlFor="compare-class" className="sheet-tools-label">Compare with</label>
     <div className="select-wrap"><select id="compare-class" value={compareClass?.name??''} onChange={event=>onCompareClass(event.target.value)}>
      <option value="">No other class</option>
      {growthData.classes.filter(profile=>profile.name!==selectedClass.name).map(profile=><option key={profile.name} value={profile.name}>{profile.name}</option>)}
     </select><span aria-hidden="true">⌄</span></div>
    </div>}
   </div>
   <StatRadar level={level} primary={{name:selectedClass.name,values:result.rows.map(row=>row.projected)}}
    compare={compareClass&&compared?{name:compareClass.name,values:compared.rows.map(row=>row.projected)}:null}/>
  </div>
  {compareClass&&<p className="compare-summary" data-testid="compare-summary">
   <strong>{selectedClass.name}</strong> vs <strong>{compareClass.name}</strong> at level {level}:{' '}
   {result.levelUps===0&&!custom?<>same starting stats; growth differs by <span className={deltaClass(growthTotal)}>{signedDelta(growthTotal,0)}%</span> in total.</>
    :known.length===0?<>not enough data to compare.</>
    :<><span className={deltaClass(total)}>{signedDelta(total)}</span> total stats · higher in {higher}, lower in {lower}, same in {known.length-higher-lower}.</>}
   {onCompareClass&&<button type="button" className="link-button" onClick={()=>onCompareClass('')}>Clear</button>}
  </p>}
  {result.error&&<p className="observation-error" role="alert">{result.error}</p>}
  <div className="stat-tiles">
   {STATS.map((stat,index)=>{
    const row=result.rows[index],personal=character.growths[stat],modifier=selectedClass.growths[stat]
    const conflict=conflicts.get(stat),delta=deltas[index]
    const growth=combined[stat],fill=growth===undefined?0:Math.max(0,Math.min(100,growth)),growthText=growth===undefined?'—':`${growth}%`
    return <article className={`stat-tile${strong.has(stat)?' is-strength':''}`} key={stat} aria-label={`${STAT_NAMES[stat]} growth`} data-stat={stat}>
     <div className="tile-head"><h3>{STAT_NAMES[stat]}</h3>{strong.has(stat)&&<span className="strength-tag" title="One of this build’s strongest growths">Top</span>}<span className="stat-abbr">{stat}</span></div>
     <p className="tile-value"><span data-testid={`average-${stat}`}>{formatExpected(row.projected)}</span>{conflict&&<span className="tile-flag" title={`Sources disagree on base ${STAT_NAMES[stat]}: ${conflict.used} used, ${conflict.alternative} listed elsewhere`} aria-hidden="true">*</span>}</p>
     <p className="tile-base">{row.unsupported?<span className="tile-unsupported">{row.unsupported}</span>
      :row.checkpoint!==null&&result.explicitCheckpoint?result.levelUps===0?<>{custom?'Starting stat':'Base stat'}</>
      :<>{formatExpected(row.checkpoint).replace(/\.0$/u,'')} base <span data-testid={`gain-${stat}`}>+ {formatExpected(row.expectedGains)}</span></>:' '}</p>
     <div className="tile-bar" aria-hidden="true"><span style={{width:`${fill}%`}}/></div>
     <div className="tile-growth">
      <span className="tile-growth-label">Growth</span>
      <output className="tile-growth-value" data-testid={`combined-${stat}`} aria-label={`${stat} combined growth`} htmlFor="character class">{growthText}</output>
      {growth!==undefined&&<span className="stat-equation" aria-label={`${stat}: personal ${personal}% plus class ${signedPercent(modifier)} equals ${growth}%`}>
       <span className="personal-color" title="Character growth">{formatPercent(personal)}</span>
       <span className={modifier<0?'negative-color':'class-color'} title="Class modifier">{modifier<0?'−':'+'} {formatPercent(Math.abs(modifier))}</span>
      </span>}
     </div>
     {compareClass&&<p className="tile-compare" data-testid={`compare-${stat}`}>
      {delta.value!==null&&delta.growth!==null&&Math.abs(delta.value)<EPSILON&&Math.abs(delta.growth)<0.5?<span className="diff-same">Same</span>
      :<>{delta.value!==null?<span className={deltaClass(delta.value)}>{signedDelta(delta.value)}</span>:<span>—</span>}
      {delta.growth!==null&&<span className="tile-compare-growth">{signedDelta(delta.growth,0)}% growth</span>}</>}
      <span className="tile-compare-label">vs {compareClass.name}</span>
     </p>}
    </article>
   })}
  </div>
  <p className="stat-sheet-key"><span className="personal-color">Character growth</span> <span className="class-color">+ class modifier</span> = growth rate. Average = base + level-ups × growth rate.</p>
  {/growth rate increases with level/iu.test(selectedClass.details.abilityDescriptions.text??'')&&<p className="sheet-warning">{selectedClass.name}’s level-dependent growth ability is excluded. The listed class modifier is used for every level-up.</p>}
  {base?.conflicts.map(conflict=><p className="sheet-warning" key={conflict.stat}>* {character.name}’s level-1 {STAT_NAMES[conflict.stat as Stat]} differs between sources: using {conflict.used} from the research sheet; the other table lists {conflict.alternative}.</p>)}
  {(onSelectClass||onCompareClass)&&<ClassFinder character={character} selectedClass={selectedClass} observations={observations} onSelectClass={onSelectClass} onCompareClass={onCompareClass}/>}
  <p className="sr-only" role="status">Showing growth rates for {character.name} with {selectedClass.name}.</p>
 </section>
}
