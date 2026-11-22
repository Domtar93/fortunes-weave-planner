import { describe, expect, it } from 'vitest'
import { growthData } from './growths'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { formatShortlistEntryLines, formatShortlistText } from './shortlistText'
import { selectMainBuildOverview, type MainBuildOverviewData } from './buildOverview'
import { BUILD_PLAN_DISCLAIMER, formatBuildOverviewText } from './buildOverviewText'

const character = (name = 'Alexandra') => growthData.characters.find(record => record.name === name)!
const profile = (name = 'Wing Soldier') => growthData.classes.find(record => record.name === name)!
const weapon = (name = 'Levin Sword') => weaponData.records.find(record => record.name === name)!
const mount = (name = "Bucephalus (Alexandra's mount)") => mountData.records.find(record => record.name === name)!
const battalion = (name = 'Bronze-Shield Guard') => battalionData.records.find(record => record.name === name)!
const plan = (name: string, category: 'Sword' | 'Flying', rank: string) => {
  const source = proficiencyData.categories[category].characters[name === 'Mu (with growth)' ? 'Mu' : name].find(entry => entry.rank === rank)!.source
  return resolvePlanningEntry(name, category, rank, source)!
}
const example = (className = 'Wing Soldier') => selectMainBuildOverview({ character: character(), selectedClass: profile(className), weaponId: weapon().id, mountId: mountId(mount()), battalionId: battalion().id,
  entries: [plan('Alexandra', 'Sword', 'D'), plan('Alexandra', 'Sword', 'C'), plan('Alexandra', 'Sword', 'B')] })
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

describe('main overview plain text', () => {
  it('exports the complete Alexandra build and the same live compatibility messages with sources and disclaimer', () => {
    const data = example(), text = formatBuildOverviewText(data)
    for (const phrase of ["FORTUNE'S WEAVE — MAIN BUILD PLAN", 'Character: Alexandra\nClass: Wing Soldier', 'Name: Levin Sword', 'Family: Sword (provisional classification)', 'Might: 12-20 (documented span, not calculated refinement)', 'Attack range: 1-2', "Name: Bucephalus (Alexandra's mount)", 'Species: Pegasus', 'Name: Bronze-Shield Guard', 'Category: Defense', 'Authority requirement: E', 'PLANNED ABILITIES (3/8)', '1. Haze Slice', '2. Rend Armor', '3. Gale Blow', 'SOURCE WARNINGS', 'PLANNING DISCLAIMER', BUILD_PLAN_DISCLAIMER]) expect(text).toContain(phrase)
    expect(text).toContain(data.weapon!.support.message); expect(text).toContain(data.mount!.message); expect(text).toContain(data.battalion!.message)
    expect(text).toContain('Authority requirement documented; character eligibility not verified.')
    expect(text).toContain('Forging!A28:J28'); expect(text).toContain('range=A28%3AJ28'); expect(text).toContain('Mounts!A18:Q18'); expect(text).toContain('Battalions!A2:G2')
    expect(text).toContain('Family source: Forging!A28'); expect(text).toContain('Class context source: Classes!L18')
    expect(text).not.toMatch(/Equipped Abilities|Build is valid|All equipment requirements met|Guaranteed obtainable/)
  })
  it('is deterministic, uses LF and leaves a deep-frozen input unchanged', () => {
    const data = freeze(structuredClone(example())), before = JSON.stringify(data)
    expect(formatBuildOverviewText(data)).toBe(formatBuildOverviewText(data)); expect(formatBuildOverviewText(data)).not.toContain('\r')
    expect(JSON.stringify(data)).toBe(before)
    const multiline = { ...data, classNotes: ['One\r\nTwo\rThree'] }
    expect(formatBuildOverviewText(multiline)).toContain('Class: One\nTwo\nThree')
  })
  it('uses supplied compatibility results verbatim rather than recomputing them', () => {
    const original = example(), data: MainBuildOverviewData = { ...original,
      weapon: { ...original.weapon!, support: { ...original.weapon!.support, message: 'Recorded weapon context fixture.' } },
      mount: { ...original.mount!, message: 'Recorded mount context fixture.' }, battalion: { ...original.battalion!, message: 'Battalion compatibility undetermined.' } }
    const text = formatBuildOverviewText(data)
    for (const message of ['Recorded weapon context fixture.', 'Recorded mount context fixture.', 'Battalion compatibility undetermined.']) expect(text).toContain(message)
  })
  it('updates Gladiator context while retaining the exact equipment', () => {
    const text = formatBuildOverviewText(example('Gladiator'))
    expect(text).toContain('Class: Gladiator'); expect(text).toContain('Weapon family listed by class.')
    expect(text).toContain('This class has no mount type listed.'); expect(text).toContain('Battalions listed by this class.')
    expect(text).toContain('Levin Sword'); expect(text).toContain("Bucephalus (Alexandra's mount)"); expect(text).toContain('Bronze-Shield Guard')
  })
  it('retains every live warning, including Zanbato and Meganius, without resolving evidence', () => {
    const data = selectMainBuildOverview({ character: character(), selectedClass: profile('Armored Ornius Rider'), weaponId: weapon('Zanbato').id, mountId: mountId(mount('Meganius')), battalionId: battalion().id, entries: [] })
    const text = formatBuildOverviewText(data)
    for (const note of data.classNotes) expect(text).toContain(note)
    for (const group of [data.weapon!, data.mount!, data.battalion!]) for (const warning of group.warnings) { expect(text).toContain(warning.source); expect(text).toContain(warning.message) }
    expect(text).toContain('Documented Might: main 14-19; preliminary Zanbato 7-19')
    expect(text).toContain('neither version is selected for calculations'); expect(text).toContain('DATA-12')
  })
  it.each(['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus'])('identifies missing %s values without zeros', name => {
    const text = formatBuildOverviewText(selectMainBuildOverview({ character: character(), selectedClass: profile(), weaponId: weapon(name).id, entries: [] }))
    expect(text).toContain('Incomplete source data. Undocumented properties:'); expect(text).toContain('Might: Not documented'); expect(text).toContain('Attack range: Not documented')
    expect(text).not.toContain('Might: 0'); expect(text).not.toContain('Attack range: 0')
  })
  it('preserves genuine zero values separately from missing data', () => {
    const original = example(), data = { ...original, weapon: { ...original.weapon!, record: { ...original.weapon!.record,
      might: { ...original.weapon!.record.might, text: '0', kind: 'single' as const, value: 0 }, attackRange: { ...original.weapon!.record.attackRange, text: '0' } } } }
    const text = formatBuildOverviewText(data); expect(text).toContain('Might: 0\n'); expect(text).toContain('Attack range: 0\n')
  })
  it('exports meaningful empty and unavailable states without default equipment or verified-mechanics claims', () => {
    const empty = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries: [] })
    const text = formatBuildOverviewText(empty)
    for (const phrase of ['Weapon: Not selected.', 'Mount: Not selected.', 'Battalion: Not selected.', 'PLANNED ABILITIES (0/8)', 'No abilities shortlisted.', 'Community data and gameplay mechanics remain unverified.']) expect(text).toContain(phrase)
    expect(text).not.toContain('Name: Levin Sword'); expect(text).toContain(BUILD_PLAN_DISCLAIMER)
    expect(formatBuildOverviewText({ ...empty, unavailable: { weapon: true, mount: true, battalion: true } }).match(/Selected reference unavailable/g)).toHaveLength(3)
  })
  it('preserves plus ranks, Unicode, apostrophes, duplicate names, sources and the shared entry formatting exactly', () => {
    const data = example(), one = plan('Alexandra', 'Sword', 'S+'), two = plan('Alexandra', 'Flying', 'C+')
    const entries = [one, { ...two, entry: { ...two.entry, text: one.entry.text } }, { ...data.entries[0], entry: { ...data.entries[0].entry, text: "Mu’s α—Wind Γ +1 / Io's" } }]
    const text = formatBuildOverviewText({ ...data, entries })
    expect(text.match(/\d\. Swordfaire/g)).toHaveLength(2); expect(text).toContain('Proficiency: Sword S+'); expect(text).toContain('Proficiency: Flying C+')
    expect(text).toContain("3. Mu’s α—Wind Γ +1 / Io's"); expect(text).toContain("Source: 'Sword'!G2"); expect(text).toContain("Source: 'Flying'!C2")
    const shared = formatShortlistEntryLines(entries).join('\n')
    expect(text).toContain(shared); expect(formatShortlistText({ id: 'Alexandra', displayName: 'Alexandra' }, entries, growthData.metadata)).toContain(shared)
  })
  it.each(['Alexandra', 'Sofia', 'Mu', 'Mu (with growth)'])('keeps %s equipment and abilities scoped to its exact identity', name => {
    const names = ['Alexandra', 'Sofia', 'Mu', 'Mu (with growth)'], index = names.indexOf(name)
    const records = names.map(value => plan(value, 'Sword', value === 'Mu (with growth)' ? 'C' : 'D'))
    const data = selectMainBuildOverview({ character: character(name), selectedClass: profile(), weaponId: weaponData.records[index].id, mountId: mountId(mountData.records[index]), battalionId: battalionData.records[index].id, entries: records })
    const text = formatBuildOverviewText(data)
    expect(text).toContain(`Character: ${name}\n`); expect(text).toContain(`Name: ${weaponData.records[index].name}\n`); expect(text).toContain(`Name: ${mountData.records[index].name}\n`)
    expect(text).toContain('PLANNED ABILITIES (1/8)'); expect(text).toContain(`1. ${records[index].entry.text}`)
    if (name === 'Mu (with growth)') { expect(text).toContain("Mu (with growth) uses Mu's source learnset"); expect(text).not.toContain('1. Wrath Strike') }
    if (name === 'Mu') expect(text).not.toContain('Shadow Gambit')
  })
})
