import { openPlannerPanel, closePlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import AbilityPlanningShortlist from './AbilityPlanningShortlist'
import { PROFICIENCY_HIGHLIGHT_MS } from './proficiencyNavigation'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { STATS } from './growths'
import { createPreset, PRESET_KEY } from './presets'

const progression = () => plannerRole('region', { name: 'Proficiency progression browser' })
const panel = () => plannerRole('region', { name: 'Ability planning shortlist' })
const cards = () => withinPlanner(panel()).getByRole('list').querySelectorAll<HTMLElement>('[data-source-record-id]')
const ids = () => [...cards()].map(card => card.dataset.sourceRecordId)
const sourceRows = () => withinPlanner(progression()).getByRole('list')
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
  await user.click(withinPlanner(sourceRows()).getByRole('button', { name: `Add to shortlist: ${path}` }))
}
async function go(user: ReturnType<typeof userEvent.setup>, path: string) {
  const action = withinPlanner(panel()).getByRole('button', { name: `View in Proficiency Progression: ${path}` })
  const id = action.closest('[data-source-record-id]')?.getAttribute('data-source-record-id')
  await user.click(action)
  await waitFor(() => expect(document.activeElement?.getAttribute('data-source-record-id')).toBe(id))
}
const returnButton = () => withinPlanner(progression()).getByRole('button', { name: 'Return to Shortlist' })
async function returnedTo(id: string) {
  const card = [...cards()].find(value => value.dataset.sourceRecordId === id)!
  await waitFor(() => expect(document.activeElement).toBe(card))
  expect(card.classList.contains('shortlist-return-target')).toBe(true)
  expect(card.textContent).toContain('Returned from proficiency source')
  expect(withinPlanner(panel()).getByText(/^Returned to /).getAttribute('role')).toBe('status')
  expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
  return card
}
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); sessionStorage.clear()
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

describe('return to originating shortlist card', () => {
  it.each([
    ['Sword', 'Haze Slice', 'D'], ['Sword', 'Rend Armor', 'C'], ['Sword', 'Gale Blow', 'B'], ['Flying', 'Flitting Flier', 'C+'],
  ])('returns %s / %s %s from source into a collapsed shortlist without mutation', async (proficiency, name, rank) => {
    const { user } = await start(); await category(user, proficiency)
    const path = `${name} · ${proficiency} ${rank}`
    await add(user, path); const before = ids(), text = cards()[0].textContent
    await go(user, path)
    await closePlannerPanel(user, 'Ability Planning Shortlist')
    returnButton().focus(); await user.keyboard('{Enter}')
    const card = await returnedTo(before[0]!)
    expect(screen.getByText('Ability Planning Shortlist').closest('details')?.open).toBe(true)
    expect(ids()).toEqual(before)
    expect(card.textContent?.replace('↳ Returned from proficiency source', '')).toBe(text)
    expect(withinPlanner(card).getByRole('button', { name: `View in Proficiency Progression: ${path}` })).toBeDefined()
  })
  it('returns by source identity after Rend Armor moves from the second to the first slot', async () => {
    const { user } = await start()
    for (const path of ['Haze Slice · Sword D', 'Rend Armor · Sword C', 'Gale Blow · Sword B']) await add(user, path)
    const before = ids(), rend = before[1]!
    await go(user, 'Rend Armor · Sword C')
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Move Rend Armor · Sword C up' }))
    expect(ids()).toEqual([before[1], before[0], before[2]])
    await user.click(returnButton()); const card = await returnedTo(rend)
    expect(card.getAttribute('aria-label')).toBe('Planning slot 1: Rend Armor · Sword C')
    expect(card.textContent).toContain("'Sword'!C2")
  })
  it.each(['remove', 'clear'])('handles %s while inspecting without recreating a plan and offers panel-only fallback', async mutation => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D'); await add(user, 'Rend Armor · Sword C')
    await go(user, 'Haze Slice · Sword D')
    if (mutation === 'remove') await user.click(withinPlanner(sourceRows()).getByRole('button', { name: 'Remove Haze Slice · Sword D from shortlist' }))
    else {
      await user.click(withinPlanner(panel()).getByRole('button', { name: 'Clear shortlist' }))
      await user.click(withinPlanner(panel()).getByRole('button', { name: 'Confirm clear shortlist' }))
    }
    const before = ids()
    const context = withinPlanner(progression()).getByRole('group', { name: 'Shortlist navigation origin' })
    expect(withinPlanner(context).getByRole('alert').textContent).toContain('not available')
    expect(withinPlanner(context).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    await closePlannerPanel(user, 'Ability Planning Shortlist')
    await user.click(withinPlanner(context).getByRole('button', { name: 'Open Shortlist Panel' }))
    await waitFor(() => expect(document.activeElement).toBe(withinPlanner(panel()).getByRole('heading', { name: 'Alexandra · Ability plans' })))
    expect(withinPlanner(panel()).getByText(/Opened Alexandra’s shortlist panel; no entry was restored/).getAttribute('role')).toBe('status')
    expect(ids()).toEqual(before)
    expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    expect(withinPlanner(progression()).queryByRole('group', { name: 'Shortlist navigation origin' })).toBeNull()
  })
  it('retains search, rank filter, category, inspection and revealed target through return and later filter edits', async () => {
    const { user } = await start(); await category(user, 'Flying'); await add(user, 'Flitting Flier · Flying C+')
    const filter = withinPlanner(progression()).getByLabelText('Rank filter') as HTMLSelectElement
    const search = withinPlanner(progression()).getByLabelText('Search ability names') as HTMLInputElement
    fireEvent.change(filter, { target: { value: 'unresolved' } }); fireEvent.change(search, { target: { value: 'not a match' } })
    await go(user, 'Flitting Flier · Flying C+'); const id = ids()[0]!
    expect(progression().textContent).toContain('Temporarily showing this source record outside your filters')
    await user.click(returnButton()); await returnedTo(id)
    expect(filter.value).toBe('unresolved'); expect(search.value).toBe('not a match')
    expect(withinPlanner(sourceRows()).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('complementary', { name: 'Ability information' }).textContent).toContain("'Flying'!C2")
    await go(user, 'Flitting Flier · Flying C+')
    fireEvent.change(search, { target: { value: 'changed while inspecting' } })
    expect(withinPlanner(sourceRows()).queryAllByRole('listitem')).toHaveLength(0)
    await user.click(returnButton()); await returnedTo(id)
    expect(search.value).toBe('changed while inspecting'); expect(filter.value).toBe('unresolved')
  })
  it.each(['Mu', 'Mu (with growth)'])('retains %s selected identity and distinct mapped source origin', async character => {
    const { user } = await start(), selector = plannerRole('combobox', { name: 'Character' })
    await user.selectOptions(selector, character); await add(user, 'Wrath Strike · Sword D')
    const first = ids()[0]!, growth = screen.getByTestId('combined-HP').textContent
    await go(user, 'Wrath Strike · Sword D'); await user.click(returnButton()); await returnedTo(first)
    expect((selector as HTMLSelectElement).value).toBe(character)
    expect(screen.getByTestId('combined-HP').textContent).toBe(growth)
    const other = character === 'Mu' ? 'Mu (with growth)' : 'Mu'
    await user.selectOptions(selector, other)
    expect(ids()).toEqual([])
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    await add(user, 'Wrath Strike · Sword D'); await go(user, 'Wrath Strike · Sword D')
    const second = ids()[0]!; expect(second).not.toBe(first)
    await user.click(returnButton()); const card = await returnedTo(second)
    expect(card.textContent).toContain("'Sword'!B39")
    expect((selector as HTMLSelectElement).value).toBe(other)
    await user.selectOptions(selector, character); expect(ids()).toEqual([first])
    expect(panel().querySelector('.shortlist-return-target')).toBeNull()
  })
  it('clears the active origin on character switch without replaying it when switching back', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D'); await go(user, 'Haze Slice · Sword D')
    const selector = plannerRole('combobox', { name: 'Character' })
    await user.selectOptions(selector, 'Sofia')
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    expect(ids()).toEqual([])
    await user.selectOptions(selector, 'Alexandra')
    expect(cards()).toHaveLength(1)
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    expect(panel().querySelector('.shortlist-return-target')).toBeNull()
  })
  it('does not associate ordinary or replacement source inspection with a previous shortlist origin', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D'); await go(user, 'Haze Slice · Sword D')
    await user.click(withinPlanner(sourceRows()).getByRole('button', { name: 'Rend Armor' }))
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Ability information' }).textContent).toContain('Rend Armor')
  })
  it('keeps identically named paths independently returnable through disposable source fixtures', async () => {
    const original = proficiencyData.categories.Sword.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = original.map(entry => entry.rank === 'C' ? { ...entry, text: 'Haze Slice' } : entry)
      const { user } = await start(); await add(user, 'Haze Slice · Sword D'); await add(user, 'Haze Slice · Sword C')
      const before = ids()
      for (const [index, rank] of ['D', 'C'].entries()) {
        await user.click(withinPlanner(panel()).getByRole('button', { name: `View in Proficiency Progression: Haze Slice · Sword ${rank}` }))
        await user.click(returnButton()); const card = await returnedTo(before[index]!)
        expect(card.textContent).toContain(`Required rank ${rank}`)
      }
      expect(ids()).toEqual(before)
    } finally { proficiencyData.categories.Sword.characters.Alexandra = original }
  })
  it('shows a nonfatal stale-source message and never returns to a different existing card', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D'); await add(user, 'Rend Armor · Sword C'); await go(user, 'Haze Slice · Sword D')
    const before = ids(), original = proficiencyData.categories.Sword.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = original.filter(entry => entry.rank !== 'D')
      await selectMain(user, 'Class', 'Dancer')
      const context = withinPlanner(progression()).getByRole('group', { name: 'Shortlist navigation origin' })
      expect(withinPlanner(context).getByRole('alert').textContent).toContain('original proficiency source record is no longer available')
      expect(withinPlanner(context).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
      expect(ids()).toEqual(before)
      expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    } finally { proficiencyData.categories.Sword.characters.Alexandra = original }
  })
  it('defensively handles missing return IDs and mismatched profiles without focusing unrelated cards', async () => {
    const planned = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!, entries = [planned]
    const props = { characterName: 'Alexandra', entries, onAction: vi.fn() }
    const view = render(<AbilityPlanningShortlist {...props} returnNavigation={{ characterName: 'Alexandra', id: 'missing', sequence: 1 }} />)
    await waitFor(() => expect(document.activeElement).toBe(withinPlanner(panel()).getByRole('heading', { name: 'Alexandra · Ability plans' })))
    expect(withinPlanner(panel()).getByRole('alert').textContent).toContain('No entry was restored')
    expect(ids()).toEqual([planned.id]); expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    view.rerender(<AbilityPlanningShortlist {...props} returnNavigation={{ characterName: 'Mu', id: planned.id, sequence: 2 }} />)
    expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    expect(props.onAction).not.toHaveBeenCalled()
  })
  it('expires/restarts the labeled highlight, preserves focus and uses instant reduced-motion-safe scrolling', () => {
    vi.useFakeTimers()
    const scroll = vi.fn(), focus = vi.spyOn(HTMLElement.prototype, 'focus')
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    const planned = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!
    const props = { characterName: 'Alexandra', entries: [planned], onAction: vi.fn() }
    const view = render(<AbilityPlanningShortlist {...props} returnNavigation={{ characterName: 'Alexandra', id: planned.id, sequence: 1 }} />)
    expect(document.activeElement).toBe(cards()[0])
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'center' })
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    view.rerender(<AbilityPlanningShortlist {...props} returnNavigation={{ characterName: 'Alexandra', id: planned.id, sequence: 2 }} />)
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    expect(panel().querySelector('.shortlist-return-target')).not.toBeNull()
    act(() => vi.advanceTimersByTime(PROFICIENCY_HIGHLIGHT_MS / 2))
    expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    expect(withinPlanner(panel()).queryByText('↳ Returned from proficiency source')).toBeNull()
    expect(document.activeElement).toBe(cards()[0]); expect(props.onAction).not.toHaveBeenCalled()
  })
  it('offers no return for ordinary browsing and supports repeated keyboard round trips without duplicate IDs', async () => {
    const { user } = await start()
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    await add(user, 'Haze Slice · Sword D'); const id = ids()[0]!
    for (let repetition = 0; repetition < 3; repetition++) {
      await go(user, 'Haze Slice · Sword D'); returnButton().focus(); await user.keyboard(' '); await returnedTo(id)
      const domIds = [...document.querySelectorAll('[id]')].map(element => element.id)
      expect(new Set(domIds).size).toBe(domIds.length)
      expect(screen.getAllByRole('region', { name: 'Ability planning shortlist' })).toHaveLength(1)
    }
  })
  it('preserves presets, storage, calculations, old catalog navigation and refresh semantics through a round trip', async () => {
    const preset = createPreset('Existing build', { characterName: 'Alexandra', className: 'Gladiator' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload)
    sessionStorage.setItem('unrelated', 'keep')
    const write = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem'), clear = vi.spyOn(Storage.prototype, 'clear')
    const { user, view } = await start(); await openPlannerPanel(user, 'Build Comparison')
    const values = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = values(); await add(user, 'Haze Slice · Sword D'); const planned = ids()
    await go(user, 'Haze Slice · Sword D'); await user.click(returnButton()); await returnedTo(planned[0]!)
    await openPlannerPanel(user, 'Weapons & Forging'); await screen.findByRole('list', { name: 'Main weapon catalog' })
    await user.click(plannerRole('button', { name: 'Inspect weapon Muen' }))
    await user.click(plannerRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    await user.click(await screen.findByRole('button', { name: 'View weapon: Muen · Chest 1 · Part I' }))
    expect(values()).toEqual(before); expect(ids()).toEqual(planned)
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('unrelated')).toBe('keep')
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
    view.unmount(); render(<App />)
    await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    expect(ids()).toEqual([]); expect(panel().querySelector('.shortlist-return-target')).toBeNull()
    await openPlannerPanel(user, 'Proficiency Progression')
    expect(withinPlanner(progression()).queryByRole('button', { name: 'Return to Shortlist' })).toBeNull()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
  })
})
