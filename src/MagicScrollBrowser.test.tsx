import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STATS } from './growths'
import { scrollData } from './scrolls'
import { createPreset, PRESET_KEY } from './presets'

afterEach(() => { cleanup(); localStorage.clear() })
const browser = () => plannerRole('region', { name: 'Magic scroll reference browser' })
const catalog = () => withinPlanner(browser()).getByRole('list', { name: 'Magic scroll catalog' })
const detail = (name: string) => withinPlanner(browser()).getByRole('region', { name: `${name} scroll details` })
const record = (name: string) => scrollData.records.find(item => item.name === name)!
const selected = (label: string) => plannerRole('combobox', { name: label }) as HTMLSelectElement
const mainValues = () => STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Magic Scrolls')
  return user
}

describe('read-only magic scroll catalog', () => {
  it('starts collapsed, offers all seven references and shows Fimbulvetr properties and provenance', async () => {
    render(<App />)
    expect(screen.getByText('Magic Scrolls').closest('details')?.open).toBe(false)
    await openPlannerPanel(userEvent, 'Magic Scrolls')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(7)
    const selected = detail('Fimbulvetr Night')
    for (const [label, value] of [['Might', '30'], ['Hit', '80'], ['Range', '1-2'], ['Weight', '28'], ['Crit', '10'], ['Avoidance', '0'], ['Uses', '1']]) {
      expect(withinPlanner(selected).getByText(label, { exact: true }).closest('div')?.querySelector('dd')?.textContent).toBe(value)
    }
    expect(selected.textContent).toContain('Fimbulvetr Tome')
    expect(selected.textContent).toContain('Magic Scrolls!A2:L2')
    expect(selected.textContent).toContain('Magic Scrolls!C2')
    expect(withinPlanner(selected).getByRole('group', { name: 'Part 1 acquisition information' }).textContent).toContain('Unavailable (N/A)')
    expect(selected.textContent).toContain("Smyrnos's Request")
    expect(selected.textContent).toContain('Temple to be repaired')
    expect(withinPlanner(browser()).getByText(/not a calculated combat forecast/)).toBeDefined()
    plannerRole('region', {name: 'Build workspace'})
    expect(screen.getAllByRole('article')).toHaveLength(9)
  })

  it('searches names, source archives and exact Greek letters without transliteration', async () => {
    const user = await open()
    const input = screen.getByLabelText('Search scroll name or source tome/archive')
    for (const [query, name] of [['night', 'Fimbulvetr Night'], ['Agnea Tome', "Agnea's Arrow"], ['Archive Γ', 'Death Γ'], ['Mire Β', 'Mire Β']]) {
      await user.clear(input); await user.type(input, query)
      expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${name}` }))
      expect(detail(name)).toBeDefined()
    }
    await user.clear(input); await user.type(input, 'Mire B')
    expect(withinPlanner(catalog()).queryAllByRole('button')).toHaveLength(0)
    expect(withinPlanner(browser()).getByText(/No scrolls match/)).toBeDefined()
    expect(detail('Mire Β').textContent).toContain('outside the filters')
  })

  it('combines acquisition filters and distinguishes documented, N/A, unknown and empty', async () => {
    const user = await open()
    await user.selectOptions(selected('Part 1 acquisition'), 'documented')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(4)
    await user.selectOptions(selected('Part 3 acquisition'), 'unknown')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(4)
    await user.selectOptions(selected('Part 1 acquisition'), 'unavailable')
    expect(withinPlanner(catalog()).queryAllByRole('button')).toHaveLength(0)
    await user.selectOptions(selected('Part 3 acquisition'), 'documented')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(3)
    await user.selectOptions(selected('Part 1 acquisition'), 'empty')
    expect(withinPlanner(catalog()).queryAllByRole('button')).toHaveLength(0)
    expect(withinPlanner(browser()).getByText(/N\/A, \?, and an empty source cell remain separate/)).toBeDefined()
  })

  it('preserves all requested effects and exact multiline acquisition text without applying mechanics', async () => {
    const user = await open()
    for (const name of ["Agnea's Arrow", 'Dark Spikes Τ', 'Mire Β', 'Death Γ', 'Banshee Θ', 'Swarm Ζ']) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${name}` }))
      const reference = record(name), selected = detail(name)
      for (const [part, label] of [['part1', 'Part 1 acquisition information'], ['part3', 'Part 3 acquisition information']] as const) {
        expect(withinPlanner(selected).getByRole('group', { name: label }).querySelector('.recorded-text')?.textContent).toBe(reference.acquisition[part].text)
      }
      expect(withinPlanner(selected).getByRole('group', { name: 'Recorded description' }).querySelector('.recorded-text')?.textContent).toBe(reference.description.text)
    }
    expect(detail('Swarm Ζ').textContent).toContain("Spd-3 on foe until unit's next phase")
    expect(withinPlanner(browser()).getByText(/do not establish scroll legality/)).toBeDefined()
  })

  it('keeps independent notes separate from every scroll, including tail annotations and route uncertainty', async () => {
    const user = await open()
    const summary = withinPlanner(browser()).getByText('General scroll research notes', { exact: true })
    expect(summary.closest('details')?.open).toBe(false)
    await user.click(summary)
    const notes = summary.closest('details')!
    for (const fragment of ['Torment grass', 'Glirmosa', 'Pongo', 'Chapter 10', 'Probably Ch10', 'story-locked', 'Luna Λ', 'Magic Scrolls!B12', 'Magic Scrolls!K12']) expect(notes.textContent).toContain(fragment)
    for (const entry of scrollData.records) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${entry.name}` }))
      expect(detail(entry.name).textContent).not.toContain('Nysaides')
      expect(detail(entry.name).textContent).not.toContain('Probably Ch10')
    }
  })

  it('retains catalog filters and inspection across character, class and collapse changes', async () => {
    const user = await open()
    await user.type(screen.getByLabelText('Search scroll name or source tome/archive'), 'Mire Β')
    await user.selectOptions(selected('Part 3 acquisition'), 'unknown')
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Mire Β' }))
    await selectMain(user, 'Character', 'Mu (with growth)')
    await selectMain(user, 'Class', 'Armored Ornius Rider')
    expect((screen.getByLabelText('Search scroll name or source tome/archive') as HTMLInputElement).value).toBe('Mire Β')
    expect(selected('Part 3 acquisition').value).toBe('unknown')
    expect(detail('Mire Β')).toBeDefined()
    expect(plannerRole('note', {name: ''}).textContent).toContain('DATA-12')
    await openPlannerPanel(user, 'Magic Scrolls')
    await openPlannerPanel(user, 'Magic Scrolls')
    expect(detail('Mire Β')).toBeDefined()
  })

  it('loads an existing preset without changing scroll state or preset schema', async () => {
    const preset = createPreset('Sofia scroll research', { characterName: 'Sofia', className: 'The Calamity' }, [])
    const raw = JSON.stringify({ schemaVersion: 1, presets: [preset] })
    localStorage.setItem(PRESET_KEY, raw)
    const user = await open()
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Dark Spikes Τ' }))
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(plannerRole('button', { name: 'Load into Main planner' }))
    expect(selected('Character').value).toBe('Sofia')
    expect(selected('Class').value).toBe('The Calamity')
    expect(screen.getByTestId('combined-Mag').textContent).toBe('60%')
    expect(detail('Dark Spikes Τ')).toBeDefined()
    expect(localStorage.getItem(PRESET_KEY)).toBe(raw)
  })

  it('browsing all seven scrolls never changes main or comparison growths', async () => {
    const user = await open()
    await openPlannerPanel(user, 'Build Comparison')
    const before = mainValues()
    const comparison = () => STATS.map(stat => `${screen.getByTestId(`comparison-A-${stat}`).textContent}/${screen.getByTestId(`comparison-B-${stat}`).textContent}/${screen.getByTestId(`comparison-difference-${stat}`).textContent}`)
    const comparisonBefore = comparison()
    for (const entry of scrollData.records) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${entry.name}` }))
      expect(mainValues()).toEqual(before)
      expect(comparison()).toEqual(comparisonBefore)
    }
    expect(mainValues()[1]).toBe('45%')
  })

  it('shows malformed raw references and blank acquisition without inventing zero or N/A', async () => {
    const entry = scrollData.records[0], previous = { hit: entry.hit, range: entry.range, acquisition: entry.acquisition }
    try {
      entry.hit = { ...entry.hit, raw: 'unresolved hit', value: null, state: 'unresolved', confidence: 'unknown' }
      entry.range = { ...entry.range, raw: '2026-01-02T00:00:00', rawType: 'd', text: null, state: 'unresolved', confidence: 'unknown' }
      entry.acquisition = { ...entry.acquisition, part1: { ...entry.acquisition.part1, raw: null, text: null, state: 'empty', confidence: 'unknown' } }
      const user = await open()
      const selected = detail('Fimbulvetr Night')
      expect(selected.textContent).toContain('Raw: unresolved hit')
      expect(selected.textContent).toContain('Raw: 2026-01-02T00:00:00')
      expect(withinPlanner(selected).getByRole('group', { name: 'Part 1 acquisition information' }).textContent).toContain('No source entry')
      await user.selectOptions(screen.getByLabelText('Part 1 acquisition'), 'empty')
      expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
    } finally { Object.assign(entry, previous) }
  })
})
