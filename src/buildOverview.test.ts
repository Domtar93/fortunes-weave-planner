import { describe, expect, it } from 'vitest'
import { growthData, type ClassProfile } from './growths'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { resolvePlanningEntry } from './shortlist'
import { proficiencyData } from './proficiencies'
import { selectMainBuildOverview } from './buildOverview'

const character = (name = 'Alexandra') => growthData.characters.find(value => value.name === name)!
const profile = (name = 'Wing Soldier') => growthData.classes.find(value => value.name === name)!
const weapon = (name = 'Levin Sword') => weaponData.records.find(value => value.name === name)!
const mount = (name = "Bucephalus (Alexandra's mount)") => mountData.records.find(value => value.name === name)!
const battalion = battalionData.records.find(value => value.name === 'Bronze-Shield Guard')!
const entry = (name: string, rank: string) => resolvePlanningEntry(name, 'Sword', rank, proficiencyData.categories.Sword.characters[name === 'Mu (with growth)' ? 'Mu' : name].find(value => value.rank === rank)!.source)!
const select = (selectedClass: ClassProfile = profile()) => selectMainBuildOverview({ character: character(), selectedClass, weaponId: weapon().id, mountId: mountId(mount()), battalionId: battalion.id, entries: [] })

describe('derived main overview', () => {
  it('retains every catalog count and never changes the input/source records', () => {
    const data = { growthData, weaponData, battalionData, mountData }, before = JSON.stringify(data)
    expect([weaponData.records.length, battalionData.records.length, mountData.records.length, growthData.classes.length]).toEqual([91, 69, 22, 59])
    const input = { character: character(), selectedClass: profile(), entries: [entry('Alexandra', 'D')] }
    const original = structuredClone(input), result = selectMainBuildOverview(input)
    expect(result.character).toBe(input.character); expect(result.selectedClass).toBe(input.selectedClass)
    expect(result.entries[0]).toBe(input.entries[0]); expect(input).toEqual(original); expect(JSON.stringify(data)).toBe(before)
  })
  it('derives Alexandra’s complete example using original records and current compatibility helpers', () => {
    const result = select()
    expect(result.weapon?.record).toBe(weapon()); expect(result.weapon?.family.family).toBe('Sword'); expect(result.weapon?.family.status).toBe('provisional')
    expect(result.weapon?.support.outcome).toBe('listed'); expect(result.mount?.record).toBe(mount())
    expect(result.mount?.outcome).toBe('match'); expect(result.battalion?.record).toBe(battalion)
    expect(result.battalion?.outcome).toBe('not-listed'); expect(result.battalion?.record.authorityRank.text).toBe('E')
  })
  it('updates only derived context for Gladiator without changing the records', () => {
    const before = select(), after = select(profile('Gladiator'))
    expect(after.weapon?.support.outcome).toBe('listed'); expect(after.mount?.outcome).toBe('unmounted'); expect(after.battalion?.outcome).toBe('listed')
    expect(after.weapon?.record).toBe(before.weapon?.record); expect(after.mount?.record).toBe(before.mount?.record); expect(after.battalion?.record).toBe(before.battalion?.record)
  })
  it('preserves not-listed and unresolved weapon, battalion and mount outcomes', () => {
    expect(select(profile('Archer')).weapon?.support.outcome).toBe('not-listed')
    const original = profile(), unknown = { ...original, details: { ...original.details,
      allowedWeaponsAndSkills: { text: null, status: 'unknown' as const, source: 'Classes!L18' },
      mountType: { text: 'Uncertain', status: 'unverified' as const, source: 'Classes!BA18' },
    } }
    const result = select(unknown)
    expect(result.weapon?.support.outcome).toBe('unresolved'); expect(result.battalion?.outcome).toBe('unresolved'); expect(result.mount?.outcome).toBe('unknown')
    expect(select(profile('Light Cavalry')).mount?.outcome).toBe('mismatch')
  })
  it('keeps empty selections distinct from stale unavailable identities', () => {
    const empty = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries: [] })
    expect(empty.weapon).toBeUndefined(); expect(empty.mount).toBeUndefined(); expect(empty.battalion).toBeUndefined(); expect(empty.entries).toEqual([])
    expect(empty.unavailable).toEqual({ weapon: false, mount: false, battalion: false })
    const stale = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries: [], weaponId: 'missing', mountId: 'missing', battalionId: 'missing' })
    expect(stale.unavailable).toEqual({ weapon: true, mount: true, battalion: true })
  })
  it('exposes Zanbato’s existing Might difference and Meganius’s conflict without resolving either', () => {
    const result = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries: [], weaponId: weapon('Zanbato').id, mountId: mountId(mount('Meganius')) })
    expect(result.weapon?.warnings.some(warning => warning.message.includes('Documented Might: main 14-19; preliminary Zanbato 7-19') && warning.source === 'Forging!C25 / Forging!C4')).toBe(true)
    expect(result.weapon?.warnings.some(warning => warning.message.includes('Main values are never overwritten'))).toBe(true)
    expect(result.mount?.warnings.some(warning => warning.message.includes('written and numeric growth entries differ') && warning.message.includes('neither version is selected for calculations'))).toBe(true)
    expect(result.weapon?.record.might.text).toBe('14-19'); expect(result.mount?.record.numericGrowths.Dex.value).toBe(15)
  })
  it.each(['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus'])('keeps %s incomplete', name => {
    const result = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries: [], weaponId: weapon(name).id })
    expect(result.weapon?.record.primaryCompleteness).toBe('incomplete'); expect(result.weapon?.warnings.length).toBeGreaterThan(0)
  })
  it('preserves relevant class and equipment warnings rather than hiding unverified source evidence', () => {
    const result = select(profile('Armored Ornius Rider'))
    expect(result.classNotes.join(' ')).toContain('DATA-12'); expect(result.weapon?.warnings.some(warning => warning.source === 'Forging!D28')).toBe(true)
  })
  it('preserves source IDs/order and filters by the exact profile without merging equal ability names', () => {
    const first = entry('Alexandra', 'D'), second = entry('Alexandra', 'C')
    const equalName = { ...second, entry: { ...second.entry, text: first.entry.text } }
    const entries = [equalName, first, entry('Sofia', 'D')]
    const result = selectMainBuildOverview({ character: character(), selectedClass: profile(), entries })
    expect(result.entries.map(value => value.id)).toEqual([second.id, first.id]); expect(result.entries).toHaveLength(2)
    expect(result.entries[0].entry.text).toBe(result.entries[1].entry.text)
    expect(entries).toHaveLength(3)
  })
  it.each(['Mu', 'Mu (with growth)'])('keeps %s display and ability identity separate', name => {
    const result = selectMainBuildOverview({ character: character(name), selectedClass: profile(), entries: [entry('Mu', 'D'), entry('Mu (with growth)', 'D')] })
    expect(result.character.name).toBe(name); expect(result.entries).toHaveLength(1); expect(result.entries[0].characterName).toBe(name)
  })
})
