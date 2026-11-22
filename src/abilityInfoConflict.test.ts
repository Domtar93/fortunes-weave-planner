import {test,expect,vi} from 'vitest'
vi.mock('./data/ability-info-runtime.json',async()=>{
 const {packRuntimeData}=await import('./runtimeCodec.js')
 return {default:packRuntimeData({records:[
  {name:'Fixture α+',proficiency:'Sword',kind:'skill',description:'Grants Hit+10.',reference:{label:'Sword!B2',url:'https://example.test/one'},facts:[]},
  {name:'Fixture α+',proficiency:'Sword',kind:'skill',description:'Grants Hit+20.',reference:{label:'Sword!B3',url:'https://example.test/two'},facts:[]}
 ]})}
})
import {resolveAbilityInformation} from './abilityInfo'
test('conflicting supplied effects remain explicit variants without an arbitrary winner',()=>{
 const info=resolveAbilityInformation({name:'Fixture α+',proficiency:'Sword'})
 expect(info.hasConflict).toBe(true)
 expect(info.description).toBeNull()
 expect(info.alternatives).toEqual(['Grants Hit+10.','Grants Hit+20.'])
 expect(info.references).toHaveLength(2)
})
