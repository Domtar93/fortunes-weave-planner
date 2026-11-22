import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ProficiencyProgression from './ProficiencyProgression'
import AbilityPlanningShortlist from './AbilityPlanningShortlist'
import { growthData } from './growths'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const character = growthData.characters.find(item => item.name === 'Alexandra')!
const selectedClass = growthData.classes.find(item => item.name === 'Gladiator')!
const swordfaire = proficiencyData.categories.Sword.characters.Alexandra.find(item => item.text === 'Swordfaire')!
const effect = 'When unit is equipped with a sword, grants Hit/Avo+10 and Atk+3.'

describe('reader-first planner', () => {
  it('opens in a focused build workspace and keeps research out of the primary screen', async () => {
    const user = userEvent.setup(); render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Planner sections' })
    expect(within(nav).getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('region', { name: 'Build workspace' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Reference workspace' })).toBeNull()
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    await user.click(within(nav).getByRole('button', { name: /^Reference/ }))
    expect(screen.getByRole('region', { name: 'Reference workspace' })).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Build workspace' })).toBeNull()
  })

  it('shows Swordfaire name, rank and actual supplied effect before optional evidence', async () => {
    const user = userEvent.setup()
    render(<ProficiencyProgression initialOpen character={character} selectedClass={selectedClass} />)
    await user.click(screen.getByRole('button', { name: 'Swordfaire' }))
    const info = screen.getByRole('complementary', { name: 'Ability information' })
    expect(within(info).getByRole('heading', { name: 'Swordfaire' })).toBeDefined()
    expect(within(info).getByText(/Required rank/).textContent).toContain('S+')
    expect(within(info).getByText(effect, { selector: '.ability-effect' }).closest('details')?.className).toBe('progression-panel')
    expect(within(info).queryByText(/Effect not yet documented/)).toBeNull()
    const research = within(info).getByText('Sources & details').closest('details')!
    expect(research.open).toBe(false)
    await user.click(within(info).getByText('Sources & details'))
    expect(within(info).getByRole('region', { name: 'Source comparison for Alexandra Sword S+' })).toBeDefined()
  })

  it('retains ability filters and selections when switching workspace sections', async () => {
    const user = userEvent.setup(); render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Planner sections' })
    await user.click(within(nav).getByRole('button', { name: /^Abilities/ }))
    await user.type(screen.getByLabelText('Search ability names'), 'Swordfaire')
    await user.click(screen.getByRole('button', { name: 'Swordfaire' }))
    const info = screen.getByRole('complementary', { name: 'Ability information' })
    await user.click(within(nav).getByRole('button', { name: /^Build / }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), { target: { value: 'Soldier' } })
    await user.click(within(nav).getByRole('button', { name: /^Abilities/ }))
    expect((screen.getByLabelText('Search ability names') as HTMLInputElement).value).toBe('Swordfaire')
    expect(within(info).getByText(effect, { selector: '.ability-effect' })).toBeDefined()
  })

  it('reveals the selected effect heading on a narrow screen', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const user = userEvent.setup()
    render(<ProficiencyProgression initialOpen character={character} selectedClass={selectedClass} />)
    await user.click(screen.getByRole('button', { name: 'Swordfaire' }))
    const info = screen.getByRole('complementary', { name: 'Ability information' })
    expect(document.activeElement).toBe(within(info).getByRole('heading', { name: 'Swordfaire' }))
  })

  it('uses the same actual effect for the planned ability card', () => {
    const entry = resolvePlanningEntry(character.name, 'Sword', swordfaire.rank, swordfaire.source)!
    render(<AbilityPlanningShortlist initialOpen characterName={character.name} entries={[entry]} onAction={vi.fn()} />)
    const slot = screen.getByRole('listitem', { name: /Planning slot 1: Swordfaire/ })
    expect(within(slot).getByText(effect, { selector: '.shortlist-effect' })).toBeDefined()
    expect(within(slot).getByText(effect, { selector: '.shortlist-effect' }).closest('details')?.className).toContain('shortlist-panel')
    expect(within(slot).getByText(/Source details/).closest('details')?.open).toBe(false)
  })
})
