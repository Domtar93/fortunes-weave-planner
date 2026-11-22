import { describe, expect, it } from 'vitest'
import { BATTALION_CATEGORIES, battalionData, filterBattalions } from './battalions'
import { growthData, type SourceText } from './growths'
import { battalionSelectionReducer, classBattalionSupport } from './battalionPlanning'

const profile = (name: string) => growthData.classes.find(value => value.name === name)!
const record = (name: string) => battalionData.records.find(value => value.name === name)!
const field = (text: string | null, status: SourceText['status'] = 'unverified'): SourceText => ({ text, status, source: 'Classes!L4' })

describe('battalion planning source context', () => {
  it.each([['Gladiator', 'listed'], ['Commoner / Noble', 'listed'], ['Ornius Rider', 'not-listed'], ['Light Cavalry', 'not-listed']])('%s uses column L', (name, expected) => {
    expect(classBattalionSupport(profile(name).details.allowedWeaponsAndSkills)).toBe(expected)
  })
  it('reconciles all 59 class lists without deriving permission from mount classification', () => {
    const outcomes = growthData.classes.map(value => classBattalionSupport(value.details.allowedWeaponsAndSkills))
    expect(outcomes.filter(value => value === 'listed')).toHaveLength(39)
    expect(outcomes.filter(value => value === 'not-listed')).toHaveLength(20)
    expect(classBattalionSupport(field('Battalions'))).toBe('listed')
    expect(classBattalionSupport(field('Sword, Infantry'))).toBe('not-listed')
  })
  it.each([undefined, field(null), field(''), field('  '), field('Battalions', 'unknown'), field('Battalions', 'unavailable'), field('Battalions (when dismounted)'), field('No Battalions'), field('Sword; Battalions'), field('Sword, Unknown'), field('Sword,')])('leaves absent/ambiguous allowed types unresolved: %j', allowed => {
    expect(classBattalionSupport(allowed)).toBe('unresolved')
  })
  it('accepts explicit case-insensitive lists and documented movement qualifiers', () => {
    expect(classBattalionSupport(field(' swords, B. Magic, battalions, Infantry (Cavalry) '))).toBe('listed')
    expect(classBattalionSupport(field('Spears, Flying (Ornius), Armor'))).toBe('not-listed')
  })
  it('retains all 69 source-backed IDs, categories, acquisition and raw/parsed evidence', () => {
    expect(battalionData.records).toHaveLength(69)
    expect(new Set(battalionData.records.map(value => value.id)).size).toBe(69)
    expect(new Set(battalionData.records.map(value => value.category.text))).toEqual(new Set(BATTALION_CATEGORIES))
    for (const value of battalionData.records) {
      expect(value.acquisition.source).toBe(`Battalions!G${value.source.row}`)
      expect(value.flatStatText.source).toBe(value.parsedStats.source)
      expect(value.reliability).toBe('unverified')
    }
    expect(record('Bronze-Shield Guard').parsedStats.values.HP).toBeNull()
    expect(record('Bronze-Shield Guard').flatStatText.text).toContain('Def')
    expect(filterBattalions({ search: '', category: 'all', rank: 'all', classSupportOnly: false }, profile('Ornius Rider'))).toHaveLength(69)
  })
  it.each([
    ['Bronze-Shield Guard', 'Defense', 'E', 8, 'Tri-Front Formation', { Def: 2, Cha: 3 }],
    ['Mage Pupils', 'Magical', 'E', 8, 'Scattered Flames', { Mag: 2, Cha: 2 }],
    ['Bai Ze Squad', 'Support', 'A', 22, 'Column Recovery+', { Mag: 3, Res: 3, Lck: 2, Cha: 8 }],
  ] as const)('preserves %s fields', (name, category, rank, gather, ability, stats) => {
    const value = record(name)
    expect(value.category.text).toBe(category); expect(value.authorityRank.text).toBe(rank)
    expect(value.gatherLimit.value).toBe(gather); expect(value.ability.text).toBe(ability)
    expect(value.parsedStats.values).toMatchObject(stats)
  })
})

describe('battalion session reducer', () => {
  it('isolates exact character profiles including both Mu states and clears only one', () => {
    let state = {}
    const names = ['Alexandra', 'Sofia', 'Mu', 'Mu (with growth)']
    names.forEach((characterName, index) => { state = battalionSelectionReducer(state, { characterName, battalionId: battalionData.records[index].id }) })
    const before = structuredClone(state)
    const next = battalionSelectionReducer(state, { characterName: 'Mu', battalionId: null })
    expect(state).toEqual(before); expect(next.Mu).toBeUndefined()
    expect(next['Mu (with growth)']).toBe(battalionData.records[3].id)
    expect(Object.keys(next)).toHaveLength(3)
  })
  it('rejects stale IDs and unknown/prototype names and returns unchanged state for no-ops', () => {
    const state = { Alexandra: record('Bronze-Shield Guard').id }
    for (const action of [
      { characterName: 'Unknown', battalionId: state.Alexandra }, { characterName: '__proto__', battalionId: state.Alexandra },
      { characterName: 'Alexandra', battalionId: 'Battalions!missing' }, { characterName: 'Alexandra', battalionId: state.Alexandra },
      { characterName: 'Sofia', battalionId: null },
    ]) expect(battalionSelectionReducer(state, action)).toBe(state)
  })
})
