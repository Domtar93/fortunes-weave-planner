import { plannerRole } from './plannerTestUtils'
import { openPlannerPanel } from './plannerTestUtils'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FullBuildLoadouts from './FullBuildLoadouts'
import {createLoadout,LOADOUT_KEY,readLoadouts,updateLoadoutFromMain,type FullBuildSelection} from './loadouts'
import {communityEntries} from './community'

const main:FullBuildSelection={characterName:'Alexandra',className:'Gladiator',weaponId:null,mountId:null,battalionId:null,abilities:[]}
const old=()=>createLoadout('Saved plan',{...main,characterName:'Sofia',className:'The Avatar'},[],'2026-10-27T00:00:00.000Z','saved')
const seed=()=>{const record=old();localStorage.setItem(LOADOUT_KEY,JSON.stringify({schemaVersion:1,loadouts:[record]}));return record}
const card=()=>screen.getByRole('listitem',{name:'Saved full loadout: Saved plan'})
async function preview(){const user=userEvent.setup();await openPlannerPanel(user, 'Full Build Loadouts');await user.click(within(card()).getByRole('button',{name:'Update from Main'}));return user}
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})
describe('reviewed saved-build updates',()=>{
 it('retains identity/name/creation time while replacing all selection fields immutably',()=>{
  const before=old(),entry=communityEntries('Reason','Alexandra').find(x=>x.rank==='S+')!
  const selection={...main,abilities:[{proficiency:'Reason' as const,rank:'S+',source:entry.source}]}
  const updated=updateLoadoutFromMain(before,selection,'2026-10-28T00:00:00.000Z')
  expect(updated).toMatchObject({...selection,id:before.id,name:before.name,createdAt:before.createdAt,updatedAt:'2026-10-28T00:00:00.000Z'})
  expect(before.characterName).toBe('Sofia');expect(updated.abilities).not.toBe(selection.abilities)
 })
 it('rejects stale sources and never moves timestamps backwards',()=>{
  const before=old()
  expect(()=>updateLoadoutFromMain(before,{...main,weaponId:'missing'})).toThrow(/Missing weapon/)
  expect(updateLoadoutFromMain(before,main,'2026-10-26T00:00:00.000Z').updatedAt).toBe(before.updatedAt)
 })
 it('previews and cancels without saving or changing the active planner',async()=>{
  seed();const raw=localStorage.getItem(LOADOUT_KEY),onLoad=vi.fn(),writes=vi.spyOn(Storage.prototype,'setItem')
  render(<FullBuildLoadouts selection={main} onLoad={onLoad}/>);const user=await preview()
  expect(screen.getByText('Review replacement of “Saved plan”')).toBeDefined()
  expect(screen.getByText('Saved: Sofia')).toBeDefined();expect(screen.getByText('Main preview: Alexandra')).toBeDefined()
  expect(writes).not.toHaveBeenCalled();await user.click(plannerRole('button', { name: 'Cancel loadout edit' }))
  expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw);expect(onLoad).not.toHaveBeenCalled()
 })
 it('only writes after explicit confirmation and retains the stored ID',async()=>{
  const original=seed(),onLoad=vi.fn();render(<FullBuildLoadouts selection={main} onLoad={onLoad}/>);const user=await preview()
  await user.click(plannerRole('button', { name: 'Confirm update loadout' }))
  expect(readLoadouts().loadouts[0]).toMatchObject({...main,id:original.id,createdAt:original.createdAt,name:original.name})
  expect(onLoad).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('Updated full loadout')
 })
 it('blocks a stale Main preview without overwriting a saved build',async()=>{
  seed();const raw=localStorage.getItem(LOADOUT_KEY),view=render(<FullBuildLoadouts selection={main} onLoad={vi.fn()}/>);const user=await preview()
  view.rerender(<FullBuildLoadouts selection={{...main,className:'The Avatar'}} onLoad={vi.fn()}/> )
  await user.click(plannerRole('button', { name: 'Confirm update loadout' }))
  expect(screen.getByRole('alert').textContent).toContain('Main changed after the preview')
  expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
 })
 it('detects concurrent saved changes before a confirmed replacement',async()=>{
  seed();render(<FullBuildLoadouts selection={main} onLoad={vi.fn()}/>);const user=await preview()
  const changed=JSON.stringify({schemaVersion:1,loadouts:[{...old(),name:'Another tab'}]});localStorage.setItem(LOADOUT_KEY,changed)
  await user.click(plannerRole('button', { name: 'Confirm update loadout' }))
  expect(screen.getByRole('alert').textContent).toContain('changed in another tab');expect(localStorage.getItem(LOADOUT_KEY)).toBe(changed)
 })
 it('keeps existing data on storage failure and leaves the review available',async()=>{
  seed();const raw=localStorage.getItem(LOADOUT_KEY);render(<FullBuildLoadouts selection={main} onLoad={vi.fn()}/>);const user=await preview()
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota fixture')})
  await user.click(plannerRole('button', { name: 'Confirm update loadout' }))
  expect(screen.getByRole('alert').textContent).toContain('Quota fixture');expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
  expect(plannerRole('button', { name: 'Confirm update loadout' })).toBeDefined()
 })
})
