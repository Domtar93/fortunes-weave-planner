import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createPreset, PRESET_KEY, type BuildPreset } from './presets'
import { growthData } from './growths'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })
const manager = () => plannerRole('region', { name: 'Named character builds' })
const card = (name: string) => withinPlanner(manager()).getByRole('listitem', { name: `Saved build: ${name}` })
const select = (name: string) => plannerRole('combobox', { name }) as HTMLSelectElement
const stored = (): BuildPreset[] => JSON.parse(localStorage.getItem(PRESET_KEY)!).presets
function seed(entries = [createPreset('Frontline', { characterName: 'Alexandra', className: 'Gladiator' }, [])]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify({ schemaVersion: 1, presets: entries }))
}
async function open() {
  const user = userEvent.setup()
  render(<App />)
  expect(screen.getByText('My Character Builds').closest('details')?.open).toBe(false)
  await openPlannerPanel(user, 'My Character Builds')
  return user
}
async function save(user: ReturnType<typeof userEvent.setup>, name: string, source = 'main') {
  await user.selectOptions(select('Save selection from'), source)
  await user.type(screen.getByRole('textbox', { name: 'Build name' }), name)
  await user.click(withinPlanner(manager()).getByRole('button', { name: 'Save build' }))
}

describe('My Character Builds', () => {
  it('saves the main pairing, remounts from localStorage and loads validated current growths only into main', async () => {
    let user = await open()
    await save(user, '  Frontline  ')
    expect(stored()[0]).toMatchObject({ name: 'Frontline', characterName: 'Alexandra', className: 'Gladiator' })
    expect(select('Character').value).toBe('Alexandra')
    expect(select('Class').value).toBe('Gladiator')
    cleanup()
    user = await open()
    await openPlannerPanel(user, 'Build Comparison')
    await selectMain(user, 'Character', 'Sofia')
    await selectMain(user, 'Class', 'The Calamity')
    await user.click(withinPlanner(card('Frontline')).getByRole('button', { name: 'Load into Main planner' }))
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
    expect(select('Character').value).toBe('Alexandra')
    expect(select('Class').value).toBe('Gladiator')
    expect(select('Build B class').value).toBe('Hunter')
    expect(card('Frontline').textContent).toContain('Last modified')
  })

  it('saves A/B independently, targets loads, recalculates differences and retains swap behavior', async () => {
    const user = await open()
    await openPlannerPanel(user, 'Build Comparison')
    await save(user, 'Alexandra Hunter', 'b')
    await user.selectOptions(select('Build A character'), 'Sofia')
    await user.selectOptions(select('Build A class'), 'The Calamity')
    await save(user, 'Sofia Calamity', 'a')
    expect(select('Build A character').value).toBe('Sofia')
    expect(select('Build B character').value).toBe('Alexandra')
    await user.click(withinPlanner(card('Alexandra Hunter')).getByRole('button', { name: 'Load into Build A' }))
    expect(select('Build A class').value).toBe('Hunter')
    expect(select('Build B class').value).toBe('Hunter')
    await user.click(withinPlanner(card('Sofia Calamity')).getByRole('button', { name: 'Load into Build B' }))
    expect(select('Build A character').value).toBe('Alexandra')
    expect(screen.getByTestId('comparison-A-Mag').textContent).toBe('35%')
    expect(screen.getByTestId('comparison-B-Mag').textContent).toBe('60%')
    expect(screen.getByTestId('comparison-difference-Mag').textContent).toBe('+25 ppB higher')
    expect(select('Character').value).toBe('Alexandra')
    expect(select('Class').value).toBe('Gladiator')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
    await user.click(plannerRole('button', { name: 'Swap builds' }))
    expect(screen.getByTestId('comparison-difference-Mag').textContent).toBe('-25 ppB lower')
    expect(stored().map(item => [item.characterName, item.className])).toEqual([['Alexandra', 'Hunter'], ['Sofia', 'The Calamity']])
  })

  it('renames one preset, duplicates with a unique ID and confirms or cancels deletion', async () => {
    const entries = [createPreset('Hunter', { characterName: 'Alexandra', className: 'Hunter' }, []), createPreset('Sofia', { characterName: 'Sofia', className: 'The Calamity' }, [])]
    seed(entries)
    const user = await open()
    await user.click(withinPlanner(card('Hunter')).getByRole('button', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'New build name' })
    await user.clear(input); await user.type(input, 'Frontline')
    await user.click(plannerRole('button', { name: 'Confirm rename' }))
    expect(stored()[0].id).toBe(entries[0].id)
    expect(stored()[0].createdAt).toBe(entries[0].createdAt)
    expect(stored()[1]).toEqual(entries[1])
    await user.click(withinPlanner(card('Frontline')).getByRole('button', { name: 'Duplicate' }))
    await user.type(screen.getByRole('textbox', { name: 'New build name' }), 'Frontline copy')
    await user.click(plannerRole('button', { name: 'Confirm duplicate' }))
    expect(stored()[2].id).not.toBe(entries[0].id)
    expect(stored()[2].className).toBe('Hunter')
    await user.click(withinPlanner(card('Frontline copy')).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('form', { name: 'Delete Frontline copy' })).toBeDefined()
    expect(document.activeElement).toBe(plannerRole('button', { name: 'Cancel' }))
    expect(stored()).toHaveLength(3)
    await user.click(plannerRole('button', { name: 'Cancel' }))
    expect(document.activeElement).toBe(withinPlanner(card('Frontline copy')).getByRole('button', { name: 'Delete' }))
    expect(stored()).toHaveLength(3)
    await user.click(withinPlanner(card('Frontline copy')).getByRole('button', { name: 'Delete' }))
    await user.click(plannerRole('button', { name: 'Confirm delete' }))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Build name' }))
    expect(stored()).toHaveLength(2)
    expect(stored()[1]).toEqual(entries[1])
  })

  it('rejects blank names and duplicate names for save, rename and duplicate', async () => {
    seed()
    const user = await open()
    await save(user, '  ')
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('nonempty')
    await user.clear(screen.getByRole('textbox', { name: 'Build name' }))
    await save(user, ' FRONTLINE ')
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('already exists')
    await user.click(withinPlanner(card('Frontline')).getByRole('button', { name: 'Duplicate' }))
    await user.type(screen.getByRole('textbox', { name: 'New build name' }), 'frontline')
    await user.click(plannerRole('button', { name: 'Confirm duplicate' }))
    expect(stored()).toHaveLength(1)
    await user.click(plannerRole('button', { name: 'Cancel' }))
    await user.click(withinPlanner(card('Frontline')).getByRole('button', { name: 'Rename' }))
    await user.clear(screen.getByRole('textbox', { name: 'New build name' }))
    await user.click(plannerRole('button', { name: 'Confirm rename' }))
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('nonempty')
    expect(stored()).toHaveLength(1)
  })

  it('reloads and loads both Mu profiles distinctly', async () => {
    let user = await open()
    await selectMain(user, 'Class', 'Commoner / Noble')
    await selectMain(user, 'Character', 'Mu')
    await save(user, 'Mu original')
    await selectMain(user, 'Character', 'Mu (with growth)')
    await save(user, 'Mu alternate')
    cleanup(); user = await open()
    await user.click(withinPlanner(card('Mu original')).getByRole('button', { name: 'Load into Main planner' }))
    expect(screen.getByTestId('combined-HP').textContent).toBe('30%')
    await user.click(withinPlanner(card('Mu alternate')).getByRole('button', { name: 'Load into Main planner' }))
    expect(select('Character').value).toBe('Mu (with growth)')
    expect(screen.getByTestId('combined-HP').textContent).toBe('50%')
  })

  it.each(['{broken', '{"schemaVersion":9,"presets":[]}'])('shows read-only recovery and never overwrites %s', async raw => {
    localStorage.setItem(PRESET_KEY, raw); localStorage.setItem('other-app', 'keep')
    const user = await open()
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('untouched')
    expect((plannerRole('button', { name: 'Save build' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(plannerRole('button', { name: 'Retry reading saved builds' }))
    expect(localStorage.getItem(PRESET_KEY)).toBe(raw)
    expect(localStorage.getItem('other-app')).toBe('keep')
    seed()
    await user.click(plannerRole('button', { name: 'Retry reading saved builds' }))
    expect(card('Frontline')).toBeDefined()
    expect((plannerRole('button', { name: 'Save build' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps missing source records identifiable and disables all load targets without dropping them', async () => {
    seed([{ ...createPreset('Lost record', { characterName: 'Alexandra', className: 'Gladiator' }, []), className: 'Retired class' }])
    await open()
    expect(card('Lost record').textContent).toContain('Missing class: Retired class')
    expect(withinPlanner(card('Lost record')).getAllByRole('button', { name: /Load into/ }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(stored()[0].className).toBe('Retired class')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('surfaces storage access failure and quota errors without losing existing saves', async () => {
    seed()
    const user = await open()
    const before = localStorage.getItem(PRESET_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError') })
    await save(user, 'Cannot fit')
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('Could not save builds')
    expect(localStorage.getItem(PRESET_KEY)).toBe(before)
    expect(card('Frontline')).toBeDefined()
    expect(withinPlanner(manager()).queryByRole('listitem', { name: 'Saved build: Cannot fit' })).toBeNull()
    vi.restoreAllMocks(); cleanup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Access denied', 'SecurityError') })
    await open()
    expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('Access denied')
  })

  it('retains source warnings in each target and does not persist mount/battalion or copied growth values', async () => {
    seed([createPreset('Disputed rider', { characterName: 'Alexandra', className: 'Armored Ornius Rider' }, [])])
    const user = await open()
    await openPlannerPanel(user, 'Build Comparison')
    for (const destination of ['Main planner', 'Build A', 'Build B']) {
      await user.click(withinPlanner(card('Disputed rider')).getByRole('button', { name: `Load into ${destination}` }))
    }
    expect(plannerRole('note', {name: ''}).textContent).toContain('DATA-12')
    for (const slot of ['A', 'B']) expect(plannerRole('group', { name: `Build ${slot} source warnings` }).textContent).toContain('DATA-12')
    expect(screen.getByTestId('combined-Spd').textContent).toBe('65%')
    await openPlannerPanel(user, 'Mounts & Compatibility')
    await user.click(plannerRole('button', { name: 'Inspect Meganius' }))
    await openPlannerPanel(user, 'Battalions & Gambits')
    await user.click(plannerRole('button', { name: 'Inspect Bai Ze Squad' }))
    await save(user, 'Reference ignored')
    expect(Object.keys(stored()[1]).sort()).toEqual(['schemaVersion', 'id', 'name', 'characterName', 'className', 'createdAt', 'updatedAt'].sort())
    expect(screen.getByTestId('combined-Spd').textContent).toBe('65%')
    expect(screen.getByTestId('comparison-B-Spd').textContent).toBe('65%')
  })

  it('validates current numeric source data at load time before changing selections', async () => {
    seed([createPreset('Sofia', { characterName: 'Sofia', className: 'The Calamity' }, [])])
    const user = await open()
    const source = growthData.classes.find(item => item.name === 'The Calamity')!
    const original = source.growths.HP
    try {
      source.growths.HP = NaN
      await user.click(withinPlanner(card('Sofia')).getByRole('button', { name: 'Load into Main planner' }))
      expect(withinPlanner(manager()).getByRole('alert').textContent).toContain('Missing or malformed HP')
      expect(select('Character').value).toBe('Alexandra')
      expect(select('Class').value).toBe('Gladiator')
    } finally { source.growths.HP = original }
  })
})
