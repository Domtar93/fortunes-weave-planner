import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ExpectedStatsByLevel from './ExpectedStatsByLevel'
import StatSheet from './StatSheet'
import {emptyObservations} from './expectedStats'
import {growthData,STATS} from './growths'
import {getCharacterBase} from './characterBases'
import * as growthModule from './growths'
import {changeMain,openPlannerPanel,plannerRole,withinPlanner} from './plannerTestUtils'
import {createLoadout,LOADOUT_KEY,type FullBuildSelection} from './loadouts'
import {createPreset,PRESET_KEY} from './presets'
import {weaponData} from './forging'
import {battalionData} from './battalions'

// Character sheet redesign (November 19, 2026): one Level control drives the stat
// sheet (average + growth per stat) and the "Compare with your game" table, where
// real stats are typed inline. Every earlier calculation/session scenario is kept.
const panel=()=>screen.getByRole('region',{name:'Compare with your game'})
const row=(stat:string)=>within(panel()).getByTestId(`expected-row-${stat}`)
const avg=(stat:string)=>row(stat).querySelector('[data-label="Average"]')!.textContent
const diffCell=(stat:string)=>row(stat).querySelector<HTMLElement>('[data-label="Difference"]')!
const diff=(stat:string)=>diffCell(stat).childNodes[0]?.textContent
const verdict=(stat:string)=>diffCell(stat).querySelector('.diff-label')?.textContent??null
const sheet=(stat:string)=>screen.getByTestId(`average-${stat}`).textContent
const gain=(stat:string)=>screen.getByTestId(`gain-${stat}`).textContent
const level=()=>plannerRole('spinbutton',{name:'Level'}) as HTMLInputElement
const target=(value:number)=>fireEvent.change(level(),{target:{value:String(value)}})
const custom=()=>fireEvent.click(within(panel()).getByLabelText('My own starting point'))
const set=(label:string,value:string)=>{
 if(label==='Starting level'&&!within(panel()).queryByLabelText(label))custom()
 fireEvent.change(within(panel()).getByLabelText(label),{target:{value}})
}
const alexandra=()=>growthData.characters.find(profile=>profile.name==='Alexandra')!
const gladiator=()=>growthData.classes.find(profile=>profile.name==='Gladiator')!
const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard')
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();sessionStorage.clear();if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else Reflect.deleteProperty(navigator,'clipboard')})

describe('character sheet and comparison',()=>{
 it('drives the stat sheet and comparison from one Level control, with stepper and slider in sync',()=>{
  render(<App/>)
  const slider=plannerRole('slider',{name:'Level slider'}) as HTMLInputElement
  target(41)
  expect(slider.value).toBe('41')
  expect(sheet('Str')).toBe('25.0');expect(gain('Str')).toBe('+ 18.0');expect(avg('Str')).toBe('25.0')
  expect(screen.getByRole('heading',{name:'Average stats at level 41'})).toBeTruthy()
  fireEvent.change(slider,{target:{value:'30'}});expect(level().value).toBe('30');expect(sheet('Str')).toBe('20.1')
  fireEvent.click(plannerRole('button',{name:'Increase level'}));expect(level().value).toBe('31');expect(sheet('Str')).toBe('20.5')
  fireEvent.click(plannerRole('button',{name:'Decrease level'}));expect(level().value).toBe('30')
  expect(within(panel()).queryByLabelText('Starting level')).toBeNull()
 })
 it('renders nine nonblank automatic totals for all64 selectable profiles',()=>{
  const observations={...emptyObservations(),targetLevel:41}
  const view=render(<StatSheet character={growthData.characters[0]} selectedClass={gladiator()} observations={observations}/>)
  for(const character of growthData.characters){
   view.rerender(<StatSheet character={character} selectedClass={gladiator()} observations={observations}/>)
   expect(screen.getAllByRole('article')).toHaveLength(9)
   for(const stat of STATS)expect(Number.isFinite(Number(sheet(stat)))).toBe(true)
  }
 })
 it('compares observed stats directly with automatic totals without requiring a starting point',()=>{
  render(<App/>);target(41);set('Strength · Your stat','27')
  expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['25.0','+2.0','Above average'])
  expect(within(panel()).queryByLabelText('Starting level')).toBeNull()
  expect(sheet('Str')).toBe('25.0')
 })
 it('makes a custom level41→41 starting point explicit and restores the automatic total with one choice',()=>{
  render(<App/>);target(41);custom();set('Starting level','41')
  expect(avg('Str')).toBe('—');expect(sheet('Str')).toBe('—')
  set('Strength · Starting stat','22');expect(avg('Str')).toBe('22.0');expect(sheet('Str')).toBe('22.0')
  fireEvent.click(within(panel()).getByLabelText('Level-1 base stats (automatic)'))
  expect(avg('Str')).toBe('25.0');expect(sheet('Str')).toBe('25.0')
  expect(within(panel()).getByRole('status').textContent).toContain('40 level-ups')
  custom()
  expect((within(panel()).getByLabelText('Starting level') as HTMLInputElement).value).toBe('41')
  expect(avg('Str')).toBe('22.0')
 })
 it('explains unknown starting data instead of substituting zero or another character',()=>{
  const character={...growthData.characters[0],name:'Unknown fixture'},observations={...emptyObservations(),targetLevel:41}
  render(<><StatSheet character={character} selectedClass={growthData.classes[0]} observations={observations}/><ExpectedStatsByLevel character={character} selectedClass={growthData.classes[0]} observations={observations} onChange={vi.fn()}/></>)
  expect(within(panel()).getByText(/Base stats are not available for this character/)).toBeTruthy()
  expect(screen.getByText('Base stats are not available for this character')).toBeTruthy()
  for(const stat of STATS){expect(avg(stat)).toBe('—');expect(sheet(stat)).toBe('—')}
 })
 it('keeps the Bonaventure starting-Speed dispute visible beside its calculated result',()=>{
  render(<App/>);changeMain('Character','Bonaventure')
  expect(sheet('Spd')).toBe('7.0');expect(avg('Spd')).toBe('7.0')
  expect(screen.getByText(/using 7 from the research sheet; the other table lists 6/)).toBeTruthy()
 })
 it('shows all nine average totals immediately with an empty comparison',()=>{
  const observations={...emptyObservations(),targetLevel:41},character=alexandra(),selectedClass=gladiator()
  render(<><StatSheet character={character} selectedClass={selectedClass} observations={observations}/><ExpectedStatsByLevel character={character} selectedClass={selectedClass} observations={observations} onChange={vi.fn()}/></>)
  expect(screen.getByRole('heading',{name:'Average stats at level 41'})).toBeTruthy()
  expect(gain('Str')).toBe('+ 18.0')
  for(const stat of STATS){
   const expected=getCharacterBase(character.name)!.stats[stat]+40*(character.growths[stat]+selectedClass.growths[stat])/100
   expect(Number(sheet(stat))).toBeCloseTo(expected,1);expect(Number(avg(stat))).toBeCloseTo(expected,1)
   expect(diff(stat)).toBe('—');expect(verdict(stat)).toBeNull()
  }
  expect([...panel().querySelectorAll('input[type=text]')].every(input=>(input as HTMLInputElement).value==='')).toBe(true)
  expect(within(panel()).queryByLabelText('Strength · Starting stat')).toBeNull()
 })
 it('shows published starting totals at level 1 with zero level-ups',()=>{
  const observations=emptyObservations(),character=growthData.characters[0]
  render(<><StatSheet character={character} selectedClass={growthData.classes[0]} observations={observations}/><ExpectedStatsByLevel character={character} selectedClass={growthData.classes[0]} observations={observations} onChange={vi.fn()}/></>)
  for(const stat of STATS){expect(Number(sheet(stat))).toBe(getCharacterBase(character.name)!.stats[stat]);expect(screen.queryByTestId(`gain-${stat}`)).toBeNull()}
  expect(screen.getByText(/From level-1 base stats · 0 level-ups/)).toBeTruthy()
  expect(within(panel()).getByRole('status').textContent).toContain('0 level-ups')
 })
 it('keeps average totals populated when class or target changes without observations',()=>{
  const observations={...emptyObservations(),targetLevel:41},hunter=growthData.classes.find(profile=>profile.name==='Hunter')!
  const view=render(<ExpectedStatsByLevel character={alexandra()} selectedClass={gladiator()} observations={observations} onChange={vi.fn()}/>)
  expect(avg('Str')).toBe('25.0')
  view.rerender(<ExpectedStatsByLevel character={alexandra()} selectedClass={hunter} observations={observations} onChange={vi.fn()}/>)
  expect(avg('Str')).toBe('21.0')
  view.rerender(<ExpectedStatsByLevel character={alexandra()} selectedClass={hunter} observations={{...observations,targetLevel:21}} onChange={vi.fn()}/>)
  expect([avg('Str'),diff('Str')]).toEqual(['14.0','—'])
 })
 it('shows gains and projected totals from a custom starting point without an actual-stat entry',()=>{
  const observations={...emptyObservations(),targetLevel:30,startingPoint:'custom' as const,checkpointLevel:'10'};observations.checkpointStats.Str='16'
  render(<><StatSheet character={alexandra()} selectedClass={gladiator()} observations={observations}/><ExpectedStatsByLevel character={alexandra()} selectedClass={gladiator()} observations={observations} onChange={vi.fn()}/></>)
  expect([avg('Str'),diff('Str')]).toEqual(['25.0','—'])
  expect(gain('Str')).toBe('+ 9.0');expect(screen.getByText(/From your level 10 stats · 20 level-ups as Gladiator/)).toBeTruthy()
  expect(avg('Mag')).toBe('—')
 })
 it('offers levels 1–99 beside the main character selector and rejects out-of-range typing',()=>{
  render(<App/>)
  const input=level()
  expect([input.min,input.max,input.value]).toEqual(['1','99','1'])
  expect((plannerRole('button',{name:'Decrease level'}) as HTMLButtonElement).disabled).toBe(true)
  target(99);expect(gain('Str')).toBe('+ 44.1')
  expect((plannerRole('button',{name:'Increase level'}) as HTMLButtonElement).disabled).toBe(true)
  for(const invalid of ['0','100','1.5',''])fireEvent.change(input,{target:{value:invalid}})
  expect(gain('Str')).toBe('+ 44.1')
  fireEvent.blur(input);expect(input.value).toBe('99')
  expect(input.closest('.character-sheet')?.querySelector('#character')).toBeTruthy()
 })
 it('projects the Alexandra example, compares actual values, and recalculates class and target immediately',()=>{
  render(<App/>);target(30);set('Starting level','10')
  expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  expect(screen.getByLabelText('Str: personal 35% plus class +10% equals 45%')).toBeTruthy()
  set('Strength · Starting stat','16');expect(gain('Str')).toBe('+ 9.0')
  set('Strength · Your stat','27')
  expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['25.0','+2.0','Above average'])
  set('Strength · Your stat','23');expect(verdict('Str')).toBe('Below average')
  set('Strength · Your stat','25');expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['25.0','0.0','Matches average'])
  changeMain('Class','Hunter');expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['23.0','+2.0','Above average'])
  target(31);expect(avg('Str')).toBe('23.4')
 })
 it('supports equality and rejects backward or malformed intervals without erasing entered stats',()=>{
  render(<App/>);target(10);set('Starting level','10')
  set('Strength · Starting stat','16');set('Strength · Your stat','16')
  expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['16.0','0.0','Matches average'])
  target(9);expect(within(panel()).getByRole('alert').textContent).toContain('backward projection')
  expect(avg('Str')).toBe('—');expect(diff('Str')).toBe('—')
  for(const invalid of ['0','100','1.5','abc']){
   set('Starting level',invalid)
   expect(within(panel()).getByRole('alert').textContent).toContain('whole number from 1 to 99')
   expect(within(panel()).getByLabelText('Starting level').getAttribute('aria-invalid')).toBe('true')
  }
  expect((within(panel()).getByLabelText('Strength · Starting stat') as HTMLInputElement).value).toBe('16')
 })
 it('keeps empty and invalid starting/actual values distinct from valid zero',()=>{
  render(<App/>);target(30)
  expect(avg('Str')).toBe('20.1');custom()
  expect(within(panel()).getByText(/Enter your starting level and starting stats/)).toBeTruthy()
  set('Strength · Starting stat','16');expect(avg('Str')).toBe('—')
  set('Starting level','10');expect([avg('Str'),diff('Str')]).toEqual(['25.0','—'])
  set('Strength · Your stat','0');expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['25.0','-25.0','Below average'])
  set('Strength · Starting stat','');expect(avg('Str')).toBe('—');expect(diff('Str')).toBe('—')
  set('Strength · Starting stat','-3');expect(within(panel()).getByLabelText('Strength · Starting stat').getAttribute('aria-invalid')).toBe('true')
  expect(avg('Str')).toBe('—');expect(row('Str').textContent).toContain('non-negative')
  set('Strength · Starting stat','0');expect(avg('Str')).toBe('9.0')
  set('Strength · Your stat','');expect(diff('Str')).toBe('—')
 })
 it('restores Alexandra, Sofia and both Mu profiles independently in-session and clears observations on remount',()=>{
  const view=render(<App/>)
  const names=['Alexandra','Sofia','Mu','Mu (with growth)']
  for(const [index,name] of names.entries()){
   changeMain('Character',name);target(30+index);set('Starting level',String(10+index))
   set('Strength · Starting stat',String(16+index));set('Strength · Your stat',String(25+index))
  }
  for(const [index,name] of names.entries()){
   changeMain('Character',name)
   expect(level().value).toBe(String(30+index))
   expect((within(panel()).getByLabelText('Starting level') as HTMLInputElement).value).toBe(String(10+index))
   expect((within(panel()).getByLabelText('Strength · Starting stat') as HTMLInputElement).value).toBe(String(16+index))
   expect((within(panel()).getByLabelText('Strength · Your stat') as HTMLInputElement).value).toBe(String(25+index))
   const profile=growthData.characters.find(character=>character.name===name)!
   expect(screen.getByLabelText(new RegExp(`^Str: personal ${profile.growths.Str}% plus class`))).toBeTruthy()
  }
  view.unmount();render(<App/>)
  for(const name of names){
   changeMain('Character',name)
   expect(within(panel()).queryByLabelText('Starting level')).toBeNull()
   expect((within(panel()).getByLabelText('Strength · Your stat') as HTMLInputElement).value).toBe('')
   expect(level().value).toBe('1')
  }
 })
 it('retains fractional expectations internally while displaying one decimal and accessible text labels',()=>{
  const observations={...emptyObservations(),startingPoint:'custom' as const,targetLevel:2,checkpointLevel:'1'};observations.checkpointStats.Str='16';observations.actualStats.Str='16.46'
  render(<ExpectedStatsByLevel character={growthData.characters[0]} selectedClass={gladiator()} observations={observations} onChange={vi.fn()}/>)
  expect(avg('Str')).toBe('16.5');expect(verdict('Str')).toBe('Above average')
  expect(within(panel()).getByRole('table')).toBeTruthy();expect(panel().querySelectorAll('tbody tr')).toHaveLength(9)
 })
 it('shows unsupported zero/missing source fields instead of a number',()=>{
  const original=growthData.characters[0],observations={...emptyObservations(),targetLevel:30,checkpointLevel:'10'}
  const character={...original,growths:{...original.growths,Str:0,Mag:undefined as unknown as number}}
  const selectedClass=growthData.classes.find(profile=>profile.name==='Armored Ornius Rider')!
  render(<><StatSheet character={character} selectedClass={selectedClass} observations={observations}/><ExpectedStatsByLevel character={character} selectedClass={selectedClass} observations={observations} onChange={vi.fn()}/></>)
  expect(avg('Str')).toBe('—');expect(sheet('Str')).toBe('—');expect(row('Str').textContent).toContain('class base-growth')
  expect(screen.getAllByText(/class base-growth/).length).toBeGreaterThan(1)
  expect(avg('Mag')).toBe('—');expect(sheet('Mag')).toBe('—')
 })
 it('makes the unmodeled level-dependent class ability visible instead of silently applying it',()=>{
  render(<App/>);changeMain('Class','Charioteer');target(45)
  expect(screen.getByText(/Charioteer’s level-dependent growth ability is excluded/)).toBeTruthy()
  expect(within(panel()).getByText(/minimum-gain rules and stat caps are not modeled/)).toBeTruthy()
 })
 it('does not apply selected mounts, weapons, battalions, class flats or abilities to the projection',async()=>{
  const user=userEvent.setup();render(<App/>);changeMain('Class','Wing Soldier');target(30);set('Starting level','10')
  const snapshot=()=>STATS.map(stat=>[sheet(stat),avg(stat),diff(stat)])
  const before=snapshot();const source=JSON.stringify(growthData)
  for(const title of ['Selected Weapon','Selected Mount','Selected Battalion'])await openPlannerPanel(user,title)
  fireEvent.change(screen.getByLabelText('Weapon for Alexandra'),{target:{value:weaponData.records[0].id}})
  fireEvent.change(screen.getByLabelText('Mount for Alexandra'),{target:{value:'Mounts!A18'}})
  fireEvent.change(screen.getByLabelText('Battalion for Alexandra'),{target:{value:battalionData.records[0].id}})
  expect(snapshot()).toEqual(before);expect(JSON.stringify(growthData)).toBe(source)
  expect(panel().textContent).toContain('no class or equipment flat bonus is added')
 })
 it('keeps manual typing local without recalculating existing growths or modifying any source record',()=>{
  render(<App/>);target(30)
  const before=JSON.stringify(growthData),combine=vi.spyOn(growthModule,'combineGrowths')
  set('Starting level','10');set('Strength · Starting stat','16');set('Strength · Your stat','25')
  expect(avg('Str')).toBe('25.0');expect(JSON.stringify(growthData)).toBe(before);expect(combine).not.toHaveBeenCalled()
 })
 it('keeps the comparison collapsed until opened, while the averages are visible immediately',()=>{
  render(<App/>)
  expect(panel().querySelector('details')!.open).toBe(false)
  expect(sheet('Str')).toBe('7.0')
 })
 it('leaves existing build exports identical after entering private session observations',async()=>{
  const user=userEvent.setup();render(<App/>);target(30)
  await openPlannerPanel(user,'Main Build Overview')
  const write=vi.fn(async (_text:string)=>{});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:write}})
  const copy=()=>withinPlanner(plannerRole('group',{name:'Copy main build overview'})).getByRole('button',{name:'Copy Build Overview'})
  await user.click(copy());set('Starting level','10');set('Strength · Starting stat','12345.625');set('Strength · Your stat','12352.875')
  await user.click(copy());expect(write).toHaveBeenCalledTimes(2);expect(write.mock.calls[1][0]).toBe(write.mock.calls[0][0]);expect(write.mock.calls[1][0]).not.toContain('12345.625')
 })
 it('preserves saved schemas, full-build loading and Build A/B without persisting observations',async()=>{
  const full:FullBuildSelection={characterName:'Sofia',className:'Archer',weaponId:weaponData.records[0].id,mountId:null,battalionId:null,abilities:[]}
  const saved=createLoadout('Retained build',full,[],'2026-11-12T12:00:00.000Z','expected-stats-fixture')
  const fullPayload=JSON.stringify({schemaVersion:1,loadouts:[saved]})
  const presetPayload=JSON.stringify({schemaVersion:1,presets:[createPreset('Retained preset',{characterName:'Alexandra',className:'Gladiator'},[])]})
  localStorage.setItem(LOADOUT_KEY,fullPayload);localStorage.setItem(PRESET_KEY,presetPayload);sessionStorage.setItem('marker','keep')
  const writes=vi.spyOn(Storage.prototype,'setItem'),removes=vi.spyOn(Storage.prototype,'removeItem'),clears=vi.spyOn(Storage.prototype,'clear')
  const user=userEvent.setup();render(<App/>);changeMain('Character','Sofia');target(30);set('Starting level','10');set('Strength · Starting stat','12');set('Strength · Your stat','23')
  changeMain('Character','Alexandra');target(99);set('Starting level','10')
  await openPlannerPanel(user,'Build Comparison')
  const ab=()=>STATS.map(stat=>[screen.getByTestId(`comparison-A-${stat}`).textContent,screen.getByTestId(`comparison-B-${stat}`).textContent])
  const before=ab();await openPlannerPanel(user,'Full Build Loadouts')
  const card=withinPlanner(plannerRole('listitem',{name:'Saved full loadout: Retained build'}))
  await user.click(card.getByRole('button',{name:'Load into Main'}))
  expect((plannerRole('combobox',{name:'Character'}) as HTMLSelectElement).value).toBe('Sofia')
  expect((plannerRole('combobox',{name:'Class'}) as HTMLSelectElement).value).toBe('Archer')
  expect(level().value).toBe('30')
  expect([avg('Str'),diff('Str'),verdict('Str')]).toEqual(['18.0','+5.0','Above average']);expect(ab()).toEqual(before)
  expect(localStorage.getItem(LOADOUT_KEY)).toBe(fullPayload);expect(localStorage.getItem(PRESET_KEY)).toBe(presetPayload);expect(sessionStorage.getItem('marker')).toBe('keep')
  expect(writes).not.toHaveBeenCalled();expect(removes).not.toHaveBeenCalled();expect(clears).not.toHaveBeenCalled()
 })
})
