import { openPlannerPanel , withinPlanner } from './plannerTestUtils'
import { selectMain, plannerRole } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import MountBrowser from './MountBrowser'
import { growthData, STATS } from './growths'
import { COMPATIBILITY_LABELS, filterMounts, mountCompatibility, mountData } from './mounts'

afterEach(cleanup)
const browser = () => plannerRole('region', { name: 'Mount reference browser' })
const catalog = () => withinPlanner(browser()).getByRole('list', { name: 'Mount catalog' })
const detail = (name: string) => withinPlanner(browser()).getByRole('region', { name: `${name} mount details` })
const profile = (name: string) => growthData.classes.find(value => value.name === name)!
const mount = (name: string) => mountData.records.find(value => value.name === name)!
async function open() {
  const user = userEvent.setup()
  render(<App />)
  await openPlannerPanel(user, 'Mounts & Compatibility')
  return user
}

describe('mount reference and compatibility', () => {
  it('starts collapsed, loads all 22 mounts, and retains the nine growth cards', async () => {
    render(<App />)
    expect(screen.getByText('Mounts & Compatibility').closest('details')?.open).toBe(false)
    expect(screen.getAllByRole('article')).toHaveLength(9)
    await openPlannerPanel(userEvent, 'Mounts & Compatibility')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(22)
    expect(withinPlanner(browser()).getByRole('group', { name: 'Mount species filters' }).querySelectorAll('button')).toHaveLength(6)
    expect(withinPlanner(detail('Wild Ornius')).getByRole('group', { name: 'Listed ability names' }).textContent).toContain('Paired Run, Paired Stealth')
  })

  it('filters all five species and searches conflicted mounts without resetting the inspection', async () => {
    const user = await open()
    for (const [species, count] of [['Ornius', 6], ['Horse', 6], ['Pegasus', 6], ['Bau', 3], ['Elephant', 1]] as const) {
      await user.click(withinPlanner(browser()).getByRole('button', { name: species }))
      expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(count)
    }
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'All mounts' }))
    await user.type(screen.getByLabelText('Search mount names'), '  MEGANIUS ')
    expect(withinPlanner(catalog()).getAllByRole('button')).toHaveLength(2)
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Meganius' }))
    expect(detail('Meganius').textContent).toContain('written and numeric growth entries differ')
    await user.type(screen.getByLabelText('Search mount names'), 'no match')
    expect(withinPlanner(browser()).getByText('No mounts match these filters. Try All mounts or clear the search.')).toBeDefined()
    expect(detail('Meganius').textContent).toContain('Selected mount is outside the current filters')
  })

  it('displays Meganius’s independent written/numeric values and all three disputed stats', async () => {
    const user = await open()
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Meganius' }))
    const selected = detail('Meganius')
    expect(withinPlanner(selected).getByRole('group', { name: 'Written growth modifiers (%)' }).querySelector('.recorded-text')?.textContent)
      .toBe('Str 5%, Def 15%, Dex 5% ')
    const table = withinPlanner(selected).getByRole('table', { name: 'Meganius written versus numeric growth modifiers' })
    for (const [stat, written, numeric] of [['Dexterity (Dex)', '+5%', '+15%'], ['Defense (Def)', '+15%', 'Not listed'],
                                            ['Resistance (Res)', 'Not listed', '+5%']]) {
      const row = withinPlanner(table).getByText(stat).closest('tr')!
      expect(row.className).toBe('growth-conflict')
      expect(row.querySelectorAll('td')[0].textContent).toContain(written)
      expect(row.querySelectorAll('td')[1].textContent).toContain(numeric)
    }
    expect(selected.textContent).toContain('neither version is selected for calculations')
    expect(screen.getByTestId('combined-Str').textContent).toBe('45%')
  })

  it('keeps Bucephalus, its foal and the elephant acquisition caveats distinct', async () => {
    const user = await open()
    await user.click(withinPlanner(catalog()).getByRole('button', { name: "Inspect Bucephalus (Alexandra's mount)" }))
    expect(detail("Bucephalus (Alexandra's mount)").textContent).toContain('Recruit Alexandra')
    await user.click(withinPlanner(catalog()).getByRole('button', { name: "Inspect Bucephalus's Foal" }))
    expect(detail("Bucephalus's Foal").textContent).toContain("Alexandra recruited outside of Cai's Path")
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Saramis War Elephant' }))
    const elephant = detail('Saramis War Elephant')
    expect(elephant.textContent).toContain("Part III Quest (may require Cai's path completed)")
    expect(elephant.textContent).toContain('uncertainty qualifier')
    expect(withinPlanner(elephant).getByRole('group', { name: 'Flat stat modifiers (points, source text)' }).textContent).toContain('Str 5, Dex 5, Def 5, Lck 5')
    expect(withinPlanner(catalog()).getAllByRole('button', { name: 'Inspect Saramis War Elephant' })).toHaveLength(1)
  })

  it('updates compatibility with the existing class selector and preserves mount/filter state on character changes', async () => {
    const user = await open()
    await user.click(withinPlanner(browser()).getByRole('button', { name: 'Horse' }))
    await user.type(screen.getByLabelText('Search mount names'), 'Wild')
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect Wild Horse' }))
    const compatibility = withinPlanner(detail('Wild Horse')).getByRole('group', { name: 'Mount compatibility' })
    await selectMain(user, 'Class', 'Ornius Rider')
    expect(compatibility.textContent).toContain(COMPATIBILITY_LABELS.mismatch)
    await selectMain(user, 'Class', 'Light Cavalry')
    expect(compatibility.textContent).toContain(COMPATIBILITY_LABELS.match)
    await selectMain(user, 'Character', 'Mu (with growth)')
    expect((screen.getByLabelText('Search mount names') as HTMLInputElement).value).toBe('Wild')
    expect(withinPlanner(browser()).getByRole('button', { name: 'Horse' }).getAttribute('aria-pressed')).toBe('true')
    expect(detail('Wild Horse')).toBeDefined()
    expect(withinPlanner(browser()).getByText(/Inspecting mounts for Mu \(with growth\)/)).toBeDefined()
    await selectMain(user, 'Class', 'Commoner / Noble')
    expect(compatibility.textContent).toContain(COMPATIBILITY_LABELS.unmounted)
    expect(compatibility.textContent).toContain('Commoner / Noble: No')
  })

  it('classifies only recorded type equality for all required species and keeps unknown types unknown', () => {
    for (const [className, name] of [['Ornius Rider', 'Wild Ornius'], ['Light Cavalry', 'Wild Horse'], ['Wing Soldier', 'Wild Pegasus'],
                                    ['Dragoon', 'Wild Bau'], ['Elephant Rider', 'Saramis War Elephant']]) {
      expect(mountCompatibility(profile(className), mount(name))).toBe('match')
    }
    expect(mountCompatibility(profile('Ornius Rider'), mount('Wild Horse'))).toBe('mismatch')
    expect(mountCompatibility(profile('Commoner / Noble'), mount('Wild Horse'))).toBe('unmounted')
    const original = profile('Ornius Rider')
    const unknown = { ...original, details: { ...original.details, mountType: { text: null, status: 'unknown' as const, source: 'fixture' } } }
    expect(mountCompatibility(unknown, mount('Wild Ornius'))).toBe('unknown')
    expect(mountCompatibility(original, { ...mount('Wild Ornius'), species: { text: 'Dragon', status: 'unverified', source: 'fixture' } })).toBe('unknown')
  })

  it('keeps alternative ability names separate from unrelated column G effects and worksheet notes', async () => {
    const user = await open()
    await user.click(withinPlanner(catalog()).getByRole('button', { name: 'Inspect White Ornius' }))
    const selected = detail('White Ornius')
    const abilities = withinPlanner(selected).getByRole('group', { name: 'Listed ability names' })
    const independent = withinPlanner(selected).getByRole('group', { name: 'Independent community reference notes (column G)' })
    expect(abilities.textContent).toContain('Paired Purify, Paired Healing')
    expect(abilities.textContent).not.toContain('Paired Alertness')
    expect(independent.querySelector('.recorded-text')?.textContent).toBe('Paired Alertness - Grants Ddg +5/10 ')
    expect(selected.textContent).toContain('Only one option, not both')
    await user.click(withinPlanner(browser()).getByText('Worksheet research notes', { exact: true }))
    expect(withinPlanner(browser()).getByText(/horses equipped by charioteers give double/)).toBeDefined()
    expect(screen.getByTestId('combined-HP').textContent).toBe('40%')
  })

  it('inspecting every mount leaves all nine growth totals unchanged', async () => {
    const user = await open()
    const before = STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)
    for (const record of mountData.records) {
      await user.click(withinPlanner(catalog()).getByRole('button', { name: `Inspect ${record.name}` }))
      expect(STATS.map(stat => screen.getByTestId(`combined-${stat}`).textContent)).toEqual(before)
    }
    expect(filterMounts('all', 'meGANIus').map(record => record.name)).toEqual(['Meganius', 'Red Meganius'])
  })

  it('shows missing source text and explicit zero without inventing an ability or zero for an omission', async () => {
    const original = mount('Wild Ornius')
    const saved = { ...original }
    original.abilities = { text: null, status: 'unknown', source: 'Mounts!C2' }
    original.acquisition = { text: null, status: 'unknown', source: 'Mounts!F2' }
    original.numericGrowths = { ...original.numericGrowths, HP: { value: 0, status: 'unverified', source: 'Mounts!H2' } }
    try {
      render(<MountBrowser character={growthData.characters[0]} selectedClass={profile('Gladiator')} />)
      await openPlannerPanel(userEvent, 'Mounts & Compatibility')
      const selected = detail('Wild Ornius')
      expect(withinPlanner(selected).getByRole('group', { name: 'Listed ability names' }).textContent).toContain('Not recorded in the workbook.')
      const table = withinPlanner(selected).getByRole('table', { name: 'Wild Ornius written versus numeric growth modifiers' })
      expect(withinPlanner(table).getByText('Health (HP)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('0%')
      expect(withinPlanner(table).getByText('Defense (Def)').closest('tr')?.querySelectorAll('td')[1].textContent).toContain('Not listed')
    } finally {
      Object.assign(original, saved)
    }
  })

  it('keeps parsed flat points, written growths and numeric percentages in distinct fields', async () => {
    const user = await open()
    const selected = detail('Wild Ornius')
    await user.click(withinPlanner(selected).getByText('Parsing & validation', { exact: true }))
    expect(selected.textContent).toContain('Parsed flat points: Spd 2, Dex 3')
    expect(mount('Wild Ornius').flatStatText.text).toBe('Spd 2, Dex 3 ')
    expect(mount('Wild Ornius').growthText.text).toBe('Spd 10%, Dex 15% ')
    expect(selected.textContent).toContain('Original formula retained')
    expect(mount('Wild Ornius').numericGrowths.Spd.value).toBe(10)
  })
})
