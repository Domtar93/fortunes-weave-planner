import { openPlannerPanel, closePlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ProficiencyProgression from './ProficiencyProgression'
import { growthData, STATS } from './growths'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { PROFICIENCY_HIGHLIGHT_MS } from './proficiencyNavigation'
import { createPreset, PRESET_KEY } from './presets'

const progression = () => plannerRole('region', { name: 'Proficiency progression browser' })
const list = () => withinPlanner(progression()).getByRole('list')
const panel = () => plannerRole('region', { name: 'Ability planning shortlist' })
const plannedRows = () => withinPlanner(panel()).getByRole('list').querySelectorAll<HTMLElement>('[data-source-record-id]')
const ids = () => [...plannedRows()].map(entry => entry.dataset.sourceRecordId)
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
async function start() {
  const user = userEvent.setup(), view = render(<App />)
  await openPlannerPanel(user, 'Proficiency Progression')
  await openPlannerPanel(user, 'Ability Planning Shortlist')
  await screen.findByRole('region', { name: 'Ability planning shortlist' })
  return { user, view }
}
async function category(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(withinPlanner(withinPlanner(progression()).getByRole('group', { name: 'Proficiency categories' })).getByRole('button', { name }))
}
async function add(user: ReturnType<typeof userEvent.setup>, path: string) {
  await user.click(withinPlanner(list()).getByRole('button', { name: `Add to shortlist: ${path}` }))
}
function action(path: string) { return withinPlanner(panel()).getByRole('button', { name: `View in Proficiency Progression: ${path}` }) }
async function arrived(path: string, source: string, character = 'Alexandra') {
  const target = await withinPlanner(list()).findByRole('listitem', { name: `${character} · ${path}` })
  await waitFor(() => expect(document.activeElement).toBe(target))
  expect(target.classList.contains('proficiency-navigation-target')).toBe(true)
  expect(target.textContent).toContain('Shortlist navigation target')
  expect(target.dataset.sourceRecordId).toContain(source)
  expect(withinPlanner(screen.getByRole('complementary', { name: 'Ability information' })).getAllByRole('link', { name: source })[0].getAttribute('href')).toContain('docs.google.com')
  return target
}
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); sessionStorage.clear()
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

describe('shortlist to proficiency navigation', () => {
  it.each([
    ['Sword', 'Haze Slice', 'D', "'Sword'!B2"], ['Sword', 'Rend Armor', 'C', "'Sword'!C2"], ['Sword', 'Gale Blow', 'B', "'Sword'!D2"],
    ['Flying', 'Flitting Flier', 'C+', "'Flying'!C2"], ['Riding', 'Knightly Senses', 'D', "'Riding'!B2"], ['Riding', 'Vanguard', 'C+', "'Riding'!D2"],
  ])('opens a collapsed panel at %s / %s / %s with exact sources and updated inspection', async (proficiency, name, rank, source) => {
    const { user } = await start()
    await category(user, proficiency); await add(user, `${name} · ${proficiency} ${rank}`)
    const before = ids()
    await category(user, proficiency === 'Sword' ? 'Flying' : 'Sword')
    await user.click(withinPlanner(list()).getAllByRole('button', { name: /^(Read the Winds|Haze Slice)$/ })[0])
    await closePlannerPanel(user, 'Proficiency Progression')
    await user.click(action(`${name} · ${proficiency} ${rank}`))
    const target = await arrived(`${proficiency} ${rank} · ${name}`, source)
    expect(screen.getByText('Proficiency Progression').closest('details')?.open).toBe(true)
    expect(target.dataset.sourceRecordId).toBe(before[0])
    expect(screen.getAllByRole('region', { name: 'Proficiency progression browser' })).toHaveLength(1)
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(proficiencyData.categories[proficiency as keyof typeof proficiencyData.categories].ranks.length)
    expect(screen.getByRole('complementary', { name: 'Ability information' }).textContent).toContain(`Source: ${source}`)
    expect(ids()).toEqual(before)
  })
  it('reveals a search-hidden Flying C+ target in source order without clearing search, then restores filtered results', async () => {
    const { user } = await start(); await category(user, 'Flying'); await add(user, 'Flitting Flier · Flying C+')
    const filters = withinPlanner(withinPlanner(progression()).getByRole('group', { name: 'Proficiency filters' }))
    fireEvent.change(filters.getByLabelText('Search ability names'), { target: { value: 'Airfighter' } })
    await user.click(action('Flitting Flier · Flying C+'))
    await arrived('Flying C+ · Flitting Flier', "'Flying'!C2")
    expect((filters.getByLabelText('Search ability names') as HTMLInputElement).value).toBe('Airfighter')
    expect(withinPlanner(list()).getAllByRole('listitem').map(row => row.querySelector('.rank-marker')?.textContent)).toEqual(['C+', 'A'])
    expect(progression().textContent).toContain('Temporarily showing this source record outside your filters')
    await user.click(withinPlanner(progression()).getByRole('button', { name: 'Return to filtered results' }))
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(1)
    expect(withinPlanner(list()).queryByText('Flitting Flier', { exact: true })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Ability information' }).textContent).not.toContain("'Flying'!C2")
  })
  it('reveals only the exact destination when rank and search both hide it, and filter editing ends the override', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D')
    const filter = withinPlanner(progression()).getByLabelText('Rank filter') as HTMLSelectElement
    const search = withinPlanner(progression()).getByLabelText('Search ability names') as HTMLInputElement
    await user.selectOptions(filter, 'unresolved'); fireEvent.change(search, { target: { value: 'no matches' } })
    await user.click(action('Haze Slice · Sword D')); await arrived('Sword D · Haze Slice', "'Sword'!B2")
    expect(filter.value).toBe('unresolved'); expect(search.value).toBe('no matches')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.change(search, { target: { value: '' } })
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(1)
    expect(withinPlanner(list()).getByText('No recorded unlock')).toBeDefined()
    expect(progression().querySelector('.proficiency-navigation-target')).toBeNull()
  })
  it('supports Enter/Space, repeated navigation and changing targets without duplicate rows or shortlist mutations', async () => {
    const { user } = await start()
    for (const path of ['Haze Slice · Sword D', 'Rend Armor · Sword C', 'Gale Blow · Sword B']) await add(user, path)
    const before = ids()
    action('Haze Slice · Sword D').focus(); await user.keyboard('{Enter}'); await arrived('Sword D · Haze Slice', "'Sword'!B2")
    action('Rend Armor · Sword C').focus(); await user.keyboard(' '); await arrived('Sword C · Rend Armor', "'Sword'!C2")
    for (const path of ['Gale Blow · Sword B', 'Gale Blow · Sword B', 'Haze Slice · Sword D']) await user.click(action(path))
    await arrived('Sword D · Haze Slice', "'Sword'!B2")
    expect(progression().querySelectorAll('.proficiency-navigation-target')).toHaveLength(1)
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(6)
    expect(ids()).toEqual(before)
  })
  it('navigates identical names at different proficiencies and ranks by their distinct IDs', async () => {
    const sword = proficiencyData.categories.Sword.characters.Alexandra, spear = proficiencyData.categories.Spear.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = sword.map(entry => entry.rank === 'C' ? { ...entry, text: 'Haze Slice' } : entry)
      proficiencyData.categories.Spear.characters.Alexandra = spear.map(entry => entry.rank === 'D' ? { ...entry, text: 'Haze Slice', state: 'documented' } : entry)
      const { user } = await start()
      await add(user, 'Haze Slice · Sword D'); await add(user, 'Haze Slice · Sword C'); await category(user, 'Spear'); await add(user, 'Haze Slice · Spear D')
      const before = ids()
      for (const [path, source] of [['Sword D', "'Sword'!B2"], ['Sword C', "'Sword'!C2"], ['Spear D', "'Spear'!B2"]]) {
        await user.click(action(`Haze Slice · ${path}`)); await arrived(`${path} · Haze Slice`, source)
      }
      expect(new Set(ids()).size).toBe(3); expect(ids()).toEqual(before)
    } finally { proficiencyData.categories.Sword.characters.Alexandra = sword; proficiencyData.categories.Spear.characters.Alexandra = spear }
  })
  it.each(['Mu', 'Mu (with growth)'])('navigates %s through its mapped source while retaining independent plans and growths', async character => {
    const { user } = await start(), selector = plannerRole('combobox', { name: 'Character' })
    await user.selectOptions(selector, character); await add(user, 'Wrath Strike · Sword D')
    const before = ids(), growth = screen.getByTestId('combined-HP').textContent
    await user.click(action('Wrath Strike · Sword D')); await arrived('Sword D · Wrath Strike', "'Sword'!B39", character)
    expect((selector as HTMLSelectElement).value).toBe(character)
    expect(screen.getByTestId('combined-HP').textContent).toBe(growth)
    const other = character === 'Mu' ? 'Mu (with growth)' : 'Mu'
    await user.selectOptions(selector, other)
    expect(ids()).toEqual([])
    expect(progression().querySelector('.proficiency-navigation-target')).toBeNull()
    await add(user, 'Wrath Strike · Sword D'); const otherIds = ids()
    expect(otherIds).not.toEqual(before)
    await user.selectOptions(selector, character)
    expect(ids()).toEqual(before)
    expect(progression().querySelector('.proficiency-navigation-target')).toBeNull()
    await user.click(action('Wrath Strike · Sword D')); await arrived('Sword D · Wrath Strike', "'Sword'!B39", character)
  })
  it('leaves a stale shortlisted source untouched and shows a nonfatal message beside the action', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D')
    const before = ids(), original = proficiencyData.categories.Sword.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = original.filter(entry => entry.rank !== 'D')
      await closePlannerPanel(user, 'Proficiency Progression')
      await user.click(action('Haze Slice · Sword D'))
      expect(withinPlanner(panel()).getByRole('alert').textContent).toContain('original proficiency source record is no longer available')
      expect(ids()).toEqual(before)
      expect(screen.getByText('Proficiency Progression').closest('details')?.open).toBe(false)
      expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    } finally { proficiencyData.categories.Sword.characters.Alexandra = original }
  })
  it('handles a missing request identifier without fabricating a row or deleting the plan', async () => {
    const planned = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!
    const entries = [planned]
    render(<ProficiencyProgression character={growthData.characters[0]} selectedClass={growthData.classes.find(entry => entry.name === 'Gladiator')!} shortlist={entries} navigation={{ id: '', characterName: 'Alexandra', sequence: 1 }} />)
    expect(await withinPlanner(progression()).findByRole('alert')).toHaveProperty('textContent', 'This planned entry has no source-record identifier. Your shortlist is unchanged.')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(6)
    expect(progression().querySelector('.proficiency-navigation-target')).toBeNull()
    expect(entries).toEqual([planned])
  })
  it('expires and restarts the labeled highlight while retaining a hidden target and using instant focus/scroll', () => {
    vi.useFakeTimers()
    const scroll = vi.fn(), focus = vi.spyOn(HTMLElement.prototype, 'focus')
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    const planned = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!
    const props = { character: growthData.characters[0], selectedClass: growthData.classes.find(entry => entry.name === 'Gladiator')!, shortlist: [planned] }
    const view = render(<ProficiencyProgression {...props} navigation={{ id: planned.id, characterName: 'Alexandra', sequence: 1 }} />)
    fireEvent.change(withinPlanner(progression()).getByLabelText('Rank filter'), { target: { value: 'unresolved' } })
    view.rerender(<ProficiencyProgression {...props} navigation={{ id: planned.id, characterName: 'Alexandra', sequence: 2 }} />)
    expect(progression().querySelector('.proficiency-navigation-target')).not.toBeNull()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'center' })
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    view.rerender(<ProficiencyProgression {...props} navigation={{ id: planned.id, characterName: 'Alexandra', sequence: 3 }} />)
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    expect(progression().querySelector('.proficiency-navigation-target')).not.toBeNull()
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    expect(progression().querySelector('.proficiency-navigation-target')).toBeNull()
    expect(withinPlanner(list()).queryByText('↳ Shortlist navigation target')).toBeNull()
    expect(progression().textContent).toContain('Navigation target: Haze Slice')
    expect(progression().textContent).toContain('Temporarily showing this source record outside your filters')
    expect((withinPlanner(progression()).getByLabelText('Rank filter') as HTMLSelectElement).value).toBe('unresolved')
    expect(document.activeElement?.getAttribute('data-source-record-id')).toBe(planned.id)
  })
  it('preserves presets, storage, calculations, old navigation and session reset after shortlist navigation', async () => {
    const preset = createPreset('Existing build', { characterName: 'Alexandra', className: 'Gladiator' }, [])
    const saved = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, saved)
    const write = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem'), clear = vi.spyOn(Storage.prototype, 'clear')
    const { user, view } = await start()
    await openPlannerPanel(user, 'Build Comparison')
    const values = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = values(); await add(user, 'Haze Slice · Sword D'); const planned = ids()
    await user.click(action('Haze Slice · Sword D')); await arrived('Sword D · Haze Slice', "'Sword'!B2")
    await openPlannerPanel(user, 'Weapons & Forging'); await screen.findByRole('list', { name: 'Main weapon catalog' })
    await user.click(plannerRole('button', { name: 'Inspect weapon Muen' }))
    await user.click(plannerRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    await user.click(await screen.findByRole('button', { name: 'View weapon: Muen · Chest 1 · Part I' }))
    expect(values()).toEqual(before); expect(ids()).toEqual(planned)
    expect(localStorage.getItem(PRESET_KEY)).toBe(saved)
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    expect(ids()).toEqual([]); expect(localStorage.getItem(PRESET_KEY)).toBe(saved)
    expect(screen.getByText('Proficiency Progression').closest('details')?.open).toBe(true)
  })
})
