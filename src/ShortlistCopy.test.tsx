import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ShortlistCopy from './ShortlistCopy'
import { growthData, STATS } from './growths'
import { resolvePlanningEntry } from './shortlist'
import { formatShortlistText } from './shortlistText'
import { createPreset, PRESET_KEY } from './presets'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value })
const panel = () => plannerRole('region', { name: 'Ability planning shortlist' })
const copyArea = () => withinPlanner(panel()).getByRole('group', { name: 'Copy ability shortlist' })
const progression = () => plannerRole('region', { name: 'Proficiency progression browser' })
const cards = () => withinPlanner(panel()).getByRole('list').querySelectorAll<HTMLElement>('[data-source-record-id]')
const ids = () => [...cards()].map(card => card.dataset.sourceRecordId)
async function start() {
  const user = userEvent.setup(), view = render(<App />)
  await openPlannerPanel(user, 'Proficiency Progression')
  await openPlannerPanel(user, 'Ability Planning Shortlist')
  await screen.findByRole('region', { name: 'Ability planning shortlist' })
  return { user, view }
}
async function add(user: ReturnType<typeof userEvent.setup>, path: string) {
  await user.click(withinPlanner(withinPlanner(progression()).getByRole('list')).getByRole('button', { name: `Add to shortlist: ${path}` }))
}
async function category(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(withinPlanner(withinPlanner(progression()).getByRole('group', { name: 'Proficiency categories' })).getByRole('button', { name }))
}
const copyButton = () => withinPlanner(copyArea()).getByRole('button', { name: 'Copy Shortlist' })
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Copy Shortlist clipboard presentation', () => {
  it('confirms only after a real asynchronous success and supports Enter without a fallback', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D')
    let finish!: () => void
    const write = vi.fn((_text: string) => new Promise<void>(resolve => { finish = resolve })); setClipboard({ writeText: write })
    copyButton().focus(); await user.keyboard('{Enter}')
    expect(withinPlanner(copyArea()).getByRole('status').textContent).toBe('Copying shortlist…')
    expect((copyButton() as HTMLButtonElement).disabled).toBe(true)
    expect(withinPlanner(copyArea()).queryByText(/^Copied shortlist/)).toBeNull()
    await act(async () => finish())
    expect(withinPlanner(copyArea()).getByRole('status').textContent).toBe('Copied shortlist for Alexandra (1 entry).')
    expect(write.mock.calls[0][0]).toContain("Source: 'Sword'!B2")
    expect(withinPlanner(copyArea()).queryByRole('textbox')).toBeNull()
  })
  it.each(['permission', 'missing', 'synchronous', 'getter'])('handles %s clipboard failure with selected read-only text and no false success', async failure => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D')
    if (failure === 'permission') setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) })
    else if (failure === 'missing') setClipboard(undefined)
    else if (failure === 'synchronous') setClipboard({ writeText: () => { throw new Error('Unavailable') } })
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, get() { throw new Error('Blocked getter') } })
    const alert = vi.spyOn(window, 'alert')
    await user.click(copyButton())
    expect(withinPlanner(copyArea()).getByRole('alert').textContent).toContain('Nothing was copied automatically')
    expect(withinPlanner(copyArea()).queryByText(/^Copied shortlist/)).toBeNull()
    const fallback = withinPlanner(copyArea()).getByRole('textbox', { name: 'Shortlist text for manual copying' }) as HTMLTextAreaElement
    expect(fallback.readOnly).toBe(true); expect(fallback.value).toContain('1. Haze Slice')
    expect(document.activeElement).toBe(fallback)
    expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    const select = withinPlanner(copyArea()).getByRole('button', { name: 'Select shortlist text' })
    select.focus(); await user.keyboard(' ')
    expect(document.activeElement).toBe(fallback)
    expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    expect(alert).not.toHaveBeenCalled()
  })
  it('disables empty copying and switches immediately to the selected character’s empty state', async () => {
    const { user } = await start(), write = vi.fn().mockResolvedValue(undefined); setClipboard({ writeText: write })
    expect((copyButton() as HTMLButtonElement).disabled).toBe(true)
    expect(copyArea().textContent).toContain('Add a planning entry before copying')
    await user.click(copyButton()); expect(write).not.toHaveBeenCalled()
    await add(user, 'Haze Slice · Sword D'); await user.click(copyButton())
    expect(write).toHaveBeenCalledTimes(1)
    await selectMain(user, 'Character', 'Sofia')
    expect((copyButton() as HTMLButtonElement).disabled).toBe(true)
    expect(withinPlanner(copyArea()).queryByRole('status')).toBeNull()
  })
  it('copies Alexandra’s actual three-entry data and new ordering without changing plans or filters', async () => {
    const { user } = await start(), write = vi.fn(async (_text: string) => {}); setClipboard({ writeText: write })
    await add(user, 'Haze Slice · Sword D'); await add(user, 'Rend Armor · Sword C'); await category(user, 'Flying'); await add(user, 'Flitting Flier · Flying C+')
    const before = ids(), search = withinPlanner(progression()).getByLabelText('Search ability names') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'no matches' } })
    await user.click(copyButton()); const first = write.mock.calls[0][0]
    expect(first).toContain('Character: Alexandra\nPlanned abilities: 3/8')
    expect(first).toContain('1. Haze Slice'); expect(first).toContain('2. Rend Armor'); expect(first).toContain('3. Flitting Flier')
    expect(first).toContain('Proficiency: Flying C+'); expect(first).toContain("Source: 'Flying'!C2")
    expect(first).toContain('Source link: https://docs.google.com/'); expect(first).toContain('Community-listed / unverified')
    expect(ids()).toEqual(before); expect(search.value).toBe('no matches')
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Move Flitting Flier · Flying C+ up' }))
    expect(withinPlanner(copyArea()).queryByRole('status')).toBeNull()
    await user.click(copyButton()); const second = write.mock.calls[1][0]
    expect(second).toContain('1. Haze Slice'); expect(second).toContain('2. Flitting Flier'); expect(second).toContain('3. Rend Armor')
    expect(ids()).toEqual([before[0], before[2], before[1]])
    expect(search.value).toBe('no matches')
  })
  it('copies different Mu profiles independently and does not carry fallback or feedback across characters', async () => {
    const { user } = await start(), selector = plannerRole('combobox', { name: 'Character' })
    const write = vi.fn(async (_text: string) => {}); setClipboard({ writeText: write })
    await user.selectOptions(selector, 'Mu'); await add(user, 'Wrath Strike · Sword D'); await user.click(copyButton())
    await user.selectOptions(selector, 'Mu (with growth)'); await add(user, 'Shadow Gambit · Sword C'); await user.click(copyButton())
    expect(write.mock.calls[0][0]).toContain('Character: Mu\n'); expect(write.mock.calls[0][0]).not.toContain('Shadow Gambit')
    expect(write.mock.calls[1][0]).toContain('Character: Mu (with growth)\n'); expect(write.mock.calls[1][0]).not.toContain('Wrath Strike')
    setClipboard(undefined); await user.click(copyButton())
    expect(withinPlanner(copyArea()).getByRole('textbox')).toBeDefined()
    await user.selectOptions(selector, 'Mu')
    expect(withinPlanner(copyArea()).queryByRole('textbox')).toBeNull(); expect(withinPlanner(copyArea()).queryByRole('status')).toBeNull()
    await user.click(copyButton()); expect((withinPlanner(copyArea()).getByRole('textbox') as HTMLTextAreaElement).value).not.toContain('Shadow Gambit')
  })
  it('ignores an old pending completion after switching character', async () => {
    const { user } = await start(); await add(user, 'Haze Slice · Sword D')
    let finish!: () => void
    setClipboard({ writeText: vi.fn((_text: string) => new Promise<void>(resolve => { finish = resolve })) })
    await user.click(copyButton())
    await selectMain(user, 'Character', 'Sofia')
    await act(async () => finish())
    expect(withinPlanner(copyArea()).queryByRole('status')).toBeNull()
    expect((copyButton() as HTMLButtonElement).disabled).toBe(true)
  })
  it('invalidates stale pending feedback after a list change and only reports the latest attempt', async () => {
    const user = userEvent.setup(), first = resolvePlanningEntry('Alexandra', 'Sword', 'D', "'Sword'!B2")!, second = resolvePlanningEntry('Alexandra', 'Sword', 'C', "'Sword'!C2")!
    let oldFinish!: () => void
    const write = vi.fn((_text: string) => new Promise<void>(resolve => { oldFinish = resolve })); setClipboard({ writeText: write })
    const props = { profile: { id: 'Alexandra', displayName: 'Alexandra' }, source: growthData.metadata }
    const view = render(<ShortlistCopy {...props} entries={[first]} />)
    await user.click(plannerRole('button', { name: 'Copy Shortlist' }))
    view.rerender(<ShortlistCopy {...props} entries={[second, first]} />)
    write.mockResolvedValue(undefined)
    await user.click(plannerRole('button', { name: 'Copy Shortlist' }))
    await act(async () => oldFinish())
    expect(screen.getByRole('status').textContent).toBe('Copied shortlist for Alexandra (2 entries).')
    expect(write.mock.calls[1][0]).toContain('1. Rend Armor')
    expect(write.mock.calls[1][0]).toBe(formatShortlistText(props.profile, [second, first], props.source))
  })
  it('preserves storage, presets, calculations, both navigation directions and fresh-session reset', async () => {
    const preset = createPreset('Existing build', { characterName: 'Alexandra', className: 'Gladiator' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('unrelated', 'keep')
    const store = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem'), clear = vi.spyOn(Storage.prototype, 'clear')
    const { user, view } = await start(), write = vi.fn(async (_text: string) => {}); setClipboard({ writeText: write })
    await openPlannerPanel(user, 'Build Comparison')
    const values = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = values(); await add(user, 'Haze Slice · Sword D'); const planned = ids()
    await user.click(copyButton())
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'View in Proficiency Progression: Haze Slice · Sword D' }))
    await user.click(withinPlanner(progression()).getByRole('button', { name: 'Return to Shortlist' }))
    await waitFor(() => expect(document.activeElement).toBe(cards()[0]))
    await openPlannerPanel(user, 'Weapons & Forging'); await screen.findByRole('list', { name: 'Main weapon catalog' })
    await user.click(plannerRole('button', { name: 'Inspect weapon Muen' })); await user.click(plannerRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    await user.click(await screen.findByRole('button', { name: 'View weapon: Muen · Chest 1 · Part I' }))
    expect(values()).toEqual(before); expect(ids()).toEqual(planned); expect(write).toHaveBeenCalledTimes(1)
    expect(store).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('unrelated')).toBe('keep')
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    expect(ids()).toEqual([]); expect((copyButton() as HTMLButtonElement).disabled).toBe(true)
    expect(withinPlanner(copyArea()).queryByRole('status')).toBeNull(); expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
    expect(store).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
  })
})
