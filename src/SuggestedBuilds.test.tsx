import {afterEach,describe,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from './App'
import {BUILD_STYLES,isLimitedClass,suggestBuilds} from './buildSuggestions'
import {emptyObservations} from './expectedStats'
import {growthData} from './growths'
import {plannerRole} from './plannerTestUtils'

// Suggested builds (November 20, 2026): computed from growth rates only. Each style
// names three stats; classes are ranked by their combined growth for the character.
const character=(name:string)=>growthData.characters.find(value=>value.name===name)!
const at=(level:number)=>({...emptyObservations(),targetLevel:level})
const card=(id:string)=>screen.getByTestId(`build-${id}`)
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear()})

describe('build suggestions model',()=>{
 it('ranks classes by the combined growth of each style’s three stats',()=>{
  const result=suggestBuilds(character('Alexandra'),at(30))
  expect(result.map(item=>item.style.id)).toEqual(BUILD_STYLES.map(style=>style.id))
  const byId=Object.fromEntries(result.map(item=>[item.style.id,item]))
  expect(byId.physical.picks.map(pick=>`${pick.profile.name} ${pick.focus}`)).toEqual(['Shadow Seeker 180','Swordmaster 180','Bow Adept 175'])
  expect(byId.magic.picks[0].profile.name).toBe('Druid')
  expect(byId.magic.picks[0].focus).toBe(190)
  expect(byId.defender.picks[0].profile.name).toBe('Castle Knight')
  expect(byId.leader.picks[0].profile.name).toBe('Celestial Trooper')
  expect(byId.leader.tied).toBe(1)
  // Each pick's focus is exactly the sum of its three listed growth rates.
  for(const item of result)for(const pick of item.picks)expect(pick.focus).toBe(pick.stats.reduce((sum,stat)=>sum+stat.growth,0))
 })
 it('marks every style tied for the character’s highest own growth as the best match',()=>{
  const result=suggestBuilds(character('Alexandra'),at(1))
  expect(result.map(item=>[item.style.id,item.personal,item.bestMatch])).toEqual([
   ['physical',135,true],['magic',135,true],['defender',100,false],['leader',130,false]])
 })
 it('hides one-unit special classes unless asked',()=>{
  const hidden=suggestBuilds(character('Alexandra'),at(30))
  expect(hidden.flatMap(item=>item.picks).some(pick=>isLimitedClass(pick.profile))).toBe(false)
  const shown=suggestBuilds(character('Alexandra'),at(30),{includeLimited:true})
  expect(shown.flatMap(item=>item.picks).some(pick=>isLimitedClass(pick.profile))).toBe(true)
 })
 it('produces a pick for every style for all 64 profiles',()=>{
  for(const profile of growthData.characters)for(const item of suggestBuilds(profile,at(20)))expect(item.picks.length).toBeGreaterThan(0)
 })
})

describe('suggested builds section',()=>{
 it('shows four styles with the top class, stat bars and averages at the chosen level',()=>{
  render(<App/>)
  fireEvent.click(plannerRole('button',{name:'Jump to level 30'}))
  const section=screen.getByRole('region',{name:'Suggested builds'})
  expect(within(section).getAllByRole('group')).toHaveLength(4)
  expect(within(section).queryAllByRole('article')).toHaveLength(0)
  const physical=card('physical')
  expect(physical.textContent).toContain('Shadow Seeker')
  expect(physical.textContent).toContain('180%')
  expect(within(physical).getByText('Best match')).toBeTruthy()
  const speed=within(physical).getByText('Speed').closest('li')!
  expect(speed.textContent).toContain('80%')
  expect(speed.textContent).toContain('32.2')
  expect(within(card('defender')).queryByText('Best match')).toBeNull()
 })
 it('applies a suggested class or loads it into the comparison',()=>{
  render(<App/>)
  fireEvent.click(screen.getByRole('button',{name:'Compare Druid with Gladiator'}))
  expect((plannerRole('combobox',{name:'Compare with'}) as HTMLSelectElement).value).toBe('Druid')
  fireEvent.click(screen.getByRole('button',{name:'Use Druid for Magic attacker'}))
  expect((plannerRole('combobox',{name:'Class'}) as HTMLSelectElement).value).toBe('Druid')
  expect(within(card('magic')).getByText('Alexandra is already using this class.')).toBeTruthy()
 })
 it('can include one-unit special classes',()=>{
  render(<App/>)
  const toggle=screen.getByRole('checkbox',{name:'Include one-unit special classes'})
  expect(screen.getByRole('region',{name:'Suggested builds'}).textContent).toContain('Classes limited to one unit are hidden.')
  fireEvent.click(toggle)
  expect(screen.getByRole('region',{name:'Suggested builds'}).textContent).not.toContain('Classes limited to one unit are hidden.')
 })
})
