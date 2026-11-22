import { plannerRole } from './plannerTestUtils'
import { openPlannerPanel } from './plannerTestUtils'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,cleanup,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReferenceRecovery from './ReferenceRecovery'
import FullBuildLoadouts from './FullBuildLoadouts'
import {createLoadout,LOADOUT_KEY,type BuildLoadout} from './loadouts'
import {communityData,communityEntries} from './community'
import {formatReferenceRecovery,parseReferenceRecovery,RECOVERY_FILENAME} from './referenceRecoveryModel'
import {MAX_BACKUP_BYTES} from './loadoutBackupModel'

const original=()=>createLoadout('Original',{characterName:'Alexandra',className:'Gladiator',weaponId:null,mountId:null,battalionId:null,abilities:[{proficiency:'Reason',rank:'S+',source:communityEntries('Reason','Alexandra').find(e=>e.rank==='S+')!.source}]},[],'2026-10-28T00:00:00.000Z','old')
function previous(changed=false){
 const value=parseReferenceRecovery(formatReferenceRecovery([original()]))
 value.snapshotSha256='a'.repeat(64)
 value.loadouts[0].abilities[0].source=value.loadouts[0].abilities[0].source.replace(communityData.namespace,'Community aaaaaaaaaaaa')
 value.evidence[0].source=value.evidence[0].source.replace(communityData.namespace,'Community aaaaaaaaaaaa')
 if(changed)value.evidence[0].text='Previous unlock'
 return value
}
const file=(text:string)=>{const value=new File([text],'recovery.json',{type:'application/json'});Object.defineProperty(value,'text',{configurable:true,value:async()=>text});return value}
const open=(user:ReturnType<typeof userEvent.setup>)=>user.click(screen.getByText('Reference refresh & recovery',{exact:true}))
const read=async(user:ReturnType<typeof userEvent.setup>,changed=false)=>{
 await user.upload(screen.getByLabelText('Choose reference recovery JSON'),file(JSON.stringify(previous(changed))))
 await user.selectOptions(screen.getByLabelText('Loadout to review'),'old')
}
const createDescriptor=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),revokeDescriptor=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL')
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();for(const [key,descriptor] of [['createObjectURL',createDescriptor],['revokeObjectURL',revokeDescriptor]] as const){if(descriptor)Object.defineProperty(URL,key,descriptor);else Reflect.deleteProperty(URL,key)}})
describe('reference backup and reviewed recovery UI',()=>{
 it('exports exact evidence JSON using the shared download lifecycle without false disk confirmation',async()=>{
  const user=userEvent.setup(),data=[original()],create=vi.fn((_blob:Blob)=>'blob:recovery'),revoke=vi.fn()
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke})
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe(RECOVERY_FILENAME);expect(this.isConnected).toBe(true)})
  render(<ReferenceRecovery loadouts={data} disabled={false} onRecover={vi.fn()}/>);await open(user);await user.click(plannerRole('button', { name: 'Download reference recovery backup' }))
  const blob=create.mock.calls[0][0];expect(blob.type).toBe('application/json;charset=utf-8');expect(click).toHaveBeenCalledOnce()
  const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(blob)})
  expect(text).toBe(formatReferenceRecovery(data));expect(screen.getByRole('status').textContent).toContain('download started')
  expect(screen.queryByText(/saved to disk/i)).toBeNull();expect(document.querySelector('a[download]')).toBeNull()
 })
 it('offers selected manual evidence after download failure without touching clipboard or saves',async()=>{
  const user=userEvent.setup(),writes=vi.spyOn(Storage.prototype,'setItem');Object.defineProperty(URL,'createObjectURL',{configurable:true,value:undefined})
  render(<ReferenceRecovery loadouts={[original()]} disabled={false} onRecover={vi.fn()}/>);await open(user);await user.click(plannerRole('button', { name: 'Download reference recovery backup' }))
  const text=screen.getByLabelText('Reference recovery JSON for manual copying') as HTMLTextAreaElement
  expect(text.value).toBe(formatReferenceRecovery([original()]));expect(document.activeElement).toBe(text)
  expect([text.selectionStart,text.selectionEnd]).toEqual([0,text.value.length]);expect(writes).not.toHaveBeenCalled()
 })
 it('shows old/current evidence and requires changed-unlock approval before an explicit create',async()=>{
  const user=userEvent.setup(),onRecover=vi.fn();render(<ReferenceRecovery loadouts={[]} disabled={false} onRecover={onRecover}/>);await open(user);await read(user,true)
  const button=plannerRole('button', { name: 'Create recovered copy' }) as HTMLButtonElement
  expect(button.disabled).toBe(true);expect(screen.getByText('Previous unlock')).toBeDefined();expect(screen.getByText('Black Magic Mastery')).toBeDefined()
  await user.click(screen.getByRole('checkbox',{name:'Approve changed unlock Reason S+'}));expect(button.disabled).toBe(false);expect(onRecover).not.toHaveBeenCalled()
  await user.click(button);expect(onRecover).toHaveBeenCalledOnce();expect(onRecover.mock.calls[0][3]).toBe('Original (recovered)')
 })
 it('cancels without changing saved records or the active build',async()=>{
  const user=userEvent.setup(),onRecover=vi.fn();render(<ReferenceRecovery loadouts={[original()]} disabled={false} onRecover={onRecover}/>);await open(user);await read(user)
  await user.click(plannerRole('button', { name: 'Cancel reference recovery' }))
  expect(onRecover).not.toHaveBeenCalled();expect(screen.queryByRole('form',{name:'Reference recovery preview'})).toBeNull()
 })
 it('adds a new copy through the real parent while preserving the old stale save and Main',async()=>{
  const pkg=previous(),old=pkg.loadouts[0],onLoad=vi.fn();localStorage.setItem(LOADOUT_KEY,JSON.stringify({schemaVersion:1,loadouts:[old]}))
  const user=userEvent.setup();render(<FullBuildLoadouts selection={original()} onLoad={onLoad}/>);await openPlannerPanel(user, 'Full Build Loadouts');await open(user);await read(user)
  expect(JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts).toEqual([old])
  await user.click(plannerRole('button', { name: 'Create recovered copy' }))
  const data:BuildLoadout[]=JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts
  expect(data).toHaveLength(2);expect(data[0]).toEqual(old);expect(data[1].id).not.toBe(old.id);expect(data[1].abilities[0].source).toContain(communityData.namespace)
  expect(onLoad).not.toHaveBeenCalled()
 })
 it.each(['quota','concurrent'])('retains old storage and the preview after %s failure',async failure=>{
  const old=previous().loadouts[0],raw=JSON.stringify({schemaVersion:1,loadouts:[old]});localStorage.setItem(LOADOUT_KEY,raw)
  const user=userEvent.setup();render(<FullBuildLoadouts selection={original()} onLoad={vi.fn()}/>);await openPlannerPanel(user, 'Full Build Loadouts');await open(user);await read(user)
  let expected=raw
  if(failure==='quota')vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota fixture')})
  else{expected=JSON.stringify({schemaVersion:1,loadouts:[{...old,name:'Other tab'}]});localStorage.setItem(LOADOUT_KEY,expected)}
  await user.click(plannerRole('button', { name: 'Create recovered copy' }));expect(localStorage.getItem(LOADOUT_KEY)).toBe(expected)
  expect(screen.getByRole('alert').textContent).toContain(failure==='quota'?'Quota fixture':'changed in another tab')
  expect(plannerRole('button', { name: 'Create recovered copy' })).toBeDefined()
 })
 it.each(['malformed','oversize','read failure'])('rejects %s files without invoking recovery',async failure=>{
  const user=userEvent.setup(),onRecover=vi.fn();render(<ReferenceRecovery loadouts={[]} disabled={false} onRecover={onRecover}/>);await open(user)
  const input=file('{bad')
  if(failure==='oversize')Object.defineProperty(input,'size',{value:MAX_BACKUP_BYTES+1})
  if(failure==='read failure')Object.defineProperty(input,'text',{value:async()=>{throw new Error('Read denied')}})
  await user.upload(screen.getByLabelText('Choose reference recovery JSON'),input)
  expect(screen.getByRole('alert')).toBeDefined();expect(onRecover).not.toHaveBeenCalled()
 })
 it('ignores a late file read after a newer choice and resets approvals for a new file',async()=>{
  const user=userEvent.setup();render(<ReferenceRecovery loadouts={[]} disabled={false} onRecover={vi.fn()}/>);await open(user)
  let finish!:(text:string)=>void;const delayed=file('');Object.defineProperty(delayed,'text',{value:()=>new Promise<string>(resolve=>{finish=resolve})})
  await user.upload(screen.getByLabelText('Choose reference recovery JSON'),delayed);await read(user,true)
  await user.click(screen.getByRole('checkbox',{name:'Approve changed unlock Reason S+'}))
  await act(async()=>finish(formatReferenceRecovery([])))
  expect(screen.getByRole('checkbox',{name:'Approve changed unlock Reason S+'})).toBeDefined()
  await read(user,true);expect((screen.getByRole('checkbox',{name:'Approve changed unlock Reason S+'}) as HTMLInputElement).checked).toBe(false)
 })
 it('keeps blocked current targets uncreatable and shows prior-release recovery guidance',async()=>{
  const user=userEvent.setup(),pkg=previous();pkg.loadouts[0].weaponId='missing'
  render(<ReferenceRecovery loadouts={[]} disabled={false} onRecover={vi.fn()}/>);await open(user)
  await user.upload(screen.getByLabelText('Choose reference recovery JSON'),file(JSON.stringify(pkg)));await user.selectOptions(screen.getByLabelText('Loadout to review'),'old')
  expect((plannerRole('button', { name: 'Create recovered copy' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('alert').textContent).toContain('Missing weapon');expect(screen.getByText(/Open the preserved previous release/)).toBeDefined()
 })
})
