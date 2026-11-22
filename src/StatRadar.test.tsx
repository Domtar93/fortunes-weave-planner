import {afterEach,describe,expect,it} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from './App'
import StatRadar,{radarScale} from './StatRadar'
import StatSheet from './StatSheet'
import {emptyObservations} from './expectedStats'
import {growthData} from './growths'
import {plannerRole} from './plannerTestUtils'

// Visual pass (November 20, 2026): a unit card with totals and a nine-axis stat chart.
// The chart only redraws numbers the tiles already show; tiles stay the table view.
const alexandra=()=>growthData.characters.find(value=>value.name==='Alexandra')!
const profile=(name:string)=>growthData.classes.find(value=>value.name===name)!
const values=[35.6,20.1,15.2,25,20.1,13.7,19.6,23.5,24.5]
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear()})

describe('stat radar',()=>{
 it('rounds the outer ring up to a readable step',()=>{
  expect(radarScale(values)).toBe(40)
  expect(radarScale([null,4])).toBe(10)
  expect(radarScale([61])).toBe(80)
  expect(radarScale([null])).toBe(10)
 })
 it('summarises every value for assistive technology and reads one stat at a time from the keyboard',()=>{
  render(<StatRadar level={30} primary={{name:'Gladiator',values}} compare={{name:'Hunter',values:values.map(value=>value-1)}}/>)
  const chart=screen.getByRole('img')
  expect(chart.getAttribute('aria-label')).toContain('Stat shape at level 30 for Gladiator compared with Hunter')
  expect(chart.getAttribute('aria-label')).toContain('Health 35.6 vs 34.6')
  const readout=screen.getByTestId('radar-readout')
  expect(readout.textContent).toContain('Hover, tap or use arrow keys')
  fireEvent.focus(chart)
  expect(readout.textContent).toContain('Health')
  expect(readout.textContent).toContain('35.6')
  expect(readout.textContent).toContain('34.6')
  fireEvent.keyDown(chart,{key:'ArrowRight'})
  expect(readout.textContent).toContain('Strength')
  fireEvent.keyDown(chart,{key:'ArrowLeft'});fireEvent.keyDown(chart,{key:'ArrowLeft'})
  expect(readout.textContent).toContain('Charm')
  fireEvent.blur(chart)
  expect(readout.textContent).toContain('Hover, tap or use arrow keys')
 })
 it('shows a legend only when a second class is compared',()=>{
  const view=render(<StatRadar level={1} primary={{name:'Gladiator',values}}/>)
  expect(document.querySelector('.radar-legend')).toBeNull()
  expect(document.querySelectorAll('.radar-area')).toHaveLength(1)
  view.rerender(<StatRadar level={1} primary={{name:'Gladiator',values}} compare={{name:'Hunter',values}}/>)
  expect(document.querySelector('.radar-legend')?.textContent).toBe('GladiatorHunter')
  expect(document.querySelectorAll('.radar-area')).toHaveLength(2)
 })
 it('says so instead of drawing an empty shape',()=>{
  render(<StatRadar level={1} primary={{name:'Gladiator',values:values.map(()=>null)}}/>)
  expect(screen.getByText('No base stats to chart for this character.')).toBeTruthy()
  expect(screen.queryByTestId('radar-readout')).toBeNull()
 })
})

describe('unit card',()=>{
 it('shows the character, class, level and totals from the same projection as the tiles',()=>{
  render(<StatSheet character={alexandra()} selectedClass={profile('Gladiator')} observations={{...emptyObservations(),targetLevel:30}}/>)
  const card=document.querySelector<HTMLElement>('.unit-hero')!
  expect(within(card).getByText('Alexandra')).toBeTruthy()
  expect(within(card).getByLabelText('Level 30').textContent).toBe('Lv30')
  // Summed from unrounded averages, so it can differ from adding the nine rounded tiles.
  const tiles=[...document.querySelectorAll('[data-testid^="average-"]')].reduce((sum,tile)=>sum+Number(tile.textContent),0)
  expect(screen.getByTestId('stat-total').textContent).toBe('197.1')
  expect(Math.abs(197.1-tiles)).toBeLessThanOrEqual(0.45)
  expect(screen.getByTestId('growth-total').textContent).toBe('390%')
 })
 it('adds the compared class to the totals and the chart',()=>{
  render(<App/>)
  fireEvent.click(plannerRole('button',{name:'Jump to level 30'}))
  fireEvent.change(plannerRole('combobox',{name:'Compare with'}),{target:{value:'Hunter'}})
  const card=document.querySelector<HTMLElement>('.unit-hero')!
  expect(within(card).getByText('vs Hunter').nextElementSibling?.textContent).toBe('−2.9')
  expect(within(card).getByRole('img').getAttribute('aria-label')).toContain('compared with Hunter')
 })
})
