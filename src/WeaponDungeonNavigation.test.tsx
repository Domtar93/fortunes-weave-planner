import { openPlannerPanel, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STATS } from './growths'
import { createPreset, PRESET_KEY } from './presets'
import { REFINED_CANDIDATE_LABEL } from './weaponDungeonReferences'

const dungeon = (name: string) => plannerRole('region', { name: `${name} dungeon details` })
const weapon = (name: string) => plannerRole('region', { name: `${name} weapon details` })
const sources = (name: string) => withinPlanner(weapon(name)).getByRole('region', { name: 'Documented Dungeon Sources' })
async function openDungeons(user: ReturnType<typeof userEvent.setup>) {
  await openPlannerPanel(user, 'Dungeon Chests & Rewards')
  await screen.findByRole('list', { name: 'Dungeon location catalog' })
}
async function openWeapons(user: ReturnType<typeof userEvent.setup>) {
  await openPlannerPanel(user, 'Weapons & Forging')
  await screen.findByRole('list', { name: 'Main weapon catalog' })
}
async function arriveAtWeapon(name: string) {
  const detail = await screen.findByRole('region', { name: `${name} weapon details` })
  await waitFor(() => expect(document.activeElement).toBe(withinPlanner(detail).getByRole('heading', { name })))
  return detail
}
afterEach(() => { cleanup(); localStorage.clear() })

describe('bidirectional weapon / dungeon navigation', () => {
  it.each([
    ['Muen', 'Cougar Woodlands', 'Part I'], ['Onoa', "Giant's Print Fort", 'Part I'], ['Veroquine', 'Masked Woods', 'Part I'],
    ['Gundogya', 'Sand-Shadow Fort', 'Part I'], ['Velheit', 'Stoppered Shrine', 'Part I'], ['Pilum', 'Shadowy Cave', 'Part III'], ['Hammer', 'Nemea Cavern', 'Part I'],
  ])('opens %s from its exact chest occurrence at %s', async (name, location, part) => {
    const user = userEvent.setup(); render(<App />)
    await openDungeons(user)
    await user.click(plannerRole('button', { name: `Inspect ${location}` }))
    await user.click(withinPlanner(dungeon(location)).getByRole('button', { name: `View weapon: ${name} · Chest 1 · ${part}` }))
    const detail = await arriveAtWeapon(name)
    expect(screen.getByText('Weapons & Forging').closest('details')?.open).toBe(true)
    expect(withinPlanner(detail).getByRole('status').textContent).toContain(`Chest 1 · ${part}`)
    expect(withinPlanner(detail).getByRole('status').textContent).toContain(location)
    expect(sources(name).textContent).toContain(`Recorded reward: ${name}`)
    expect(dungeon(location)).toBeDefined()
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('opens a previously unopened dungeon at the exact chest and phase, retaining the reward source', async () => {
    const user = userEvent.setup(); render(<App />)
    await openWeapons(user)
    await user.click(plannerRole('button', { name: 'Inspect weapon Muen' }))
    await user.click(withinPlanner(sources('Muen')).getByRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    const target = await screen.findByRole('cell', { name: 'Chest 1 · Part I · Muen' })
    await waitFor(() => expect(document.activeElement).toBe(target))
    expect(target.className).toContain('reward-navigation-target')
    expect(dungeon('Cougar Woodlands').textContent).toContain('Navigation target: Chest 1 · Part I · Muen')
    expect(withinPlanner(withinPlanner(dungeon('Cougar Woodlands')).getByRole('table')).getByRole('link', { name: 'Dungeon Chests!B3' })).toBeDefined()
    expect(screen.getByText('Dungeon Chests & Rewards').closest('details')?.open).toBe(true)
  })

  it.each([
    ['Palace of Sand', 'Part III', 'part1'], ['Southern Passage', 'Part I', 'part3'],
  ])('retains filters and exposes the %s destination despite an opposing phase filter', async (location, part, phase) => {
    const user = userEvent.setup(); render(<App />)
    await openDungeons(user)
    const dungeonFilters = withinPlanner(plannerRole('group', { name: 'Dungeon catalog filters' }))
    const search = dungeonFilters.getByLabelText('Search dungeon or reward names') as HTMLInputElement
    const reward = dungeonFilters.getByLabelText('Locations containing reward') as HTMLInputElement
    const phaseSelect = dungeonFilters.getByLabelText('Reward phase') as HTMLSelectElement
    const unresolved = screen.getByRole('checkbox', { name: 'Locations with unresolved entries' }) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'Corroios' } })
    fireEvent.change(reward, { target: { value: 'impossible' } })
    await user.selectOptions(phaseSelect, phase)
    await user.click(unresolved)
    await openPlannerPanel(user, 'Dungeon Chests & Rewards')
    await openWeapons(user)
    await user.click(plannerRole('button', { name: 'Inspect weapon Salamander' }))
    const weaponFilters = withinPlanner(plannerRole('group', { name: 'Weapon catalog filters' }))
    const weaponName = weaponFilters.getByLabelText('Weapon name') as HTMLInputElement
    const completeness = weaponFilters.getByLabelText('Record completeness') as HTMLSelectElement
    const conflicts = weaponFilters.getByLabelText('Source conflicts / differences') as HTMLSelectElement
    fireEvent.change(weaponName, { target: { value: 'Muen' } })
    await user.selectOptions(completeness, 'primary-incomplete')
    await user.selectOptions(conflicts, 'numeric')
    await user.click(withinPlanner(sources('Salamander')).getByRole('button', { name: `View dungeon: ${location} · Chest 1 · ${part}` }))
    const target = await screen.findByRole('cell', { name: `Chest 1 · ${part} · Salamander` })
    await waitFor(() => expect(document.activeElement).toBe(target))
    expect(phaseSelect.value).toBe(phase)
    expect(search.value).toBe('Corroios')
    expect(reward.value).toBe('impossible')
    expect(unresolved.checked).toBe(true)
    expect(dungeon(location).textContent).toContain('Both phases are shown for this target')
    expect(dungeon(location).textContent).toContain('outside the filters')
    await user.click(withinPlanner(target).getByRole('button', { name: `View weapon: Salamander · Chest 1 · ${part}` }))
    const detail = await arriveAtWeapon('Salamander')
    expect(detail.textContent).toContain('outside the filters')
    expect(weaponName.value).toBe('Muen')
    expect(completeness.value).toBe('primary-incomplete')
    expect(conflicts.value).toBe('numeric')
    expect(withinPlanner(detail).getByRole('status').textContent).toContain(location)
    expect(withinPlanner(detail).getByRole('status').textContent).toContain(part)
  })

  it('preserves both Salamander sources and supports repeated navigation without duplicated catalogs', async () => {
    const user = userEvent.setup(); render(<App />)
    await openWeapons(user)
    await user.click(plannerRole('button', { name: 'Inspect weapon Salamander' }))
    expect(withinPlanner(sources('Salamander')).getAllByRole('button')).toHaveLength(2)
    for (const [location, part] of [['Palace of Sand', 'Part III'], ['Southern Passage', 'Part I'], ['Palace of Sand', 'Part III']]) {
      await user.click(withinPlanner(sources('Salamander')).getByRole('button', { name: `View dungeon: ${location} · Chest 1 · ${part}` }))
      const target = await screen.findByRole('cell', { name: `Chest 1 · ${part} · Salamander` })
      await waitFor(() => expect(document.activeElement).toBe(target))
      await user.click(withinPlanner(target).getByRole('button', { name: `View weapon: Salamander · Chest 1 · ${part}` }))
      await arriveAtWeapon('Salamander')
    }
    expect(screen.getAllByRole('list', { name: 'Main weapon catalog' })).toHaveLength(1)
    expect(withinPlanner(plannerRole('list', { name: 'Main weapon catalog' })).getAllByRole('button')).toHaveLength(91)
    expect(screen.getAllByRole('list', { name: 'Dungeon location catalog' })).toHaveLength(1)
    expect(withinPlanner(plannerRole('list', { name: 'Dungeon location catalog' })).getAllByRole('button')).toHaveLength(31)
    expect(withinPlanner(sources('Salamander')).getAllByRole('button')).toHaveLength(2)
  })

  it('clears a previous chest target when existing scroll navigation requests the same dungeon', async () => {
    const user = userEvent.setup(); render(<App />)
    await openWeapons(user)
    await user.click(plannerRole('button', { name: 'Inspect weapon Salamander' }))
    await user.click(withinPlanner(sources('Salamander')).getByRole('button', { name: 'View dungeon: Southern Passage · Chest 1 · Part I' }))
    const cell = await screen.findByRole('cell', { name: 'Chest 1 · Part I · Salamander' })
    await waitFor(() => expect(document.activeElement).toBe(cell))
    await openPlannerPanel(user, 'Magic Scrolls')
    await user.click(plannerRole('button', { name: 'Inspect Swarm Ζ' }))
    await user.click(plannerRole('button', { name: 'View dungeon: Southern Passage' }))
    await waitFor(() => expect(document.activeElement).toBe(withinPlanner(dungeon('Southern Passage')).getByRole('heading', { name: 'Southern Passage' })))
    expect(dungeon('Southern Passage').querySelector('.reward-navigation-target')).toBeNull()
    expect(dungeon('Southern Passage').textContent).not.toContain('Navigation target:')
    expect(dungeon('Southern Passage').textContent).toContain('Swarm Z')
  })

  it('leaves unrelated rewards plain and refined-label suggestions noninteractive', async () => {
    const user = userEvent.setup(); render(<App />)
    await openDungeons(user)
    const cor = dungeon('Corroios Fort Ruins')
    expect(withinPlanner(cor).queryByRole('button', { name: /^View weapon:/ })).toBeNull()
    const candidate = withinPlanner(cor).getByRole('cell', { name: 'Chest 2 · Part III · Horsekiller Bow +2' })
    expect(candidate.textContent).toContain(REFINED_CANDIDATE_LABEL)
    expect(candidate.textContent).toContain('Suggested base: Horsekiller Bow · suffix +2')
    expect(candidate.textContent).toContain('Dungeon Chests!C2')
    expect(withinPlanner(candidate).queryByRole('button')).toBeNull()
    await user.click(plannerRole('button', { name: 'Inspect Uncharted Isle' }))
    const tome = withinPlanner(dungeon('Uncharted Isle')).getByRole('cell', { name: 'Chest 2 · Part I · Thick Foreign Tome' })
    expect(withinPlanner(tome).queryByRole('button')).toBeNull()
    await user.click(plannerRole('button', { name: 'Inspect Southern Passage' }))
    const levin = withinPlanner(dungeon('Southern Passage')).getByRole('cell', { name: 'Chest 1 · Part III · Levin Sword +3' })
    expect(levin.textContent).toContain('refinement unverified')
    expect(withinPlanner(levin).queryByRole('button')).toBeNull()
    const swarm = withinPlanner(dungeon('Southern Passage')).getByRole('cell', { name: 'Chest 2 · Part I · Swarm Z' })
    expect(withinPlanner(swarm).queryByRole('button')).toBeNull()
    expect(swarm.textContent).not.toContain('Ζ')
  })

  it('does not imply unavailability for no exact source and keeps Zanbato conflict beside candidate evidence', async () => {
    const user = userEvent.setup(); render(<App />)
    await openWeapons(user)
    expect(sources('Wooden Sword').textContent).toContain('No exact dungeon chest match documented.')
    expect(sources('Wooden Sword').textContent).toContain('Recorded chest locations. Route access may vary.')
    await user.click(plannerRole('button', { name: 'Inspect weapon Zanbato' }))
    expect(withinPlanner(sources('Zanbato')).queryByRole('button')).toBeNull()
    await user.click(withinPlanner(weapon('Zanbato')).getByText('Possible refined-label references · 1', { exact: true }))
    const candidate = withinPlanner(weapon('Zanbato')).getByText('Possible refined-label references · 1', { exact: true }).closest('details')!
    expect(candidate.textContent).toContain('Zanbato +2')
    expect(candidate.textContent).toContain('documented suffix +2')
    expect(candidate.textContent).toContain(REFINED_CANDIDATE_LABEL)
    expect(withinPlanner(candidate).queryByRole('button')).toBeNull()
    const conflict = withinPlanner(weapon('Zanbato')).getByRole('table')
    expect(conflict.textContent).toContain('14-19')
    expect(conflict.textContent).toContain('7-19')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('preserves main/build A/B/preset data across navigation, and comparison swaps and preset loads still work', async () => {
    const preset = createPreset('Existing Sofia', { characterName: 'Sofia', className: 'The Calamity' }, [])
    const payload = JSON.stringify({ schemaVersion: 1, presets: [preset] })
    localStorage.setItem(PRESET_KEY, payload)
    const user = userEvent.setup(); render(<App />)
    await openPlannerPanel(user, 'My Character Builds')
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Existing Sofia' })).getByRole('button', { name: 'Load into Build B' }))
    await openPlannerPanel(user, 'Build Comparison')
    await user.click(plannerRole('button', { name: 'Swap builds' }))
    expect((screen.getByLabelText('Build A character') as HTMLSelectElement).value).toBe('Sofia')
    expect((screen.getByLabelText('Build B class') as HTMLSelectElement).value).toBe('Gladiator')
    const growths = () => STATS.map(stat => [screen.getByTestId(`combined-${stat}`).textContent, screen.getByTestId(`comparison-A-${stat}`).textContent, screen.getByTestId(`comparison-B-${stat}`).textContent])
    const before = growths()
    await openWeapons(user)
    await user.click(plannerRole('button', { name: 'Inspect weapon Muen' }))
    await user.click(withinPlanner(sources('Muen')).getByRole('button', { name: 'View dungeon: Cougar Woodlands · Chest 1 · Part I' }))
    await user.click(await screen.findByRole('button', { name: 'View weapon: Muen · Chest 1 · Part I' }))
    await arriveAtWeapon('Muen')
    expect(growths()).toEqual(before)
    expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra')
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
    await user.click(withinPlanner(plannerRole('group', { name: 'Load Existing Sofia' })).getByRole('button', { name: 'Load into Main planner' }))
    expect(screen.getByTestId('combined-Mag').textContent).toBe('60%')
    expect(weapon('Muen')).toBeDefined()
    expect(localStorage.getItem(PRESET_KEY)).toBe(payload)
  })
})
