import {useReducer} from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ProficiencyProgression from './ProficiencyProgression'
import AbilityPlanningShortlist from './AbilityPlanningShortlist'
import FullBuildLoadouts from './FullBuildLoadouts'
import {growthData,PROFICIENCIES} from './growths'
import {proficiencyData} from './proficiencies'
import {shortlistReducer,resolvePlanningEntry} from './shortlist'
import {LOADOUT_KEY,type FullBuildSelection} from './loadouts'
import {createPreset,PRESET_KEY} from './presets'
import {mountData} from './mounts'
import {mountId} from './mountPlanning'

const character=growthData.characters.find(row=>row.name==='Alexandra')!
const selectedClass=growthData.classes.find(row=>row.name==='Gladiator')!
const selection:FullBuildSelection={characterName:character.name,className:selectedClass.name,weaponId:null,mountId:null,battalionId:null,abilities:[]}
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})
function BrowserHarness(){
 const [state,dispatch]=useReducer(shortlistReducer,{byCharacter:{}})
 return <ProficiencyProgression initialOpen character={character} selectedClass={selectedClass} shortlist={state.byCharacter.Alexandra??[]} planningFeedback={state.feedback} onPlanningAction={dispatch}/>
}
describe('shorter reader-to-plan navigation',()=>{
 it('adds and removes the exact inspected source record without changing the effect',async()=>{
  const user=userEvent.setup();render(<BrowserHarness/> )
  await user.click(screen.getByRole('button',{name:'Swordfaire'}))
  const info=screen.getByRole('complementary',{name:'Ability information'})
  const effect=within(info).getByText(/When unit is equipped with a sword/,{selector:'.ability-effect'}).textContent
  await user.click(within(info).getByRole('button',{name:'Add selected ability to shortlist: Swordfaire · Sword S+'}))
  expect(within(info).getByText('1 / 8 planned')).toBeDefined()
  expect(screen.getByRole('status').textContent).toContain('Added Swordfaire · Sword S+')
  expect(screen.queryByRole('button',{name:'Add to shortlist: Swordfaire · Sword S+'})).toBeNull()
  await user.click(within(info).getByRole('button',{name:'Remove selected ability from shortlist: Swordfaire · Sword S+'}))
  expect(within(info).getByText('0 / 8 planned')).toBeDefined()
  expect(within(info).getByText(/When unit is equipped with a sword/,{selector:'.ability-effect'}).textContent).toBe(effect)
 })
 it('explains the full plan and prevents a ninth inspector addition',async()=>{
  const shortlist=PROFICIENCIES.flatMap(proficiency=>proficiencyData.categories[proficiency].characters.Alexandra.map(entry=>resolvePlanningEntry('Alexandra',proficiency,entry.rank,entry.source))).filter((entry):entry is NonNullable<typeof entry>=>entry!==null && entry.entry.text!=='Swordfaire').slice(0,8)
  expect(shortlist.length).toBe(8)
  const user=userEvent.setup(),dispatch=vi.fn();render(<ProficiencyProgression initialOpen character={character} selectedClass={selectedClass} shortlist={shortlist} onPlanningAction={dispatch}/> )
  await user.click(screen.getByRole('button',{name:'Swordfaire'}))
  const info=screen.getByRole('complementary',{name:'Ability information'})
  const add=within(info).getByRole('button',{name:/Add selected ability/}) as HTMLButtonElement
  expect(add.disabled).toBe(true)
  expect(within(info).getByText(/Plan full; remove an ability first/)).toBeDefined()
  await user.click(add);expect(dispatch).not.toHaveBeenCalled()
 })
 it('does not offer an inspector planning action for compound unlocks',async()=>{
  const user=userEvent.setup();render(<ProficiencyProgression initialOpen character={growthData.characters.find(row=>row.name==='Olympia')!} selectedClass={selectedClass} onPlanningAction={vi.fn()}/> )
  await user.click(screen.getByRole('button',{name:'White Magic'}))
  const info=screen.getByRole('complementary',{name:'Ability information'})
  expect(within(info).getAllByRole('heading').length).toBeGreaterThan(1)
  expect(within(info).queryByRole('button',{name:/selected ability.*shortlist/})).toBeNull()
 })
 it('opens the existing collapsed plan and returns to the filtered selected browser without storage writes',async()=>{
  const user=userEvent.setup(),writes=vi.spyOn(Storage.prototype,'setItem');render(<App/> )
  await user.click(within(screen.getByRole('navigation',{name:'Planner sections'})).getByRole('button',{name:/^Abilities/}))
  fireEvent.change(screen.getByLabelText('Search ability names'),{target:{value:'Swordfaire'}})
  await user.click(screen.getByRole('button',{name:'Swordfaire'}))
  const info=screen.getByRole('complementary',{name:'Ability information'})
  await user.click(within(info).getByRole('button',{name:/Add selected ability/}))
  await user.click(screen.getByText('Ability Planning Shortlist',{exact:true}))
  expect(screen.getByText('Ability Planning Shortlist',{exact:true}).closest('details')!.open).toBe(false)
  await user.click(screen.getByRole('button',{name:'View ability plan'}))
  const plan=screen.getByRole('region',{name:'Ability planning shortlist'})
  expect(plan.closest('details')!.open).toBe(true)
  expect(document.activeElement).toBe(within(plan).getByRole('heading',{name:'Alexandra · Ability plans'}))
  expect(within(plan).getByRole('listitem',{name:/Planning slot 1: Swordfaire/})).toBeDefined()
  await user.click(within(plan).getByRole('button',{name:'Back to rank browser'}))
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Sword — Alexandra'}))
  expect((screen.getByLabelText('Search ability names') as HTMLInputElement).value).toBe('Swordfaire')
  expect(within(info).getByRole('heading',{name:'Swordfaire'})).toBeDefined()
  expect(writes).not.toHaveBeenCalled()
 })
 it('ignores plan-open requests belonging to another character',()=>{
  render(<AbilityPlanningShortlist characterName='Alexandra' entries={[]} onAction={vi.fn()} panelRequest={{characterName:'Mu',sequence:1}}/> )
  expect(screen.getByText('Ability Planning Shortlist',{exact:true}).closest('details')!.open).toBe(false)
  expect(screen.queryByRole('region',{name:'Ability planning shortlist'})).toBeNull()
 })
 it('keeps workspace buttons native and makes both navigation and the skip link focus the visible workspace',async()=>{
  const user=userEvent.setup();render(<App/> )
  const nav=screen.getByRole('navigation',{name:'Planner sections'})
  await user.click(within(nav).getByRole('button',{name:/^Reference/}))
  const heading=screen.getByRole('heading',{name:'Reference library'})
  expect(document.activeElement).toBe(heading)
  expect(within(nav).getByRole('button',{name:/^Reference/}).getAttribute('aria-current')).toBe('page')
  await user.click(screen.getByRole('link',{name:'Skip to current workspace'}))
  expect(document.activeElement).toBe(heading)
  expect(screen.queryByRole('region',{name:'Build workspace'})).toBeNull()
 })
 it('focuses the visible Build heading after loading a character/class preset',async()=>{
  const preset=createPreset('Pair focus',{characterName:'Sofia',className:'Archer'},[],'2026-11-01T00:00:00.000Z','pair-focus')
  localStorage.setItem(PRESET_KEY,JSON.stringify({schemaVersion:1,presets:[preset]}))
  const user=userEvent.setup();render(<App/> )
  await user.click(within(screen.getByRole('navigation',{name:'Planner sections'})).getByRole('button',{name:/^Compare & saves/}))
  await user.click(screen.getByText('My Character Builds',{exact:true}))
  const card=screen.getByRole('listitem',{name:'Saved build: Pair focus'})
  await user.click(within(card).getByRole('button',{name:'Load into Main planner'}))
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Build your character'}))
  expect((screen.getByRole('combobox',{name:'Character'}) as HTMLSelectElement).value).toBe('Sofia')
 })
 it('lets an exact catalog destination retain focus after user workspace changes',async()=>{
  const user=userEvent.setup();render(<App/> )
  const nav=screen.getByRole('navigation',{name:'Planner sections'})
  await user.click(within(nav).getByRole('button',{name:/^Reference/}))
  await user.click(within(nav).getByRole('button',{name:/^Build /}))
  await user.click(screen.getByText('Selected Mount',{exact:true}))
  await user.selectOptions(screen.getByRole('combobox',{name:/^Mount for /}),mountId(mountData.records.find(row=>row.name==='Wild Pegasus')!))
  await user.click(screen.getByRole('button',{name:'View in Mount Reference'}))
  const target=within(screen.getByRole('region',{name:'Wild Pegasus mount details'})).getByRole('heading',{name:'Wild Pegasus'})
  expect(document.activeElement).toBe(target)
  expect(document.activeElement).not.toBe(screen.getByRole('heading',{name:'Reference library'}))
 })
 it('keeps healthy-storage retry inside optional save details without removing it',async()=>{
  const user=userEvent.setup();render(<FullBuildLoadouts initialOpen selection={selection} onLoad={vi.fn()}/> )
  const retry=screen.getByRole('button',{name:'Retry reading full loadouts'})
  const optionalDetails=retry.closest('details.reader-disclosure')! as HTMLDetailsElement
  expect(optionalDetails.open).toBe(false)
  expect(optionalDetails.querySelector('summary')!.textContent).toBe('About local saves')
  await user.click(screen.getByText('About local saves',{exact:true}))
  await user.click(screen.getByRole('button',{name:'Retry reading full loadouts'}))
  expect(screen.getByRole('status').textContent).toContain('Stored data was not changed')
 })
 it('keeps recovery retry immediately available for unreadable stored loadouts',async()=>{
  localStorage.setItem(LOADOUT_KEY,'broken-json')
  const user=userEvent.setup();render(<FullBuildLoadouts initialOpen selection={selection} onLoad={vi.fn()}/> )
  expect(screen.getByRole('alert').textContent).toContain('could not be read')
  const retry=screen.getByRole('button',{name:'Retry reading full loadouts'})
  expect(retry.closest('details.reader-disclosure')).toBeNull()
  await user.click(retry)
  expect(localStorage.getItem(LOADOUT_KEY)).toBe('broken-json')
 })
})
