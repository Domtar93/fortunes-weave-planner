import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import SelectedWeapon from './SelectedWeapon'
import { growthData, STATS } from './growths'
import { weaponData, weaponFieldText, WEAPON_FIELDS, type WeaponFieldKey } from './forging'
import { createPreset, PRESET_KEY } from './presets'

const panel = () => plannerRole('region', { name: 'Main build selected weapon' })
const choice = () => withinPlanner(panel()).getByRole('combobox', { name: /^Weapon for / }) as HTMLSelectElement
const selected = (name: string) => withinPlanner(panel()).getByRole('region', { name: `${name} selected weapon reference` })
const compatibility = () => withinPlanner(panel()).getByRole('group', { name: 'Weapon class compatibility' })
const weapon = (name: string) => weaponData.records.find(record => record.name === name)!
const field = (name: string, key: WeaponFieldKey) => withinPlanner(selected(name)).getByText(WEAPON_FIELDS[key], { exact: true }).closest('div')!.querySelector('dd')!.textContent
const mainClass = () => plannerRole('combobox', { name: 'Class' })
async function open() {
  const user = userEvent.setup(), view = render(<App />)
  await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
  return { user, view }
}
async function select(user: ReturnType<typeof userEvent.setup>, name: string) { await user.selectOptions(choice(), weapon(name).id) }
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe('main build weapon planning', () => {
  it('shows Levin Sword’s source properties without modifying growths or calculating magical damage', async () => {
    const { user } = await open(), before = STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
    await select(user, 'Levin Sword')
    expect(field('Levin Sword', 'hit')).toBe('70'); expect(field('Levin Sword', 'might')).toBe('12-20')
    expect(field('Levin Sword', 'attackRange')).toBe('1-2'); expect(field('Levin Sword', 'weight')).toBe('8')
    expect(selected('Levin Sword').textContent).toContain('magical attack'); expect(selected('Levin Sword').textContent).toContain('Combat art: Lightning Strike')
    expect(selected('Levin Sword').textContent).toContain('Family classification: provisional')
    expect(withinPlanner(selected('Levin Sword')).getByRole('link', { name: 'Forging!A28:J28' }).getAttribute('href')).toContain('range=A28%3AJ28')
    expect(compatibility().textContent).toContain('Weapon family listed by class.')
    expect(compatibility().textContent).toContain('do not prove current weapon rank or equip legality')
    expect(STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)).toEqual(before)
  })
  it('retains Levin Sword across a class change and reports Archer’s not-listed context without hiding it', async () => {
    const { user } = await open(); await select(user, 'Levin Sword'); await selectMain(user, 'Class', 'Archer')
    expect(choice().value).toBe(weapon('Levin Sword').id)
    expect(compatibility().textContent).toContain('Weapon family not listed by class.')
    expect(compatibility().textContent).toContain('Archer: Bow, Battalions, Infantry')
    expect(withinPlanner(choice()).getAllByRole('option')).toHaveLength(92)
    await selectMain(user, 'Class', 'Gladiator'); expect(compatibility().textContent).toContain('Weapon family listed by class.')
  })
  it.each([['Pugilist', 'Wooden Gauntlets', 'Weapon family listed by class.'], ['Wing Soldier', 'War Bow', 'Weapon family not listed by class.']])('%s gives documented family context for %s', async (className, name, message) => {
    const { user } = await open(); await selectMain(user, 'Class', className); await select(user, name)
    expect(compatibility().textContent).toContain(message); expect(choice().value).toBe(weapon(name).id)
  })
  it('shows missing allowed-types data as unresolved using the same selected weapon component', async () => {
    const selectedClass = growthData.classes.find(record => record.name === 'Gladiator')!
    const user = userEvent.setup()
    render(<SelectedWeapon characterName="Alexandra" selectedClass={{ ...selectedClass, details: { ...selectedClass.details, allowedWeaponsAndSkills: { text: null, status: 'unknown', source: 'Classes!L4' } } }} weaponId={weapon('Levin Sword').id} onSelect={vi.fn()} onNavigateDungeon={vi.fn()} />)
    await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
    expect(compatibility().textContent).toContain('Compatibility not determined.'); expect(compatibility().textContent).toContain('Not documented')
  })
  it('offers all 91 canonical records and keeps filtered choices inspectable until explicitly cleared', async () => {
    const { user } = await open()
    expect(withinPlanner(choice()).getAllByRole('option')).toHaveLength(92)
    expect(withinPlanner(choice()).queryByRole('option', { name: 'Veronique' })).toBeNull()
    await select(user, 'Levin Sword')
    await user.selectOptions(withinPlanner(panel()).getByLabelText('Weapon family'), 'Bow')
    expect(choice().value).toBe(weapon('Levin Sword').id); expect(selected('Levin Sword')).toBeDefined()
    expect(withinPlanner(panel()).getByRole('status').textContent).toContain('outside these filters')
    const search = withinPlanner(panel()).getByLabelText('Search weapons') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'nonmatching name' } })
    expect(choice().value).toBe(weapon('Levin Sword').id)
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear weapon selection' }))
    expect(choice().value).toBe(''); expect(search.value).toBe('nonmatching name')
    expect((withinPlanner(panel()).getByRole('button', { name: 'Clear weapon selection' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it.each(['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus'])('keeps incomplete %s selectable with undocumented fields instead of zeros', async name => {
    const { user } = await open(); await select(user, name)
    expect(selected(name).textContent).toContain('Some combat stats are missing.')
    for (const key of ['hit', 'might', 'attackRange', 'weight', 'critical', 'durability', 'maxRefinement'] as WeaponFieldKey[]) expect(field(name, key)).toBe(weaponFieldText(weapon(name), key))
    expect(field(name, 'hit')).toBe('Not documented')
    expect(withinPlanner(selected(name)).getByText('No exact dungeon chest match documented.')).toBeDefined()
  })
  it('keeps valid numeric zero and source discrepancies visible without interpolating Might', async () => {
    const { user } = await open(); await select(user, 'Wooden Sword'); expect(field('Wooden Sword', 'critical')).toBe('0')
    await select(user, "Ursa's Right Claw"); expect(field("Ursa's Right Claw", 'maxRefinement')).toBe('0')
    await select(user, 'Zanbato')
    const evidence = withinPlanner(selected('Zanbato')).getByLabelText('Preliminary comparison Zanbato')
    expect(evidence.textContent).toContain('14-19'); expect(evidence.textContent).toContain('7-19')
    expect(evidence.textContent).toContain('numeric'); expect(evidence.textContent).toContain('Main values are retained')
    expect(selected('Zanbato').textContent).toContain('No progression formula')
  })
  it('shows Salamander’s two exact occurrences and keeps Levin Sword +3 unverified and noninteractive', async () => {
    const { user } = await open(); await select(user, 'Salamander')
    const sources = withinPlanner(selected('Salamander')).getByRole('region', { name: 'Documented Dungeon Sources' })
    expect(withinPlanner(sources).getAllByRole('button')).toHaveLength(2)
    expect(sources.textContent).toContain('Palace of Sand'); expect(sources.textContent).toContain('Southern Passage')
    await select(user, 'Levin Sword')
    expect(selected('Levin Sword').textContent).toContain('No exact dungeon chest match documented.')
    await user.click(withinPlanner(selected('Levin Sword')).getByText(/Possible refined-label references/))
    const candidates = withinPlanner(selected('Levin Sword')).getByText(/Possible refined-label references/).closest('details')!
    expect(candidates.textContent).toContain('Levin Sword +3'); expect(candidates.textContent).toContain('refinement unverified')
    expect(withinPlanner(candidates).queryByRole('button')).toBeNull()
  })
  it('navigates Muen to its exact chest and preserves selected weapon and existing dungeon filters', async () => {
    const { user } = await open(); await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    await screen.findByRole('list', { name: 'Dungeon location catalog' })
    const filter = screen.getByLabelText('Search dungeon or reward names') as HTMLInputElement
    fireEvent.change(filter, { target: { value: 'does not match' } })
    await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    await select(user, 'Muen')
    await user.click(withinPlanner(selected('Muen')).getByRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    const target = await screen.findByRole('cell', { name: 'Chest 1 · Part I · Muen' })
    await waitFor(() => expect(document.activeElement).toBe(target))
    expect(target.className).toContain('reward-navigation-target'); expect(filter.value).toBe('does not match')
    expect(choice().value).toBe(weapon('Muen').id)
    await user.click(withinPlanner(target).getByRole('button', { name: 'View weapon: Muen · Chest 1 · Part I' }))
    expect(await screen.findByRole('region', { name: 'Muen weapon details' })).toBeDefined()
    expect(choice().value).toBe(weapon('Muen').id)
  })
  it('keeps all character choices independent including both Mu profiles and resets on remount', async () => {
    const { user, view } = await open()
    const choices = [['Alexandra', 'Levin Sword'], ['Sofia', 'War Bow'], ['Mu', 'Muen'], ['Mu (with growth)', 'Salamander']]
    for (const [name, item] of choices) {
      await selectMain(user, 'Character', name); expect(choice().value).toBe(''); await select(user, item)
    }
    for (const [name, item] of choices) { await selectMain(user, 'Character', name); expect(choice().value).toBe(weapon(item).id) }
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear weapon selection' }))
    await selectMain(user, 'Character', 'Mu'); expect(choice().value).toBe(weapon('Muen').id)
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
    for (const [name] of choices) { await selectMain(user, 'Character', name); expect(choice().value).toBe('') }
  })
  it('keeps populated presets/storage and A/B calculations unchanged through selections and main preset loads', async () => {
    const preset = createPreset('Sofia Archer', { characterName: 'Sofia', className: 'Archer' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const { user } = await open(); await openPlannerPanel(user, 'Build Comparison')
    const comparisons = () => STATS.map(stat => `${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = comparisons(); await select(user, 'Levin Sword')
    await selectMain(user, 'Character', 'Sofia'); await select(user, 'War Bow'); await selectMain(user, 'Character', 'Alexandra')
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Sofia Archer' })).getByRole('button', { name: 'Load into Main planner' }))
    expect(choice().value).toBe(weapon('War Bow').id); expect((mainClass() as HTMLSelectElement).value).toBe('Archer')
    expect(comparisons()).toEqual(before)
    await selectMain(user, 'Character', 'Alexandra'); expect(choice().value).toBe(weapon('Levin Sword').id)
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
  })
  it('preserves shortlist records, filters, source return navigation and the existing Copy action', async () => {
    const { user } = await open(); await openPlannerPanel(user, 'Proficiency Progression')
    await user.click(plannerRole('button', { name: 'Add to shortlist: Haze Slice · Sword D' }))
    await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    const shortlist = plannerRole('region', { name: 'Ability planning shortlist' }), cards = () => shortlist.querySelectorAll<HTMLElement>('[data-source-record-id]')
    const originalId = cards()[0].dataset.sourceRecordId
    const search = screen.getByLabelText('Search ability names') as HTMLInputElement; fireEvent.change(search, { target: { value: 'hidden' } })
    await select(user, 'Zanbato'); await selectMain(user, 'Class', 'Archer')
    await user.click(withinPlanner(shortlist).getByRole('button', { name: 'View in Proficiency Progression: Haze Slice · Sword D' }))
    await user.click(plannerRole('button', { name: 'Return to Shortlist' })); await waitFor(() => expect(document.activeElement).toBe(cards()[0]))
    expect(cards()[0].dataset.sourceRecordId).toBe(originalId); expect(search.value).toBe('hidden'); expect(choice().value).toBe(weapon('Zanbato').id)
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await user.click(withinPlanner(shortlist).getByRole('button', { name: 'Copy Shortlist' }))
    expect(write.mock.calls[0][0]).toContain('1. Haze Slice'); expect(write.mock.calls[0][0]).not.toContain('Zanbato')
  })
})
