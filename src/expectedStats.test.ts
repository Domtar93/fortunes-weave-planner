import {describe,it,expect} from 'vitest'
import {growthData,STATS} from './growths'
import {emptyObservations,formatExpected,numericObservations,parseObservation,projectExpectedStats,TARGET_LEVELS,type ExpectedStatsInput} from './expectedStats'

const alexandra=growthData.characters.find(row=>row.name==='Alexandra')!
const gladiator=growthData.classes.find(row=>row.name==='Gladiator')!
const input=(extra:Partial<ExpectedStatsInput>={}):ExpectedStatsInput=>({targetLevel:30,checkpointLevel:10,personalGrowth:alexandra.growths,classGrowth:gladiator.growths,...extra})
const strength=(extra:Partial<ExpectedStatsInput>={})=>projectExpectedStats(input(extra)).rows.find(row=>row.stat==='Str')!

describe('independent constant-class expectation model',()=>{
 it('provides every integer target level from1 through99 exactly once',()=>{
  expect(TARGET_LEVELS).toEqual(Array.from({length:99},(_,index)=>index+1))
 })
 it.each([1,99])('supports target level%s',(level)=>{
  const result=projectExpectedStats(input({targetLevel:level,checkpointLevel:1}))
  expect(result.error).toBeNull();expect(result.levelUps).toBe(level-1)
 })
 it.each([0,100,-1,1.5,NaN,Infinity])('rejects invalid target level%s',targetLevel=>{
  const result=projectExpectedStats(input({targetLevel}))
  expect(result.error).toContain('Target level');expect(result.levelUps).toBeNull()
  expect(result.rows.every(row=>row.expectedGains===null&&row.projected===null)).toBe(true)
 })
 it.each([0,100,-1,1.5,NaN])('rejects invalid checkpoint level%s',checkpointLevel=>{
  const result=projectExpectedStats(input({checkpointLevel}))
  expect(result.error).toContain('checkpoint level');expect(result.rows.every(row=>row.expectedGains===null)).toBe(true)
 })
 it('counts one transition, with no off-by-one inclusive counting',()=>{
  const result=projectExpectedStats(input({checkpointLevel:29}))
  expect(result.levelUps).toBe(1);expect(result.rows.find(row=>row.stat==='Str')!.expectedGains).toBe(.45)
 })
 it('uses35personal plus10class and produces9gains,25projected from16',()=>{
  const row=strength({checkpointStats:{Str:16}})
  expect(row.personal).toBe(35);expect(row.classModifier).toBe(10);expect(row.effective).toBe(45)
  expect(row.expectedGains).toBe(9);expect(row.projected).toBe(25)
  expect(formatExpected(row.expectedGains)).toBe('9.0');expect(formatExpected(row.projected)).toBe('25.0')
 })
 it('returns zero gains and unchanged supplied values at the checkpoint',()=>{
  const result=projectExpectedStats(input({targetLevel:10,checkpointStats:{Str:16},actualStats:{Str:16}}))
  expect(result.levelUps).toBe(0);expect(result.rows.every(row=>row.expectedGains===0)).toBe(true)
  expect(result.rows.find(row=>row.stat==='Str')).toMatchObject({projected:16,difference:0,comparison:'Matches simplified expectation'})
 })
 it('does not extrapolate backward or fabricate projected stats',()=>{
  const result=projectExpectedStats(input({targetLevel:9,checkpointStats:{Str:16}}))
  expect(result.error).toContain('backward projection');expect(result.levelUps).toBeNull()
  expect(result.rows.every(row=>row.projected===null&&row.expectedGains===null)).toBe(true)
 })
 it.each([[27,2,'Above simplified expectation'],[23,-2,'Below simplified expectation'],[25,0,'Matches simplified expectation']] as const)('compares actual%s with a transparent signed difference',(actual,difference,comparison)=>{
  const row=strength({checkpointStats:{Str:16},actualStats:{Str:actual}})
  expect(row.difference).toBe(difference);expect(row.comparison).toBe(comparison)
  expect(formatExpected(row.difference,true)).toBe(difference>0?'+2.0':difference<0?'-2.0':'0.0')
 })
 it('keeps missing checkpoint values blank rather than assuming zero',()=>{
  const row=strength({checkpointStats:{},actualStats:{Str:25}})
  expect(row.expectedGains).toBe(9);expect(row.checkpoint).toBeNull();expect(row.projected).toBeNull();expect(row.difference).toBeNull()
 })
 it('keeps missing observed values blank and a valid projected value available',()=>{
  const row=strength({checkpointStats:{Str:16},actualStats:{}})
  expect(row.projected).toBe(25);expect(row.actual).toBeNull();expect(row.difference).toBeNull();expect(row.comparison).toBeNull()
 })
 it.each(['personalGrowth','classGrowth'] as const)('does not replace missing%s values with zero',field=>{
  const row=strength({[field]:{...input()[field],Str:undefined}})
  expect(row.unsupported).toContain('missing or malformed');expect(row.effective).toBeNull();expect(row.expectedGains).toBeNull()
 })
 it('rejects malformed required growth even if its text resembles a number',()=>{
  const row=strength({personalGrowth:{Str:'35' as unknown as number}})
  expect(row.effective).toBeNull();expect(row.unsupported).toContain('missing or malformed')
 })
 it('preserves above100growth without clamping or applying a stat cap',()=>{
  const row=strength({personalGrowth:{Str:110},classGrowth:{Str:15},checkpointStats:{Str:1000}})
  expect(row.effective).toBe(125);expect(row.expectedGains).toBe(25);expect(row.projected).toBe(1025)
 })
 it('retains fractional gains across the whole interval without per-level rounding',()=>{
  const row=strength({checkpointLevel:1,targetLevel:4,personalGrowth:{Str:17},classGrowth:{Str:0},checkpointStats:{Str:8}})
  expect(row.expectedGains).toBe(.51);expect(row.projected).toBe(8.51);expect(formatExpected(row.expectedGains)).toBe('0.5')
 })
 it('normalizes only floating-point equality noise, not genuine fractional differences',()=>{
  const same=strength({checkpointLevel:1,targetLevel:2,personalGrowth:{Str:20},classGrowth:{Str:0},checkpointStats:{Str:.1},actualStats:{Str:.3}})
  expect(same.difference).toBe(0);expect(same.comparison).toBe('Matches simplified expectation')
  const different=strength({checkpointLevel:1,targetLevel:2,checkpointStats:{Str:16},actualStats:{Str:16.46}})
  expect(different.difference).toBeCloseTo(.01,12);expect(different.comparison).toBe('Above simplified expectation')
 })
 it('marks zero-personal substitution unsupported rather than borrowing flat stats or treating it as zero',()=>{
  const row=strength({personalGrowth:{Str:0},classGrowth:{Str:10},checkpointStats:{Str:16},actualStats:{Str:25}})
  expect(row.unsupported).toContain('class base-growth');expect(row.effective).toBeNull();expect(row.expectedGains).toBeNull();expect(row.projected).toBeNull()
 })
 it('retains checkpoint identity with no transitions even when the zero-growth rule is unsupported',()=>{
  const row=strength({targetLevel:10,personalGrowth:{Str:0},checkpointStats:{Str:16},actualStats:{Str:16}})
  expect(row.unsupported).toBeTruthy();expect(row.expectedGains).toBe(0);expect(row.projected).toBe(16);expect(row.difference).toBe(0)
 })
 it('applies only the documented0lower floor, retaining the original negative class modifier',()=>{
  const row=strength({personalGrowth:{Str:5},classGrowth:{Str:-10}})
  expect(row.classModifier).toBe(-10);expect(row.effective).toBe(0);expect(row.expectedGains).toBe(0)
 })
 it('uses level1 only as the default growth interval and requires an explicit checkpoint for absolute stats',()=>{
  const result=projectExpectedStats(input({checkpointLevel:null,checkpointStats:{Str:16}}))
  expect(result.intervalStart).toBe(1);expect(result.explicitCheckpoint).toBe(false)
  expect(result.rows.find(row=>row.stat==='Str')!.expectedGains).toBe(13.05)
  expect(result.rows.every(row=>row.projected===null)).toBe(true)
 })
 it('preserves valid numericalzero stat entries without treating them as absent',()=>{
  const row=strength({checkpointStats:{Str:0},actualStats:{Str:0}})
  expect(row.projected).toBe(9);expect(row.actual).toBe(0);expect(row.difference).toBe(-9)
 })
 it.each([-1,NaN,Infinity])('rejects invalid checkpoint and observed stat%s values',invalid=>{
  const row=strength({checkpointStats:{Str:invalid},actualStats:{Str:invalid}})
  expect(row.checkpoint).toBeNull();expect(row.actual).toBeNull();expect(row.difference).toBeNull();expect(row.inputErrors).toHaveLength(2)
 })
 it('supports partial rows independently and refuses numeric overflow',()=>{
  const result=projectExpectedStats(input({personalGrowth:{...alexandra.growths,Mag:null},checkpointStats:{Str:16},actualStats:{Str:27}}))
  expect(result.rows.find(row=>row.stat==='Str')!.difference).toBe(2)
  expect(result.rows.find(row=>row.stat==='Mag')!.expectedGains).toBeNull()
  expect(strength({personalGrowth:{Str:Number.MAX_VALUE}}).expectedGains).toBeNull()
 })
 it('keeps observations independent and parses blanks, zeroes and malformed input distinctly',()=>{
  const one=emptyObservations(),two=emptyObservations();one.checkpointStats.Str='16'
  expect(two.checkpointStats.Str).toBe('');expect(one.targetLevel).toBe(1)
  expect(parseObservation('')).toBeNull();expect(parseObservation('  ')).toBeNull();expect(parseObservation('0')).toBe(0)
  expect(parseObservation('1.25')).toBe(1.25);expect(parseObservation('bad')).toBeNaN();expect(parseObservation('-1')).toBeNaN()
  expect(numericObservations(two.actualStats)).toEqual(Object.fromEntries(STATS.map(stat=>[stat,null])))
 })
 it('does not mutate source profiles, class flats, or user-supplied observation maps',()=>{
  const checkpoints={Str:16},observed={Str:27},before=JSON.stringify([growthData,checkpoints,observed])
  const result=projectExpectedStats(input({checkpointStats:checkpoints,actualStats:observed}))
  expect(result.rows).toHaveLength(9);expect(JSON.stringify([growthData,checkpoints,observed])).toBe(before)
 })
 it('accepts all64existing profiles and59classes through the same nine-stat mapping',()=>{
  expect(growthData.characters).toHaveLength(64);expect(growthData.classes).toHaveLength(59)
  for(const character of growthData.characters)for(const selectedClass of growthData.classes){
   const result=projectExpectedStats({targetLevel:99,checkpointLevel:1,personalGrowth:character.growths,classGrowth:selectedClass.growths})
   expect(result.error).toBeNull();expect(result.rows.map(row=>row.stat)).toEqual([...STATS])
   expect(result.rows.every(row=>row.projected===null&&row.actual===null&&row.expectedGains!==null)).toBe(true)
  }
 })
})
