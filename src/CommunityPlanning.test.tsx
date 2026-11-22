import { openPlannerPanel, changeMain, plannerRole , withinPlanner } from './plannerTestUtils'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import CommunityReferenceBrowser from './CommunityReferenceBrowser'
import CommunityCharacterDetails from './CommunityCharacterDetails'
import {communityData,communityEntries} from './community'
import {LOADOUT_KEY} from './loadouts'

afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})
describe('expanded evidence UI',()=>{
 it('displays complete personal descriptions, multiline names, source links and unavailable markers',async()=>{
  const user=userEvent.setup(),view=render(<CommunityCharacterDetails characterName="Alexandra"/> )
  await user.click(screen.getByText('Additional character details · community reference'))
  expect(await screen.findByText('Grants Hit/Avo+5 to unit for each adjacent ally.')).toBeDefined()
  expect(screen.getByRole('link',{name:'Characters!AI60'}).getAttribute('href')).toContain('#gid=942420165&range=AI60')
  view.rerender(<CommunityCharacterDetails characterName="Anatolia"/> )
  expect(screen.getByText('Celestial Flow Meridian Rotation',{exact:false}).textContent).toContain('\n')
  view.rerender(<CommunityCharacterDetails characterName="Aswan"/> )
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
 })
 it('plans an expanded rank, exports and saves it, and navigates bidirectionally using its own source',async()=>{
  const user=userEvent.setup();render(<App/> )
  await openPlannerPanel(user, 'Proficiency Progression')
  await user.selectOptions(screen.getByLabelText('Learnset source'),'community')
  const categories=plannerRole('group', { name: 'Proficiency categories' })
  await user.click(withinPlanner(categories).getByRole('button',{name:'Black Magic'}))
  const entry=communityEntries('Reason','Alexandra').find(e=>e.rank==='S+')!
  await user.click(plannerRole('button', { name: `Add to shortlist: ${entry.text} · Reason S+` }))
  await openPlannerPanel(user, 'Ability Planning Shortlist')
  const shortlist=plannerRole('region', { name: 'Ability planning shortlist' })
  expect(shortlist.textContent).toContain('Black Magic Mastery')
  await user.click(withinPlanner(shortlist).getByRole('button',{name:/View in Proficiency Progression/}))
  await waitFor(()=>expect((screen.getByLabelText('Learnset source') as HTMLSelectElement).value).toBe('community'))
  expect(screen.getByText(/Navigation target: Black Magic Mastery/)).toBeDefined()
  await user.click(plannerRole('button', { name: 'Return to Shortlist' }))
  await openPlannerPanel(user, 'Full Build Loadouts')
  fireEvent.change(screen.getByLabelText('Loadout name'),{target:{value:'Expanded rank plan'}})
  await user.click(plannerRole('button', { name: 'Save main loadout' }))
  const saved=JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts[0]
  expect(saved.abilities[0].source).toBe(entry.source)
  expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
 })
 it('opens all 27 catalogs locally and searches base/refinement data without changing a build',async()=>{
  const user=userEvent.setup(),writes=vi.spyOn(Storage.prototype,'setItem');render(<CommunityReferenceBrowser/> )
  await openPlannerPanel(user, 'Expanded Community Reference')
  expect(screen.getByLabelText('Reference worksheet').querySelectorAll('option')).toHaveLength(27)
  await screen.findByText('Wooden Sword · Base')
  fireEvent.change(screen.getByLabelText('Search reference rows and notes'),{target:{value:'Wooden Sword'}})
  expect(screen.getByText('Wooden Sword · 1')).toBeDefined()
  await user.click(screen.getByText('Wooden Sword · 1'))
  expect(screen.getByText('Smithing Stone x1, 100 G')).toBeDefined()
  await user.selectOptions(screen.getByLabelText('Reference worksheet'),'Thermae')
  expect(await screen.findByText('Giants\' Bath (Special) · row 2')).toBeDefined()
  expect(screen.getByText(/another bath overwrites/)).toBeDefined()
  await user.selectOptions(screen.getByLabelText('Reference worksheet'),'Characters')
  fireEvent.change(screen.getByLabelText('Search reference rows and notes'),{target:{value:'Average Stats'}})
  const average=await screen.findByText('Average Stats · row 42');await user.click(average)
  expect(screen.getAllByText(/Source error · REF/).length).toBe(20)
  expect(writes).not.toHaveBeenCalled()
 })
 it('shows original and additional learnsets separately and keeps filters, class and Mu profiles independent',async()=>{
  const user=userEvent.setup();render(<App/> )
  await openPlannerPanel(user, 'Proficiency Progression')
  changeMain('Character', 'Benditz')
  expect(screen.queryByRole('button',{name:'Add to shortlist: Flash Blow · Sword B'})).toBeNull()
  await user.selectOptions(screen.getByLabelText('Learnset source'),'community')
  expect(plannerRole('button', { name: 'Add to shortlist: Flash Blow · Sword B' })).toBeDefined()
  changeMain('Class', 'The Avatar')
  expect((screen.getByLabelText('Learnset source') as HTMLSelectElement).value).toBe('community')
  expect(communityData.characters['Mu (with growth)']).toBeDefined()
 })
})
