import { openPlannerPanel, selectMain, plannerRole , withinPlanner } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import BattalionBrowser from './BattalionBrowser'
import { growthData, STATS } from './growths'
import { battalionData, battalionSupport, filterBattalions } from './battalions'

afterEach(cleanup)
const browser = () => plannerRole('region', { name: 'Battalion reference browser' })
const catalog = () => withinPlanner(browser()).getByRole('list', { name: 'Battalion catalog' })
const detail = (name: string) => withinPlanner(browser()).getByRole('region', { name: `${name} battalion details` })
const profile = (name: string) => growthData.classes.find(value => value.name === name)!
const record = (name: string) => battalionData.records.find(value => value.name === name)!
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Battalions & Gambits')
  return user
}

describe('battalion reference browser', () => {
  it('starts collapsed, loads 69 references and shows Bronze-Shield fields with full Unicode acquisition text', async () => {
    render(<App />)
    expect(screen.getByText('Battalions & Gambits').closest('details')?.open).toBe(false)
    await openPlannerPanel(userEvent, 'Battalions & Gambits')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(69)
    const selected = detail('Bronze-Shield Guard')
    expect(selected.textContent).toContain('Tri-Front Formation')
    expect(withinPlanner(selected).getByRole('group', { name: 'Category' }).textContent).toContain('Defense')
    expect(withinPlanner(selected).getByRole('group', { name: 'Required Authority rank' }).textContent).toContain('E')
    expect(withinPlanner(selected).getByRole('group', { name: 'Gather limit' }).textContent).toContain('8')
    expect(withinPlanner(selected).getByRole('group', { name: 'Acquisition information' }).querySelector('.recorded-text')?.textContent)
      .toBe(record('Bronze-Shield Guard').acquisition.text)
    expect(selected.textContent).toContain('Mahón Castle Town')
    expect(selected.textContent).toContain('Battalions!A2:G2')
    expect(selected.textContent).toContain('Unverified')
    plannerRole('region', {name: 'Build workspace'})
    expect(screen.getAllByRole('article')).toHaveLength(9)
  })

  it('combines name/category filters with exact required-rank filters', async () => {
    const user = await open()
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Support' }))
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(17)
    await user.type(screen.getByLabelText('Search battalion names'), 'priest')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(3)
    await user.selectOptions(screen.getByLabelText('Required Authority rank (catalog)'), 'E')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(1)
    expect(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Priest Trainees' })).toBeDefined()
    await user.selectOptions(screen.getByLabelText('Required Authority rank (catalog)'), 'A')
    expect(withinPlanner(browser()).getByText(/No battalions match/)).toBeDefined()
    expect(detail('Bronze-Shield Guard').textContent).toContain('Selected battalion is outside the filters')
  })

  it('verifies Mage Pupils, Luck alias and Bai Ze flat values without growth percentages', async () => {
    const user = await open()
    for (const [name, ability] of [['Mage Pupils', 'Scattered Flames'], ['Priest Trainees', 'Splash Recover'], ['Bai Ze Squad', 'Column Recovery+']]) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${name}` }))
      expect(withinPlanner(detail(name)).getByRole('group', { name: 'Listed ability / gambit name' }).textContent).toContain(ability)
    }
    const points = withinPlanner(detail('Bai Ze Squad')).getByRole('group', { name: 'Parsed flat stat modifiers' })
    for (const [stat, value] of [['Magic (Mag)', '+3'], ['Resistance (Res)', '+3'], ['Luck (Lck)', '+2'], ['Charm (Cha)', '+8']]) {
      expect(withinPlanner(points).getByText(stat).closest('div')?.querySelector('dd')?.textContent).toBe(value)
    }
    expect(points.textContent).not.toContain('%')
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Priest Trainees' }))
    expect(withinPlanner(detail('Priest Trainees')).getByRole('group', { name: 'Flat stat bonuses' }).querySelector('.recorded-text')?.textContent).toBe('Res+1 Luck +1 Cha +3')
    expect(withinPlanner(detail('Priest Trainees')).getByText('Luck (Lck)').closest('div')?.querySelector('dd')?.textContent).toBe('+1')
  })

  it('keeps Gladiator’s zero Authority XP separate from character rank and updates mounted context', async () => {
    const user = await open()
    const context = withinPlanner(browser()).getByRole('group', { name: 'Class battalion context' })
    expect(context.textContent).toContain('Gladiator · Listed as allowed')
    expect(context.textContent).toContain('Authority XP bonus: 0')
    expect(context.textContent).toContain('Authority can be used without bonus proficiency experience')
    expect(context.textContent).toContain('not Alexandra’s actual Authority rank')
    expect(context.textContent).toContain('Classes!T4')
    await selectMain(user, 'Class', 'Ornius Rider')
    expect(context.textContent).toContain('Not listed as allowed while mounted')
    expect(context.textContent).toContain('Dismounting permission has not been verified')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(69)
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Bai Ze Squad' }))
    expect(detail('Bai Ze Squad')).toBeDefined()
    await selectMain(user, 'Class', 'Commoner / Noble')
    expect(context.textContent).toContain('Commoner / Noble · Listed as allowed')
  })

  it('retains selection and filters on character/class changes, including the optional support filter', async () => {
    const user = await open()
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Support' }))
    await user.type(screen.getByLabelText('Search battalion names'), 'Bai')
    await user.selectOptions(screen.getByLabelText('Required Authority rank (catalog)'), 'A')
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Bai Ze Squad' }))
    await user.click(screen.getByLabelText('Only show when class lists battalions'))
    await selectMain(user, 'Character', 'Mu (with growth)')
    expect((screen.getByLabelText('Search battalion names') as HTMLInputElement).value).toBe('Bai')
    expect((screen.getByLabelText('Required Authority rank (catalog)') as HTMLSelectElement).value).toBe('A')
    expect(withinPlanner(browser()).getByRole('button', { name: 'Support' }).getAttribute('aria-pressed')).toBe('true')
    await selectMain(user, 'Class', 'Ornius Rider')
    expect(withinPlanner(browser()).getByText(/No battalions match/)).toBeDefined()
    expect(detail('Bai Ze Squad')).toBeDefined()
    await user.click(screen.getByLabelText('Only show when class lists battalions'))
    expect(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Bai Ze Squad' })).toBeDefined()
  })

  it('preserves independent community notes without assigning their mechanics to a battalion', async () => {
    const user = await open()
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Alecto Morningstars' }))
    expect(detail('Alecto Morningstars').textContent).not.toContain('inflicts')
    expect(detail('Alecto Morningstars').textContent).not.toContain('Scattered Flames')
    await user.click(withinPlanner(browser()).getByText('General battalion research notes', { exact: true }))
    expect(withinPlanner(browser()).getByText(/heals 70% and \*inflicts\* poison/)).toBeDefined()
    expect(withinPlanner(browser()).getByText('Battalions!I36 · unverified')).toBeDefined()
    expect(detail('Alecto Morningstars').textContent).not.toContain('inflicts')
  })

  it('models all expected distributions and source-only support counts', () => {
    const defaults = { category: 'all', rank: 'all', search: '', classSupportOnly: false }
    for (const [category, count] of [['Physical', 18], ['Magical', 16], ['Defense', 18], ['Support', 17]] as const) {
      expect(filterBattalions({ ...defaults, category }, profile('Gladiator'))).toHaveLength(count)
    }
    for (const [rank, count] of [['E', 10], ['D', 13], ['C', 15], ['B', 16], ['A', 15]] as const) {
      expect(filterBattalions({ ...defaults, rank }, profile('Gladiator'))).toHaveLength(count)
    }
    expect(growthData.classes.filter(value => battalionSupport(value) === 'listed')).toHaveLength(39)
    expect(growthData.classes.filter(value => battalionSupport(value) === 'not_listed_mounted')).toHaveLength(20)
    const original = profile('Gladiator')
    expect(battalionSupport({ ...original, details: { ...original.details,
      allowedWeaponsAndSkills: { text: null, status: 'unknown', source: 'fixture' } } })).toBe('unknown')
  })

  it('shows unknown/unresolved raw values without invented parsed numbers', async () => {
    const original = record('Bronze-Shield Guard')
    const saved = { ...original }
    original.flatStatText = { text: 'Def+2 or +4', status: 'unverified', source: 'Battalions!F2' }
    original.parsedStats = { state: 'unresolved', values: Object.fromEntries(STATS.map(stat => [stat, null])) as typeof original.parsedStats.values,
      unparsed: [' or +4'], source: 'Battalions!F2' }
    original.ability = { text: null, status: 'unknown', source: 'Battalions!E2' }
    try {
      render(<BattalionBrowser character={growthData.characters[0]} selectedClass={profile('Gladiator')} />)
      await openPlannerPanel(userEvent, 'Battalions & Gambits')
      const selected = detail(original.name)
      expect(withinPlanner(selected).getByRole('group', { name: 'Listed ability / gambit name' }).textContent).toContain('Unknown')
      expect(withinPlanner(selected).getByRole('group', { name: 'Flat stat bonuses' }).textContent).toContain('Def+2 or +4')
      expect(withinPlanner(selected).getByRole('group', { name: 'Parsed flat stat modifiers' }).textContent).toContain('Parsing: unresolved')
      expect(selected.querySelectorAll('.battalion-stat-grid dd').length).toBe(9)
      expect([...selected.querySelectorAll('.battalion-stat-grid dd')].every(value => value.textContent === 'Not listed')).toBe(true)
    } finally { Object.assign(original, saved) }
  })

  it('inspecting all battalions leaves every growth output unchanged', async () => {
    const user = await open()
    const before = STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
    for (const value of battalionData.records) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${value.name}` }))
      expect(STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)).toEqual(before)
    }
  })

  it('does not infer gambit mechanics or gather-limit interpretations', async () => {
    await open()
    const selected = detail('Bronze-Shield Guard')
    expect(withinPlanner(selected).getByRole('group', {name: 'Gather limit'}).querySelector('.recorded-text')?.textContent).toBe('8')
    expect(withinPlanner(selected).getByRole('group', {name: 'Listed ability / gambit name'}).querySelector('.recorded-text')?.textContent).toBe('Tri-Front Formation')
    expect(selected.textContent).not.toContain('Damage:')
    expect(selected.textContent).not.toContain('Cooldown:')
    expect(selected.textContent).not.toContain('Range:')
    expect(record('Bronze-Shield Guard').parsedStats.values.HP).toBeNull()
  })
})
