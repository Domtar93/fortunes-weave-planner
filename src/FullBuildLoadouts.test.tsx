import { openPlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FullBuildLoadouts from './FullBuildLoadouts'
import App from './App'
import { createLoadout, LOADOUT_KEY, type FullBuildSelection } from './loadouts'
import { createPreset, PRESET_KEY } from './presets'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { STATS } from './growths'
import { proficiencyData } from './proficiencies'

const now = '2026-10-26T01:00:00.000Z'
const selection = (name = 'Alexandra'): FullBuildSelection => ({ characterName: name, className: 'Wing Soldier', weaponId: weaponData.records[0].id, mountId: 'Mounts!A18', battalionId: battalionData.records[0].id,
  abilities: ['D', 'C', 'B'].map(rank => ({ proficiency: 'Sword', rank, source: proficiencyData.categories.Sword.characters[name === 'Mu (with growth)' ? 'Mu' : name].find(entry => entry.rank === rank)!.source })) })
const panel = () => plannerRole('region', { name: 'Saved full build loadouts' })
const open = async (user: ReturnType<typeof userEvent.setup>) => openPlannerPanel(user, 'Full Build Loadouts')
const card = (name: string) => withinPlanner(panel()).getByRole('listitem', { name: `Saved full loadout: ${name}` })
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe('explicit full build loadouts', () => {
  it('saves current complete references only on explicit submit and loads them with keyboard support', async () => {
    const user = userEvent.setup(), source = selection(), onLoad = vi.fn(), writes = vi.spyOn(Storage.prototype, 'setItem')
    render(<FullBuildLoadouts selection={source} onLoad={onLoad} />); expect(writes).not.toHaveBeenCalled(); await open(user)
    await user.type(screen.getByLabelText('Loadout name'), 'Wing plan'); screen.getByLabelText('Loadout name').focus(); await user.keyboard('{Enter}')
    const saved = JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts[0]
    expect(saved).toMatchObject(source); expect(saved.name).toBe('Wing plan'); expect(Object.keys(saved.abilities[0])).toEqual(['proficiency', 'rank', 'source'])
    const load = withinPlanner(card('Wing plan')).getByRole('button', { name: 'Load into Main' }); load.focus(); await user.keyboard(' ')
    expect(onLoad).toHaveBeenCalledExactlyOnceWith(source); expect(writes).toHaveBeenCalledTimes(1)
    expect(withinPlanner(panel()).getByRole('status').textContent).toContain('Other characters and Build A/B were unchanged')
  })
  it('renames, duplicates and confirms deletion without loading or changing current choices', async () => {
    const saved = createLoadout('Original', selection(), [], now, 'one'); localStorage.setItem(LOADOUT_KEY, JSON.stringify({ schemaVersion: 1, loadouts: [saved] }))
    const user = userEvent.setup(), onLoad = vi.fn(); render(<FullBuildLoadouts selection={selection()} onLoad={onLoad} />); await open(user)
    await user.click(withinPlanner(card('Original')).getByRole('button', { name: 'Rename loadout' })); await user.clear(screen.getByLabelText('New loadout name')); await user.type(screen.getByLabelText('New loadout name'), 'Renamed')
    await user.click(plannerRole('button', { name: 'Confirm rename loadout' })); expect(card('Renamed')).toBeDefined()
    await user.click(withinPlanner(card('Renamed')).getByRole('button', { name: 'Duplicate loadout' })); await user.type(screen.getByLabelText('New loadout name'), 'Copy')
    await user.click(plannerRole('button', { name: 'Confirm duplicate loadout' })); expect(card('Copy')).toBeDefined()
    const collection = JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts; expect(collection[0].id).not.toBe(collection[1].id); expect(collection[0].abilities).toEqual(collection[1].abilities)
    await user.click(withinPlanner(card('Copy')).getByRole('button', { name: 'Delete loadout' })); await user.click(plannerRole('button', { name: 'Cancel loadout edit' })); expect(card('Copy')).toBeDefined()
    await user.click(withinPlanner(card('Copy')).getByRole('button', { name: 'Delete loadout' })); await user.click(plannerRole('button', { name: 'Confirm delete loadout' }))
    expect(withinPlanner(panel()).queryByRole('listitem', { name: 'Saved full loadout: Copy' })).toBeNull(); expect(onLoad).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText('Loadout name'))
  })
  it('retains malformed storage and blocks writes until explicit recovery/re-read', async () => {
    localStorage.setItem(LOADOUT_KEY, '{bad'); const writes = vi.spyOn(Storage.prototype, 'setItem'), user = userEvent.setup()
    render(<FullBuildLoadouts selection={selection()} onLoad={vi.fn()} />); await open(user)
    expect(withinPlanner(panel()).getByRole('alert').textContent).toContain('Stored data is untouched')
    expect((withinPlanner(panel()).getByRole('button', { name: 'Save main loadout' }) as HTMLButtonElement).disabled).toBe(true); expect(writes).not.toHaveBeenCalled(); expect(localStorage.getItem(LOADOUT_KEY)).toBe('{bad')
    localStorage.removeItem(LOADOUT_KEY); await user.click(withinPlanner(panel()).getByRole('button', { name: 'Retry reading full loadouts' }))
    expect((withinPlanner(panel()).getByRole('button', { name: 'Save main loadout' }) as HTMLButtonElement).disabled).toBe(false); expect(writes).not.toHaveBeenCalled()
  })
  it('keeps stale source IDs visible and blocks partial loading', async () => {
    const saved = { ...createLoadout('Stale', selection(), [], now, 'stale'), weaponId: 'Missing weapon' }; const raw = JSON.stringify({ schemaVersion: 1, loadouts: [saved] }); localStorage.setItem(LOADOUT_KEY, raw)
    const user = userEvent.setup(), onLoad = vi.fn(); render(<FullBuildLoadouts selection={selection()} onLoad={onLoad} />); await open(user)
    expect(card('Stale').textContent).toContain('Unavailable (Missing weapon)'); const load = withinPlanner(card('Stale')).getByRole('button', { name: 'Load into Main' })
    expect((load as HTMLButtonElement).disabled).toBe(true); await user.click(load); expect(onLoad).not.toHaveBeenCalled(); expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
  })
  it('blocks stale-tab saves and displays quota failures without silently replacing storage', async () => {
    const user = userEvent.setup(); render(<FullBuildLoadouts selection={selection()} onLoad={vi.fn()} />); await open(user)
    const raw = JSON.stringify({ schemaVersion: 1, loadouts: [createLoadout('Other tab', selection(), [], now, 'other')] }); localStorage.setItem(LOADOUT_KEY, raw)
    await user.type(screen.getByLabelText('Loadout name'), 'New'); await user.click(plannerRole('button', { name: 'Save main loadout' }))
    expect(withinPlanner(panel()).getByRole('alert').textContent).toContain('another tab'); expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
    await user.click(plannerRole('button', { name: 'Retry reading full loadouts' })); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    await user.click(plannerRole('button', { name: 'Save main loadout' })); expect(withinPlanner(panel()).getByRole('alert').textContent).toContain('Quota exceeded'); expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
  })
  it.each(['Mu', 'Mu (with growth)'])('restores %s with exact profile identity and shared learnset sources kept separate', async name => {
    const saved = createLoadout('Mu plan', selection(name), [], now, 'mu'); localStorage.setItem(LOADOUT_KEY, JSON.stringify({ schemaVersion: 1, loadouts: [saved] }))
    const user = userEvent.setup(), onLoad = vi.fn(); render(<FullBuildLoadouts selection={selection()} onLoad={onLoad} />); await open(user)
    await user.click(withinPlanner(card('Mu plan')).getByRole('button', { name: 'Load into Main' })); expect(onLoad.mock.calls[0][0].characterName).toBe(name); expect(onLoad.mock.calls[0][0].abilities).toEqual(selection(name).abilities)
  })
  it('loads a saved full plan atomically in the App while preserving another character, presets and A/B', async () => {
    const old = JSON.stringify({ schemaVersion: 1, presets: [createPreset('Legacy', { characterName: 'Sofia', className: 'Archer' }, [], now, 'legacy')] }); localStorage.setItem(PRESET_KEY, old)
    const full = createLoadout('Complete', selection(), [], now, 'complete'); localStorage.setItem(LOADOUT_KEY, JSON.stringify({ schemaVersion: 1, loadouts: [full] }))
    const user = userEvent.setup(), writes = vi.spyOn(Storage.prototype, 'setItem'); render(<App />)
    for (const label of ['Selected Weapon', 'Selected Mount', 'Selected Battalion', 'Build Comparison', 'Main Build Overview', 'Full Build Loadouts']) await openPlannerPanel(user, label)
    fireEvent.change(plannerRole('combobox', { name: 'Character' }), { target: { value: 'Sofia' } }); set('Weapon for Sofia', weaponData.records[8].id)
    const compare = () => STATS.map(stat => `${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`), before = compare()
    await user.click(withinPlanner(card('Complete')).getByRole('button', { name: 'Load into Main' }))
    expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra'); expect((plannerRole('combobox', { name: 'Class' }) as HTMLSelectElement).value).toBe('Wing Soldier')
    expect((screen.getByLabelText('Weapon for Alexandra') as HTMLSelectElement).value).toBe(full.weaponId); expect((screen.getByLabelText('Mount for Alexandra') as HTMLSelectElement).value).toBe(full.mountId)
    expect((screen.getByLabelText('Battalion for Alexandra') as HTMLSelectElement).value).toBe(full.battalionId)
    const overview = plannerRole('region', { name: 'Main build planning overview' }); expect(overview.textContent).toContain('3/8'); expect(overview.textContent).toContain('Haze Slice')
    expect(compare()).toEqual(before); expect(localStorage.getItem(PRESET_KEY)).toBe(old); expect(writes).not.toHaveBeenCalled()
    fireEvent.change(plannerRole('combobox', { name: 'Character' }), { target: { value: 'Sofia' } }); expect((screen.getByLabelText('Weapon for Sofia') as HTMLSelectElement).value).toBe(weaponData.records[8].id)
  })
  it('retains explicit saves across remount while unsaved active plans reset and require an explicit Load', async () => {
    const user = userEvent.setup(), view = render(<App />); await open(user); await user.type(screen.getByLabelText('Loadout name'), 'Empty plan'); await user.click(plannerRole('button', { name: 'Save main loadout' }))
    const raw = localStorage.getItem(LOADOUT_KEY); fireEvent.change(plannerRole('combobox', { name: 'Character' }), { target: { value: 'Mu' } }); view.unmount(); render(<App />); await open(user)
    expect(card('Empty plan')).toBeDefined(); expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw); expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra')
  })
  it('renders at most 25 saved cards per page and searches the entire collection without writing or loading', async () => {
    const base = createLoadout('Template', selection(), [], now, 'template')
    const records = Array.from({ length: 61 }, (_, index) => ({ ...base, id: `plan-${index}`, name: `Plan ${String(index).padStart(2, '0')}` }))
    const raw = JSON.stringify({ schemaVersion: 1, loadouts: records }); localStorage.setItem(LOADOUT_KEY, raw)
    const writes = vi.spyOn(Storage.prototype, 'setItem'), onLoad = vi.fn(), user = userEvent.setup()
    render(<FullBuildLoadouts selection={selection()} onLoad={onLoad} />)
    expect(screen.queryByRole('region', { name: 'Saved full build loadouts' })).toBeNull(); await open(user)
    const cards = () => withinPlanner(panel()).getAllByRole('listitem', { name: /^Saved full loadout:/u })
    expect(cards()).toHaveLength(25); expect(card('Plan 00')).toBeDefined()
    await user.click(plannerRole('button', { name: 'Next loadout page' })); expect(cards()).toHaveLength(25); expect(card('Plan 25')).toBeDefined()
    await user.click(plannerRole('button', { name: 'Next loadout page' })); expect(cards()).toHaveLength(11); expect(card('Plan 60')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Search saved loadouts'), { target: { value: 'Plan 60' } }); expect(cards()).toHaveLength(1); expect(card('Plan 60')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Search saved loadouts'), { target: { value: 'alexANDRA' } }); expect(cards()).toHaveLength(25)
    fireEvent.change(screen.getByLabelText('Search saved loadouts'), { target: { value: 'Wing Soldier' } }); expect(cards()).toHaveLength(25)
    fireEvent.change(screen.getByLabelText('Search saved loadouts'), { target: { value: 'No matching plan' } }); expect(withinPlanner(panel()).queryAllByRole('listitem', { name: /^Saved full loadout:/u })).toHaveLength(0)
    expect(panel().textContent).toContain('0 matching of 61 saved'); expect(writes).not.toHaveBeenCalled(); expect(onLoad).not.toHaveBeenCalled(); expect(localStorage.getItem(LOADOUT_KEY)).toBe(raw)
    await user.click(screen.getByText('Compare Full Plans', { exact: true })); await screen.findByLabelText('Full plan B')
    expect(withinPlanner(screen.getByLabelText('Full plan B')).getAllByRole('option')).toHaveLength(62)
  })
  it('clamps the last page after deletion and retains all off-page records', async () => {
    const base = createLoadout('Template', selection(), [], now, 'template')
    const records = Array.from({ length: 26 }, (_, index) => ({ ...base, id: `plan-${index}`, name: `Plan ${index}` }))
    localStorage.setItem(LOADOUT_KEY, JSON.stringify({ schemaVersion: 1, loadouts: records }))
    const user = userEvent.setup(); render(<FullBuildLoadouts selection={selection()} onLoad={vi.fn()} />); await open(user)
    await user.click(plannerRole('button', { name: 'Next loadout page' })); await user.click(withinPlanner(card('Plan 25')).getByRole('button', { name: 'Delete loadout' }))
    await user.click(plannerRole('button', { name: 'Confirm delete loadout' }))
    expect(card('Plan 0')).toBeDefined(); expect(withinPlanner(panel()).getAllByRole('listitem', { name: /^Saved full loadout:/u })).toHaveLength(25)
    expect(JSON.parse(localStorage.getItem(LOADOUT_KEY)!).loadouts).toEqual(records.slice(0, 25)); expect(document.activeElement).toBe(screen.getByLabelText('Loadout name'))
  })
})
