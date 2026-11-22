import { selectMain, plannerRole } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(cleanup)

describe('planning page', () => {
  it('shows all nine outputs with the initial Alexandra / Gladiator breakdown', () => {
    render(<App />)
    expect(screen.getAllByRole('article')).toHaveLength(9)
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
    expect(screen.getByLabelText('HP: personal 30% plus class +10% equals 40%')).toBeDefined()
    const character = plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement
    const classSelect = plannerRole('combobox', { name: 'Class' }) as HTMLSelectElement
    expect(character.options).toHaveLength(64)
    expect(classSelect.options).toHaveLength(59)
    expect([...character.options].some(option => option.value === 'Name')).toBe(false)
  })
  it('updates immediately when either selector changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Character', 'Sofia')
    expect(screen.getByTestId('combined-Mag').textContent).toBe('45%')
    await selectMain(user, 'Class', 'The Calamity')
    expect(screen.getByTestId('combined-Mag').textContent).toBe('60%')
    expect(screen.getByLabelText('Mag: personal 45% plus class +15% equals 60%')).toBeDefined()
  })
  it('allows both Mu profiles and the documented zero modifier class', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Class', 'Commoner / Noble')
    await selectMain(user, 'Character', 'Mu')
    expect(screen.getByTestId('combined-HP').textContent).toBe('30%')
    await selectMain(user, 'Character', 'Mu (with growth)')
    expect(screen.getByTestId('combined-HP').textContent).toBe('50%')
    expect(plannerRole('note', {name: ''}).textContent).toContain('SUMIF')
  })
  it('shows source uncertainty with the disputed class and preserves its values', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Class', 'Armored Ornius Rider')
    expect(plannerRole('note', {name: ''}).textContent).toContain('DATA-12')
    expect(screen.getByTestId('combined-Spd').textContent).toBe('65%')
    expect(screen.getByTestId('combined-Dex').textContent).toBe('50%')
    await selectMain(user, 'Class', 'Soldier')
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByLabelText('Spd: personal 55% plus class -5% equals 50%')).toBeDefined()
  })
})
