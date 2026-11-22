import { selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import ClassDetails from './ClassDetails'
import { combineGrowths, growthData, PROFICIENCIES, STATS } from './growths'

afterEach(cleanup)
const profile = (name: string) => growthData.classes.find(value => value.name === name)!
const panel = (name: string) => plannerRole('region', { name: `${name} · Class details` })

describe('read-only class reference', () => {
  it('shows Gladiator summary and keeps all four sections collapsed initially', () => {
    render(<App />)
    const reference = panel('Gladiator')
    expect(withinPlanner(reference).getByRole('group', { name: 'License category' }).textContent).toContain('Beginner')
    expect(withinPlanner(reference).getByRole('group', { name: 'Level requirement' }).textContent).toContain('Lv. 5')
    expect(withinPlanner(reference).getByRole('group', { name: 'Movement' }).textContent).toContain('4')
    expect(withinPlanner(reference).getByRole('group', { name: 'Mount type' }).textContent).toContain('Not mounted')
    const sections = [...reference.querySelectorAll<HTMLDetailsElement>(':scope > details.class-section')]
    expect(sections).toHaveLength(4)
    expect(sections.every(section => !section.open)).toBe(true)
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('displays mastery text without applying flat ability effects to growths', async () => {
    const user = userEvent.setup()
    render(<App />)
    const reference = panel('Gladiator')
    await user.click(withinPlanner(reference).getByText('Mastery & class abilities', { exact: true }))
    expect(withinPlanner(reference).getByRole('group', { name: 'Mastery ability' }).textContent).toContain('Attack Basics')
    expect(withinPlanner(reference).getByRole('group', { name: 'Mastery description' }).textContent).toContain('Grants Str +1.')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('preserves Dancer’s complete multiline requirements and abilities', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Class', 'Dancer')
    const reference = panel('Dancer')
    expect(withinPlanner(reference).getByRole('group', { name: 'License category' }).textContent).toContain('Advanced')
    expect(withinPlanner(reference).getByRole('group', { name: 'Level requirement' }).textContent).toContain('Lv. 35')
    await user.click(withinPlanner(reference).getByText('Requirements & restrictions', { exact: true }))
    const unlock = withinPlanner(reference).getByRole('group', { name: 'Additional unlock conditions' })
    expect(unlock.querySelector('.recorded-text')?.textContent).toBe(profile('Dancer').details.additionalUnlocks.text)
    expect(unlock.textContent).toContain('Leda route:')
    expect(unlock.textContent).toContain('Limited to only ONE unit at a time.')
    expect(withinPlanner(reference).getByText(/influence examination chances/)).toBeDefined()
    await user.click(withinPlanner(reference).getByText('Mastery & class abilities', { exact: true }))
    expect(withinPlanner(reference).getByRole('group', { name: 'Mastery ability' }).textContent).toContain('Special Dance')
    expect(withinPlanner(reference).getByRole('group', { name: 'Class abilities' }).textContent).toContain('Combat Arts +2, Dance')
    expect(withinPlanner(reference).getByRole('group', { name: 'Class ability descriptions' }).querySelector('.recorded-text')?.textContent)
      .toBe('Unit can equip +2 combat arts.\nAllows the use of the Dance combat art.')
    // This panel records the restriction without declaring the selected character ineligible.
    expect((plannerRole('combobox', { name: 'Class' }) as HTMLSelectElement).selectedOptions[0].disabled).toBe(false)
  })

  it('updates open sections for Armored Ornius Rider and retains the dispute warning', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(withinPlanner(panel('Gladiator')).getByText('Requirements & restrictions', { exact: true }))
    await user.click(withinPlanner(panel('Gladiator')).getByText('Mastery & class abilities', { exact: true }))
    await selectMain(user, 'Class', 'Armored Ornius Rider')
    const reference = panel('Armored Ornius Rider')
    expect(withinPlanner(reference).getByRole('group', { name: 'License category' }).textContent).toContain('Specialty')
    expect(withinPlanner(reference).getByRole('group', { name: 'Primary proficiency requirements' }).textContent).toContain('Riding: D')
    expect(withinPlanner(reference).getByRole('group', { name: 'Mastery ability' }).textContent).toContain('Sense Threat')
    expect(withinPlanner(reference).getByRole('group', { name: 'Mount type' }).textContent).toContain('Ornius')
    expect(withinPlanner(reference).queryByText('Attack Basics')).toBeNull()
    expect(plannerRole('note', {name: ''}).textContent).toContain('DATA-12')
    expect(screen.getByTestId('combined-Spd').textContent).toBe('65%')
  })

  it('loads every Avatar section and its final-row source addresses', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Class', 'The Avatar')
    const reference = panel('The Avatar')
    for (const title of ['Requirements & restrictions', 'Mastery & class abilities', 'Weapons, skills & experience', 'Growth modifiers & flat bonuses']) {
      await user.click(withinPlanner(reference).getByText(title, { exact: true }))
    }
    expect(withinPlanner(reference).getByRole('group', { name: 'Mastery ability' }).textContent).toContain('Divine Law')
    expect(withinPlanner(reference).getByRole('group', { name: 'Additional unlock conditions' }).textContent).toContain('Lotus of Reincarnation')
    expect(withinPlanner(reference).getByRole('group', { name: 'Class ability descriptions' }).textContent).toContain('Multiplies black magic and white magic uses by 3.')
    expect(withinPlanner(reference).getByText('Classes!BA61').closest('details')?.open).toBe(false)
    expect(withinPlanner(reference).getByRole('group', { name: 'Black Magic experience' }).textContent).toContain('+5 bonus XP')
    expect(withinPlanner(reference).getByRole('table', { name: 'The Avatar flat stat bonuses' }).textContent).toContain('Classes!AP61')
  })

  it('distinguishes all 12 proficiency entries, including numeric zero and a source blank', async () => {
    const user = userEvent.setup()
    render(<ClassDetails profile={profile('Gladiator')} />)
    const reference = panel('Gladiator')
    await user.click(withinPlanner(reference).getByText('Weapons, skills & experience', { exact: true }))
    expect(reference.querySelectorAll('.proficiency-entry')).toHaveLength(12)
    expect(withinPlanner(reference).getByRole('group', { name: 'Sword experience' }).textContent).toContain('+1 bonus XP')
    const zero = withinPlanner(reference).getByRole('group', { name: 'Authority experience' })
    const blank = withinPlanner(reference).getByRole('group', { name: 'Spear experience' })
    expect(zero.textContent).toContain('Usable · 0 bonus XP')
    expect(blank.textContent).toContain('Not listed as usable')
    expect(blank.textContent).not.toContain('0 bonus XP')
    expect(withinPlanner(reference).getByRole('group', { name: 'Allowed weapons and skills' }).textContent)
      .toContain('Sword, Axe, Gauntlets, Battalions, Infantry')
  })

  it('keeps negative growth percentages and flat stat points in separate tables', async () => {
    const user = userEvent.setup()
    render(<App />)
    await selectMain(user, 'Class', 'Soldier')
    const reference = panel('Soldier')
    await user.click(withinPlanner(reference).getByText('Growth modifiers & flat bonuses', { exact: true }))
    const growth = withinPlanner(reference).getByRole('table', { name: 'Soldier class growth modifiers' })
    const flat = withinPlanner(reference).getByRole('table', { name: 'Soldier flat stat bonuses' })
    expect(withinPlanner(growth).getByText('Speed (Spd)').closest('tr')?.textContent).toContain('-5%')
    expect(withinPlanner(flat).getByText('Speed (Spd)').closest('tr')?.querySelector('td')?.textContent).toBe('0')
    expect(withinPlanner(flat).getByText('Strength (Str)').closest('tr')?.textContent).toContain('+1')
    expect(flat.textContent).not.toContain('%')
    expect(screen.getByTestId('combined-Spd').textContent).toBe('50%')
    expect(withinPlanner(reference).getByText(/Work-in-progress base stats are excluded/)).toBeDefined()
  })

  it('shows unknown descriptions and flat bonuses without inventing zero or effects', async () => {
    const user = userEvent.setup()
    const original = profile('Gladiator')
    const missing = { ...original, details: { ...original.details,
      masteryDescription: { text: null, status: 'unknown' as const, source: 'Classes!H4' },
      flatStatBonuses: { ...original.details.flatStatBonuses, HP: { value: null, status: 'unknown' as const, source: 'Classes!AH4' } },
      movement: { value: 0, status: 'unverified' as const, source: 'Classes!AZ4' },
    } }
    render(<ClassDetails profile={missing} />)
    const reference = panel('Gladiator')
    expect(withinPlanner(reference).getByRole('group', { name: 'Movement' }).querySelector('p')?.textContent).toBe('0')
    await user.click(withinPlanner(reference).getByText('Mastery & class abilities', { exact: true }))
    const description = withinPlanner(reference).getByRole('group', { name: 'Mastery description' })
    expect(description.textContent).toContain('Unknown')
    expect(withinPlanner(description).getByText('Not recorded in the workbook.')).toBeDefined()
    await user.click(withinPlanner(reference).getByText('Growth modifiers & flat bonuses', { exact: true }))
    const flat = withinPlanner(reference).getByRole('table', { name: 'Gladiator flat stat bonuses' })
    expect(withinPlanner(flat).getByText('Health (HP)').closest('tr')?.textContent).toContain('Unknown')
  })

  it('all 59 typed class records are complete and bonuses never alter growth calculations', () => {
    expect(growthData.classes).toHaveLength(59)
    for (const item of growthData.classes) {
      expect(Object.keys(item.details.proficiencyExperience)).toEqual(PROFICIENCIES)
      expect(Object.keys(item.details.flatStatBonuses)).toEqual(STATS)
      expect(item.details.mountType.source).toBe(`Classes!BA${item.source.row}`)
      const personal = growthData.characters[0].growths
      const combined = combineGrowths(personal, item.growths)
      for (const stat of STATS) expect(combined[stat]).toBe(personal[stat] + item.growths[stat])
    }
  })
})
