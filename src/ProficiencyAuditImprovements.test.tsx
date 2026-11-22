import { openPlannerPanel, changeMain, plannerRole , withinPlanner } from './plannerTestUtils'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import {compareRankSources} from './ProficiencySourceComparison'
import {combatArtReferences,communityData} from './community'
import {growthData} from './growths'
import {proficiencyData} from './proficiencies'

afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})
describe('auditor proficiency suggestions',()=>{
 it('distinguishes blank, absent, matching, changed and ambiguous same-rank records',()=>{
  expect(compareRankSources('Benditz','Sword','B').relation).toBe('Different recorded entries')
  expect(compareRankSources('Alexandra','Reason','S+').relation).toBe('Rank absent from corrected workbook')
  expect(compareRankSources('Alexandra','Sword','D').relation).toBe('Same recorded entry')
  expect(compareRankSources('Mu','Sword','D').original[0].source).toBe(compareRankSources('Mu (with growth)','Sword','D').original[0].source)
  const original=proficiencyData.categories.Sword.characters.Alexandra
  try{proficiencyData.categories.Sword.characters.Alexandra=[...original,{...original[0],source:"'Sword'!Z99"}];expect(compareRankSources('Alexandra','Sword','D').relation).toBe('Ambiguous source records')}
  finally{proficiencyData.categories.Sword.characters.Alexandra=original}
 })
 it('links only exact name/category records, preserving mirror provenance and all duplicate matches',()=>{
  const refs=combatArtReferences('Sword','Haze Slice');expect(refs[0].row).toBe(26)
  expect(refs[0].origin.source).toBe('Sword!A94');expect(refs[0].reference.formula).toBe('=Sword!A94')
  expect(combatArtReferences('Axe','Haze Slice')).toEqual([]);expect(combatArtReferences('Sword','Haze')).toEqual([])
  communityData.combatArts.push({...refs[0],row:999})
  try{expect(combatArtReferences('Sword','Haze Slice')).toHaveLength(2)}finally{communityData.combatArts.pop()}
 })
 it('shows original/additional values and source links without changing source choice, growths or storage',async()=>{
  const user=userEvent.setup(),writes=vi.spyOn(Storage.prototype,'setItem');render(<App/> )
  await openPlannerPanel(user, 'Proficiency Progression')
  changeMain('Character', 'Benditz')
  await user.selectOptions(screen.getByLabelText('Learnset source'),'community')
  await user.click(plannerRole('button', { name: 'Flash Blow' }))
  const pair=plannerRole('region', { name: 'Source comparison for Benditz Sword B' })
  expect(withinPlanner(pair).getByText('Different recorded entries')).toBeDefined()
  expect(withinPlanner(pair).getByText('Unknown / blank')).toBeDefined();expect(withinPlanner(pair).getByText('Flash Blow')).toBeDefined()
  expect(withinPlanner(pair).getAllByRole('link')).toHaveLength(2)
  expect((screen.getByLabelText('Learnset source') as HTMLSelectElement).value).toBe('community')
  expect(writes).not.toHaveBeenCalled();expect(growthData.characters.find(c=>c.name==='Sofia')!.growths.Mag).toBe(45)
 })
 it('allows inspecting unknown ranks without making them shortlistable',async()=>{
  const user=userEvent.setup();render(<App/> );await openPlannerPanel(user, 'Proficiency Progression')
  await user.selectOptions(screen.getByLabelText('Compare rank sources'),'S')
  expect(plannerRole('region', { name: 'Source comparison for Alexandra Sword S' })).toBeDefined()
  expect(screen.queryByRole('button',{name:/Add to shortlist: .* · Sword S$/})).toBeNull()
 })
 it('opens, expands and focuses the exact combat-art row outside retained reference filters, including repeated navigation',async()=>{
  const user=userEvent.setup();render(<App/> )
  await openPlannerPanel(user, 'Expanded Community Reference')
  await screen.findByText('Wooden Sword · Base')
  fireEvent.change(screen.getByLabelText('Search reference rows and notes'),{target:{value:'unrelated forging query'}})
  await openPlannerPanel(user, 'Proficiency Progression');await user.click(plannerRole('button', { name: 'Haze Slice' }))
  await openPlannerPanel(user, 'Sources & details')
  await user.click(plannerRole('button', { name: 'View Haze Slice in reference · row 26' }))
  const summary=await screen.findByText('Haze Slice · row 26'),row=summary.closest('details')!
  await waitFor(()=>expect(document.activeElement).toBe(row))
  expect(row.open).toBe(true);expect((screen.getByLabelText('Search reference rows and notes') as HTMLInputElement).value).toBe('unrelated forging query')
  expect(row.textContent).toContain('Grants Avo+10 during combat')
  await user.click(plannerRole('button', { name: 'Return to reference results' }));expect(screen.queryByText('Haze Slice · row 26')).toBeNull();await openPlannerPanel(user, 'Proficiency Progression')
  await user.click(plannerRole('button', { name: 'View Haze Slice in reference · row 26' }));expect(await screen.findByText('Haze Slice · row 26')).toBeDefined()
 })
})
