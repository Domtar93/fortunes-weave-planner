import {afterEach,describe,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import StatSheet from './StatSheet'
import {classRequirement} from './ClassFinder'
import {emptyObservations} from './expectedStats'
import {growthData} from './growths'
import {openPlannerPanel,plannerRole} from './plannerTestUtils'

// Calculator refinements (November 20, 2026): level shortcuts, strongest growths,
// a "compare with" class shown on every tile, and a ranked class finder.
// None of these is saved; they only read the existing projection.
const level=()=>plannerRole('spinbutton',{name:'Level'}) as HTMLInputElement
const target=(value:number)=>fireEvent.change(level(),{target:{value:String(value)}})
const compareSelect=()=>plannerRole('combobox',{name:'Compare with'}) as HTMLSelectElement
const classSelect=()=>plannerRole('combobox',{name:'Class'}) as HTMLSelectElement
const tileCompare=(stat:string)=>screen.getByTestId(`compare-${stat}`)
const profile=(name:string)=>growthData.classes.find(value=>value.name===name)!
const alexandra=()=>growthData.characters.find(value=>value.name==='Alexandra')!
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear()})

describe('level shortcuts',()=>{
 it('jumps to a common level and marks the active shortcut',()=>{
  render(<App/>)
  const thirty=plannerRole('button',{name:'Jump to level 30'})
  expect(thirty.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(thirty)
  expect(level().value).toBe('30')
  expect(screen.getByRole('heading',{name:'Average stats at level 30'})).toBeTruthy()
  expect(screen.getByTestId('average-Str').textContent).toBe('20.1')
  expect(thirty.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(plannerRole('button',{name:'Increase level'}))
  expect(thirty.getAttribute('aria-pressed')).toBe('false')
 })
})

describe('strongest growths',()=>{
 it('highlights every stat at or above the third-highest growth, including ties',()=>{
  render(<StatSheet character={alexandra()} selectedClass={profile('Gladiator')} observations={{...emptyObservations(),targetLevel:30}}/>)
  const chips=[...document.querySelectorAll('.strength-chip')].map(chip=>chip.textContent)
  expect(chips).toEqual(['Speed 55%','Luck 50%','Charm 50%'])
  const strong=screen.getAllByRole('article').filter(tile=>tile.classList.contains('is-strength')).map(tile=>tile.getAttribute('data-stat'))
  expect(strong).toEqual(['Spd','Lck','Cha'])
 })
})

describe('compare with another class',()=>{
 it('shows per-stat differences and a summary, and clears back to the plain sheet',()=>{
  render(<App/>)
  target(30)
  expect(screen.queryByTestId('compare-Str')).toBeNull()
  expect([...compareSelect().options].some(option=>option.value==='Gladiator')).toBe(false)
  fireEvent.change(compareSelect(),{target:{value:'Hunter'}})
  expect(within(tileCompare('Str')).getByText('+2.9')).toBeTruthy()
  expect(within(tileCompare('Str')).getByText('+10% growth')).toBeTruthy()
  expect(within(tileCompare('Spd')).getByText('−2.9')).toBeTruthy()
  expect(within(tileCompare('HP')).getByText('Same')).toBeTruthy()
  const summary=screen.getByTestId('compare-summary').textContent
  expect(summary).toContain('Gladiator vs Hunter at level 30')
  expect(summary).toContain('−2.9 total stats')
  expect(summary).toContain('higher in 1, lower in 2, same in 6')
  fireEvent.click(within(screen.getByTestId('compare-summary')).getByRole('button',{name:'Clear'}))
  expect(screen.queryByTestId('compare-summary')).toBeNull()
  expect(screen.queryByTestId('compare-Str')).toBeNull()
  expect(compareSelect().value).toBe('')
 })
 it('explains that both classes start equal at level 1',()=>{
  render(<App/>)
  fireEvent.change(compareSelect(),{target:{value:'Hunter'}})
  expect(screen.getByTestId('compare-summary').textContent).toContain('same starting stats')
 })
 it('hides the comparison when the main class becomes the compared class',()=>{
  render(<App/>)
  fireEvent.change(compareSelect(),{target:{value:'Hunter'}})
  fireEvent.change(classSelect(),{target:{value:'Hunter'}})
  expect(screen.queryByTestId('compare-summary')).toBeNull()
  expect(compareSelect().value).toBe('')
 })
 it('is never written to storage',()=>{
  render(<App/>)
  fireEvent.change(compareSelect(),{target:{value:'Hunter'}})
  for(let index=0;index<localStorage.length;index++)expect(localStorage.getItem(localStorage.key(index)!)).not.toContain('Hunter')
 })
})

describe('class finder',()=>{
 it('ranks classes by the character’s best growth, with shared ranks for ties',async()=>{
  const user=userEvent.setup()
  render(<App/>)
  target(30)
  await openPlannerPanel(user,'Find the best class')
  const stat=plannerRole('combobox',{name:'Rank classes by'}) as HTMLSelectElement
  expect(stat.value).toBe('Spd')
  expect(screen.getByTestId('finder-current-rank').textContent).toBe('Gladiator ranks #42 of 59 for Speed (tied with 9 others).')
  const list=screen.getByRole('list',{name:'Classes ranked by Speed growth'})
  const rows=within(list).getAllByRole('listitem')
  expect(rows).toHaveLength(8)
  expect(rows[0].textContent).toContain('Dancer')
  expect(rows[0].textContent).toContain('80%')
  expect(rows[0].textContent).toContain('32.2')
  expect([...list.querySelectorAll('.finder-rank')].map(rank=>rank.textContent).slice(0,6)).toEqual(['1','1','1','1','5','5'])
  fireEvent.click(screen.getByRole('button',{name:'Show all 59 classes'}))
  expect(within(list).getAllByRole('listitem')).toHaveLength(59)
  fireEvent.change(stat,{target:{value:'all'}})
  expect(screen.getByRole('list',{name:'Classes ranked by all stats growth'})).toBeTruthy()
 })
 it('applies or compares a class from the ranking',async()=>{
  const user=userEvent.setup()
  render(<App/>)
  await openPlannerPanel(user,'Find the best class')
  fireEvent.click(screen.getByRole('button',{name:'Compare with Dancer'}))
  expect(compareSelect().value).toBe('Dancer')
  fireEvent.click(screen.getByRole('button',{name:'Use Shadow Seeker'}))
  expect(classSelect().value).toBe('Shadow Seeker')
  expect(screen.queryByRole('button',{name:'Use Shadow Seeker'})).toBeNull()
  expect(screen.getByTestId('finder-current-rank').textContent).toContain('Shadow Seeker ranks #1 of 59 for Speed')
 })
 it('shows requirements copied from the research sheet',()=>{
  expect(classRequirement(profile('Dancer'))).toContain('Lv. 35')
  expect(classRequirement(profile('Dancer'))).toContain('one unit at a time')
  expect(classRequirement(profile('Myrmidon'))).toBe('Lv. 20')
 })
})
