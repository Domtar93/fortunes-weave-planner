import { plannerRole } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FullPlanComparison from './FullPlanComparison'
import { compareFullPlans } from './fullPlanComparisonModel'
import { compareGrowthBuilds } from './comparison'
import { createLoadout, type FullBuildSelection } from './loadouts'
import { weaponData } from './forging'
import { proficiencyData } from './proficiencies'
import { STATS } from './growths'
const main = (name = 'Alexandra', className = 'Gladiator'): FullBuildSelection => ({ characterName: name, className, weaponId: null, mountId: null, battalionId: null, abilities: [] })
const saved = () => createLoadout('Wing plan', { ...main('Sofia', 'Wing Soldier'), weaponId: weaponData.records.find(x => x.name === 'Zanbato')!.id, mountId: 'Mounts!A4' }, [], '2026-10-26T01:00:00.000Z', 'one')
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })
describe('full plan comparison', () => {
  it('reuses existing base-growth calculations and preserves all source warnings without applying equipment', () => {
    const a = main(), b = saved(), expected = compareGrowthBuilds(a, b), result = compareFullPlans(a, b)
    expect(result.growth).toEqual(expected); expect(result.b.weapon!.warnings.some(x => x.message.includes('14-19'))).toBe(true)
    expect(result.b.mount!.warnings.some(x => x.message.includes('neither version'))).toBe(true); expect(result.a.character.name).toBe('Alexandra'); expect(result.b.character.name).toBe('Sofia')
    const unchanged = compareFullPlans({ ...a, weaponId: b.weaponId, mountId: b.mountId }, b); expect(unchanged.growth).toEqual(result.growth)
  })
  it.each(['Mu', 'Mu (with growth)'])('retains %s identity and its exact mapped ability path', name => {
    const source = proficiencyData.categories.Sword.characters.Mu.find(entry => entry.rank === 'D')!.source
    const data = { ...main(name), abilities: [{ proficiency: 'Sword' as const, rank: 'D', source }] }, result = compareFullPlans(data, main('Alexandra'))
    expect(result.a.character.name).toBe(name); expect(result.growth.a.character.name).toBe(name)
    expect(result.a.entries[0].characterName).toBe(name); expect(result.a.entries[0].learnsetCharacter).toBe('Mu'); expect(result.a.entries[0].entry.rank).toBe('D')
  })
  it('preserves ability order and independent source identity', () => {
    const a = { ...main(), abilities: [{ proficiency: 'Flying' as const, rank: 'C+', source: "'Flying'!C2" }, { proficiency: 'Sword' as const, rank: 'S+', source: "'Sword'!G2" }] }
    const result = compareFullPlans(a, main()); expect(result.a.entries.map(x => x.entry.rank)).toEqual(['C+', 'S+']); expect(result.b.entries).toEqual([])
  })
  it('blocks unavailable references instead of making partial or substituted comparisons', () => {
    expect(() => compareFullPlans(main(), { ...main(), mountId: 'Missing' })).toThrow('Missing mount')
    expect(() => compareFullPlans({ ...main(), characterName: 'Gone' }, main())).toThrow()
  })
  it('starts collapsed, then compares current Main and a saved full plan without storage writes', async () => {
    const user = userEvent.setup(), write = vi.spyOn(Storage.prototype, 'setItem'); render(<FullPlanComparison main={main()} loadouts={[saved()]} />)
    expect(screen.queryByRole('region', { name: 'Full build plan comparison' })).toBeNull(); await user.click(screen.getByText('Compare Full Plans', { exact: true }))
    await screen.findByRole('region', { name: 'Full build plan comparison' }); await user.selectOptions(screen.getByLabelText('Full plan B'), 'loadout:one')
    const right = plannerRole('region', { name: 'Full plan B details' }); expect(right.textContent).toContain('Sofia'); expect(right.textContent).toContain('Zanbato'); expect(right.textContent).toContain('Meganius')
    expect(right.textContent).toContain('Neither source is reconciled here'); expect(right.textContent).toContain('neither version is selected')
    const expected = compareGrowthBuilds(main(), saved()); for (const stat of STATS) expect(screen.getByTestId(`full-plan-B-${stat}`).textContent).toBe(`${expected.b.combined[stat]}%`)
    expect(write).not.toHaveBeenCalled(); expect(screen.getByRole('table').textContent).toContain('B − A')
  })
  it('updates the live Main result and retains source choices across collapse/reopen', async () => {
    const user = userEvent.setup(), view = render(<FullPlanComparison main={main()} loadouts={[saved()]} />); await user.click(screen.getByText('Compare Full Plans', { exact: true })); await screen.findByLabelText('Full plan B')
    await user.selectOptions(screen.getByLabelText('Full plan B'), 'loadout:one'); view.rerender(<FullPlanComparison main={main('Mu', 'Hunter')} loadouts={[saved()]} />)
    expect(plannerRole('region', { name: 'Full plan A details' }).textContent).toContain('Mu × Hunter')
    await user.click(screen.getByText('Compare Full Plans', { exact: true })); await user.click(screen.getByText('Compare Full Plans', { exact: true })); expect((screen.getByLabelText('Full plan B') as HTMLSelectElement).value).toBe('loadout:one')
  })
  it('shows a stale/deleted plan without silently replacing it with Main', async () => {
    const user = userEvent.setup(), view = render(<FullPlanComparison main={main()} loadouts={[saved()]} />); await user.click(screen.getByText('Compare Full Plans', { exact: true })); await screen.findByLabelText('Full plan B'); await user.selectOptions(screen.getByLabelText('Full plan B'), 'loadout:one')
    view.rerender(<FullPlanComparison main={main()} loadouts={[]} />); expect(screen.getByRole('alert').textContent).toContain('no selection was substituted'); expect((screen.getByLabelText('Full plan B') as HTMLSelectElement).value).toBe('loadout:one')
    expect(screen.queryByRole('table')).toBeNull(); await user.selectOptions(screen.getByLabelText('Full plan B'), 'main'); expect(screen.getByRole('table')).toBeDefined()
  })
  it('retains exact ability names, evidence and source links in both independent columns', async () => {
    const user = userEvent.setup(), selection = { ...main(), abilities: [{ proficiency: 'Sword' as const, rank: 'D', source: "'Sword'!B2" }] }
    render(<FullPlanComparison main={selection} loadouts={[]} />); await user.click(screen.getByText('Compare Full Plans', { exact: true })); await screen.findByLabelText('Full plan B')
    for (const label of ['A', 'B']) { const column = within(plannerRole('region', { name: `Full plan ${label} details` })); expect(column.getByText(/Haze Slice/)).toBeDefined(); expect(column.getByRole('link').getAttribute('href')).toContain('range=B2') }
  })
})
