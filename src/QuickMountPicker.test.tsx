import { openPlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickMountPicker from './QuickMountPicker'
import App from './App'
import { growthData } from './growths'
import { createLoadout, LOADOUT_KEY } from './loadouts'
const character = growthData.characters.find(item => item.name === 'Alexandra')!
const profile = (name = 'Light Cavalry') => growthData.classes.find(item => item.name === name)!
const setClass = (name: string) => fireEvent.change(plannerRole('combobox', { name: 'Class' }), { target: { value: name } })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })
describe('mount chooser directly below Class', () => {
  it('appears immediately for mounted classes with only matching references and no automatic choice', () => {
    const onSelect = vi.fn(), view = render(<QuickMountPicker character={character} selectedClass={profile('Gladiator')} onSelect={onSelect} />)
    expect(screen.queryByRole('region')).toBeNull()
    view.rerender(<QuickMountPicker character={character} selectedClass={profile()} onSelect={onSelect} />)
    const select = plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement
    expect(select.value).toBe(''); expect(withinPlanner(select).getAllByRole('option')).toHaveLength(7)
    expect(select.textContent).toContain('Wild Horse'); expect(select.textContent).not.toContain('Wild Pegasus'); expect(onSelect).not.toHaveBeenCalled()
  })
  it('shows immediate nine-stat workbook results, 30-percent exceptions and the Charioteer multiplier', () => {
    const props = { character, selectedClass: profile(), selectedId: 'Mounts!A8', onSelect: vi.fn() }, view = render(<QuickMountPicker {...props} />)
    expect(screen.getByTestId('quick-mount-HP').textContent).toBe('45%'); expect(screen.getByTestId('quick-mount-Str').textContent).toBe('40%')
    expect(screen.getByText(/Unlisted growths count as \+0%/)).toBeDefined()
    view.rerender(<QuickMountPicker {...props} selectedClass={profile('Charioteer')} />)
    expect(screen.getByTestId('quick-mount-HP').textContent).toBe('50%'); expect(screen.getByText(/Charioteer applies ×2/)).toBeDefined()
    view.rerender(<QuickMountPicker {...props} selectedClass={profile('Wing Soldier')} selectedId="Mounts!A18" />)
    expect(screen.getByText(/Listed growth total \+30%/)).toBeDefined()
  })
  it('retains an incompatible current choice, warns instead of silently replacing it, and blocks disputed totals', () => {
    const props = { character, selectedClass: profile('Wing Soldier'), selectedId: 'Mounts!A8', onSelect: vi.fn() }, view = render(<QuickMountPicker {...props} />)
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('Mounts!A8')
    expect(screen.getByRole('status').textContent).toContain('differs'); expect(props.onSelect).not.toHaveBeenCalled()
    view.rerender(<QuickMountPicker {...props} selectedClass={profile('Ornius Rider')} selectedId="Mounts!A4" />)
    expect(screen.getByTestId('quick-mount-HP').textContent).toBe('—'); expect(screen.getByRole('status').textContent).toContain('No version is selected')
  })
  it('shares the existing character-scoped selection and details without changing the original nine growth cards', async () => {
    const user = userEvent.setup(), writes = vi.spyOn(Storage.prototype, 'setItem'); render(<App />)
    expect(screen.queryByRole('region', { name: 'Quick mount comparison' })).toBeNull(); setClass('Light Cavalry')
    await user.selectOptions(plannerRole('combobox', { name: 'Mount' }), 'Mounts!A8')
    expect(screen.getByTestId('quick-mount-HP').textContent).toBe('45%'); expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    await openPlannerPanel(user, 'Selected Mount')
    expect((screen.getByLabelText('Mount for Alexandra') as HTMLSelectElement).value).toBe('Mounts!A8')
    await user.selectOptions(screen.getByLabelText('Mount for Alexandra'), 'Mounts!A10')
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('Mounts!A10')
    fireEvent.change(plannerRole('combobox', { name: 'Character' }), { target: { value: 'Sofia' } })
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('')
    fireEvent.change(plannerRole('combobox', { name: 'Character' }), { target: { value: 'Alexandra' } })
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('Mounts!A10')
    setClass('Gladiator'); expect(screen.queryByRole('region', { name: 'Quick mount comparison' })).toBeNull()
    setClass('Light Cavalry'); expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('Mounts!A10')
    expect(writes).not.toHaveBeenCalled()
  })
  it('reflects an explicitly loaded full plan and still resets unsaved choices on remount', async () => {
    const loadout = createLoadout('Pegasus', { characterName: 'Alexandra', className: 'Wing Soldier', weaponId: null, mountId: 'Mounts!A18', battalionId: null, abilities: [] }, [], '2026-10-27T00:00:00.000Z', 'qa')
    localStorage.setItem(LOADOUT_KEY, JSON.stringify({ schemaVersion: 1, loadouts: [loadout] }))
    const user = userEvent.setup(), view = render(<App />); await openPlannerPanel(user, 'Full Build Loadouts')
    await user.click(plannerRole('button', { name: 'Load into Main' }))
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('Mounts!A18')
    expect(screen.getByText(/Listed growth total \+30%/)).toBeDefined()
    view.unmount(); render(<App />); expect(screen.queryByRole('region', { name: 'Quick mount comparison' })).toBeNull(); setClass('Wing Soldier')
    expect((plannerRole('combobox', { name: 'Mount' }) as HTMLSelectElement).value).toBe('')
  })
})
