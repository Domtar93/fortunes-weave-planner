import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import MainBuildOverview from './MainBuildOverview'
import { selectMainBuildOverview } from './buildOverview'
import { growthData, STATS } from './growths'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { createPreset, PRESET_KEY } from './presets'

const panel = () => plannerRole('region', { name: 'Main build planning overview' })
const area = (name: string) => withinPlanner(panel()).getByRole('region', { name: `Overview ${name}` })
const names = () => [...withinPlanner(panel()).getByRole('list', { name: 'Overview ability order' }).querySelectorAll('li > strong')].map(node => node.textContent)
const chooseWeapon = (user: ReturnType<typeof userEvent.setup>, name: string) => user.selectOptions(screen.getByLabelText(/^Weapon for /), weaponData.records.find(value => value.name === name)!.id)
const chooseMount = (user: ReturnType<typeof userEvent.setup>, name: string) => user.selectOptions(screen.getByLabelText(/^Mount for /), mountId(mountData.records.find(value => value.name === name)!))
const chooseBattalion = (user: ReturnType<typeof userEvent.setup>, name: string) => user.selectOptions(screen.getByLabelText(/^Battalion for /), battalionData.records.find(value => value.name === name)!.id)
async function open() {
  const user = userEvent.setup(), view = render(<App />)
  expect(screen.getByText('Main Build Overview', { exact: true }).closest('details')?.open).toBe(false)
  await openPlannerPanel(user, 'Main Build Overview')
  return { user, view }
}
async function equipment(user: ReturnType<typeof userEvent.setup>) {
  for (const label of ['Selected Weapon', 'Selected Mount', 'Selected Battalion']) await openPlannerPanel(user, label)
  await screen.findByRole('region', { name: 'Main build selected battalion' })
}
async function add(user: ReturnType<typeof userEvent.setup>, profile: string, rank: string) {
  const entry = proficiencyData.categories.Sword.characters[profile === 'Mu (with growth)' ? 'Mu' : profile].find(value => value.rank === rank)!
  await user.click(plannerRole('button', { name: `Add to shortlist: ${entry.text} · Sword ${rank}` }))
  return entry.text
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear() })

describe('Main Build Overview', () => {
  it('shows the exact empty pairing, three missing selections and 0/8 with no editing controls', async () => {
    await open()
    expect(withinPlanner(panel()).getByRole('heading', { name: 'Alexandra × Gladiator' })).toBeDefined()
    expect(withinPlanner(panel()).getAllByText('Not selected.', { exact: true })).toHaveLength(3)
    expect(area('planned abilities').textContent).toContain('0/8'); expect(area('planned abilities').textContent).toContain('No abilities shortlisted.')
    expect(withinPlanner(panel()).getAllByRole('button').map(button => button.textContent)).toEqual(['Copy Build Overview', 'Download .txt']); expect(withinPlanner(panel()).queryAllByRole('combobox')).toHaveLength(0)
    expect(panel().textContent).toContain('Your current equipment and ability plan. Use Copy or Download to share it.')
    expect(panel().textContent).not.toContain('Build Valid')
  })
  it('shows Alexandra’s complete Wing Soldier example and class changes without affecting equipment or growths', async () => {
    const { user } = await open(); await equipment(user); await selectMain(user, 'Class', 'Wing Soldier')
    const growths = () => STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
    const before = growths()
    await chooseWeapon(user, 'Levin Sword'); await chooseMount(user, "Bucephalus (Alexandra's mount)"); await chooseBattalion(user, 'Bronze-Shield Guard')
    await openPlannerPanel(user, 'Proficiency Progression')
    for (const rank of ['D', 'C', 'B']) await add(user, 'Alexandra', rank)
    expect(withinPlanner(panel()).getByRole('heading', { name: 'Alexandra × Wing Soldier' })).toBeDefined()
    expect(area('weapon').textContent).toContain('Levin SwordSword'); expect(area('weapon').textContent).toContain('Weapon family listed by class.')
    expect(area('mount').textContent).toContain('Species: Pegasus'); expect(area('mount').textContent).toContain('Mount species matches')
    expect(area('battalion').textContent).toContain('Battalions not listed by this class.'); expect(area('battalion').textContent).toContain('Required Authority rank: E')
    expect(area('battalion').textContent).toContain('current Authority rank is not tracked')
    expect(area('planned abilities').textContent).toContain('3/8'); expect(names()).toEqual(['Haze Slice', 'Rend Armor', 'Gale Blow']); expect(growths()).toEqual(before)
    await selectMain(user, 'Class', 'Gladiator')
    expect(area('weapon').textContent).toContain('Weapon family listed by class.'); expect(area('mount').textContent).toContain('This class has no mount type listed.')
    expect(area('battalion').textContent).toContain('Battalions listed by this class.')
    expect(area('weapon').textContent).toContain('Levin Sword'); expect(area('mount').textContent).toContain("Bucephalus (Alexandra's mount)"); expect(area('battalion').textContent).toContain('Bronze-Shield Guard')
    expect(names()).toEqual(['Haze Slice', 'Rend Armor', 'Gale Blow'])
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%'); expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })
  it('shows Zanbato, Meganius and class disputes visibly without expanding another detail section', async () => {
    const { user } = await open(); await equipment(user)
    const before = STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
    await chooseWeapon(user, 'Zanbato'); await chooseMount(user, 'Meganius')
    expect(area('weapon').textContent).toContain('Documented Might: main 14-19; preliminary Zanbato 7-19')
    expect(area('weapon').textContent).toContain('Forging!C25 / Forging!C4')
    expect(area('mount').textContent).toContain('written and numeric growth entries differ')
    expect(area('mount').textContent).toContain('neither version is selected for calculations')
    expect(withinPlanner(panel()).getAllByRole('button').map(button => button.textContent)).toEqual(['Copy Build Overview', 'Download .txt'])
    expect(STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)).toEqual(before)
    await selectMain(user, 'Class', 'Armored Ornius Rider')
    expect(withinPlanner(panel()).getByRole('group', { name: 'Class source notes' }).textContent).toContain('DATA-12')
  })
  it('distinguishes listed, non-match, no-mount and unresolved information without eligibility labels', async () => {
    const { user } = await open(); await equipment(user); await chooseWeapon(user, 'Levin Sword'); await chooseMount(user, 'Wild Horse'); await chooseBattalion(user, 'Mage Pupils')
    await selectMain(user, 'Class', 'Archer'); expect(area('weapon').textContent).toContain('Weapon family not listed by class.')
    await selectMain(user, 'Class', 'Wing Soldier'); expect(area('mount').textContent).toContain('Mount species differs')
    expect(area('battalion').textContent).toContain('Battalions not listed')
    await selectMain(user, 'Class', 'Gladiator'); expect(area('mount').textContent).toContain('This class has no mount type listed.')
    expect(panel().textContent).not.toMatch(/\b(?:Equippable|Unequippable|Build Valid)\b/)
  })
  it('shows unresolved class evidence and source-incomplete weapons without filling values', async () => {
    const original = growthData.classes[0]
    const data = selectMainBuildOverview({ character: growthData.characters[0], selectedClass: { ...original, details: { ...original.details,
      allowedWeaponsAndSkills: { text: null, status: 'unknown', source: 'Classes!L3' }, mountType: { text: null, status: 'unknown', source: 'Classes!BA3' } } },
      weaponId: weaponData.records.find(value => value.name === 'Zerberus')!.id, mountId: 'Mounts!A14', battalionId: battalionData.records[0].id, entries: [] })
    render(<MainBuildOverview data={data} />); await openPlannerPanel(userEvent, 'Main Build Overview')
    expect(area('weapon').textContent).toContain('Compatibility not determined.'); expect(area('weapon').textContent).toContain('Incomplete source data')
    expect(area('mount').textContent).toContain('Mount compatibility not determined.'); expect(area('battalion').textContent).toContain('Battalion compatibility undetermined.')
  })
  it('updates each equipment change/clear immediately and remains live after collapse/reopen', async () => {
    const { user } = await open(); await equipment(user)
    await chooseWeapon(user, 'Whirlwind Blade'); expect(area('weapon').textContent).toContain('Incomplete source data')
    await chooseMount(user, 'Wild Pegasus'); expect(area('mount').textContent).toContain('Wild Pegasus')
    await chooseBattalion(user, 'Bai Ze Squad'); expect(area('battalion').textContent).toContain('Required Authority rank: A')
    await openPlannerPanel(user, 'Main Build Overview'); await chooseWeapon(user, 'Levin Sword')
    await openPlannerPanel(user, 'Main Build Overview'); expect(area('weapon').textContent).toContain('Levin Sword')
    for (const [label, region] of [['Clear weapon selection', 'weapon'], ['Clear mount selection', 'mount'], ['Clear battalion selection', 'battalion']]) {
      await user.click(plannerRole('button', { name: label })); expect(area(region).textContent).toContain('Not selected.')
    }
  })
  it('updates shortlist add, reorder, remove and confirmed clear while retaining source identities', async () => {
    const { user } = await open(); await openPlannerPanel(user, 'Proficiency Progression')
    await add(user, 'Alexandra', 'D'); await add(user, 'Alexandra', 'C'); await add(user, 'Alexandra', 'B')
    await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    const beforeIds = [...area('planned abilities').querySelectorAll<HTMLElement>('[data-overview-source-id]')].map(node => node.dataset.overviewSourceId)
    await user.click(plannerRole('button', { name: 'Move Gale Blow · Sword B up' })); expect(names()).toEqual(['Haze Slice', 'Gale Blow', 'Rend Armor'])
    expect([...area('planned abilities').querySelectorAll<HTMLElement>('[data-overview-source-id]')].map(node => node.dataset.overviewSourceId)).toEqual([beforeIds[0], beforeIds[2], beforeIds[1]])
    await user.click(withinPlanner(plannerRole('region', { name: 'Ability planning shortlist' })).getByRole('button', { name: 'Remove Haze Slice · Sword D from shortlist' })); expect(names()).toEqual(['Gale Blow', 'Rend Armor'])
    expect(area('planned abilities').textContent).toContain('2/8')
    await user.click(plannerRole('button', { name: 'Clear shortlist' })); await user.click(plannerRole('button', { name: 'Confirm clear shortlist' }))
    expect(area('planned abilities').textContent).toContain('0/8'); expect(area('planned abilities').textContent).toContain('No abilities shortlisted.')
  })
  it('retains separate same-name abilities with different source-backed rank identities', async () => {
    const first = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!
    const second = { ...resolvePlanningEntry('Alexandra', 'Sword', 'C', "'Sword'!C2")!, entry: { ...first.entry, rank: 'C', source: "'Sword'!C2" } }
    render(<MainBuildOverview data={selectMainBuildOverview({ character: growthData.characters[0], selectedClass: growthData.classes[0], entries: [first, second] })} />)
    await openPlannerPanel(userEvent, 'Main Build Overview')
    expect(names()).toEqual(['Haze Slice', 'Haze Slice']); expect(area('planned abilities').textContent).toContain('Sword · D'); expect(area('planned abilities').textContent).toContain('Sword · C')
  })
  // Keep both independence workflows below the unchanged 15-second UI budget.
  it.each([
    { label: 'Alexandra and Sofia', pairs: [['Alexandra', 'Levin Sword', "Bucephalus (Alexandra's mount)", 'Bronze-Shield Guard'], ['Sofia', 'War Bow', 'Wild Horse', 'Mage Pupils']] },
    { label: 'Mu and Mu (with growth)', pairs: [['Mu', 'Muen', 'Wild Ornius', 'Bai Ze Squad'], ['Mu (with growth)', 'Salamander', 'Wild Pegasus', 'Priest Trainees']] },
  ])('switches equipment and ability state correctly for $label', async ({ pairs }) => {
    const { user } = await open(); await equipment(user); await openPlannerPanel(user, 'Proficiency Progression')
    const abilities = new Map<string, string | null>()
    for (const [name, weapon, mount, battalion] of pairs) {
      await selectMain(user, 'Character', name); expect(area('planned abilities').textContent).toContain('0/8')
      await chooseWeapon(user, weapon); await chooseMount(user, mount); await chooseBattalion(user, battalion); abilities.set(name, await add(user, name, 'D'))
    }
    for (const [name, weapon, mount, battalion] of pairs) {
      await selectMain(user, 'Character', name)
      expect(withinPlanner(panel()).getByRole('heading', { name: `${name} × Gladiator` })).toBeDefined()
      expect(area('weapon').textContent).toContain(weapon); expect(area('mount').textContent).toContain(mount); expect(area('battalion').textContent).toContain(battalion)
      expect(names()).toEqual([abilities.get(name)]); expect(area('planned abilities').textContent).toContain('1/8')
    }
  })
  it('reflects main preset loads, preserves per-profile session choices and leaves storage and A/B untouched', async () => {
    const preset = createPreset('Sofia Archer', { characterName: 'Sofia', className: 'Archer' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const { user } = await open(); await equipment(user); await openPlannerPanel(user, 'Build Comparison')
    const comparisons = () => STATS.map(stat => `${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = comparisons(); await chooseWeapon(user, 'Levin Sword'); await chooseMount(user, 'Wild Pegasus'); await chooseBattalion(user, 'Bronze-Shield Guard')
    await selectMain(user, 'Character', 'Sofia'); await chooseWeapon(user, 'War Bow'); await chooseMount(user, 'Wild Horse'); await chooseBattalion(user, 'Mage Pupils')
    await selectMain(user, 'Character', 'Alexandra'); await openPlannerPanel(user, 'My Character Builds')
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Sofia Archer' })).getByRole('button', { name: 'Load into Main planner' }))
    expect(withinPlanner(panel()).getByRole('heading', { name: 'Sofia × Archer' })).toBeDefined()
    expect(area('weapon').textContent).toContain('War Bow'); expect(area('weapon').textContent).toContain('Weapon family listed by class.')
    expect(area('mount').textContent).toContain('Wild Horse'); expect(area('mount').textContent).toContain('This class has no mount type listed.')
    expect(area('battalion').textContent).toContain('Mage Pupils'); expect(comparisons()).toEqual(before)
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
  })
  it('resets session choices/abilities on remount while preserving an existing preset payload', async () => {
    const preset = createPreset('Existing', { characterName: 'Alexandra', className: 'Wing Soldier' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload)
    const { user, view } = await open(); await equipment(user); await chooseWeapon(user, 'Zanbato'); await chooseMount(user, 'Meganius'); await chooseBattalion(user, 'Mage Pupils')
    await openPlannerPanel(user, 'Proficiency Progression'); await add(user, 'Alexandra', 'D')
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Main Build Overview')
    expect(withinPlanner(panel()).getAllByText('Not selected.', { exact: true })).toHaveLength(3)
    expect(area('planned abilities').textContent).toContain('0/8'); expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
  })
})
