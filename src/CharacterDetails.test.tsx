import { selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import CharacterDetails from './CharacterDetails'
import { growthData, isDataStatus, ROUTES } from './growths'

afterEach(cleanup)

describe('character abilities and recruitment', () => {
  it('shows the selected character’s ability names and all four verbatim route entries', () => {
    render(<App />)
    const panel = plannerRole('region', { name: 'Alexandra · Abilities & recruitment' })
    const inherent = withinPlanner(panel).getByRole('group', { name: 'Inherent ability' })
    expect(withinPlanner(inherent).getByText('Silver Maiden')).toBeDefined()
    expect(withinPlanner(inherent).getByText('Unverified')).toBeDefined()
    expect(withinPlanner(inherent).getByText('Source: Characters!W3')).toBeDefined()
    expect(withinPlanner(panel).getByText('Soar')).toBeDefined()
    for (const route of ROUTES) {
      const group = withinPlanner(panel).getByRole('group', { name: `${route}’s Path` })
      const raw = growthData.characters[0].recruitment[route].text!
      expect(group.querySelector('.recorded-text')?.textContent).toBe(raw)
      expect(withinPlanner(group).getByText('Unverified')).toBeDefined()
    }
    expect(withinPlanner(panel).getByText('Grants Hit/Avo+5 to unit for each adjacent ally.')).toBeDefined()
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
  })

  it('updates on character selection and keeps unknown abilities distinct from unavailable routes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Character', 'Aswan')
    let panel = plannerRole('region', { name: 'Aswan · Abilities & recruitment' })
    const equippable = withinPlanner(panel).getByRole('group', { name: 'Equippable abilities' })
    expect(withinPlanner(equippable).getByText('Unknown')).toBeDefined()
    expect(withinPlanner(equippable).getByText('Not recorded.')).toBeDefined()
    expect(withinPlanner(equippable).queryByText('Unavailable')).toBeNull()
    expect(withinPlanner(panel).queryByText('Silver Maiden')).toBeNull()

    await selectMain(user, 'Character', 'Bonaventure')
    panel = plannerRole('region', { name: 'Bonaventure · Abilities & recruitment' })
    const cai = withinPlanner(panel).getByRole('group', { name: 'Cai’s Path' })
    expect(cai.querySelector('.recorded-text')?.textContent).toBe('Unavailable')
    expect(cai.textContent).toContain('Original entry: -.')
    expect(withinPlanner(cai).queryByText('Unknown')).toBeNull()
    expect(withinPlanner(cai).getByText('Source: Characters!Y8')).toBeDefined()
    expect(withinPlanner(panel).getByRole('group', { name: 'Theodora’s Path' }).textContent).toContain('Unverified')
  })

  it('keeps the two Mu profiles and their own source rows separate', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Character', 'Mu')
    expect(screen.getByText('Source: Characters!W40')).toBeDefined()
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    await selectMain(user, 'Character', 'Mu (with growth)')
    expect(screen.getByText('Source: Characters!W41')).toBeDefined()
    expect(screen.queryByText('Source: Characters!W40')).toBeNull()
    expect(screen.getByTestId('combined-HP').textContent).toBe('60%')
  })

  it('does not change character details when only the class changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    const panel = plannerRole('region', { name: 'Alexandra · Abilities & recruitment' })
    const before = panel.textContent
    await selectMain(user, 'Class', 'The Calamity')
    expect(panel.textContent).toBe(before)
    expect(screen.getByTestId('combined-Mag').textContent).toBe('50%')
  })

  it('supports explicit confirmation status and renders recorded text safely', () => {
    const original = growthData.characters[0]
    const character = { ...original, personal: { ...original.personal,
      inherent: { text: '<img src=x onerror=alert(1)>', status: 'confirmed' as const, source: 'Verified fixture' },
    } }
    render(<CharacterDetails character={character} />)
    const entry = plannerRole('group', { name: 'Inherent ability' })
    expect(withinPlanner(entry).getByText('Confirmed')).toBeDefined()
    expect(withinPlanner(entry).getByText('<img src=x onerror=alert(1)>')).toBeDefined()
    expect(entry.querySelector('img')).toBeNull()
    expect(isDataStatus('confirmed')).toBe(true)
    expect(isDataStatus('unverified')).toBe(true)
    expect(isDataStatus('unknown')).toBe(true)
    expect(isDataStatus('unavailable')).toBe(true)
    expect(isDataStatus('toString')).toBe(false)
    expect(isDataStatus('assumed')).toBe(false)
  })
})
