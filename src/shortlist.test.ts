import { describe, expect, it } from 'vitest'
import { growthData, PROFICIENCIES, type Proficiency } from './growths'
import { learnsetIdentity, proficiencyData, type LearnsetEntry } from './proficiencies'
import { isShortlistable, learnsetSourceLink, planningRecordId, planningRequirements, resolvePlanningEntry, shortlistReducer, type ShortlistAction, type ShortlistState } from './shortlist'

const source = (proficiency: Proficiency, rank: string, character = 'Alexandra') => proficiencyData.categories[proficiency].characters[learnsetIdentity(character)].find(entry => entry.rank === rank)!
const add = (proficiency: Proficiency, rank: string, characterName = 'Alexandra'): ShortlistAction => ({ type: 'add', characterName, proficiency, rank, source: source(proficiency, rank, characterName).source })
const initial = (): ShortlistState => ({ byCharacter: {} })
const apply = (actions: ShortlistAction[]) => actions.reduce(shortlistReducer, initial())

describe('source-backed session planning model', () => {
  it.each([['D', 'Haze Slice', "'Sword'!B2"], ['C', 'Rend Armor', "'Sword'!C2"], ['B', 'Gale Blow', "'Sword'!D2"], ['A', 'Lunging Gale', "'Sword'!E2"], ['S+', 'Swordfaire', "'Sword'!G2"]])('retains Alexandra Sword %s identity, evidence and original source', (rank, text, cell) => {
    const state = apply([add('Sword', rank)])
    const planned = state.byCharacter.Alexandra[0]
    expect(planned).toMatchObject({ characterName: 'Alexandra', learnsetCharacter: 'Alexandra', proficiency: 'Sword', entry: { rank, text, source: cell, state: 'documented', evidence: 'Community-listed / unverified', reliability: 'unverified' } })
    expect(planned.entry).toBe(source('Sword', rank))
    expect(planned.id).toBe(planningRecordId('Alexandra', 'Sword', source('Sword', rank)))
    expect(learnsetSourceLink(planned.entry)).toBe(source('Sword', rank).sourceUrl)
  })
  it('keeps Flying C+ and Riding D/C+ selectable and every explicit N/A or blank blocked', () => {
    const state = apply([add('Flying', 'C+'), add('Riding', 'D'), add('Riding', 'C+')])
    expect(state.byCharacter.Alexandra.map(value => [value.entry.text, value.entry.rank])).toEqual([['Flitting Flier', 'C+'], ['Knightly Senses', 'D'], ['Vanguard', 'C+']])
    for (const [category, rank] of [['Sword', 'S'], ['Flying', 'B'], ['Riding', 'C']] as const) {
      expect(isShortlistable(source(category, rank))).toBe(false)
      expect(resolvePlanningEntry('Alexandra', category, rank, source(category, rank).source)).toBeNull()
    }
  })
  it('excludes bare/named question marks and compounds without rewriting or splitting them', () => {
    const compound = source('Spear', 'A', 'Eshmel'), question = source('Sword', 'S', 'Halvin'), uncertain = source('Flying', 'A', 'Dietrich')
    expect(compound.text).toBe('Graceful Blow\n(A+), Frozen Spear\n(A+)')
    expect(question.text).toBe('?')
    expect(uncertain.text).toBe('Airfighter?')
    for (const entry of [compound, question, uncertain]) expect(isShortlistable(entry)).toBe(false)
    for (const text of ['?', 'Airfighter?', 'N/A', '  ', 'One/Two', 'One, Two', 'One\nTwo', 'One (A+)', 'One; Two']) expect(isShortlistable({ ...source('Sword', 'D'), text })).toBe(false)
    expect(apply([add('Spear', 'A', 'Eshmel'), add('Sword', 'S', 'Halvin'), add('Flying', 'A', 'Dietrich')]).byCharacter).toEqual({})
    expect(compound.text).toBe('Graceful Blow\n(A+), Frozen Spear\n(A+)')
    expect(uncertain.state).toBe('placeholder')
  })
  it('blocks the ninth entry, preserves the eight and frees capacity on removal', () => {
    const firstEight: ShortlistAction[] = ['D', 'C', 'B', 'A', 'S+'].map(rank => add('Sword', rank))
    firstEight.push(add('Flying', 'D'), add('Flying', 'C+'), add('Riding', 'D'))
    const state = apply(firstEight), blocked = shortlistReducer(state, add('Riding', 'C+'))
    expect(blocked.byCharacter.Alexandra).toBe(state.byCharacter.Alexandra)
    expect(blocked.byCharacter.Alexandra).toHaveLength(8)
    expect(blocked.feedback).toMatchObject({ error: true, origin: 'progression', characterName: 'Alexandra' })
    expect(blocked.feedback?.text).toContain('All 8 planning slots are filled')
    const removed = shortlistReducer(blocked, { type: 'remove', characterName: 'Alexandra', id: state.byCharacter.Alexandra[0].id })
    const next = shortlistReducer(removed, add('Riding', 'C+'))
    expect(next.byCharacter.Alexandra).toHaveLength(8)
    expect(next.byCharacter.Alexandra[7].entry.text).toBe('Vanguard')
  })
  it('prevents duplicate source identities even when an ability name changes', () => {
    const state = apply([add('Sword', 'D')]), duplicate = shortlistReducer(state, add('Sword', 'D'))
    expect(duplicate.byCharacter.Alexandra).toBe(state.byCharacter.Alexandra)
    expect(duplicate.feedback?.text).toContain('exact source record is already shortlisted')
    expect(planningRecordId('Alexandra', 'Sword', { ...source('Sword', 'D'), text: 'Changed display' } as LearnsetEntry)).toBe(state.byCharacter.Alexandra[0].id)
  })
  it('allows equal ability names from distinct proficiency/rank source paths in a disposable fixture', () => {
    const original = proficiencyData.categories.Spear.characters.Alexandra
    const originalSword = proficiencyData.categories.Sword.characters.Alexandra
    try {
      proficiencyData.categories.Sword.characters.Alexandra = originalSword.map(entry => entry.rank === 'C' ? { ...entry, text: 'Haze Slice', matrixText: 'Haze Slice' } : entry)
      proficiencyData.categories.Spear.characters.Alexandra = original.map(entry => entry.rank === 'D' ? { ...entry, text: 'Haze Slice', matrixText: 'Haze Slice', state: 'documented' } : entry)
      const state = apply([add('Sword', 'D'), add('Spear', 'D'), add('Sword', 'C')])
      expect(state.byCharacter.Alexandra.map(entry => entry.entry.text)).toEqual(['Haze Slice', 'Haze Slice', 'Haze Slice'])
      expect(new Set(state.byCharacter.Alexandra.map(entry => entry.id)).size).toBe(3)
      expect(state.byCharacter.Alexandra.map(entry => [entry.proficiency, entry.entry.rank])).toEqual([['Sword', 'D'], ['Spear', 'D'], ['Sword', 'C']])
    } finally { proficiencyData.categories.Spear.characters.Alexandra = original; proficiencyData.categories.Sword.characters.Alexandra = originalSword }
  })
  it('reorders immutable records and treats invalid movement and unknown IDs as no-ops', () => {
    const state = apply([add('Sword', 'D'), add('Sword', 'C'), add('Sword', 'B')])
    const ids = state.byCharacter.Alexandra.map(entry => entry.id)
    const moved = shortlistReducer(state, { type: 'up', characterName: 'Alexandra', id: ids[2] })
    expect(moved.byCharacter.Alexandra.map(entry => entry.id)).toEqual([ids[0], ids[2], ids[1]])
    const down = shortlistReducer(moved, { type: 'down', characterName: 'Alexandra', id: ids[0] })
    expect(down.byCharacter.Alexandra.map(entry => entry.id)).toEqual([ids[2], ids[0], ids[1]])
    expect(state.byCharacter.Alexandra.map(entry => entry.id)).toEqual(ids)
    expect(down.byCharacter.Alexandra[0]).toBe(state.byCharacter.Alexandra[2])
    expect(shortlistReducer(state, { type: 'up', characterName: 'Alexandra', id: ids[0] })).toBe(state)
    expect(shortlistReducer(state, { type: 'down', characterName: 'Alexandra', id: ids[2] })).toBe(state)
    expect(shortlistReducer(state, { type: 'remove', characterName: 'Alexandra', id: 'missing' })).toBe(state)
  })
  it('scopes Sofia and both Mu profiles separately while retaining the explicit source mapping', () => {
    const state = apply([add('Sword', 'D'), add('Sword', 'D', 'Sofia'), add('Sword', 'D', 'Mu'), add('Sword', 'C', 'Mu (with growth)')])
    expect(state.byCharacter.Alexandra[0].entry.text).toBe('Haze Slice')
    expect(state.byCharacter.Sofia[0].entry.text).toBe('Sunder')
    expect(state.byCharacter.Mu[0].learnsetCharacter).toBe('Mu')
    expect(state.byCharacter['Mu (with growth)'][0].learnsetCharacter).toBe('Mu')
    const both = shortlistReducer(state, add('Sword', 'D', 'Mu (with growth)'))
    expect(both.byCharacter.Mu[0].entry).toBe(both.byCharacter['Mu (with growth)'][1].entry)
    expect(both.byCharacter.Mu[0].id).not.toBe(both.byCharacter['Mu (with growth)'][1].id)
    const clear = shortlistReducer(both, { type: 'clear', characterName: 'Alexandra' })
    expect(clear.byCharacter.Alexandra).toEqual([])
    expect(clear.byCharacter.Mu).toBe(both.byCharacter.Mu)
    expect(clear.byCharacter.Sofia).toBe(both.byCharacter.Sofia)
  })
  it('rejects unknown character aliases, fake cells, rank mismatches and unavailable records', () => {
    for (const action of [
      { ...add('Sword', 'D'), characterName: 'alexandra' }, { ...add('Sword', 'D'), source: "'Sword'!Z999" },
      { ...add('Sword', 'D'), rank: 'S' }, add('Flying', 'B'),
    ]) {
      const state = shortlistReducer(initial(), action)
      expect(state.byCharacter).toEqual({})
      expect(state.feedback?.error).toBe(true)
    }
  })
  it('retains exact glossary evidence, missing descriptions and the mount-bond caveat', () => {
    const state = apply([add('Sword', 'D'), add('Flying', 'C+')])
    expect(state.byCharacter.Alexandra[0].glossary?.description).toBeFalsy()
    const flier = state.byCharacter.Alexandra[1]
    expect(flier.glossary).toBe(proficiencyData.glossary['Flitting Flier'])
    expect(flier.glossary?.description).toContain('grants AS+2 during combat')
    expect(flier.glossary?.evidence).toBe('Unofficial guide; unverified')
    expect(flier.glossary?.note).toContain('mount-bond ability')
  })
  it('summarizes exact recorded ranks in source order without training calculations', () => {
    const state = apply([add('Riding', 'C+'), add('Sword', 'S+'), add('Sword', 'D'), add('Flying', 'C+'), add('Riding', 'D')])
    expect(planningRequirements(state.byCharacter.Alexandra)).toEqual([
      { proficiency: 'Sword', count: 2, ranks: ['D', 'S+'] }, { proficiency: 'Riding', count: 2, ranks: ['D', 'C+'] }, { proficiency: 'Flying', count: 1, ranks: ['C+'] },
    ])
  })
  it('preserves original direct links and uses a named-sheet fallback for missing links', () => {
    expect(learnsetSourceLink(source('Sword', 'D'))).toBe(source('Sword', 'D').sourceUrl)
    const url = new URL(learnsetSourceLink({ ...source('Sword', 'D'), sourceUrl: null }))
    expect(url.searchParams.get('sheet')).toBe('Sword')
    expect(url.searchParams.get('range')).toBe('B2')
  })
  it('retains all 4,284 source records and classifications and changes no imported data', () => {
    const before = JSON.stringify([proficiencyData, growthData])
    let state = initial()
    for (const rank of ['D', 'C', 'B', 'A', 'S+']) state = shortlistReducer(state, add('Sword', rank))
    const all = PROFICIENCIES.flatMap(category => Object.values(proficiencyData.categories[category].characters).flat())
    expect(all).toHaveLength(4284)
    expect(Object.fromEntries(['documented', 'unavailable', 'unknown', 'compound', 'placeholder'].map(kind => [kind, all.filter(entry => entry.state === kind).length]))).toEqual({ documented: 2321, unavailable: 56, unknown: 1871, compound: 27, placeholder: 9 })
    expect(all.filter(isShortlistable)).toHaveLength(2321)
    expect(JSON.stringify([proficiencyData, growthData])).toBe(before)
  })
})
