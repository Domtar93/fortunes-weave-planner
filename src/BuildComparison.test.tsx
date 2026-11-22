import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { growthData, STATS } from './growths'

afterEach(cleanup)
const panel = () => plannerRole('region', { name: 'Character and class growth comparison' })
const field = (label: string) => withinPlanner(panel()).getByRole('combobox', { name: label })
const values = (build: 'A' | 'B') => STATS.map(stat => screen.getByTestId(`comparison-${build}-${stat}`).textContent)
const differences = () => STATS.map(stat => screen.getByTestId(`comparison-difference-${stat}`).querySelector('strong')?.textContent)
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Build Comparison')
  return user
}

describe('side-by-side growth comparison', () => {
  it('starts collapsed and offers 64/59 selections on each side, retaining nine main growth cards', async () => {
    render(<App />)
    expect(screen.getByText('Build Comparison').closest('details')?.open).toBe(false)
    expect(screen.getAllByRole('article')).toHaveLength(9)
    await openPlannerPanel(userEvent, 'Build Comparison')
    for (const label of ['A', 'B']) {
      const characters = field(`Build ${label} character`) as HTMLSelectElement
      const classes = field(`Build ${label} class`) as HTMLSelectElement
      expect(characters.options).toHaveLength(64)
      expect(classes.options).toHaveLength(59)
      expect([...characters.options].filter(option => option.text.startsWith('Mu')).map(option => option.text)).toEqual(['Mu', 'Mu (with growth)'])
      expect([...classes.options].some(option => option.text === 'The Avatar')).toBe(true)
    }
    const table = withinPlanner(panel()).getByRole('table', { name: 'Build A versus Build B growth rates and B minus A percentage-point differences' })
    expect(withinPlanner(table).getAllByRole('row')).toHaveLength(10)
    expect(screen.getByTestId('comparison-difference-Str').textContent).toBe('-10 ppB lower')
    expect(screen.getByTestId('comparison-difference-Spd').textContent).toBe('+10 ppB higher')
    expect(screen.getByTestId('comparison-difference-HP').textContent).toBe('0 ppEqual')
  })

  it('shows the Alexandra example immediately and expands exact personal/class contributions', async () => {
    const user = await open()
    expect(values('A')).toEqual(['40%', '45%', '35%', '55%', '45%', '30%', '40%', '50%', '50%'])
    expect(values('B')).toEqual(['40%', '35%', '35%', '65%', '55%', '30%', '40%', '50%', '50%'])
    expect(differences()).toEqual(['0 pp', '-10 pp', '0 pp', '+10 pp', '+10 pp', '0 pp', '0 pp', '0 pp', '0 pp'])
    const summary = withinPlanner(panel()).getByText('Personal + class breakdown', { exact: true })
    expect(summary.closest('details')?.open).toBe(false)
    await user.click(summary)
    const first = withinPlanner(panel()).getByRole('table', { name: 'Build A personal and class growth contributions' })
    const strength = withinPlanner(first).getByText('Str').closest('tr')!
    expect([...strength.querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['35%', '+10%', '45%'])
    expect(withinPlanner(panel()).getByRole('region', { name: 'Build A growth contributions' }).textContent).toContain('Classes!Y4:AG4')
  })

  it('keeps comparisons independent of each other and main selections, and loads main into A only on request', async () => {
    const user = await open()
    await user.selectOptions(field('Build B character'), 'Sofia')
    await user.selectOptions(field('Build B class'), 'The Calamity')
    expect(screen.getByTestId('comparison-B-Mag').textContent).toBe('60%')
    expect(screen.getByTestId('comparison-A-Mag').textContent).toBe('35%')
    expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra')
    expect((plannerRole('combobox', { name: 'Class' }) as HTMLSelectElement).value).toBe('Gladiator')
    expect(screen.getByTestId('combined-Mag').textContent).toBe('35%')
    await selectMain(user, 'Character', 'Sofia')
    expect((field('Build A character') as HTMLSelectElement).value).toBe('Alexandra')
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Load main planner into Build A' }))
    expect(screen.getByTestId('comparison-A-Mag').textContent).toBe('45%')
    expect(screen.getByTestId('comparison-B-Mag').textContent).toBe('60%')
    expect(screen.getByTestId('comparison-difference-Mag').textContent).toBe('+15 ppB higher')
    expect((field('Build B class') as HTMLSelectElement).value).toBe('The Calamity')
  })

  it('preserves both Mu profiles and Commoner zeros, and supports identical builds', async () => {
    const user = await open()
    for (const label of ['A', 'B']) await user.selectOptions(field(`Build ${label} class`), 'Commoner / Noble')
    await user.selectOptions(field('Build A character'), 'Mu')
    await user.selectOptions(field('Build B character'), 'Mu (with growth)')
    expect(screen.getByTestId('comparison-A-HP').textContent).toBe('30%')
    expect(screen.getByTestId('comparison-B-HP').textContent).toBe('50%')
    expect(screen.getByTestId('comparison-difference-HP').textContent).toBe('+20 ppB higher')
    expect(withinPlanner(panel()).getByRole('group', { name: 'Build B source warnings' }).textContent).toContain('SUMIF')
    await user.selectOptions(field('Build B character'), 'Mu')
    expect(differences()).toEqual(STATS.map(() => '0 pp'))
  })

  it('swaps both selections and totals while reversing all nonzero differences', async () => {
    const user = await open()
    const a = values('A'), b = values('B')
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Swap builds' }))
    expect(values('A')).toEqual(b)
    expect(values('B')).toEqual(a)
    expect((field('Build A class') as HTMLSelectElement).value).toBe('Hunter')
    expect((field('Build B class') as HTMLSelectElement).value).toBe('Gladiator')
    expect(differences()).toEqual(['0 pp', '+10 pp', '0 pp', '-10 pp', '-10 pp', '0 pp', '0 pp', '0 pp', '0 pp'])
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('keeps the Armored Ornius dispute visible on either comparison side without altering main notes', async () => {
    const user = await open()
    await user.selectOptions(field('Build B class'), 'Armored Ornius Rider')
    expect(withinPlanner(panel()).getByRole('group', { name: 'Build B source warnings' }).textContent).toContain('DATA-12')
    expect(screen.getByTestId('comparison-B-Spd').textContent).toBe('65%')
    expect(screen.getByTestId('comparison-B-Dex').textContent).toBe('50%')
    expect(screen.queryByRole('note')).toBeNull()
    await user.click(withinPlanner(panel()).getByRole('button', { name: 'Swap builds' }))
    expect(withinPlanner(panel()).getByRole('group', { name: 'Build A source warnings' }).textContent).toContain('DATA-12')
    expect(withinPlanner(panel()).queryByRole('group', { name: 'Build B source warnings' })).toBeNull()
  })

  it('shows concise typed class context and preserves full multiline Dancer restrictions', async () => {
    const user = await open()
    await user.selectOptions(field('Build B class'), 'Dancer')
    const context = withinPlanner(panel()).getByRole('region', { name: 'Build B class context' })
    for (const text of ['Advanced', 'Lv. 35', 'Special Dance', 'Leda route:', 'Limited to only ONE unit at a time.', 'Movement', 'Mount classification']) {
      expect(context.textContent).toContain(text)
    }
    const restrictions = withinPlanner(context).getByText('Additional unlock restrictions').closest('div')!
    expect(restrictions.querySelector('dd')?.textContent).toBe(growthData.classes.find(value => value.name === 'Dancer')!.details.additionalUnlocks.text)
    expect(withinPlanner(context).getByText('Primary proficiency requirements')).toBeDefined()
    expect(withinPlanner(context).getByText('Secondary proficiency requirements')).toBeDefined()
    expect(context.textContent).not.toContain('When using Dance')
    expect(withinPlanner(panel()).getByText(/Compare two character and class pairings/)).toBeDefined()
  })

  it('preserves negative modifiers and shows their negative point difference', async () => {
    const user = await open()
    await user.selectOptions(field('Build B class'), 'Castle Knight')
    await user.click(withinPlanner(panel()).getByText('Personal + class breakdown', { exact: true }))
    const table = withinPlanner(panel()).getByRole('table', { name: 'Build B personal and class growth contributions' })
    const speed = withinPlanner(table).getByText('Spd').closest('tr')!
    expect([...speed.querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['55%', '-15%', '40%'])
    expect(screen.getByTestId('comparison-difference-Spd').textContent).toBe('-15 ppB lower')
  })

  it('preserves unknown class context fields without default eligibility assumptions', async () => {
    const user = await open()
    await user.selectOptions(field('Build B class'), 'Commoner / Noble')
    const context = withinPlanner(panel()).getByRole('region', { name: 'Build B class context' })
    const primary = withinPlanner(context).getByText('Primary proficiency requirements').closest('div')!
    expect(primary.querySelector('dd')?.textContent).toBe('Unknown / unrecorded')
    expect(primary.textContent).toContain('Classes!E3')
    expect(withinPlanner(panel()).getByText(/not an overall build ranking/)).toBeDefined()
  })

  it('excludes inspected mount/battalion bonuses and retains comparison state when closed/reopened', async () => {
    const user = await open()
    const before = [values('A'), values('B'), differences()]
    await openPlannerPanel(user, 'Mounts & Compatibility')
    await user.click(plannerRole('button', { name: 'Inspect Meganius' }))
    await openPlannerPanel(user, 'Battalions & Gambits')
    await user.click(plannerRole('button', { name: 'Inspect Bai Ze Squad' }))
    expect([values('A'), values('B'), differences()]).toEqual(before)
    await user.selectOptions(field('Build B character'), 'Sofia')
    await openPlannerPanel(user, 'Build Comparison')
    await openPlannerPanel(user, 'Build Comparison')
    expect((field('Build B character') as HTMLSelectElement).value).toBe('Sofia')
    expect(withinPlanner(panel()).getByText(/Flat class, mount, battalion/)).toBeDefined()
    expect((plannerRole('combobox', { name: 'Character' }) as HTMLSelectElement).value).toBe('Alexandra')
  })
})
