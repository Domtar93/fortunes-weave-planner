import { openPlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ShortlistCopy from './ShortlistCopy'
import { growthData, STATS } from './growths'
import { resolvePlanningEntry } from './shortlist'
import { formatShortlistText } from './shortlistText'
import { createPreset, PRESET_KEY } from './presets'
import { proficiencyData } from './proficiencies'

const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const profile = { id: 'Alexandra', displayName: 'Alexandra' }, source = growthData.metadata
const sword = (rank: string) => resolvePlanningEntry('Alexandra', 'Sword', rank, proficiencyData.categories.Sword.characters.Alexandra.find(entry => entry.rank === rank)!.source)!
const muPlan = (name: string, rank: string) => resolvePlanningEntry(name, 'Sword', rank, proficiencyData.categories.Sword.characters.Mu.find(entry => entry.rank === rank)!.source)!
const flier = () => resolvePlanningEntry('Alexandra', 'Flying', 'C+', "'Flying'!C2")!
const panel = () => plannerRole('region', { name: 'Ability planning shortlist' })
const area = () => withinPlanner(panel()).getByRole('group', { name: 'Copy ability shortlist' })
const download = () => withinPlanner(plannerRole('group', { name: 'Copy ability shortlist' })).getByRole('button', { name: 'Download .txt' })
const copy = () => plannerRole('button', { name: 'Copy Shortlist' })
const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(blob, 'utf-8')
})
function browser() {
  const create = vi.fn((_blob: Blob) => 'blob:shortlist-download'), revoke = vi.fn(), filenames: string[] = []
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filenames.push(this.download) })
  const write = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
  return { create, revoke, click, filenames, write }
}
async function start() {
  const user = userEvent.setup(), view = render(<App />)
  await openPlannerPanel(user, 'Proficiency Progression')
  await openPlannerPanel(user, 'Ability Planning Shortlist')
  await screen.findByRole('region', { name: 'Ability planning shortlist' })
  return { user, view }
}
async function add(user: ReturnType<typeof userEvent.setup>, path: string) {
  await user.click(plannerRole('button', { name: `Add to shortlist: ${path}` }))
}
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear()
  for (const [key, descriptor] of [['createObjectURL', createDescriptor], ['revokeObjectURL', revokeDescriptor]] as const) {
    if (descriptor) Object.defineProperty(URL, key, descriptor); else Reflect.deleteProperty(URL, key)
  }
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Download .txt shortlist action', () => {
  it('downloads Alexandra’s actual three records using exactly the Copy formatter and preserves reordering', async () => {
    const { user } = await start(), { create, filenames, write } = browser()
    await add(user, 'Haze Slice · Sword D'); await add(user, 'Rend Armor · Sword C')
    await user.click(withinPlanner(plannerRole('group', { name: 'Proficiency categories' })).getByRole('button', { name: 'Flying' }))
    await add(user, 'Flitting Flier · Flying C+')
    const records = [sword('D'), sword('C'), flier()], expected = formatShortlistText(profile, records, source)
    const ids = () => [...panel().querySelectorAll<HTMLElement>('[data-source-record-id]')].map(card => card.dataset.sourceRecordId)
    const before = ids()
    await user.click(copy()); expect(write.mock.calls[0][0]).toBe(expected)
    download().focus(); await user.keyboard('{Enter}')
    expect(await readBlob(create.mock.calls[0][0])).toBe(expected)
    expect(create.mock.calls[0][0].type).toBe('text/plain;charset=utf-8'); expect(filenames).toEqual(['alexandra-ability-shortlist.txt'])
    expect(ids()).toEqual(before); expect(withinPlanner(area()).getByRole('status').textContent).toBe('Download started: alexandra-ability-shortlist.txt. Check your browser’s downloads.')
    expect(area().textContent).not.toMatch(/saved successfully|file saved|download complete/i)
    for (const entry of records) for (const value of [entry.entry.text, entry.entry.rank, entry.entry.evidence, entry.entry.source, entry.entry.sourceUrl]) expect(expected).toContain(value)
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Move Flitting Flier · Flying C+ up' }))
    expect(withinPlanner(area()).queryByRole('status')).toBeNull()
    await user.click(download())
    expect(await readBlob(create.mock.calls[1][0])).toBe(formatShortlistText(profile, [records[0], records[2], records[1]], source))
    await user.click(copy()); expect(write.mock.calls[1][0]).toBe(await readBlob(create.mock.calls[1][0]))
    expect(document.querySelector('a[download]')).toBeNull()
  })
  it('preserves UTF-8, Greek characters, apostrophes and plus ranks without another formatter', async () => {
    const user = userEvent.setup(), { create, filenames } = browser()
    const base = sword('D'), entries = [{ ...base, entry: { ...base.entry, text: "Mu’s Γ / 'α' — +1", rank: 'S+' } }, flier()]
    render(<ShortlistCopy profile={profile} source={source} entries={entries} />)
    await user.click(download())
    const text = await readBlob(create.mock.calls[0][0])
    expect(text).toBe(formatShortlistText(profile, entries, source)); expect(text).toContain("Mu’s Γ / 'α' — +1")
    expect(text).toContain('Proficiency: Sword S+'); expect(text).toContain('Proficiency: Flying C+')
    expect(filenames).toEqual(['alexandra-ability-shortlist.txt'])
  })
  it('disables empty downloads and immediately uses independent Mu profiles with distinct filenames', async () => {
    const user = userEvent.setup(), { create, filenames } = browser()
    const props = { source }, mu = { id: 'Mu', displayName: 'Mu' }, other = { id: 'Mu (with growth)', displayName: 'Mu (with growth)' }
    const view = render(<ShortlistCopy {...props} profile={mu} entries={[]} />)
    expect((download() as HTMLButtonElement).disabled).toBe(true); await user.click(download()); expect(create).not.toHaveBeenCalled()
    const original = muPlan('Mu', 'D'), alternate = muPlan(other.id, 'C')
    view.rerender(<ShortlistCopy {...props} profile={mu} entries={[original]} />); await user.click(download())
    view.rerender(<ShortlistCopy {...props} profile={other} entries={[alternate]} />)
    expect(screen.queryByRole('status')).toBeNull(); download().focus(); await user.keyboard(' ')
    expect(filenames).toEqual(['mu-ability-shortlist.txt', 'mu-with-growth-ability-shortlist.txt'])
    expect(await readBlob(create.mock.calls[0][0])).toBe(formatShortlistText(mu, [original], source))
    const text = await readBlob(create.mock.calls[1][0]); expect(text).toContain('Character: Mu (with growth)\n'); expect(text).not.toContain('Wrath Strike')
    view.rerender(<ShortlistCopy {...props} profile={{ id: 'Sofia', displayName: 'Sofia' }} entries={[]} />)
    expect((download() as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole('status')).toBeNull()
  })
  it.each(['missing', 'create', 'click', 'append'])('offers the existing selected fallback after a %s download failure and keeps Copy working', async failure => {
    const user = userEvent.setup(), { create, click, revoke, write } = browser(), entries = [sword('D')]
    render(<ShortlistCopy profile={profile} source={source} entries={entries} />)
    if (failure === 'missing') Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    if (failure === 'create') create.mockImplementation(() => { throw new Error('Blocked') })
    if (failure === 'click') click.mockImplementation(() => { throw new Error('Blocked') })
    if (failure === 'append') vi.spyOn(document.body, 'appendChild').mockImplementation(() => { throw new Error('Blocked') })
    await user.click(download())
    expect(screen.getByRole('alert').textContent).toContain('could not start the download')
    expect(screen.queryByRole('status')).toBeNull(); expect(document.querySelector('a[download]')).toBeNull()
    const fallback = screen.getByRole('textbox', { name: 'Shortlist text for manual copying' }) as HTMLTextAreaElement
    expect(fallback.value).toBe(formatShortlistText(profile, entries, source)); expect(fallback.readOnly).toBe(true)
    expect(document.activeElement).toBe(fallback); expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    if (failure === 'click' || failure === 'append') expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:shortlist-download')
    else expect(revoke).not.toHaveBeenCalled()
    await user.click(copy()); expect(write.mock.calls[0][0]).toBe(fallback.value)
    expect(screen.getByRole('status').textContent).toBe('Copied shortlist for Alexandra (1 entry).'); expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('does not let an earlier pending clipboard operation replace download feedback', async () => {
    browser(); const user = userEvent.setup(); let finish!: () => void
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>(resolve => { finish = resolve }) } })
    render(<ShortlistCopy profile={profile} source={source} entries={[sword('D')]} />)
    await user.click(copy()); expect(screen.getByRole('status').textContent).toBe('Copying shortlist…')
    await user.click(download()); await act(async () => finish())
    expect(screen.getByRole('status').textContent).toContain('Download started:')
    expect((copy() as HTMLButtonElement).disabled).toBe(false)
  })
  it('preserves selectors, filters, navigation, presets, calculations and session-only refresh reset', async () => {
    const preset = createPreset('Existing build', { characterName: 'Alexandra', className: 'Gladiator' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('unrelated', 'keep')
    const store = vi.spyOn(Storage.prototype, 'setItem'), remove = vi.spyOn(Storage.prototype, 'removeItem'), clear = vi.spyOn(Storage.prototype, 'clear')
    const { create } = browser(), { user, view } = await start()
    await openPlannerPanel(user, 'Build Comparison')
    const values = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = values(); await add(user, 'Haze Slice · Sword D')
    const search = screen.getByLabelText('Search ability names') as HTMLInputElement, rank = screen.getByLabelText('Rank filter') as HTMLSelectElement
    fireEvent.change(search, { target: { value: 'no matches' } }); await user.selectOptions(rank, 'documented')
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'View in Proficiency Progression: Haze Slice · Sword D' }))
    expect(plannerRole('button', { name: 'Return to Shortlist' })).toBeDefined()
    await user.click(download()); expect(search.value).toBe('no matches'); expect(rank.value).toBe('documented')
    await user.click(plannerRole('button', { name: 'Return to Shortlist' }))
    const card = panel().querySelector<HTMLElement>('[data-source-record-id]')!
    await waitFor(() => expect(document.activeElement).toBe(card))
    expect(values()).toEqual(before); expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra')
    expect((plannerRole('combobox', { name: 'Class' }) as HTMLSelectElement).value).toBe('Gladiator')
    expect(create).toHaveBeenCalledTimes(1); expect(store).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('unrelated')).toBe('keep')
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Ability Planning Shortlist'); await screen.findByRole('region', { name: 'Ability planning shortlist' })
    expect((download() as HTMLButtonElement).disabled).toBe(true); expect((copy() as HTMLButtonElement).disabled).toBe(true)
    expect(panel().querySelectorAll('[data-source-record-id]')).toHaveLength(0); expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
    expect(store).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
  })
})
