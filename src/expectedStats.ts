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
}
export type ComparisonLabel = 'Above simplified expectation'|'Below simplified expectation'|'Matches simplified expectation'
export interface ExpectedStatRow {
 stat:Stat; personal:number|null; classModifier:number|null; effective:number|null
 expectedGains:number|null; checkpoint:number|null; projected:number|null; actual:number|null; difference:number|null
 comparison:ComparisonLabel|null; unsupported:string|null; inputErrors:string[]
}
export interface ExpectedStatsResult {
 intervalStart:number|null; levelUps:number|null; explicitCheckpoint:boolean; error:string|null; rows:ExpectedStatRow[]
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
 const levelUps=error?null:input.targetLevel-start
 const rows=STATS.map((stat):ExpectedStatRow=>{
  const personal=input.personalGrowth[stat],modifier=input.classGrowth[stat]
  let unsupported=!finite(personal)||!finite(modifier)?'Required growth data is missing or malformed.'
   :personal<0?'Personal growth is negative; this source case is unsupported.'
   :personal===0?'Zero personal growth needs a separate class base-growth value, which is unavailable.':null
  // The documented lower floor applies after addition. No upper cap is used.
  let effective=unsupported?null:Math.max(0,personal!+modifier!)
  if(effective!==null&&!Number.isFinite(effective)){unsupported='Growth calculation exceeds the supported numeric range.';effective=null}
  let expectedGains=levelUps===0?0:levelUps!==null&&effective!==null?levelUps*effective/100:null
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
 return {intervalStart:validLevel(start)?start:null,levelUps,explicitCheckpoint,error,rows}
}

export interface StatObservations {
 targetLevel:number;checkpointLevel:string;checkpointStats:Record<Stat,string>;actualStats:Record<Stat,string>
 startingPoint?:'published'|'custom'
}
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
