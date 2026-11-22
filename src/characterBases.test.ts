import {describe,expect,it} from 'vitest'
import {characterBases,getCharacterBase,projectCharacterAverage} from './characterBases'
import {emptyObservations} from './expectedStats'
import {growthData,STATS} from './growths'

const alexandra=growthData.characters.find(row=>row.name==='Alexandra')!
const gladiator=growthData.classes.find(row=>row.name==='Gladiator')!
const strength=(result:ReturnType<typeof projectCharacterAverage>)=>result.result.rows.find(row=>row.stat==='Str')!

describe('published character starting stats and automatic averages',()=>{
 it('covers all 64 profiles exactly with nine integer level-1 bases',()=>{
  expect(characterBases.map(row=>row.name)).toEqual(growthData.characters.map(row=>row.name))
  for(const base of characterBases){expect(base.level).toBe(1);expect(Object.keys(base.stats)).toEqual([...STATS]);expect(Object.values(base.stats).every(value=>Number.isInteger(value)&&value>=0)).toBe(true)}
 })
 it('calculates Alexandra at level41 automatically:7starting Strength plus18gains equals25',()=>{
  const observations={...emptyObservations(),targetLevel:41}
  expect(strength(projectCharacterAverage(alexandra,gladiator,observations))).toMatchObject({personal:35,classModifier:10,effective:45,checkpoint:7,expectedGains:18,projected:25,actual:null})
 })
 it('returns published bases at level1 and supports level99',()=>{
  expect(strength(projectCharacterAverage(alexandra,gladiator,emptyObservations())).projected).toBe(7)
  expect(strength(projectCharacterAverage(alexandra,gladiator,{...emptyObservations(),targetLevel:99})).projected).toBe(51.1)
 })
 it('does not let unused checkpoint text zero out the automatic level41 average',()=>{
  const observations=emptyObservations();observations.targetLevel=41;observations.checkpointLevel='41';observations.checkpointStats.Str='999'
  expect(strength(projectCharacterAverage(alexandra,gladiator,observations)).projected).toBe(25)
  expect(projectCharacterAverage(alexandra,gladiator,observations).result.levelUps).toBe(40)
 })
 it('supports explicit manual checkpoints without mixing missing manual rows with published bases',()=>{
  const observations=emptyObservations();observations.startingPoint='custom';observations.targetLevel=30;observations.checkpointLevel='10';observations.checkpointStats.Str='16';observations.actualStats.Str='27'
  const result=projectCharacterAverage(alexandra,gladiator,observations)
  expect(strength(result)).toMatchObject({projected:25,expectedGains:9,difference:2})
  expect(result.result.rows.find(row=>row.stat==='HP')!.projected).toBeNull()
 })
 it('leaves missing custom levels unsupported for totals and never invents unknown-character bases',()=>{
  expect(strength(projectCharacterAverage(alexandra,gladiator,{...emptyObservations(),startingPoint:'custom'})).projected).toBeNull()
  const unknown={...alexandra,name:'Unrecorded'}
  expect(getCharacterBase(unknown.name)).toBeNull();expect(strength(projectCharacterAverage(unknown,gladiator,emptyObservations())).projected).toBeNull()
 })
 it('compares actual observations against the published baseline without requiring a checkpoint',()=>{
  const observations=emptyObservations();observations.targetLevel=41;observations.actualStats.Str='27'
  expect(strength(projectCharacterAverage(alexandra,gladiator,observations))).toMatchObject({projected:25,difference:2,comparison:'Above simplified expectation'})
 })
 it('uses independent Mu growths and identical published bases without adding the growth ability twice',()=>{
  const mu=growthData.characters.find(row=>row.name==='Mu')!,variant=growthData.characters.find(row=>row.name==='Mu (with growth)')!
  expect(getCharacterBase(mu.name)!.stats).toEqual(getCharacterBase(variant.name)!.stats)
  const observations={...emptyObservations(),targetLevel:21}
  const one=strength(projectCharacterAverage(mu,gladiator,observations)),two=strength(projectCharacterAverage(variant,gladiator,observations))
  expect(two.projected!-one.projected!).toBeCloseTo(20*(variant.growths.Str-mu.growths.Str)/100)
 })
 it('preserves the Bonaventure Speed disagreement instead of dropping either value',()=>{
  expect(getCharacterBase('Bonaventure')).toMatchObject({stats:{Spd:7},conflicts:[{stat:'Spd',used:7,alternative:6}]})
 })
 it('calculates complete totals for every existing character/class and leaves sources immutable',()=>{
  const before=JSON.stringify([growthData,characterBases])
  for(const character of growthData.characters)for(const selectedClass of growthData.classes){
   const result=projectCharacterAverage(character,selectedClass,{...emptyObservations(),targetLevel:41})
   expect(result.result.error).toBeNull();expect(result.result.rows.every(row=>row.projected!==null&&Number.isFinite(row.projected))).toBe(true)
  }
  expect(JSON.stringify([growthData,characterBases])).toBe(before)
 })
})
