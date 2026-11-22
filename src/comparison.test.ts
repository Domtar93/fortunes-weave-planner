import { describe, expect, it } from 'vitest'
import { compareGrowthBuilds, formatPercentagePoints } from './comparison'
import { growthData, STATS, type Growths } from './growths'

const alexandra = { characterName: 'Alexandra', className: 'Gladiator' }
const hunter = { characterName: 'Alexandra', className: 'Hunter' }

describe('independent growth build comparison', () => {
  it('matches Alexandra’s Gladiator/Hunter totals and percentage-point differences', () => {
    const result = compareGrowthBuilds(alexandra, hunter)
    expect(result.a.combined).toEqual({ HP: 40, Str: 45, Mag: 35, Spd: 55, Dex: 45, Def: 30, Res: 40, Lck: 50, Cha: 50 })
    expect(result.b.combined).toEqual({ HP: 40, Str: 35, Mag: 35, Spd: 65, Dex: 55, Def: 30, Res: 40, Lck: 50, Cha: 50 })
    expect(result.difference).toEqual({ HP: 0, Str: -10, Mag: 0, Spd: 10, Dex: 10, Def: 0, Res: 0, Lck: 0, Cha: 0 })
    expect(formatPercentagePoints(-10)).toBe('-10 pp')
    expect(formatPercentagePoints(15)).toBe('+15 pp')
    expect(formatPercentagePoints(0)).toBe('0 pp')
  })

  it('shows Sofia Magic 45% versus 60%, with a +15 point difference', () => {
    const result = compareGrowthBuilds({ characterName: 'Sofia', className: 'Gladiator' }, { characterName: 'Sofia', className: 'The Calamity' })
    expect(result.a.combined.Mag).toBe(45)
    expect(result.b.combined.Mag).toBe(60)
    expect(result.difference.Mag).toBe(15)
  })

  it('keeps Mu growth profiles distinct with the validated Commoner zero modifiers', () => {
    const result = compareGrowthBuilds({ characterName: 'Mu', className: 'Commoner / Noble' }, { characterName: 'Mu (with growth)', className: 'Commoner / Noble' })
    expect(result.a.combined.HP).toBe(30)
    expect(result.b.combined.HP).toBe(50)
    expect(result.difference.HP).toBe(20)
    expect(result.a.combined).toEqual(result.a.character.growths)
    expect(result.b.combined).toEqual(result.b.character.growths)
    expect(result.a.character.source.row).not.toBe(result.b.character.source.row)
  })

  it('identical selections give zero across all nine stats', () => {
    expect(compareGrowthBuilds(hunter, hunter).difference).toEqual(Object.fromEntries(STATS.map(stat => [stat, 0])))
  })

  it('swapping reverses each nonzero difference and preserves both numerical builds', () => {
    const b = { characterName: 'Sofia', className: 'The Calamity' }
    const forward = compareGrowthBuilds(alexandra, b)
    const reverse = compareGrowthBuilds(b, alexandra)
    expect(reverse.a.combined).toEqual(forward.b.combined)
    expect(reverse.b.combined).toEqual(forward.a.combined)
    for (const stat of STATS) expect(reverse.difference[stat] || 0).toBe((-forward.difference[stat]) || 0)
  })

  it('retains negative totals, negative class modifiers and totals over 100', () => {
    const personal = { ...growthData.characters.find(value => value.name === 'Alexandra')!, growths: { ...growthData.characters[0].growths, HP: 95, Mag: 0 } }
    const data = { characters: [personal], classes: growthData.classes }
    const result = compareGrowthBuilds({ characterName: 'Alexandra', className: 'The Eternal' }, { characterName: 'Alexandra', className: 'Castle Knight' }, data)
    expect(result.a.combined.HP).toBe(125)
    expect(result.b.combined.Mag).toBe(-5)
    expect(result.b.selectedClass.growths.Spd).toBe(-15)
    expect(result.difference.HP).toBeLessThan(0)
  })

  it('rejects unknown selections and malformed growths without numerical defaults', () => {
    expect(() => compareGrowthBuilds({ ...alexandra, characterName: 'Name' }, hunter)).toThrow('Unknown character')
    expect(() => compareGrowthBuilds(alexandra, { ...hunter, className: 'Missing' })).toThrow('Unknown class')
    for (const value of [undefined, null, NaN, Infinity, '35']) {
      const character = { ...growthData.characters[0], growths: { ...growthData.characters[0].growths, HP: value } as Growths }
      expect(() => compareGrowthBuilds(alexandra, hunter, { characters: [character], classes: growthData.classes })).toThrow('HP')
    }
  })

  it('reads growths only and leaves source data/selection objects unchanged', () => {
    const before = JSON.stringify(growthData)
    const selectionBefore = JSON.stringify([alexandra, hunter])
    const sentinelClasses = growthData.classes.map(profile => ({ ...profile, details: { ...profile.details,
      movement: { value: 999, status: 'unverified' as const, source: 'fixture' },
      flatStatBonuses: Object.fromEntries(STATS.map(stat => [stat, { value: 999, status: 'unverified', source: 'fixture' }])) as typeof profile.details.flatStatBonuses,
    } }))
    const result = compareGrowthBuilds(alexandra, hunter, { characters: growthData.characters, classes: sentinelClasses })
    expect(result.a.combined.Str).toBe(45)
    expect(result.b.combined.Str).toBe(35)
    expect(result.difference.Str).toBe(-10)
    expect(JSON.stringify(growthData)).toBe(before)
    expect(JSON.stringify([alexandra, hunter])).toBe(selectionBefore)
  })
})
