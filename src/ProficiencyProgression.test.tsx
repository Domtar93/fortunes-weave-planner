import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { growthData, PROFICIENCIES, PROFICIENCY_NAMES } from './growths'
import { explicitlyListed, filterEntries, learnsetIdentity, proficiencyData } from './proficiencies'

afterEach(cleanup)
const browser = () => plannerRole('region', { name: 'Proficiency progression browser' })
const list = () => withinPlanner(browser()).getByRole('list')
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Proficiency Progression')
  return user
}

describe('proficiency progression', () => {
  it('opens with Alexandra’s six Sword source ranks in the abilities workspace', async () => {
    render(<App />)
    expect(screen.getByText('Proficiency Progression').closest('details')?.open).toBe(true)
    await openPlannerPanel(userEvent, 'Proficiency Progression')
    expect(withinPlanner(list()).getAllByRole('listitem').map(value => value.querySelector('.rank-marker')?.textContent))
      .toEqual(['D', 'C', 'B', 'A', 'S', 'S+'])
    for (const name of ['Haze Slice', 'Rend Armor', 'Gale Blow', 'Lunging Gale', 'Swordfaire']) {
      expect(withinPlanner(list()).getByRole('button', { name })).toBeDefined()
    }
    const unknown = withinPlanner(list()).getByText('No recorded unlock').closest('li')!
    expect(unknown.textContent).toContain('SNo recorded unlock')
    expect(withinPlanner(unknown).queryByRole('button')).toBeNull()
  })

  it('loads all 12 categories with their own applicable ranks', async () => {
    const user = await open()
    const buttons = withinPlanner(browser()).getByRole('group', { name: 'Proficiency categories' })
    expect(withinPlanner(buttons).getAllByRole('button')).toHaveLength(12)
    for (const category of PROFICIENCIES) {
      await user.click(withinPlanner(buttons).getByRole('button', { name: PROFICIENCY_NAMES[category] }))
      expect(withinPlanner(list()).getAllByRole('listitem').map(value => value.querySelector('.rank-marker')?.textContent))
        .toEqual(proficiencyData.categories[category].ranks)
    }
    expect(proficiencyData.categories.Axe.ranks).toEqual(['D', 'C', 'B', 'A', 'S+'])
    expect(proficiencyData.categories.Reason.ranks).toEqual(['D', 'C', 'B', 'A', 'S'])
  })

  it('keeps Flying C+ and Riding C+ at their exact source positions', async () => {
    const user = await open()
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Flying' }))
    const flitting = withinPlanner(list()).getByRole('button', { name: 'Flitting Flier' }).closest('li')!
    expect(flitting.querySelector('.rank-marker')?.textContent).toBe('C+')
    expect(withinPlanner(list()).getByText('N/A').closest('li')?.textContent).toContain('B')
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Riding' }))
    const vanguard = withinPlanner(list()).getByRole('button', { name: 'Vanguard' }).closest('li')!
    expect(vanguard.querySelector('.rank-marker')?.textContent).toBe('C+')
    expect(withinPlanner(list()).getAllByText('N/A')).toHaveLength(2)
    expect(withinPlanner(list()).getAllByText('No recorded unlock')).toHaveLength(3)
  })

  it('filters documented versus unknown/unresolved and searches names', async () => {
    const user = await open()
    await user.selectOptions(screen.getByLabelText('Rank filter'), 'documented')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(5)
    await user.type(screen.getByLabelText('Search ability names'), '  GALE ')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(2)
    await user.clear(screen.getByLabelText('Search ability names'))
    await user.selectOptions(screen.getByLabelText('Rank filter'), 'unresolved')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(1)
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Riding' }))
    expect(withinPlanner(list()).queryByText('N/A')).toBeNull()
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(3)
    await user.type(screen.getByLabelText('Search ability names'), 'unfindable')
    expect(withinPlanner(browser()).getByText('No entries match these filters. Try All ranks or clear the search.')).toBeDefined()
  })

  it('shows supplied effects and clears stale details on character change', async () => {
    const user = await open()
    await user.click(withinPlanner(list()).getByRole('button', { name: 'Haze Slice' }))
    const info = screen.getByRole('complementary', { name: 'Ability information' })
    expect(info.querySelector('.ability-effect')?.textContent).toContain('Grants Avo+10 during combat')
    expect(info.textContent).toContain("'Sword'!B2")
    expect(info.textContent).toContain('Required rank D')
    await selectMain(user, 'Character', 'Aswan')
    expect(withinPlanner(list()).getByRole('button', { name: 'Wrath Strike' })).toBeDefined()
    expect(info.textContent).not.toContain('Haze Slice')
  })

  it('displays sourced unverified effects and their acquisition caveat', async () => {
    const user = await open()
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Flying' }))
    await user.click(withinPlanner(list()).getByRole('button', { name: 'Flitting Flier' }))
    const info = screen.getByRole('complementary', { name: 'Ability information' })
    expect(info.textContent).toContain('grants AS+2 during combat')
    expect(info.textContent).toContain('Unofficial guide; unverified')
    expect(info.textContent).toContain('mount-bond ability')
    expect(info.textContent).toContain('Required rank C+')
  })

  it('maps only Mu alternate learnsets while retaining separate personal growths', async () => {
    const user = await open()
    await selectMain(user, 'Character', 'Mu')
    const muEntries = list().textContent
    const muGrowth = screen.getByTestId('combined-HP').textContent
    await selectMain(user, 'Character', 'Mu (with growth)')
    expect(list().textContent).toBe(muEntries)
    expect(screen.getByTestId('combined-HP').textContent).not.toBe(muGrowth)
    expect(withinPlanner(browser()).getByText(/explicit profile mapping/)).toBeDefined()
    expect(learnsetIdentity('Alex')).toBe('Alex')
    expect(learnsetIdentity('mu')).toBe('mu')
  })

  it('preserves compounds verbatim and does not promote placeholders to abilities', async () => {
    const user = await open()
    await selectMain(user, 'Character', 'Eshmel')
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Spear' }))
    const raw = 'Graceful Blow\n(A+), Frozen Spear\n(A+)'
    const compound = withinPlanner(list()).getAllByRole('button').find(value => value.textContent === raw)!
    expect(compound.closest('li')?.querySelector('.rank-marker')?.textContent).toBe('A')
    await user.click(compound)
    expect(screen.getByRole('complementary', { name: 'Ability information' }).textContent).toContain('This entry lists multiple unlocks or conditions.')
    await selectMain(user, 'Character', 'Halvin')
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Sword' }))
    expect(withinPlanner(list()).getByText('?').closest('li')?.classList.contains('placeholder')).toBe(true)
    expect(withinPlanner(list()).queryByRole('button', { name: '?' })).toBeNull()
  })

  it('class context preserves Dancer conflicts without suppressing unlocks or applying effects', async () => {
    const user = await open()
    const before = list().textContent
    await selectMain(user, 'Class', 'Dancer')
    expect(list().textContent).toBe(before)
    const context = withinPlanner(browser()).getByLabelText('Selected class proficiency context')
    expect(context.textContent).toContain('Dancer · Sword')
    expect(context.textContent).toContain('Source conflict: Dancer lists Bow')
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Bow' }))
    expect(context.textContent).toContain('Bow appears in')
    expect(context.textContent).toContain('Blank / unlisted')
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Axe' }))
    expect(context.textContent).toContain('Axe support is not established')
    expect(context.textContent).toContain('+2 bonus XP')
    expect(withinPlanner(list()).getAllByRole('listitem')).toHaveLength(5)
  })

  it('every original identity has complete applicable rank entries and filters preserve raw data', () => {
    for (const category of PROFICIENCIES) {
      expect(Object.keys(proficiencyData.categories[category].characters)).toHaveLength(63)
      for (const profile of growthData.characters) {
        const entries = proficiencyData.categories[category].characters[learnsetIdentity(profile.name)]
        expect(entries.map(value => value.rank)).toEqual(proficiencyData.categories[category].ranks)
        expect(filterEntries(entries, 'all', '')).toEqual(entries)
        expect(filterEntries(entries, 'documented', '').every(value => value.state === 'documented')).toBe(true)
        expect(filterEntries(entries, 'unresolved', '').every(value => ['unknown', 'compound', 'placeholder'].includes(value.state))).toBe(true)
      }
    }
  })

  it('reads literal magic/armor names and preserves conditional mount support without XP inference', () => {
    const rider = growthData.classes.find(value => value.name === 'Armored Ornius Rider')!
    expect(explicitlyListed(rider, 'Riding')).toBe(true)
    expect(explicitlyListed(rider, 'Flying')).toBe(true)
    for (const [name, category] of [['Diviner', 'Reason'], ['Priest', 'Faith'], ['Armored Knight', 'Armor']] as const) {
      expect(explicitlyListed(growthData.classes.find(value => value.name === name)!, category)).toBe(true)
    }
    const dancer = growthData.classes.find(value => value.name === 'Dancer')!
    expect(explicitlyListed(dancer, 'Bow')).toBe(true)
    expect(explicitlyListed(dancer, 'Axe')).toBe(false)
    const entries = proficiencyData.categories.Axe.characters.Tobias
    expect(entries[0].text).toBe('Spike, Half Spike')
    expect(entries[0].state).toBe('compound')
    expect(filterEntries(entries, 'documented', '').some(value => value.text === 'Spike, Half Spike')).toBe(false)
  })
})

