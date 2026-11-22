import { openPlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import BuildOverviewCopy from './BuildOverviewCopy'
import { selectMainBuildOverview } from './buildOverview'
import { formatBuildOverviewText } from './buildOverviewText'
import { mainBuildFilename } from './shortlistDownload'
import * as growths from './growths'
import { growthData, STATS } from './growths'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { resolvePlanningEntry } from './shortlist'
import { proficiencyData } from './proficiencies'
import { createPreset, PRESET_KEY } from './presets'

const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const downloadDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download')
const plan = (name: string, rank: string) => resolvePlanningEntry(name, 'Sword', rank,
  proficiencyData.categories.Sword.characters[name === 'Mu (with growth)' ? 'Mu' : name].find(entry => entry.rank === rank)!.source)!
const empty = (name = 'Alexandra', className = 'Wing Soldier') => selectMainBuildOverview({
  character: growthData.characters.find(record => record.name === name)!, selectedClass: growthData.classes.find(record => record.name === className)!, entries: [],
})
const complete = () => selectMainBuildOverview({ ...empty(), weaponId: weaponData.records.find(record => record.name === 'Levin Sword')!.id,
  mountId: 'Mounts!A18', battalionId: battalionData.records[0].id, entries: ['D', 'C', 'B'].map(rank => plan('Alexandra', rank)) })
const area = () => plannerRole('group', { name: 'Copy main build overview' })
const download = () => withinPlanner(area()).getByRole('button', { name: 'Download .txt' })
const copy = () => withinPlanner(area()).getByRole('button', { name: 'Copy Build Overview' })
const read = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsText(blob, 'utf-8')
})
function browser() {
  const create = vi.fn((_blob: Blob) => `blob:main-build-${create.mock.calls.length}`), revoke = vi.fn(), anchors: HTMLAnchorElement[] = []
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { anchors.push(this) })
  const write = vi.fn(async (_text: string) => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
  return { create, revoke, anchors, click, write }
}
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear()
  for (const [object, key, descriptor] of [[URL, 'createObjectURL', createDescriptor], [URL, 'revokeObjectURL', revokeDescriptor], [navigator, 'clipboard', clipboardDescriptor], [HTMLAnchorElement.prototype, 'download', downloadDescriptor]] as const) {
    if (descriptor) Object.defineProperty(object, key, descriptor); else Reflect.deleteProperty(object, key)
  }
})

describe('main build filenames', () => {
  it.each([
    ['Alexandra', 'alexandra'], ['Sofia', 'sofia'], ['Mu', 'mu'], ['Mu (with growth)', 'mu-with-growth'],
    ["O'Brien", 'o-brien'], ['Élodie α Γ', 'elodie-α-γ'], ['../C:\\Mu<>:"/\\|?* .', 'c-mu'],
    ['CON', 'character-con'], ['PRN', 'character-prn'], ['COM9', 'character-com9'], ['LPT¹', 'character-lpt1'],
    ['NUL.txt', 'nul-txt'], ['', 'character'], [' . / \\ : * ? " < > | ', 'character'],
  ])('sanitizes %j through the existing filename policy', (input, stem) => {
    const result = mainBuildFilename(input)
    expect(result).toBe(`${stem}-main-build.txt`)
    expect(result).not.toMatch(/[<>:"/\\|?*\x00-\x1f]/)
    expect(result).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i)
  })
  it('caps the Unicode stem and preserves distinct Mu profile filenames', () => {
    const result = mainBuildFilename('𐐀'.repeat(200) + ' ./')
    expect(Array.from(result.replace('-main-build.txt', ''))).toHaveLength(80)
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    expect(mainBuildFilename('Mu')).not.toBe(mainBuildFilename('Mu (with growth)'))
  })
})

describe('Download main build overview', () => {
  it('downloads the complete Alexandra plan exactly as copied, with UTF-8 MIME, sources, warnings and keyboard feedback', async () => {
    const user = userEvent.setup(), api = browser(), data = complete(); render(<BuildOverviewCopy data={data} />)
    await user.click(copy()); download().focus(); await user.keyboard('{Enter}')
    const text = await read(api.create.mock.calls[0][0])
    expect(text).toBe(formatBuildOverviewText(data)); expect(text).toBe(api.write.mock.calls[0][0]); expect(text).not.toContain('\r')
    expect(api.create.mock.calls[0][0].type).toBe('text/plain;charset=utf-8')
    expect(api.anchors[0].download).toBe('alexandra-main-build.txt'); expect(api.anchors[0].isConnected).toBe(false)
    for (const value of ['Character: Alexandra', 'Class: Wing Soldier', 'Name: Levin Sword', "Name: Bucephalus (Alexandra's mount)", 'Name: Bronze-Shield Guard', 'PLANNED ABILITIES (3/8)', '1. Haze Slice', '2. Rend Armor', '3. Gale Blow', 'provisional classification', 'Authority requirement: E · Unverified', 'character eligibility not verified', 'Forging!D28', 'Excel date encoding retained', 'https://docs.google.com/', 'Community-listed / unverified', 'PLANNING DISCLAIMER']) expect(text).toContain(value)
    expect(withinPlanner(area()).getByRole('status').textContent).toBe('Download started.')
    expect(area().textContent).not.toMatch(/file saved|download completed|saved to downloads/i)
    expect(withinPlanner(area()).queryByRole('textbox')).toBeNull()
  })
  it('allows empty equipment and ability selections without inventing defaults', async () => {
    const user = userEvent.setup(), api = browser(), data = empty(); render(<BuildOverviewCopy data={data} />)
    expect((download() as HTMLButtonElement).disabled).toBe(false); await user.click(download())
    const text = await read(api.create.mock.calls[0][0]); expect(text).toBe(formatBuildOverviewText(data))
    for (const value of ['Weapon: Not selected.', 'Mount: Not selected.', 'Battalion: Not selected.', 'PLANNED ABILITIES (0/8)']) expect(text).toContain(value)
    expect(api.write).not.toHaveBeenCalled()
  })
  it('reuses delayed cleanup for repeated downloads without leaving anchors or object URLs', () => {
    vi.useFakeTimers(); const api = browser(); render(<BuildOverviewCopy data={complete()} />)
    api.click.mockImplementation(function (this: HTMLAnchorElement) { api.anchors.push(this); expect(this.isConnected).toBe(true); expect(this.hidden).toBe(true) })
    fireEvent.click(download()); fireEvent.click(download()); fireEvent.click(download())
    expect(api.create).toHaveBeenCalledTimes(3); expect(document.querySelector('a[download]')).toBeNull(); expect(api.revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999); expect(api.revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(1)
    expect(api.revoke.mock.calls.map(([url]) => url)).toEqual(['blob:main-build-1', 'blob:main-build-2', 'blob:main-build-3'])
    expect(api.write).not.toHaveBeenCalled()
  })
  it.each(['missing-url', 'missing-cleanup', 'missing-blob', 'missing-anchor-download', 'create', 'append', 'click'])('offers the same selected fallback after %s failure without writing the clipboard', async failure => {
    const user = userEvent.setup(), api = browser(), data = complete(); render(<BuildOverviewCopy data={data} />)
    if (failure === 'missing-url') Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    if (failure === 'missing-cleanup') Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: undefined })
    if (failure === 'missing-blob') vi.stubGlobal('Blob', undefined)
    if (failure === 'missing-anchor-download') Reflect.deleteProperty(HTMLAnchorElement.prototype, 'download')
    if (failure === 'create') api.create.mockImplementation(() => { throw new Error('No object URL') })
    if (failure === 'append') vi.spyOn(document.body, 'appendChild').mockImplementation(() => { throw new Error('No append') })
    if (failure === 'click') api.click.mockImplementation(() => { throw new Error('Blocked') })
    await user.click(download())
    expect(withinPlanner(area()).getByRole('alert').textContent).toBe('The browser could not start the download. Copy the text below manually.')
    expect(withinPlanner(area()).queryByRole('status')).toBeNull(); expect(api.write).not.toHaveBeenCalled(); expect(document.querySelector('a[download]')).toBeNull()
    const fallback = withinPlanner(area()).getByRole('textbox', { name: 'Build overview text for manual copying' }) as HTMLTextAreaElement
    expect(fallback.value).toBe(formatBuildOverviewText(data)); expect(fallback.readOnly).toBe(true); expect(document.activeElement).toBe(fallback)
    expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    fallback.setSelectionRange(0, 0); withinPlanner(area()).getByRole('button', { name: 'Select build overview text' }).focus(); await user.keyboard(' ')
    expect(document.activeElement).toBe(fallback); expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, fallback.value.length])
    if (failure === 'append' || failure === 'click') expect(api.revoke).toHaveBeenCalledExactlyOnceWith('blob:main-build-1')
    else expect(api.revoke).not.toHaveBeenCalled()
  })
  it('does not let a pending clipboard write replace newer download success or failure feedback', async () => {
    const user = userEvent.setup(), api = browser(); render(<BuildOverviewCopy data={complete()} />)
    let finish!: () => void
    api.write.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    await user.click(copy()); await user.click(download()); await act(async () => finish())
    expect(withinPlanner(area()).getByRole('status').textContent).toBe('Download started.')
    await user.click(copy()); api.click.mockImplementation(() => { throw new Error('Blocked') }); await user.click(download()); await act(async () => finish())
    expect(withinPlanner(area()).queryByRole('status')).toBeNull(); expect(withinPlanner(area()).getByRole('alert').textContent).toContain('could not start')
  })
  it('uses immediate character/class/order changes and exact independent profile records', async () => {
    const user = userEvent.setup(), api = browser(), view = render(<BuildOverviewCopy data={complete()} />)
    const names = ['Alexandra', 'Sofia', 'Mu', 'Mu (with growth)']
    for (const [index, name] of names.entries()) {
      const data = selectMainBuildOverview({ ...empty(name, index % 2 ? 'Gladiator' : 'Wing Soldier'),
        weaponId: weaponData.records[index].id, mountId: `Mounts!A${[18, 8, 2, 14][index]}`, battalionId: battalionData.records[index].id,
        entries: [plan(name, 'C'), plan(name, 'D')] })
      view.rerender(<BuildOverviewCopy data={data} />); expect(withinPlanner(area()).queryByRole('status')).toBeNull(); await user.click(download())
      const text = await read(api.create.mock.calls[index][0]); expect(text).toBe(formatBuildOverviewText(data)); expect(api.anchors[index].download).toBe(mainBuildFilename(name))
      expect(text).toContain(`Character: ${name}\n`); expect(text).toContain(`Name: ${weaponData.records[index].name}\n`)
      expect(text).toContain(`1. ${plan(name, 'C').entry.text}`); expect(text).toContain(`2. ${plan(name, 'D').entry.text}`)
      if (index === 1) { expect(text).toContain('This class has no mount type listed.'); expect(text).toContain('Battalions listed by this class.') }
      if (index === 3) expect(text).toContain("Mu (with growth) uses Mu's source learnset")
    }
    expect(api.anchors[2].download).not.toBe(api.anchors[3].download)
  })
  it('retains conflicting source warnings and incomplete weapon information exactly', async () => {
    const user = userEvent.setup(), api = browser(), view = render(<BuildOverviewCopy data={complete()} />)
    for (const [index, name] of ['Zanbato', 'Whirlwind Blade'].entries()) {
      const data = selectMainBuildOverview({ ...empty(), weaponId: weaponData.records.find(record => record.name === name)!.id, mountId: 'Mounts!A4' })
      view.rerender(<BuildOverviewCopy data={data} />); await user.click(download()); const text = await read(api.create.mock.calls[index][0])
      expect(text).toBe(formatBuildOverviewText(data)); expect(text).toContain('neither version is selected for calculations')
      if (index === 0) expect(text).toContain('Documented Might: main 14-19; preliminary Zanbato 7-19')
      else { expect(text).toContain('Might: Not documented'); expect(text).toContain('Missing values are not zero.'); expect(text).not.toContain('Might: 0') }
    }
  })
  it('preserves UTF-8 names, Greek text, apostrophes, C+/S+ ranks and distinct same-name source identities', async () => {
    const user = userEvent.setup(), api = browser(), data = complete(), first = plan('Alexandra', 'S+')
    const other = resolvePlanningEntry('Alexandra', 'Flying', 'C+', "'Flying'!C2")!
    const entries = [first, { ...other, entry: { ...other.entry, text: first.entry.text } }, { ...data.entries[0], entry: { ...data.entries[0].entry, text: "Mu’s α Γ — Io's" } }]
    const input = { ...data, entries }; render(<BuildOverviewCopy data={input} />); await user.click(copy()); await user.click(download())
    const text = await read(api.create.mock.calls[0][0]); expect(text).toBe(api.write.mock.calls[0][0]); expect(text).toBe(formatBuildOverviewText(input))
    for (const value of ['Sword S+', 'Flying C+', "Source: 'Sword'!G2", "Source: 'Flying'!C2", "Mu’s α Γ — Io's"]) expect(text).toContain(value)
    expect(text.match(/\d\. Swordfaire/g)).toHaveLength(2)
  })
  it('keeps actual app selections, source order, filters, presets, A/B and growth calculations unchanged and resets session plans on remount', async () => {
    const preset = createPreset('Existing', { characterName: 'Alexandra', className: 'Wing Soldier' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] }); localStorage.setItem(PRESET_KEY, payload); sessionStorage.setItem('marker', 'keep')
    const writes = vi.spyOn(Storage.prototype, 'setItem'), removes = vi.spyOn(Storage.prototype, 'removeItem'), clears = vi.spyOn(Storage.prototype, 'clear')
    const user = userEvent.setup(), api = browser(), view = render(<App />)
    expect(screen.getByText('Main Build Overview', { exact: true }).closest('details')!.open).toBe(false)
    for (const label of ['Main Build Overview', 'Selected Weapon', 'Selected Mount', 'Selected Battalion', 'Proficiency Progression', 'Build Comparison']) await openPlannerPanel(user, label)
    await user.selectOptions(screen.getByLabelText('Weapon for Alexandra'), weaponData.records[0].id)
    await user.selectOptions(screen.getByLabelText('Mount for Alexandra'), 'Mounts!A18'); await user.selectOptions(screen.getByLabelText('Battalion for Alexandra'), battalionData.records[0].id)
    await user.click(plannerRole('button', { name: 'Add to shortlist: Haze Slice · Sword D' }))
    const overview = plannerRole('region', { name: 'Main build planning overview' })
    const state = () => ({ selects: [...document.querySelectorAll('select')].map(node => node.value), inputs: [...document.querySelectorAll('input')].map(node => node.value),
      ids: [...overview.querySelectorAll<HTMLElement>('[data-overview-source-id]')].map(node => node.dataset.overviewSourceId),
      growths: STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`) })
    const before = state(), calculate = vi.spyOn(growths, 'combineGrowths'); await user.click(download())
    expect(state()).toEqual(before); expect(calculate).not.toHaveBeenCalled(); expect(api.write).not.toHaveBeenCalled()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(sessionStorage.getItem('marker')).toBe('keep')
    expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
    view.unmount(); render(<App />); await openPlannerPanel(user, 'Main Build Overview'); await user.click(download())
    const reset = await read(api.create.mock.calls[1][0]); expect(reset).toContain('PLANNED ABILITIES (0/8)'); expect(reset.match(/Not selected\./g)).toHaveLength(3)
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload); expect(writes).not.toHaveBeenCalled(); expect(removes).not.toHaveBeenCalled(); expect(clears).not.toHaveBeenCalled()
  })
})
