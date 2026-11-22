import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import SelectedBattalion from './SelectedBattalion'
import BattalionBrowser from './BattalionBrowser'
import { battalionData } from './battalions'
import { growthData, STATS } from './growths'
import { weaponData } from './forging'
import { createPreset, PRESET_KEY } from './presets'

const panel = () => plannerRole('region', { name: 'Main build selected battalion' })
const choice = () => withinPlanner(panel()).getByRole('combobox', { name: /^Battalion for / }) as HTMLSelectElement
const selected = (name: string) => withinPlanner(panel()).getByRole('region', { name: `${name} selected battalion reference` })
const record = (name: string) => battalionData.records.find(value => value.name === name)!
const character = () => plannerRole('combobox', { name: 'Character' })
const mainClass = () => plannerRole('combobox', { name: 'Class' })
const catalog = () => plannerRole('list', { name: 'Battalion catalog' })
const support = () => withinPlanner(panel()).getByRole('group', { name: 'Battalion class compatibility' })
async function open() {
  const user = userEvent.setup(), view = render(<App />)
  expect(screen.getByText('Selected Battalion', { exact: true }).closest('details')?.open).toBe(false)
  await openPlannerPanel(user, 'Selected Battalion')
  await screen.findByRole('region', { name: 'Main build selected battalion' })
  return { user, view }
}
async function select(user: ReturnType<typeof userEvent.setup>, name: string) { await user.selectOptions(choice(), record(name).id) }
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe('main build selected battalion', () => {
  it.each([
    ['Bronze-Shield Guard', 'Defense', 'E', '8', 'Tri-Front Formation', [['Defense (Def)', '+2'], ['Charm (Cha)', '+3']]],
    ['Mage Pupils', 'Magical', 'E', '8', 'Scattered Flames', [['Magic (Mag)', '+2'], ['Charm (Cha)', '+2']]],
    ['Bai Ze Squad', 'Support', 'A', '22', 'Column Recovery+', [['Magic (Mag)', '+3'], ['Resistance (Res)', '+3'], ['Luck (Lck)', '+2'], ['Charm (Cha)', '+8']]],
  ])('shows %s through the shared source detail view', async (name, category, rank, gather, ability, stats) => {
    const { user } = await open(); await select(user, name as string)
    const view = selected(name as string), original = record(name as string)
    for (const [label, text] of [['Category', category], ['Required Authority rank', rank], ['Gather limit', gather], ['Listed ability / gambit name', ability]]) {
      expect(withinPlanner(view).getByRole('group', { name: label as string }).querySelector('.recorded-text')?.textContent).toBe(text)
    }
    for (const [label, text] of stats as string[][]) expect(withinPlanner(view).getByText(label).closest('div')?.querySelector('dd')?.textContent).toBe(text)
    expect(withinPlanner(view).getByRole('group', { name: 'Acquisition information' }).querySelector('.recorded-text')?.textContent).toBe(original.acquisition.text)
    expect(withinPlanner(view).getByRole('group', { name: 'Flat stat bonuses' }).querySelector('.recorded-text')?.textContent).toBe(original.flatStatText.text)
    const modifiers = withinPlanner(view).getByRole('group', { name: 'Parsed flat stat modifiers' })
    expect(modifiers.querySelectorAll('dd')).toHaveLength(9); expect(modifiers.textContent).not.toContain('%')
    expect(modifiers.querySelector('dd')?.textContent).toBe('Not listed')
    const source = `${original.source.sheet}!${original.source.range}`
    expect(withinPlanner(view).getByRole('link', { name: source }).getAttribute('href')).toContain(`range=${encodeURIComponent(original.source.range)}`)
    expect(view.textContent).toContain('Unverified')
    expect(withinPlanner(view).getByRole('link', {name: source}).closest('details')?.open).toBe(false)
  })
  it('offers all 69 for mounted classes, retains filtered choice and clears without changing filters', async () => {
    const { user } = await open()
    expect((withinPlanner(panel()).getByRole('button', { name: 'Clear battalion selection' }) as HTMLButtonElement).disabled).toBe(true)
    await selectMain(user, 'Class', 'Ornius Rider'); expect(choice().options.length).toBe(70)
    await select(user, 'Bai Ze Squad')
    await user.selectOptions(screen.getByLabelText('Battalion category'), 'Defense')
    fireEvent.change(screen.getByLabelText('Search battalions'), { target: { value: 'bronze' } })
    expect(choice().value).toBe(record('Bai Ze Squad').id); expect(selected('Bai Ze Squad')).toBeDefined()
    expect(withinPlanner(choice()).getAllByRole('option')).toHaveLength(3)
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear battalion selection' }))
    expect(choice().value).toBe(''); expect((screen.getByLabelText('Search battalions') as HTMLInputElement).value).toBe('bronze')
    expect((screen.getByLabelText('Battalion category') as HTMLSelectElement).value).toBe('Defense')
    await user.selectOptions(screen.getByLabelText('Battalion category'), 'all')
    fireEvent.change(screen.getByLabelText('Search battalions'), { target: { value: '' } })
    expect(choice().options.length).toBe(70)
  })
  it('updates column L context across classes without replacing the battalion or inventing training rank', async () => {
    const { user } = await open(); await select(user, 'Bai Ze Squad')
    for (const [name, message] of [['Gladiator', 'Battalions listed by this class.'], ['Ornius Rider', 'Battalions not listed by this class.'], ['Light Cavalry', 'Battalions not listed by this class.'], ['Commoner / Noble', 'Battalions listed by this class.']]) {
      await selectMain(user, 'Class', name)
      expect(support().textContent).toContain(message); expect(choice().value).toBe(record('Bai Ze Squad').id)
      expect(choice().options.length).toBe(70)
    }
    expect(support().textContent).toContain('not Alexandra’s current rank')
    expect(support().textContent).toContain('Individual Authority training is not tracked')
    expect(support().textContent).toContain('Dismounting permission is not established')
    expect(support().textContent).not.toContain('Fully equippable')
  })
  it('shows unknown class evidence and stale selections without replacements', async () => {
    const profile = growthData.classes[0], onSelect = vi.fn()
    render(<SelectedBattalion characterName="Alexandra" selectedClass={{ ...profile, details: { ...profile.details, allowedWeaponsAndSkills: { text: null, status: 'unknown', source: 'Classes!L3' } } }} battalionId="stale" onSelect={onSelect} onNavigateCatalog={vi.fn()} />)
    await openPlannerPanel(userEvent, 'Selected Battalion'); await screen.findByRole('region', { name: 'Main build selected battalion' })
    expect(support().textContent).toContain('Battalion compatibility undetermined.')
    expect(panel().textContent).toContain('No replacement was selected'); expect(choice().value).toBe(''); expect(onSelect).not.toHaveBeenCalled()
  })
  it('keeps Alexandra, Sofia and both Mu profiles independent and resets all choices on remount', async () => {
    const { user, view } = await open()
    const pairs = [['Alexandra', 'Bronze-Shield Guard'], ['Sofia', 'Mage Pupils'], ['Mu', 'Bai Ze Squad'], ['Mu (with growth)', 'Priest Trainees']]
    for (const [name, battalion] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe(''); await select(user, battalion) }
    for (const [name, battalion] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe(record(battalion).id) }
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear battalion selection' }))
    await selectMain(user, 'Character', 'Mu'); expect(choice().value).toBe(record('Bai Ze Squad').id)
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Selected Battalion'); await screen.findByRole('region', { name: 'Main build selected battalion' })
    for (const [name] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe('') }
  })
  it('reveals exact source ID outside all retained catalog filters, focuses the heading and never duplicates it', async () => {
    const { user } = await open(); await select(user, 'Bai Ze Squad')
    await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
    const weaponChoice = screen.getByLabelText('Weapon for Alexandra') as HTMLSelectElement
    await user.selectOptions(weaponChoice, weaponData.records.find(value => value.name === 'Levin Sword')!.id)
    await selectMain(user, 'Class', 'Ornius Rider')
    await openPlannerPanel(user, 'Battalions & Gambits')
    await user.click(withinPlanner(plannerRole('group', { name: 'Battalion categories' })).getByRole('button', { name: 'Defense' }))
    fireEvent.change(screen.getByLabelText('Search battalion names'), { target: { value: 'hidden target' } })
    await user.selectOptions(screen.getByLabelText('Required Authority rank (catalog)'), 'E')
    await user.click(screen.getByLabelText('Only show when class lists battalions'))
    await openPlannerPanel(user, 'Battalions & Gambits')
    const weaponBefore = weaponChoice.value
    for (let index = 0; index < 2; index++) {
      await user.click(withinPlanner(panel()).getByRole('button', { name: 'View in Battalions & Gambits' }))
      const target = await screen.findByRole('region', { name: 'Bai Ze Squad battalion details' })
      const heading = withinPlanner(target).getByRole('heading', { name: 'Bai Ze Squad' })
      await waitFor(() => expect(document.activeElement).toBe(heading))
      expect(screen.getByText('Battalions & Gambits', { exact: true }).closest('details')?.open).toBe(true)
      expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
      expect(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Bai Ze Squad' }).getAttribute('aria-pressed')).toBe('true')
      expect(target.textContent).toContain(record('Bai Ze Squad').acquisition.text)
    }
    expect((screen.getByLabelText('Search battalion names') as HTMLInputElement).value).toBe('hidden target')
    expect((screen.getByLabelText('Required Authority rank (catalog)') as HTMLSelectElement).value).toBe('E')
    expect((screen.getByLabelText('Only show when class lists battalions') as HTMLInputElement).checked).toBe(true)
    expect((character() as HTMLSelectElement).value).toBe('Alexandra'); expect((mainClass() as HTMLSelectElement).value).toBe('Ornius Rider')
    expect(weaponChoice.value).toBe(weaponBefore); expect(choice().value).toBe(record('Bai Ze Squad').id)
    expect(screen.getByText(/temporarily revealed outside the retained filters/)).toBeDefined()
  })
  it('ignores stale catalog navigation without destroying existing inspection', async () => {
    render(<BattalionBrowser character={growthData.characters[0]} selectedClass={growthData.classes[0]} navigation={{ id: 'stale', sequence: 1 }} />)
    await openPlannerPanel(userEvent, 'Battalions & Gambits')
    expect(plannerRole('region', { name: 'Bronze-Shield Guard battalion details' })).toBeDefined()
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(69)
  })
  it('does not write storage or change named presets, comparisons, growths or independent weapons', async () => {
    const preset = createPreset('Sofia Archer', { characterName: 'Sofia', className: 'Archer' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const { user } = await open(); await openPlannerPanel(user, 'Build Comparison')
    const outputs = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = outputs(); await select(user, 'Bronze-Shield Guard'); expect(outputs()).toEqual(before)
    await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
    const weaponChoice = () => screen.getByLabelText(/^Weapon for /) as HTMLSelectElement
    const alexandraWeapon = weaponData.records[0].id, sofiaWeapon = weaponData.records[1].id
    await user.selectOptions(weaponChoice(), alexandraWeapon)
    await selectMain(user, 'Character', 'Sofia'); await select(user, 'Mage Pupils'); await user.selectOptions(weaponChoice(), sofiaWeapon)
    await selectMain(user, 'Character', 'Alexandra'); expect(weaponChoice().value).toBe(alexandraWeapon); expect(choice().value).toBe(record('Bronze-Shield Guard').id)
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Sofia Archer' })).getByRole('button', { name: 'Load into Main planner' }))
    expect(choice().value).toBe(record('Mage Pupils').id); expect(weaponChoice().value).toBe(sofiaWeapon); expect((mainClass() as HTMLSelectElement).value).toBe('Archer')
    const after = outputs(); expect(after.map(value => value.split('/').slice(1))).toEqual(before.map(value => value.split('/').slice(1)))
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
  })
  it('preserves shortlist source/return, ordering, filters, Copy and TXT output through battalion selection', async () => {
    const { user } = await open(); await openPlannerPanel(user, 'Proficiency Progression')
    await user.click(plannerRole('button', { name: 'Add to shortlist: Haze Slice · Sword D' }))
    await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    const shortlist = plannerRole('region', { name: 'Ability planning shortlist' })
    const cards = () => shortlist.querySelectorAll<HTMLElement>('[data-source-record-id]')
    const beforeId = cards()[0].dataset.sourceRecordId
    fireEvent.change(screen.getByLabelText('Search ability names'), { target: { value: 'hidden' } })
    await select(user, 'Bronze-Shield Guard')
    await user.click(withinPlanner(shortlist).getByRole('button', { name: 'View in Proficiency Progression: Haze Slice · Sword D' }))
    await user.click(plannerRole('button', { name: 'Return to Shortlist' })); await waitFor(() => expect(document.activeElement).toBe(cards()[0]))
    expect(cards()[0].dataset.sourceRecordId).toBe(beforeId); expect(cards()).toHaveLength(1)
    expect((screen.getByLabelText('Search ability names') as HTMLInputElement).value).toBe('hidden')
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await user.click(withinPlanner(shortlist).getByRole('button', { name: 'Copy Shortlist' }))
    let downloaded: Blob | undefined
    vi.stubGlobal('URL', class extends URL { static createObjectURL(blob: Blob) { downloaded = blob; return 'blob:test' } static revokeObjectURL = vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      await user.click(withinPlanner(shortlist).getByRole('button', { name: 'Download .txt' }))
      const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(downloaded!) })
      expect(text).toBe(write.mock.calls[0][0]); expect(text).toContain('1. Haze Slice'); expect(text).not.toContain('Bronze-Shield Guard')
      expect(choice().value).toBe(record('Bronze-Shield Guard').id)
    } finally { vi.unstubAllGlobals() }
  })
})
