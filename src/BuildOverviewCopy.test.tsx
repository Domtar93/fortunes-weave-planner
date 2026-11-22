import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import BuildOverviewCopy from './BuildOverviewCopy'
import * as growths from './growths'
import { growthData, STATS } from './growths'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { selectMainBuildOverview } from './buildOverview'
import { formatBuildOverviewText } from './buildOverviewText'
import { createPreset, PRESET_KEY } from './presets'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const clipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
const character = (name = 'Alexandra') => growthData.characters.find(value => value.name === name)!
const profile = (name = 'Wing Soldier') => growthData.classes.find(value => value.name === name)!
const plan = (name: string, rank: string) => resolvePlanningEntry(name, 'Sword', rank, proficiencyData.categories.Sword.characters[name === 'Mu (with growth)' ? 'Mu' : name].find(entry => entry.rank === rank)!.source)!
const example = (name = 'Alexandra', className = 'Wing Soldier') => selectMainBuildOverview({ character: character(name), selectedClass: profile(className),
  weaponId: weaponData.records.find(value => value.name === 'Levin Sword')!.id, mountId: mountId(mountData.records.find(value => value.name === "Bucephalus (Alexandra's mount)")!), battalionId: battalionData.records[0].id,
  entries: [plan(name, 'D'), plan(name, 'C'), plan(name, 'B')] })
const area = () => plannerRole('group', { name: 'Copy main build overview' })
const copy = () => withinPlanner(area()).getByRole('button', { name: 'Copy Build Overview' })
const overview = () => plannerRole('region', { name: 'Main build planning overview' })
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard); else Reflect.deleteProperty(navigator, 'clipboard')
})
async function app() {
  const user = userEvent.setup(), view = render(<App />)
  await openPlannerPanel(user, 'Main Build Overview')
  return { user, view }
}
async function equipment(user: ReturnType<typeof userEvent.setup>) {
  for (const label of ['Selected Weapon', 'Selected Mount', 'Selected Battalion']) await openPlannerPanel(user, label)
  await screen.findByRole('region', { name: 'Main build selected battalion' })
}
async function add(user: ReturnType<typeof userEvent.setup>, name: string, rank: string) {
  await user.click(plannerRole('button', { name: `Add to shortlist: ${plan(name, rank).entry.text} · Sword ${rank}` }))
}

describe('Copy Build Overview', () => {
  it('supports keyboard copying and confirms only after an awaited write succeeds', async () => {
    const user = userEvent.setup(), data = example(); render(<BuildOverviewCopy data={data} />)
    let finish!: () => void
    const write = vi.fn((_text: string) => new Promise<void>(resolve => { finish = resolve })); clipboard({ writeText: write })
    copy().focus(); await user.keyboard('{Enter}')
    expect(write).toHaveBeenCalledWith(formatBuildOverviewText(data)); expect(withinPlanner(area()).getByRole('status').textContent).toBe('Copying build overview…')
    expect((copy() as HTMLButtonElement).disabled).toBe(true); expect(withinPlanner(area()).queryByText(/^Copied build/)).toBeNull()
    await act(async () => finish())
    expect(withinPlanner(area()).getByRole('status').textContent).toBe('Copied build overview for Alexandra.'); expect(withinPlanner(area()).queryByRole('textbox')).toBeNull()
  })
  it.each(['permission', 'missing', 'synchronous', 'getter'])('handles %s clipboard failure with focused, selected fallback and no false success', async failure => {
    const user = userEvent.setup(), data = example(); render(<BuildOverviewCopy data={data} />)
    if (failure === 'permission') clipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) })
    else if (failure === 'missing') clipboard(undefined)
    else if (failure === 'synchronous') clipboard({ writeText: () => { throw new Error('Blocked') } })
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, get() { throw new Error('Blocked getter') } })
    const alert = vi.spyOn(window, 'alert'); await user.click(copy())
    expect(withinPlanner(area()).getByRole('alert').textContent).toContain('Nothing was copied automatically'); expect(withinPlanner(area()).queryByRole('status')).toBeNull()
    const fallback = withinPlanner(area()).getByRole('textbox', { name: 'Build overview text for manual copying' }) as HTMLTextAreaElement
    expect(fallback.readOnly).toBe(true); expect(fallback.wrap).toBe('soft'); expect(fallback.value).toBe(formatBuildOverviewText(data)); expect(document.activeElement).toBe(fallback)
    expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    fallback.setSelectionRange(0, 0); withinPlanner(area()).getByRole('button', { name: 'Select build overview text' }).focus(); await user.keyboard(' ')
    expect(document.activeElement).toBe(fallback); expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length]); expect(alert).not.toHaveBeenCalled()
  })
  it('allows a meaningful empty main build export with both export actions available', async () => {
    const { user } = await app(), write = vi.fn(async (_text: string) => {}); clipboard({ writeText: write })
    expect((copy() as HTMLButtonElement).disabled).toBe(false); await user.click(copy())
    const text = write.mock.calls[0][0]
    for (const value of ['Character: Alexandra\nClass: Gladiator', 'Weapon: Not selected.', 'Mount: Not selected.', 'Battalion: Not selected.', 'PLANNED ABILITIES (0/8)']) expect(text).toContain(value)
    expect((withinPlanner(area()).getByRole('button', { name: 'Download .txt' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('invalidates fallback/success on class or equipment changes and exports new context without correction', async () => {
    const user = userEvent.setup(), data = example(), view = render(<BuildOverviewCopy data={data} />); clipboard(undefined)
    await user.click(copy()); expect(withinPlanner(area()).getByRole('textbox')).toBeDefined()
    const next = example('Alexandra', 'Gladiator'); view.rerender(<BuildOverviewCopy data={next} />)
    expect(withinPlanner(area()).queryByRole('textbox')).toBeNull(); expect(withinPlanner(area()).queryByRole('alert')).toBeNull()
    const write = vi.fn(async (_text: string) => {}); clipboard({ writeText: write }); await user.click(copy())
    expect(write.mock.calls[0][0]).toContain('This class has no mount type listed.'); expect(write.mock.calls[0][0]).toContain('Battalions listed by this class.')
    view.rerender(<BuildOverviewCopy data={{ ...next, weapon: undefined }} />); expect(withinPlanner(area()).queryByRole('status')).toBeNull()
  })
  it('ignores a late success after same-profile changes, including returning to the original text', async () => {
    const user = userEvent.setup(), first = example(), view = render(<BuildOverviewCopy data={first} />)
    let finish!: () => void; clipboard({ writeText: () => new Promise<void>(resolve => { finish = resolve }) })
    await user.click(copy()); view.rerender(<BuildOverviewCopy data={example('Alexandra', 'Gladiator')} />); view.rerender(<BuildOverviewCopy data={first} />)
    await act(async () => finish()); expect(withinPlanner(area()).queryByRole('status')).toBeNull(); expect(withinPlanner(area()).queryByRole('textbox')).toBeNull()
  })
  it('discards an old profile’s pending failure while retaining a newer successful export', async () => {
    const user = userEvent.setup(), view = render(<BuildOverviewCopy data={example()} />)
    let reject!: (error: Error) => void
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail })).mockResolvedValue(undefined); clipboard({ writeText: write })
    await user.click(copy()); view.rerender(<BuildOverviewCopy data={example('Sofia')} />); await user.click(copy())
    expect(withinPlanner(area()).getByRole('status').textContent).toContain('for Sofia.')
    await act(async () => reject(new Error('late failure')))
    expect(withinPlanner(area()).queryByRole('alert')).toBeNull(); expect(withinPlanner(area()).getByRole('status').textContent).toContain('for Sofia.')
  })
  it('ignores completions after unmount without restoring feedback in another copy instance', async () => {
    const user = userEvent.setup(), view = render(<BuildOverviewCopy data={example()} />)
    let finish!: () => void; clipboard({ writeText: () => new Promise<void>(resolve => { finish = resolve }) })
    await user.click(copy()); view.unmount(); render(<BuildOverviewCopy data={example('Sofia')} />); await act(async () => finish())
    expect(withinPlanner(area()).queryByRole('status')).toBeNull()
  })
  it('copies the actual Alexandra example, follows class/reorder changes, and preserves source conflict warnings', async () => {
    const { user } = await app(); await equipment(user); await selectMain(user, 'Class', 'Wing Soldier')
    await user.selectOptions(screen.getByLabelText('Weapon for Alexandra'), weaponData.records.find(value => value.name === 'Levin Sword')!.id)
    await user.selectOptions(screen.getByLabelText('Mount for Alexandra'), 'Mounts!A18'); await user.selectOptions(screen.getByLabelText('Battalion for Alexandra'), battalionData.records[0].id)
    await openPlannerPanel(user, 'Proficiency Progression'); for (const rank of ['D', 'C', 'B']) await add(user, 'Alexandra', rank)
    const write = vi.fn(async (_text: string) => {}); clipboard({ writeText: write }); await user.click(copy())
    const first = write.mock.calls[0][0]
    for (const phrase of ['Name: Levin Sword', "Name: Bucephalus (Alexandra's mount)", 'Name: Bronze-Shield Guard', 'PLANNED ABILITIES (3/8)', '1. Haze Slice', '2. Rend Armor', '3. Gale Blow', 'Community-listed / unverified']) expect(first).toContain(phrase)
    for (const region of ['Overview weapon', 'Overview mount', 'Overview battalion']) {
      const context = withinPlanner(overview()).getByRole('region', { name: region }).querySelector('.overview-context')!.textContent!
      expect(first).toContain(context)
    }
    await selectMain(user, 'Class', 'Gladiator'); await user.click(copy())
    expect(write.mock.calls[1][0]).toContain('This class has no mount type listed.'); expect(write.mock.calls[1][0]).toContain('Battalions listed by this class.')
    await openPlannerPanel(user, 'Ability Planning Shortlist'); await user.click(plannerRole('button', { name: 'Move Gale Blow · Sword B up' }))
    await user.click(copy()); expect(write.mock.calls[2][0]).toContain('2. Gale Blow'); expect(write.mock.calls[2][0]).toContain('3. Rend Armor')
    await user.selectOptions(screen.getByLabelText('Weapon for Alexandra'), weaponData.records.find(value => value.name === 'Zanbato')!.id)
    await user.selectOptions(screen.getByLabelText('Mount for Alexandra'), 'Mounts!A4'); await user.click(copy())
    expect(write.mock.calls[3][0]).toContain('Documented Might: main 14-19; preliminary Zanbato 7-19'); expect(write.mock.calls[3][0]).toContain('neither version is selected for calculations')
  })
  it.each([['Alexandra', 'Sofia'], ['Mu', 'Mu (with growth)']])('exports independent equipment and shortlists for %s and %s', async (firstProfile, secondProfile) => {
    const { user } = await app(); await equipment(user); await openPlannerPanel(user, 'Proficiency Progression')
    const write = vi.fn(async (_text: string) => {}); clipboard({ writeText: write })
    const pairs = [['Alexandra', 'Levin Sword', 'Mounts!A18', 'Bronze-Shield Guard', 'D'], ['Sofia', 'War Bow', 'Mounts!A8', 'Mage Pupils', 'D'], ['Mu', 'Muen', 'Mounts!A2', 'Bai Ze Squad', 'D'], ['Mu (with growth)', 'Salamander', 'Mounts!A14', 'Priest Trainees', 'C']].filter(([name]) => [firstProfile, secondProfile].includes(name))
    for (const [name, weapon, mount, battalion, rank] of pairs) {
      await selectMain(user, 'Character', name)
      await user.selectOptions(screen.getByLabelText(`Weapon for ${name}`), weaponData.records.find(value => value.name === weapon)!.id)
      await user.selectOptions(screen.getByLabelText(`Mount for ${name}`), mount); await user.selectOptions(screen.getByLabelText(`Battalion for ${name}`), battalionData.records.find(value => value.name === battalion)!.id)
      await add(user, name, rank)
    }
    for (const [name, weapon, mount, battalion, rank] of pairs) {
      await selectMain(user, 'Character', name); await user.click(copy())
      const text = write.mock.calls[write.mock.calls.length - 1][0]
      expect(text).toContain(`Character: ${name}\n`); expect(text).toContain(`Name: ${weapon}\n`); expect(text).toContain(`Source: ${mountData.records.find(value => mountId(value) === mount)!.source}`)
      expect(text).toContain(`Name: ${battalion}\n`); expect(text).toContain(`1. ${plan(name, rank).entry.text}`); expect(text).toContain('PLANNED ABILITIES (1/8)')
    }
    if (firstProfile === 'Mu') { expect(write.mock.calls[0][0]).not.toContain('Shadow Gambit'); expect(write.mock.calls[1][0]).toContain("Mu (with growth) uses Mu's source learnset") }
  })
  it('does not change state, populated presets, A/B, output statistics or trigger new growth calculations', async () => {
    const preset = createPreset('Existing', { characterName: 'Alexandra', className: 'Wing Soldier' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const { user } = await app(); await equipment(user); await user.selectOptions(screen.getByLabelText('Weapon for Alexandra'), weaponData.records[0].id)
    await user.selectOptions(screen.getByLabelText('Mount for Alexandra'), 'Mounts!A14'); await user.selectOptions(screen.getByLabelText('Battalion for Alexandra'), battalionData.records[0].id)
    await openPlannerPanel(user, 'Proficiency Progression'); await add(user, 'Alexandra', 'D'); await openPlannerPanel(user, 'Build Comparison')
    const state = () => ({ selects: [...document.querySelectorAll('select')].map(select => select.value), abilities: [...overview().querySelectorAll<HTMLElement>('[data-overview-source-id]')].map(node => node.dataset.overviewSourceId),
      growths: STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`) })
    const before = state(), calculate = vi.spyOn(growths, 'combineGrowths'), write = vi.fn(async (_text: string) => {}); clipboard({ writeText: write })
    await user.click(copy()); expect(state()).toEqual(before); expect(calculate).not.toHaveBeenCalled()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
  })
})
