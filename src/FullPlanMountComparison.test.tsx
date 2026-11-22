import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FullPlanMountComparison from './FullPlanMountComparison'
import {compareFullPlans} from './fullPlanComparisonModel'
import {mountData} from './mounts'
import {previewWorkbookMountGrowth} from './mountGrowthPreviewModel'
import type {FullBuildSelection} from './loadouts'

const plan=(className='Gladiator',mountName?:string):FullBuildSelection=>({characterName:'Alexandra',className,weaponId:null,mountId:mountName?mountData.records.find(m=>m.name===mountName)!.nameSource.source:null,battalionId:null,abilities:[]})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
describe('independent documented mount comparison',()=>{
 it('shows no secondary table until opened and reuses the existing mount preview exactly',async()=>{
  const data=compareFullPlans(plan(),plan('Charioteer','Wild Horse')),writes=vi.spyOn(Storage.prototype,'setItem')
  render(<FullPlanMountComparison a={data.a} b={data.b}/>);expect(screen.queryByRole('table')).toBeNull()
  await userEvent.setup().click(screen.getByText('Compare documented mount growths'))
  const expected=previewWorkbookMountGrowth(data.b.character,data.b.selectedClass,data.b.mount!.record)
  for(const row of expected.rows)expect(screen.getByTestId(`full-mount-B-${row.stat}`).textContent).toContain(row.combined===null?'Unavailable':`${row.combined}%`)
  expect(screen.getByTestId('full-mount-B-HP').textContent).toContain('50%')
  expect(screen.getByText(/Separate community-workbook preview, unverified/)).toBeDefined();expect(writes).not.toHaveBeenCalled()
 })
 it('keeps disputed mount totals and differences unavailable',async()=>{
  const data=compareFullPlans(plan(),plan('Ornius Rider','Meganius'))
  render(<FullPlanMountComparison a={data.a} b={data.b}/>);await userEvent.setup().click(screen.getByText('Compare documented mount growths'))
  expect(screen.getByTestId('full-mount-B-HP').textContent).toContain('Unavailable')
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(9)
  expect(data.growth.b.combined.HP).toBe(data.b.character.growths.HP+data.b.selectedClass.growths.HP)
 })
})
