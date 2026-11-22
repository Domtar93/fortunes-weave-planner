import {afterEach,expect,it} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import {mountData} from './mounts'
import {mountId} from './mountPlanning'
afterEach(()=>{cleanup();localStorage.clear();sessionStorage.clear()})
it('opens the real Reference workspace when following a selected mount, without a test navigation helper',async()=>{
 const user=userEvent.setup();render(<App/> )
 await user.click(screen.getByText('Selected Mount',{exact:true}))
 await user.selectOptions(screen.getByRole('combobox',{name:/^Mount for /}),mountId(mountData.records.find(record=>record.name==='Wild Pegasus')!))
 await user.click(screen.getByRole('button',{name:'View in Mount Reference'}))
 expect(screen.getByRole('region',{name:'Reference workspace'})).toBeDefined()
 expect(screen.queryByRole('region',{name:'Build workspace'})).toBeNull()
 expect(screen.getByRole('list',{name:'Mount catalog'})).toBeDefined()
})
it('loading a saved full build returns to visible Build and restores its profile, without a test navigation helper',async()=>{
 const user=userEvent.setup();render(<App/> )
 const nav=screen.getByRole('navigation',{name:'Planner sections'})
 await user.click(within(nav).getByRole('button',{name:/^Compare & saves/}))
 await user.type(screen.getByRole('textbox',{name:'Loadout name'}),'Navigation QA')
 await user.click(screen.getByRole('button',{name:'Save main loadout'}))
 await user.click(within(nav).getByRole('button',{name:/^Build /}))
 await user.selectOptions(screen.getByRole('combobox',{name:'Character'}),'Sofia')
 await user.click(within(nav).getByRole('button',{name:/^Compare & saves/}))
 await user.click(screen.getByRole('button',{name:'Load into Main'}))
 expect(screen.getByRole('region',{name:'Build workspace'})).toBeDefined()
 expect(screen.queryByRole('region',{name:'Compare and save workspace'})).toBeNull()
 expect((screen.getByRole('combobox',{name:'Character'}) as HTMLSelectElement).value).toBe('Alexandra')
})

