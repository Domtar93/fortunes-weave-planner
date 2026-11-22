import { describe, expect, it } from 'vitest'
import imported from './data/growths.json'
import { growthData, STATS, type SourceText } from './growths'
import { mountData, filterMounts } from './mounts'
import { mountId, mountSelectionReducer, planningMountCompatibility, type MountSelections } from './mountPlanning'

const mount = (name: string) => mountData.records.find(record => record.name === name)!
const profile = (name: string) => growthData.classes.find(record => record.name === name)!

describe('mount planning source integrity', () => {
  it('retains 22 source-identical records, numeric columns, totals and the 6/6/6/3/1 distribution', () => {
    expect(mountData.records).toHaveLength(22)
    expect(mountData.records).toEqual(imported.mounts.records)
    expect(new Set(mountData.records.map(mountId)).size).toBe(22)
    for (const record of mountData.records) {
      expect(mountId(record)).toBe(record.nameSource.source)
      expect(mountId(record)).toMatch(/^Mounts!A(?:[2-9]|1[0-9]|2[0-3])$/)
      expect(Object.keys(record.numericGrowths)).toEqual([...STATS])
    }
    for (const [species, count] of [['Ornius', 6], ['Horse', 6], ['Pegasus', 6], ['Bau', 3], ['Elephant', 1]] as const) expect(filterMounts(species, '')).toHaveLength(count)
  })
  it('uses name-cell source identity independently of record name and array order', () => {
    const record = mount("Bucephalus (Alexandra's mount)")
    expect(mountId(record)).toBe('Mounts!A18')
    expect(mountId({ ...record, name: 'A renamed label' })).toBe('Mounts!A18')
    expect([...mountData.records].reverse().find(value => mountId(value) === 'Mounts!A18')).toBe(record)
  })
  it('keeps related mounts separate and preserves exact acquisition caveats', () => {
    expect(mountId(mount("Rocinan (Io's mount)"))).not.toBe(mountId(mount("Rocinan's Brother")))
    expect(mountId(mount("Bucephalus (Alexandra's mount)"))).not.toBe(mountId(mount("Bucephalus's Foal")))
    expect(mount("Bucephalus (Alexandra's mount)").acquisition.text).toBe('Recruit Alexandra')
    expect(mount("Rocinan (Io's mount)").acquisition.text).toBe('Recruit Io')
    expect(mount('Wild Horse').acquisition.text).toBe('Sunlit Pass, Oleance Plains, Daimos Plateau, Sunfall Path, Desert Escapeway')
    expect(mount('Saramis War Elephant').acquisition.text).toBe("Part III Quest (may require Cai's path completed)")
  })
  it('retains Meganius’s independent written and numeric disagreements without correction', () => {
    const record = mount('Meganius')
    expect(record.species.text).toBe('Ornius')
    expect(record.parsed.flatStats.values).toMatchObject({ Str: 1, Def: 3, Dex: 1 })
    expect(record.parsed.growths.values).toMatchObject({ Str: 5, Def: 15, Dex: 5, Res: null })
    expect(record.numericGrowths.Str.value).toBe(5); expect(record.numericGrowths.Dex.value).toBe(15)
    expect(record.numericGrowths.Res.value).toBe(5); expect(record.numericGrowths.Def.value).toBeNull()
    expect(record.growthComparison.differences.map(value => value.stat)).toEqual(['Dex', 'Def', 'Res'])
  })
})

describe('documented mount species comparison', () => {
  it.each([
    ['Wing Soldier', 'Wild Pegasus', 'match'], ['Wing Soldier', 'Wild Horse', 'mismatch'],
    ['Ornius Rider', 'Wild Ornius', 'match'], ['Dragoon', 'Wild Bau', 'match'],
    ['Elephant Rider', 'Saramis War Elephant', 'match'], ['Gladiator', 'Wild Horse', 'unmounted'],
  ])('%s + %s gives %s', (className, mountName, expected) => {
    expect(planningMountCompatibility(profile(className), mount(mountName))).toBe(expected)
  })
  it.each([
    { text: null, status: 'unknown' }, { text: '', status: 'unverified' }, { text: 'Dragon', status: 'unverified' },
    { text: 'No', status: 'unknown' }, { text: 'Pegasus', status: 'unavailable' }, { text: 'Horse or Pegasus', status: 'unverified' },
  ] as const)('does not treat missing/uninterpretable class fields as No: %j', field => {
    const original = profile('Wing Soldier')
    expect(planningMountCompatibility({ ...original, details: { ...original.details, mountType: { ...field, source: 'Classes!BA18' } } }, mount('Wild Pegasus'))).toBe('unknown')
  })
  it('keeps absent records and unknown mount species unresolved', () => {
    expect(planningMountCompatibility(undefined, mount('Wild Horse'))).toBe('unknown')
    expect(planningMountCompatibility(profile('Wing Soldier'))).toBe('unknown')
    for (const species of [{ text: null, status: 'unknown' }, { text: 'Dragon', status: 'unverified' }, { text: 'Pegasus', status: 'unknown' }] as SourceText[]) {
      expect(planningMountCompatibility(profile('Wing Soldier'), { ...mount('Wild Pegasus'), species })).toBe('unknown')
    }
  })
  it('does not derive permission from class name, movement, XP, weapon types or requirements', () => {
    const original = profile('Wing Soldier')
    const context = { ...original, name: 'Horse General', details: { ...original.details,
      mountType: { ...original.details.mountType, text: 'Horse' },
      allowedWeaponsAndSkills: { ...original.details.allowedWeaponsAndSkills, text: 'Flying, Infantry, Battalions' },
      primaryRequirements: { ...original.details.primaryRequirements, text: 'Flying S+' },
      movement: { ...original.details.movement, value: 0 },
    } }
    expect(planningMountCompatibility(context, mount('Wild Horse'))).toBe('match')
    expect(planningMountCompatibility(context, mount('Wild Pegasus'))).toBe('mismatch')
  })
})

describe('mount session reducer', () => {
  it('isolates Alexandra, Sofia and both Mu profiles without mutating previous state', () => {
    let state: MountSelections = {}
    const pairs = [['Alexandra', "Bucephalus (Alexandra's mount)"], ['Sofia', 'Wild Horse'], ['Mu', 'Wild Ornius'], ['Mu (with growth)', 'Wild Pegasus']]
    for (const [characterName, name] of pairs) state = mountSelectionReducer(state, { characterName, mountId: mountId(mount(name)) })
    const before = structuredClone(state)
    const next = mountSelectionReducer(state, { characterName: 'Mu', mountId: null })
    expect(state).toEqual(before); expect(next.Mu).toBeUndefined(); expect(next['Mu (with growth)']).toBe('Mounts!A14')
    expect(Object.keys(next)).toHaveLength(3)
  })
  it('rejects stale IDs, array indexes, name-only identities and unknown/prototype character names', () => {
    const state = { Alexandra: 'Mounts!A18' }
    for (const action of [
      { characterName: 'Unknown', mountId: 'Mounts!A18' }, { characterName: '__proto__', mountId: 'Mounts!A18' },
      { characterName: 'Alexandra', mountId: '17' }, { characterName: 'Alexandra', mountId: 'Mounts!A99' },
      { characterName: 'Alexandra', mountId: "Bucephalus (Alexandra's mount)" },
      { characterName: 'Alexandra', mountId: 'Mounts!A18' }, { characterName: 'Sofia', mountId: null },
    ]) expect(mountSelectionReducer(state, action)).toBe(state)
  })
})
