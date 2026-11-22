import { describe, expect, it } from 'vitest'
import { growthData, PROFICIENCIES, type Proficiency } from './growths'
import { learnsetIdentity, proficiencyData } from './proficiencies'
import { planningRecordId, resolvePlanningEntry, type PlanningEntry } from './shortlist'
import { resolveShortlistTarget } from './proficiencyNavigation'

const plan = (proficiency: Proficiency, rank: string, character = 'Alexandra') => {
  const source = proficiencyData.categories[proficiency].characters[learnsetIdentity(character)].find(entry => entry.rank === rank)!
  return resolvePlanningEntry(character, proficiency, rank, source.source)!
}

describe('exact shortlist navigation resolution', () => {
  it.each([
    ['Sword', 'D', 'Haze Slice', "'Sword'!B2"], ['Sword', 'C', 'Rend Armor', "'Sword'!C2"], ['Sword', 'B', 'Gale Blow', "'Sword'!D2"],
    ['Flying', 'C+', 'Flitting Flier', "'Flying'!C2"], ['Riding', 'D', 'Knightly Senses', "'Riding'!B2"], ['Riding', 'C+', 'Vanguard', "'Riding'!D2"],
  ])('resolves %s %s through its original source cell', (proficiency, rank, text, source) => {
    const planned = plan(proficiency as Proficiency, rank)
    const result = resolveShortlistTarget('Alexandra', [planned], planned.id)
    expect(result).toMatchObject({ target: { id: planned.id, characterName: 'Alexandra', proficiency, entry: { rank, text, source, evidence: 'Community-listed / unverified', state: 'documented' } } })
    if ('target' in result) expect(result.target.entry).toBe(planned.entry)
  })
  it.each([undefined, ''])('handles a missing identifier (%s) nonfatally', id => {
    const entries = [plan('Sword', 'D')]
    expect(resolveShortlistTarget('Alexandra', entries, id)).toEqual({ error: 'This planned entry has no source-record identifier. Your shortlist is unchanged.' })
    expect(entries).toHaveLength(1)
  })
  it('rejects unknown IDs and another character without switching or guessing by name', () => {
    const planned = plan('Sword', 'D')
    for (const [character, id] of [['Alexandra', 'Haze Slice'], ['Sofia', planned.id], ['Alexandra', 'missing']]) {
      expect(resolveShortlistTarget(character, [planned], id)).toHaveProperty('error')
    }
  })
  it('rejects stale source references, tampered paths and unavailable original records', () => {
    const original = plan('Sword', 'D')
    const stale = { ...original, entry: { ...original.entry, source: "'Sword'!Z999" } }
    const staleId = { ...stale, id: planningRecordId('Alexandra', 'Sword', stale.entry) }
    const wrongRank = { ...original, entry: { ...original.entry, rank: 'C' } }
    const unavailable = { ...original, entry: proficiencyData.categories.Sword.characters.Alexandra.find(entry => entry.rank === 'S')! }
    for (const value of [stale, staleId, wrongRank, unavailable]) {
      expect(resolveShortlistTarget('Alexandra', [value], value.id)).toHaveProperty('error')
    }
  })
  it('distinguishes equal names at different proficiencies and ranks using disposable fixtures', () => {
    const sword = proficiencyData.categories.Sword.characters.Alexandra, spear = proficiencyData.categories.Spear.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = sword.map(entry => entry.rank === 'C' ? { ...entry, text: 'Haze Slice' } : entry)
      proficiencyData.categories.Spear.characters.Alexandra = spear.map(entry => entry.rank === 'D' ? { ...entry, text: 'Haze Slice', state: 'documented' } : entry)
      const entries = [plan('Sword', 'D'), plan('Sword', 'C'), plan('Spear', 'D')]
      for (const planned of entries) expect(resolveShortlistTarget('Alexandra', entries, planned.id)).toMatchObject({ target: { id: planned.id, proficiency: planned.proficiency, entry: { source: planned.entry.source, rank: planned.entry.rank, text: 'Haze Slice' } } })
      expect(new Set(entries.map(entry => entry.id)).size).toBe(3)
    } finally { proficiencyData.categories.Sword.characters.Alexandra = sword; proficiencyData.categories.Spear.characters.Alexandra = spear }
  })
  it('keeps mapped Mu source paths independent from selected profile identities and growths', () => {
    const mu = plan('Sword', 'D', 'Mu'), alternate = plan('Sword', 'D', 'Mu (with growth)')
    expect(mu.entry).toBe(alternate.entry)
    expect(mu.id).not.toBe(alternate.id)
    expect(resolveShortlistTarget('Mu', [mu], mu.id)).toMatchObject({ target: { characterName: 'Mu', learnsetCharacter: 'Mu' } })
    expect(resolveShortlistTarget('Mu (with growth)', [alternate], alternate.id)).toMatchObject({ target: { characterName: 'Mu (with growth)', learnsetCharacter: 'Mu' } })
    expect(resolveShortlistTarget('Mu', [alternate], alternate.id)).toHaveProperty('error')
    expect(growthData.characters.find(entry => entry.name === 'Mu')?.growths.HP).not.toBe(growthData.characters.find(entry => entry.name === 'Mu (with growth)')?.growths.HP)
  })
  it('fails closed on duplicate shortlisted or canonical source identities', () => {
    const planned = plan('Sword', 'D'), original = proficiencyData.categories.Sword.characters.Alexandra
    expect(resolveShortlistTarget('Alexandra', [planned, planned], planned.id)).toHaveProperty('error')
    try {
      proficiencyData.categories.Sword.characters.Alexandra = [...original, planned.entry]
      expect(resolveShortlistTarget('Alexandra', [planned], planned.id)).toHaveProperty('error')
    } finally { proficiencyData.categories.Sword.characters.Alexandra = original }
  })
  it('never mutates plans, growths, glossary or any of the 4,284 original records', () => {
    const plans: PlanningEntry[] = [plan('Sword', 'D'), plan('Flying', 'C+')]
    const before = JSON.stringify([plans, growthData, proficiencyData])
    for (const value of plans) resolveShortlistTarget('Alexandra', plans, value.id)
    resolveShortlistTarget('Alexandra', plans, 'missing')
    expect(JSON.stringify([plans, growthData, proficiencyData])).toBe(before)
    expect(PROFICIENCIES.flatMap(category => Object.values(proficiencyData.categories[category].characters).flat())).toHaveLength(4284)
  })
})
