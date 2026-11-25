import {STATS, type Stat} from './growths'

export const TARGET_LEVELS = Array.from({length:99},(_,index)=>index+1)
export const GROWTH_RULE_REFERENCE = 'https://annasnotebook.net/en/mechanics/stats/'
type OptionalStats = Partial<Record<Stat,number|null>>
export interface ExpectedStatsInput {
 targetLevel:number
 checkpointLevel?:number|null
 personalGrowth:OptionalStats
 classGrowth:OptionalStats
 checkpointStats?:OptionalStats
 actualStats?:OptionalStats
 /** Earlier classes, in order. Each covers the level-ups up to and including its untilLevel. */
 earlierClasses?:EarlierClassInput[]
 /** Name of the final class, for the per-class breakdown. */
 finalLabel?:string
}
export interface EarlierClassInput { label:string; classGrowth:OptionalStats; untilLevel:number }
/** How many of the projected level-ups each class receives. */
export interface ClassSegment { label:string|null; fromLevel:number; toLevel:number; levelUps:number }
export type ComparisonLabel = 'Above simplified expectation'|'Below simplified expectation'|'Matches simplified expectation'
export interface ExpectedStatRow {
 stat:Stat; personal:number|null; classModifier:number|null; effective:number|null
 expectedGains:number|null; checkpoint:number|null; projected:number|null; actual:number|null; difference:number|null
 comparison:ComparisonLabel|null; unsupported:string|null; inputErrors:string[]
}
export interface ExpectedStatsResult {
 intervalStart:number|null; levelUps:number|null; explicitCheckpoint:boolean; error:string|null; rows:ExpectedStatRow[]
 /** Level-ups per class, in order, skipping classes that receive none. Empty when there is an error. */
 segments:ClassSegment[]
}
export function validLevel(value:unknown):value is number {
 return typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=99
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const missing=(value:unknown)=>value===null||value===undefined

// No recruitment, equipment, flat-class, mount, or persistence inputs exist here.
// Each multiplication uses the entire interval, without per-level rounding.
export function projectExpectedStats(input:ExpectedStatsInput):ExpectedStatsResult {
 const explicitCheckpoint=!missing(input.checkpointLevel)
 const start=explicitCheckpoint?input.checkpointLevel!:1
 const error=!validLevel(input.targetLevel)?'Target level must be a whole number from 1 to 99.'
  :!validLevel(start)?'Reference checkpoint level must be a whole number from 1 to 99.'
  :input.targetLevel<start?'Target level is below the checkpoint. Choose a target at or above the checkpoint; backward projection is not supported.':null
 const earlier=input.earlierClasses??[]
 const pathError=error?null:earlier.some(stage=>!validLevel(stage.untilLevel)||stage.untilLevel<2)?'Each class change needs a level from 2 to 99.'
  :earlier.some((stage,index)=>index>0&&stage.untilLevel<=earlier[index-1].untilLevel)?'Class changes must be at increasing levels.'
  :earlier.length>0&&earlier.at(-1)!.untilLevel>=99?'The last class change must be below level 99, so the main class gets a turn.':null
 const finalError=error??pathError
 const levelUps=finalError?null:input.targetLevel-start
 // Class path (November 25, 2026): the level-up into level L uses the class held at level L−1,
 // so a class held "until level 10" receives the level-ups into levels 2–10 and the next class
 // starts with the level-up into 11. Segments before the starting point receive nothing.
 const segments:(ClassSegment&{growth:OptionalStats})[]=[]
 if(levelUps!==null){
  let from=start
  for(const stage of earlier){
   const to=Math.min(stage.untilLevel,input.targetLevel)
   if(to>from){segments.push({label:stage.label,fromLevel:from,toLevel:to,levelUps:to-from,growth:stage.classGrowth});from=to}
  }
  if(input.targetLevel>from)segments.push({label:input.finalLabel??null,fromLevel:from,toLevel:input.targetLevel,levelUps:input.targetLevel-from,growth:input.classGrowth})
 }
 const rows=STATS.map((stat):ExpectedStatRow=>{
  const personal=input.personalGrowth[stat],modifier=input.classGrowth[stat]
  const growthFor=(classGrowth:OptionalStats)=>{
   const classValue=classGrowth[stat]
   return !finite(personal)||!finite(classValue)?null:Math.max(0,personal+classValue)
  }
  let unsupported=!finite(personal)||!finite(modifier)?'Required growth data is missing or malformed.'
   :personal<0?'Personal growth is negative; this source case is unsupported.'
   :personal===0?'Zero personal growth needs a separate class base-growth value, which is unavailable.'
   :segments.some(segment=>growthFor(segment.growth)===null)?'Growth data for an earlier class is missing or malformed.':null
  // The documented lower floor applies after addition. No upper cap is used.
  let effective=unsupported?null:Math.max(0,personal!+modifier!)
  if(effective!==null&&!Number.isFinite(effective)){unsupported='Growth calculation exceeds the supported numeric range.';effective=null}
  // Each class contributes its own level-ups × its own growth; nothing is rounded between classes.
  let expectedGains=levelUps===0?0:levelUps!==null&&effective!==null?segments.reduce((sum,segment)=>sum+segment.levelUps*growthFor(segment.growth)!/100,0):null
  if(expectedGains!==null&&!Number.isFinite(expectedGains)){unsupported='Growth calculation exceeds the supported numeric range.';expectedGains=null}
  const rawCheckpoint=input.checkpointStats?.[stat],rawActual=input.actualStats?.[stat]
  const checkpoint=finite(rawCheckpoint)&&rawCheckpoint>=0?rawCheckpoint:null
  const actual=finite(rawActual)&&rawActual>=0?rawActual:null
  const inputErrors:string[]=[]
  if(!missing(rawCheckpoint)&&checkpoint===null)inputErrors.push('Checkpoint stat must be a finite, non-negative number.')
  if(!missing(rawActual)&&actual===null)inputErrors.push('Actual stat must be a finite, non-negative number.')
  const total=explicitCheckpoint&&checkpoint!==null&&expectedGains!==null?checkpoint+expectedGains:null
  const projected=total!==null&&Number.isFinite(total)?total:null
  if(total!==null&&projected===null)inputErrors.push('Projected stat exceeds the supported numeric range.')
  const rawDifference=projected!==null&&actual!==null?actual-projected:null
  // Normalize floating-point representation noise only, without decimal rounding.
  const difference=rawDifference!==null&&Math.abs(rawDifference)<=Number.EPSILON*Math.max(1,Math.abs(actual!),Math.abs(projected!))*4?0:rawDifference
  const comparison=difference===null?null:difference>0?'Above simplified expectation':difference<0?'Below simplified expectation':'Matches simplified expectation'
  return {stat,personal:finite(personal)?personal:null,classModifier:finite(modifier)?modifier:null,effective,expectedGains,checkpoint,projected,actual,difference,comparison,unsupported,inputErrors}
 })
 return {intervalStart:validLevel(start)?start:null,levelUps,explicitCheckpoint,error:finalError,rows,
  segments:segments.map(({label,fromLevel,toLevel,levelUps})=>({label,fromLevel,toLevel,levelUps}))}
}

export interface StatObservations {
 targetLevel:number;checkpointLevel:string;checkpointStats:Record<Stat,string>;actualStats:Record<Stat,string>
 startingPoint?:'published'|'custom'
 /** Session-only earlier classes before the main class. Never saved with builds. */
 classPath?:ClassStage[]
}
export const MAX_EARLIER_CLASSES=4
/** "Class held until this level", in order; the main Class covers the rest. */
export interface ClassStage { className:string; untilLevel:number }
export function emptyObservations():StatObservations {
 const blanks=()=>Object.fromEntries(STATS.map(stat=>[stat,''])) as Record<Stat,string>
 return {targetLevel:1,checkpointLevel:'',checkpointStats:blanks(),actualStats:blanks(),startingPoint:'published'}
}
// Preserve blank and invalid text independently. Neither is converted to zero.
export function parseObservation(value:string):number|null {
 if(!value.trim())return null
 return /^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim())?Number(value):NaN
}
export function numericObservations(values:Record<Stat,string>):OptionalStats {
 return Object.fromEntries(STATS.map(stat=>[stat,parseObservation(values[stat])]))
}
const expectedFormat=new Intl.NumberFormat('en-US',{minimumFractionDigits:1,maximumFractionDigits:1,useGrouping:false})
export function formatExpected(value:number|null,signed=false):string {
 if(value===null)return '—'
 // Avoid a misleading -0.0 while comparing using the unrounded value.
 const text=expectedFormat.format(value)
 return `${signed&&value>0?'+':''}${text==='-0.0'?'0.0':text}`
}
