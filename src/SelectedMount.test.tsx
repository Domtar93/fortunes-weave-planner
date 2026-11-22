import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import SelectedMount from './SelectedMount'
import MountBrowser from './MountBrowser'
import { growthData, STATS } from './growths'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { createPreset, PRESET_KEY } from './presets'
import { weaponData } from './forging'
import { battalionData } from './battalions'

const panel = () => plannerRole('region', { name: 'Main build selected mount' })
const choice = () => withinPlanner(panel()).getByRole('combobox', { name: /^Mount for / }) as HTMLSelectElement
const selected = (name: string) => withinPlanner(panel()).getByRole('region', { name: `${name} selected mount reference` })
const mount = (name: string) => mountData.records.find(record => record.name === name)!
const character = () => plannerRole('combobox', { name: 'Character' })
const mainClass = () => plannerRole('combobox', { name: 'Class' })
const compatibility = () => withinPlanner(panel()).getByRole('group', { name: 'Selected mount class compatibility' })
const catalog = () => plannerRole('list', { name: 'Mount catalog' })
const bucephalus = "Bucephalus (Alexandra's mount)"
async function open() {
  const user = userEvent.setup(), view = render(<App />)
  expect(screen.getByText('Selected Mount', { exact: true }).closest('details')?.open).toBe(false)
  await openPlannerPanel(user, 'Selected Mount'); await screen.findByRole('region', { name: 'Main build selected mount' })
  return { user, view }
}
async function select(user: ReturnType<typeof userEvent.setup>, name: string) { await user.selectOptions(choice(), mountId(mount(name))) }
const raw = (name: string, label: string) => withinPlanner(selected(name)).getByRole('group', { name: label }).querySelector('.recorded-text')?.textContent
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe('main build mount selection', () => {
  it('starts empty without automatically granting a character’s mount and offers all 22 records', async () => {
    await open()
    expect(choice().value).toBe(''); expect(choice().options).toHaveLength(23)
    expect((withinPlanner(panel()).getByRole('button', { name: 'Clear mount selection' }) as HTMLButtonElement).disabled).toBe(true)
    expect(panel().textContent).toContain('Choose a mount to see its growths, abilities and locations.')
    expect(withinPlanner(panel()).queryByRole('button', { name: 'View in Mount Reference' })).toBeNull()
  })
  it('shows Wild Pegasus’s separate written and numeric evidence, sources, abilities and original total', async () => {
    const { user } = await open(); await select(user, 'Wild Pegasus')
    const original = mount('Wild Pegasus'), detail = selected(original.name)
    expect(raw(original.name, 'Flat stat modifiers (points, source text)')).toBe(original.flatStatText.text)
    expect(raw(original.name, 'Written growth modifiers (%)')).toBe(original.growthText.text)
    expect(original.parsed.flatStats.values).toMatchObject({ Spd: 3, Res: 2 })
    expect(original.parsed.growths.values).toMatchObject({ Spd: 15, Res: 10 })
    expect(raw(original.name, 'Listed ability names')).toBe(original.abilities.text)
    expect(raw(original.name, 'Acquisition locations & recorded route/story conditions')).toBe(original.acquisition.text)
    const table = withinPlanner(detail).getByRole('table', { name: 'Wild Pegasus written versus numeric growth modifiers' })
    expect(table.querySelectorAll('tbody tr')).toHaveLength(9)
    expect(withinPlanner(table).getByText('Speed (Spd)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('+15%')
    expect(withinPlanner(table).getByText('Resistance (Res)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('+10%')
    expect(withinPlanner(detail).getByRole('link', { name: 'Mounts!A14:Q14' }).getAttribute('href')).toContain('range=A14%3AQ14')
    expect(detail.textContent).toContain(original.totalGrowth.formula); expect(detail.textContent).toContain('Original formula retained')
    expect(detail.textContent).toContain('Unverified'); expect(detail.textContent).toContain('Listed abilities may be alternatives')
  })
  it('preserves Meganius’s raw flat text and three written/numeric disagreements visibly', async () => {
    const { user } = await open(); await select(user, 'Meganius')
    expect(raw('Meganius', 'Flat stat modifiers (points, source text)')).toBe(mount('Meganius').flatStatText.text)
    expect(raw('Meganius', 'Written growth modifiers (%)')).toBe('Str 5%, Def 15%, Dex 5% ')
    const table = withinPlanner(selected('Meganius')).getByRole('table')
    for (const [stat, written, numeric] of [['Dexterity (Dex)', '+5%', '+15%'], ['Defense (Def)', '+15%', 'Not listed'], ['Resistance (Res)', 'Not listed', '+5%']]) {
      const row = withinPlanner(table).getByText(stat).closest('tr')!
      expect(row.className).toBe('growth-conflict')
      expect(row.querySelectorAll('td')[0].textContent).toContain(written); expect(row.querySelectorAll('td')[1].textContent).toContain(numeric)
    }
    expect(selected('Meganius').textContent).toContain('neither version is selected for calculations')
  })
  it.each([bucephalus, "Bucephalus's Foal", "Rocinan (Io's mount)", "Rocinan's Brother", 'Saramis War Elephant'])('retains %s as a distinct source record', async name => {
    const { user } = await open(); await select(user, name)
    expect(choice().value).toBe(mountId(mount(name)))
    expect(raw(name, 'Acquisition locations & recorded route/story conditions')).toBe(mount(name).acquisition.text)
    expect(raw(name, 'Flat stat modifiers (points, source text)')).toBe(mount(name).flatStatText.text)
    expect(raw(name, 'Written growth modifiers (%)')).toBe(mount(name).growthText.text)
    if (name === 'Saramis War Elephant') {
      expect(selected(name).textContent).toContain("Part III Quest (may require Cai's path completed)")
      expect(selected(name).textContent).toContain('uncertainty qualifier')
    }
  })
  it('never assigns independent column G notes or sheet annotations as listed abilities', async () => {
    const { user } = await open(); await select(user, 'White Ornius')
    expect(raw('White Ornius', 'Listed ability names')).toBe('Paired Purify, Paired Healing')
    expect(raw('White Ornius', 'Independent community reference notes (column G)')).toBe('Paired Alertness - Grants Ddg +5/10 ')
    expect(raw('White Ornius', 'Listed ability names')).not.toContain('Alertness')
    expect(selected('White Ornius').textContent).toContain('not assigned as an effect')
  })
  it('keeps zero, missing, negative numeric evidence, raw text and numeric totals distinct', async () => {
    const original = mount('Wild Pegasus'), saved = { ...original }
    original.numericGrowths = { ...original.numericGrowths, HP: { value: 0, status: 'unverified', source: 'Mounts!H14' }, Mag: { value: -5, status: 'unverified', source: 'Mounts!J14' } }
    original.totalGrowth = { value: 0, formula: null, status: 'unverified', source: 'Mounts!Q14' }
    try {
      const { user } = await open(); await select(user, original.name)
      const table = withinPlanner(selected(original.name)).getByRole('table')
      const hp = withinPlanner(table).getByText('Health (HP)').closest('tr')!.querySelectorAll('td')
      expect(hp[0].textContent).toContain('Not listed'); expect(hp[1].textContent).toContain('0%')
      expect(withinPlanner(table).getByText('Magic (Mag)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('-5%')
      expect(withinPlanner(table).getByText('Strength (Str)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('Not listed')
      expect(selected(original.name).textContent).toContain('Source total (Mounts!Q14): 0%')
      expect(raw(original.name, 'Written growth modifiers (%)')).toBe(saved.growthText.text)
    } finally { Object.assign(original, saved) }
  })
  it('filters all species, retains an out-of-filter choice, and clears only selection', async () => {
    const { user } = await open()
    for (const [species, count] of [['Ornius', 6], ['Horse', 6], ['Pegasus', 6], ['Bau', 3], ['Elephant', 1]] as const) {
      await user.selectOptions(screen.getByLabelText('Mount species'), species); expect(choice().options).toHaveLength(count + 1)
    }
    await user.selectOptions(screen.getByLabelText('Mount species'), 'all'); await select(user, bucephalus)
    await user.selectOptions(screen.getByLabelText('Mount species'), 'Horse')
    fireEvent.change(screen.getByLabelText('Search mounts'), { target: { value: 'wild' } })
    expect(choice().options).toHaveLength(3); expect(choice().value).toBe('Mounts!A18'); expect(selected(bucephalus)).toBeDefined()
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear mount selection' })); expect(choice().value).toBe('')
    expect((screen.getByLabelText('Search mounts') as HTMLInputElement).value).toBe('wild')
    expect((screen.getByLabelText('Mount species') as HTMLSelectElement).value).toBe('Horse')
  })
  it('updates every required class outcome immediately and retains the selected mount on class changes', async () => {
    const { user } = await open()
    for (const [className, name, phrase] of [['Wing Soldier', 'Wild Pegasus', 'matches'], ['Wing Soldier', 'Wild Horse', 'differs from'], ['Ornius Rider', 'Wild Ornius', 'matches'], ['Dragoon', 'Wild Bau', 'matches'], ['Elephant Rider', 'Saramis War Elephant', 'matches']]) {
      await select(user, name); await selectMain(user, 'Class', className)
      expect(compatibility().textContent).toContain(`Mount species ${phrase} the class's documented mount type.`)
      expect(choice().value).toBe(mountId(mount(name))); expect(choice().options).toHaveLength(23)
    }
    await select(user, 'Wild Horse'); await selectMain(user, 'Class', 'Gladiator')
    expect(choice().value).toBe('Mounts!A8'); expect(compatibility().textContent).toContain('This class has no mount type listed.')
    expect(compatibility().textContent).toContain('equip legality, ownership and acquisition eligibility are unverified')
    expect(compatibility().textContent).toContain('Classes!BA4')
  })
  it('shows unknown class evidence and stale selection without automatic replacement', async () => {
    const profile = growthData.classes[0], onSelect = vi.fn()
    const props = { characterName: 'Alexandra', selectedClass: { ...profile, details: { ...profile.details, mountType: { text: null, status: 'unknown' as const, source: 'Classes!BA3' } } }, onSelect, onNavigateCatalog: vi.fn() }
    const view = render(<SelectedMount {...props} selectedMountId="Mounts!A14" />)
    await openPlannerPanel(userEvent, 'Selected Mount'); await screen.findByRole('region', { name: 'Main build selected mount' })
    expect(compatibility().textContent).toContain('Mount compatibility not determined.')
    view.rerender(<SelectedMount {...props} selectedMountId="stale" />)
    expect(choice().value).toBe(''); expect(panel().textContent).toContain('No replacement was selected'); expect(onSelect).not.toHaveBeenCalled()
  })
  it('restores independent Alexandra/Sofia/Mu choices and clears them on a fresh mount', async () => {
    const { user, view } = await open()
    const pairs = [['Alexandra', bucephalus], ['Sofia', 'Wild Horse'], ['Mu', 'Wild Ornius'], ['Mu (with growth)', 'Wild Pegasus']]
    for (const [name, mountName] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe(''); await select(user, mountName) }
    for (const [name, mountName] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe(mountId(mount(mountName))) }
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear mount selection' }))
    await selectMain(user, 'Character', 'Mu'); expect(choice().value).toBe('Mounts!A2')
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Selected Mount'); await screen.findByRole('region', { name: 'Main build selected mount' })
    for (const [name] of pairs) { await selectMain(user, 'Character', name); expect(choice().value).toBe('') }
  })
  it('reveals the exact source-ID catalog record through retained filters, focuses and repeats without duplicates', async () => {
    const { user } = await open(); await select(user, bucephalus)
    await selectMain(user, 'Class', 'Wing Soldier')
    await openPlannerPanel(user, 'Selected Weapon'); await screen.findByRole('region', { name: 'Main build selected weapon' })
    await user.selectOptions(screen.getByLabelText('Weapon for Alexandra'), weaponData.records[0].id)
    await openPlannerPanel(user, 'Selected Battalion'); await screen.findByRole('region', { name: 'Main build selected battalion' })
    await user.selectOptions(screen.getByLabelText('Battalion for Alexandra'), battalionData.records[0].id)
    await openPlannerPanel(user, 'Mounts & Compatibility')
    await user.click(withinPlanner(plannerRole('group', { name: 'Mount species filters' })).getByRole('button', { name: 'Horse' }))
    fireEvent.change(screen.getByLabelText('Search mount names'), { target: { value: 'hidden target' } })
    await openPlannerPanel(user, 'Mounts & Compatibility')
    for (let index = 0; index < 2; index++) {
      await user.click(withinPlanner(panel()).getByRole('button', { name: 'View in Mount Reference' }))
      const detail = await screen.findByRole('region', { name: `${bucephalus} mount details` })
      await waitFor(() => expect(document.activeElement).toBe(withinPlanner(detail).getByRole('heading', { name: bucephalus })))
      expect(screen.getByText('Mounts & Compatibility', { exact: true }).closest('details')?.open).toBe(true)
      expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
      expect(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${bucephalus}` }).getAttribute('aria-pressed')).toBe('true')
      expect(detail.textContent).toContain('Recruit Alexandra'); expect(detail.textContent).toContain('Mounts!A18:Q18')
    }
    expect((screen.getByLabelText('Search mount names') as HTMLInputElement).value).toBe('hidden target')
    expect(withinPlanner(plannerRole('group', { name: 'Mount species filters' })).getByRole('button', { name: 'Horse' }).getAttribute('aria-pressed')).toBe('true')
    expect((character() as HTMLSelectElement).value).toBe('Alexandra'); expect((mainClass() as HTMLSelectElement).value).toBe('Wing Soldier')
    expect((screen.getByLabelText('Weapon for Alexandra') as HTMLSelectElement).value).toBe(weaponData.records[0].id)
    expect((screen.getByLabelText('Battalion for Alexandra') as HTMLSelectElement).value).toBe(battalionData.records[0].id)
    expect(choice().value).toBe('Mounts!A18'); expect(screen.getByText(/temporarily revealed outside the retained filters/)).toBeDefined()
  })
  it('ignores invalid catalog requests without replacing the current reference', async () => {
    render(<MountBrowser character={growthData.characters[0]} selectedClass={growthData.classes[0]} navigation={{ id: 'stale', sequence: 1 }} />)
    await userEvent.click(screen.getByText('Mounts & Compatibility', { exact: true }))
    expect(plannerRole('region', { name: 'Wild Ornius mount details' })).toBeDefined(); expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(22)
  })
  it('leaves populated presets, source data, all growths/A-B, flat class bonuses and other selections unchanged', async () => {
    const preset = createPreset('Sofia Archer', { characterName: 'Sofia', className: 'Archer' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const dataBefore = JSON.stringify({ growthData, weaponData, battalionData, mountData })
    const { user } = await open(); await openPlannerPanel(user, 'Build Comparison')
    const outputs = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = outputs(); await select(user, 'Meganius'); expect(outputs()).toEqual(before)
    await selectMain(user, 'Character', 'Sofia'); await select(user, 'Wild Horse'); await selectMain(user, 'Character', 'Alexandra')
    expect(choice().value).toBe('Mounts!A4')
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Sofia Archer' })).getByRole('button', { name: 'Load into Main planner' }))
    expect(choice().value).toBe('Mounts!A8'); expect((mainClass() as HTMLSelectElement).value).toBe('Archer')
    expect(outputs().map(value => value.split('/').slice(1))).toEqual(before.map(value => value.split('/').slice(1)))
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
    expect(JSON.stringify({ growthData, weaponData, battalionData, mountData })).toBe(dataBefore)
  })
})
