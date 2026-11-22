import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { dungeonData } from './dungeons'
import { STATS } from './growths'
import { createPreset, PRESET_KEY } from './presets'

afterEach(() => { cleanup(); localStorage.clear() })
const browser = () => plannerRole('region', { name: 'Dungeon chest reference browser' })
const catalog = () => withinPlanner(browser()).getByRole('list', { name: 'Dungeon location catalog' })
const detail = (name: string) => withinPlanner(browser()).getByRole('region', { name: `${name.trim()} dungeon details` })
const table = (name: string) => withinPlanner(detail(name)).getByRole('table', { name: `Chest rewards at ${name.trim()}` })
const cells = (name: string) => [...table(name).querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('.reward-text')].map(cell => cell.textContent))
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Dungeon Chests & Rewards')
  await screen.findByRole('region', { name: 'Dungeon chest reference browser' })
  return user
}
async function inspect(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${name}` }))
}

describe('Dungeon Chests & Rewards', () => {
  it('starts collapsed, lists all 31 locations and shows one row per Corroios chest with source links', async () => {
    render(<App />)
    expect(screen.getByText('Dungeon Chests & Rewards').closest('details')?.open).toBe(false)
    await openPlannerPanel(userEvent, 'Dungeon Chests & Rewards')
    await screen.findByRole('region', { name: 'Dungeon chest reference browser' })
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(31)
    expect(cells('Corroios Fort Ruins')).toEqual([['Poisonbone Chain', 'Large Bullion'], ['Magic Staff', 'Horsekiller Bow +2'], ['Tactics Manual', 'Talisman']])
    expect(withinPlanner(table('Corroios Fort Ruins')).getAllByRole('row')).toHaveLength(4)
    expect(withinPlanner(table('Corroios Fort Ruins')).getByRole('columnheader', { name: 'Part I' })).toBeDefined()
    const link = withinPlanner(table('Corroios Fort Ruins')).getByRole('link', { name: 'Dungeon Chests!B2' }) as HTMLAnchorElement
    expect(new URL(link.href).searchParams.get('range')).toBe('B2')
    expect(new URL(link.href).searchParams.get('sheet')).toBe('Dungeon Chests')
    expect(link.target).toBe('_blank')
    plannerRole('region', {name: 'Build workspace'})
    expect(screen.getAllByRole('article')).toHaveLength(9)
  })

  it('verifies Nowah, sparse Uncharted, Palace placeholders and exact Southern Passage Latin spelling', async () => {
    const user = await open()
    await inspect(user, "Nowah's Cave")
    expect(cells("Nowah's Cave")).toHaveLength(4)
    expect(cells("Nowah's Cave")[1]).toEqual(['Tactics Manual', 'Killing Edge +3'])
    expect(cells("Nowah's Cave")[3]).toEqual(['Pure Water', 'Goddess Icon'])
    await inspect(user, 'Uncharted Isle')
    expect(cells('Uncharted Isle')).toEqual([['Thick Foreign Tome', 'Talisman']])
    expect(withinPlanner(table('Uncharted Isle')).getByRole('rowheader').textContent).toContain('Chest 2')
    expect(withinPlanner(table('Uncharted Isle')).queryByText('Chest 1', { exact: true })).toBeNull()
    await inspect(user, 'Palace of Sand')
    expect(cells('Palace of Sand')).toEqual([['-', 'Salamander'], ['-', 'Giant Shell'], ['-', 'Large Bullion'], ['-', 'Extra Large Bullion']])
    expect(withinPlanner(detail('Palace of Sand')).getAllByText('Dash placeholder')).toHaveLength(4)
    expect(detail('Palace of Sand').textContent).toContain('not an obtainable item')
    await inspect(user, 'Southern Passage')
    expect(cells('Southern Passage')[1]).toEqual(['Swarm Z', 'Black Pearl'])
  })

  it('combines normalized location/reward queries with selected phase and changes visible columns', async () => {
    const user = await open()
    const search = screen.getByLabelText('Search dungeon or reward names'), reward = screen.getByLabelText('Locations containing reward')
    await user.type(search, '  COUGAR   WOODLANDS ')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
    await inspect(user, 'Cougar Woodlands')
    expect(cells('Cougar Woodlands ')).toHaveLength(4)
    await user.clear(search); await user.type(reward, 'Poisonbone Chain')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
    await inspect(user, 'Corroios Fort Ruins')
    await user.selectOptions(screen.getByLabelText('Reward phase'), 'part1')
    expect(cells('Corroios Fort Ruins')).toEqual([['Poisonbone Chain'], ['Magic Staff'], ['Tactics Manual']])
    expect(withinPlanner(table('Corroios Fort Ruins')).queryByRole('columnheader', { name: 'Part III' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Reward phase'), 'part3')
    expect(withinPlanner(catalog()).queryAllByRole('button')).toHaveLength(0)
    expect(cells('Corroios Fort Ruins')).toEqual([['Large Bullion'], ['Horsekiller Bow +2'], ['Talisman']])
    expect(detail('Corroios Fort Ruins').textContent).toContain('outside the filters')
  })

  it('filters unresolved entries in the active phase without hiding a selected location', async () => {
    const user = await open()
    await user.click(screen.getByLabelText('Locations with unresolved entries'))
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
    await inspect(user, 'Palace of Sand')
    await user.selectOptions(screen.getByLabelText('Reward phase'), 'part3')
    expect(withinPlanner(catalog()).queryAllByRole('button')).toHaveLength(0)
    expect(detail('Palace of Sand')).toBeDefined()
    expect(withinPlanner(browser()).getByText(/Unresolved includes dash placeholders/)).toBeDefined()
  })

  it('shows explicit Enno and Grand Megalith notes while leaving discussions and corrections separate', async () => {
    const user = await open()
    await inspect(user, 'Enno Isle*')
    expect(withinPlanner(detail('Enno Isle*')).getByRole('region', { name: 'Location-specific source notes' }).textContent).toContain('Theodora only in P1 due to Boat')
    expect(withinPlanner(detail('Enno Isle*')).getByRole('link', { name: 'Dungeon Chests!A34' })).toBeDefined()
    await inspect(user, 'Palace of Sand')
    expect(detail('Palace of Sand').textContent).toContain('Grand Megalith access (Magellan)')
    await inspect(user, 'Rubess Forest')
    expect(detail('Rubess Forest').textContent).not.toContain('Archive Τ')
    const notesLabel = withinPlanner(browser()).getByText('General dungeon research notes', { exact: true })
    await user.click(notesLabel)
    const notes = notesLabel.closest('details')!
    for (const fragment of ['Archive Τ for Dark Spikes Τ', 'is this supposed to be about Uncharted Isle?', 'door is locked', 'unconfirmed', 'Purple - Cursed Equipment']) expect(notes.textContent).toContain(fragment)
    expect(withinPlanner(notes).getByRole('link', { name: 'Dungeon Chests!H26' })).toBeDefined()
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(31)
  })

  it('retains filters/inspection across character changes, preset loads and collapse without changing saved schema', async () => {
    const preset = createPreset('Sofia', { characterName: 'Sofia', className: 'The Calamity' }, [])
    const raw = JSON.stringify({ schemaVersion: 1, presets: [preset] })
    localStorage.setItem(PRESET_KEY, raw)
    const user = await open()
    await user.type(screen.getByLabelText('Search dungeon or reward names'), 'Nowah')
    await inspect(user, "Nowah's Cave")
    await selectMain(user, 'Character', 'Mu (with growth)')
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(plannerRole('button', { name: 'Load into Main planner' }))
    expect(screen.getByTestId('combined-Mag').textContent).toBe('60%')
    expect((screen.getByLabelText('Search dungeon or reward names') as HTMLInputElement).value).toBe('Nowah')
    expect(detail("Nowah's Cave")).toBeDefined()
    expect(localStorage.getItem(PRESET_KEY)).toBe(raw)
    await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    expect(detail("Nowah's Cave")).toBeDefined()
  })

  it('navigates in both directions by location name, opens the target and focuses its heading without clearing filters', async () => {
    const user = await open()
    await user.type(screen.getByLabelText('Search dungeon or reward names'), 'Nowah')
    await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    await openPlannerPanel(user, 'Magic Scrolls')
    await user.click(plannerRole('button', { name: 'Inspect Mire Β' }))
    await user.type(screen.getByLabelText('Search scroll name or source tome/archive'), 'Night')
    await user.click(plannerRole('button', { name: 'View dungeon: Cave Behind the Falls' }))
    expect(screen.getByText('Dungeon Chests & Rewards').closest('details')?.open).toBe(true)
    expect(detail('Cave Behind the Falls')).toBeDefined()
    expect(document.activeElement).toBe(withinPlanner(detail('Cave Behind the Falls')).getByRole('heading', { name: 'Cave Behind the Falls' }))
    expect((screen.getByLabelText('Search dungeon or reward names') as HTMLInputElement).value).toBe('Nowah')
    expect(detail('Cave Behind the Falls').textContent).toContain('outside the filters')
    await user.click(screen.getByText('Magic-scroll acquisition references', { exact: true }))
    await user.click(plannerRole('button', { name: 'View Mire Β · Part I acquisition' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Mire Β' }))
    expect((screen.getByLabelText('Search scroll name or source tome/archive') as HTMLInputElement).value).toBe('Night')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('keeps cross-sheet differences visible and navigation does not equate rewards or spell labels', async () => {
    const user = await open()
    await inspect(user, 'Uncharted Isle')
    await user.click(screen.getByText('Magic-scroll acquisition references', { exact: true }))
    expect(detail('Uncharted Isle').textContent).toContain('Uncharted Isle chest')
    await user.click(plannerRole('button', { name: 'View Dark Spikes Τ · Part III acquisition' }))
    const links = plannerRole('region', { name: 'Dungeon location references' })
    expect(links.textContent).toContain('Part III chest labels at Uncharted Isle: 2: Talisman')
    expect(links.textContent).toContain('Greek/Latin item labels')
    expect(links.textContent).not.toContain('Archive Τ')
  })

  it('opens a dungeon for the first time directly from a scroll acquisition and focuses the target', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Dungeon Chests & Rewards').closest('details')?.open).toBe(false)
    await openPlannerPanel(user, 'Magic Scrolls')
    await user.click(plannerRole('button', { name: 'Inspect Swarm Ζ' }))
    await user.click(plannerRole('button', { name: 'View dungeon: Southern Passage' }))
    const target = await screen.findByRole('region', { name: 'Southern Passage dungeon details' })
    expect(document.activeElement).toBe(withinPlanner(target).getByRole('heading', { name: 'Southern Passage' }))
    expect(cells('Southern Passage')[1]).toEqual(['Swarm Z', 'Black Pearl'])
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('browsing key locations and navigation leaves all main/comparison growths and warnings unchanged', async () => {
    const user = await open()
    await selectMain(user, 'Class', 'Armored Ornius Rider')
    await openPlannerPanel(user, 'Build Comparison')
    const values = () => STATS.map(stat => `${screen.getByTestId(`combined-${stat}`).textContent}/${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}`)
    const before = values()
    for (const name of ['Uncharted Isle', 'Southern Passage', "Nowah's Cave", 'Palace of Sand']) { await inspect(user, name); expect(values()).toEqual(before) }
    expect(plannerRole('note', {name: ''}).textContent).toContain('DATA-12')
  })

  it('keeps malformed raw cells inspectable, renders missing states and uses accessible row/column labels', async () => {
    const chest = dungeonData.records[0].chests[0], old = { raw: chest.raw, part1: chest.part1, part3: chest.part3 }
    try {
      chest.raw = 'Ambiguous\nextra\nline'
      chest.part1 = { raw: null, status: 'unresolved' }; chest.part3 = { raw: '', status: 'empty' }
      const user = await open()
      expect(table('Corroios Fort Ruins').textContent).toContain('Unresolved source')
      expect(table('Corroios Fort Ruins').textContent).toContain('Missing reward entry')
      expect(withinPlanner(table('Corroios Fort Ruins')).getAllByRole('rowheader')).toHaveLength(3)
      await user.click(screen.getByText('Raw chest cells', { exact: true }))
      expect(withinPlanner(detail('Corroios Fort Ruins')).getByText('Ambiguous extra line').textContent).toBe('Ambiguous\nextra\nline')
    } finally { Object.assign(chest, old) }
  })
})
