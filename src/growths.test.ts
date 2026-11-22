import { describe, expect, it } from 'vitest'
import { combineGrowths, formatPercent, growthData, signedPercent, STATS, type Growths } from './growths'

const character = (name: string) => growthData.characters.find(p => p.name === name)!
const classProfile = (name: string) => growthData.classes.find(p => p.name === name)!

describe('source growths and calculations', () => {
  it('contains 64 profiles and 59 classes, including both Mu states and The Avatar', () => {
    expect(growthData.characters).toHaveLength(64)
    expect(growthData.classes).toHaveLength(59)
    expect(character('Mu').growths.HP).toBe(30)
    expect(character('Mu (with growth)').growths.HP).toBe(50)
    expect(classProfile('The Avatar')).toBeDefined()
    expect(growthData.characters.some(p => p.name === 'Name')).toBe(false)
  })
  it('preserves Sofia Magic at 45%', () => { expect(character('Sofia').growths.Mag).toBe(45) })
  it('combines Alexandra and Gladiator exactly', () => {
    expect(character('Alexandra').growths).toMatchObject({ HP: 30, Str: 35 })
    expect(classProfile('Gladiator').growths).toMatchObject({ HP: 10, Str: 10 })
    expect(combineGrowths(character('Alexandra').growths, classProfile('Gladiator').growths))
      .toEqual({ HP: 40, Str: 45, Mag: 35, Spd: 55, Dex: 45, Def: 30, Res: 40, Lck: 50, Cha: 50 })
  })
  it('preserves The Calamity Magic modifier at +15%', () => { expect(classProfile('The Calamity').growths.Mag).toBe(15) })
  it('preserves negatives and totals above 100 without clamping', () => {
    const combined = combineGrowths(character('Mu').growths, classProfile('Castle Knight').growths)
    expect(combined.Mag).toBe(0)
    expect(classProfile('Castle Knight').growths.Spd).toBe(-15)
    const personal = { ...character('Alexandra').growths, HP: 95, Mag: 0 }
    expect(combineGrowths(personal, classProfile('The Eternal').growths).HP).toBe(125)
    expect(combineGrowths(personal, classProfile('Diviner').growths).Str).toBe(30)
    expect(combineGrowths(personal, classProfile('Castle Knight').growths).Mag).toBe(-5)
    expect(formatPercent(125)).toBe('125%')
    expect(signedPercent(-15)).toBe('-15%')
  })
  it('rejects missing and malformed numbers instead of using zero', () => {
    const valid = character('Alexandra').growths
    for (const value of [undefined, NaN, Infinity, '35', null]) {
      expect(() => combineGrowths({ ...valid, HP: value } as Growths, valid)).toThrow('HP')
      expect(() => combineGrowths(valid, { ...valid, HP: value } as Growths)).toThrow('HP')
    }
  })
  it('all 3,776 valid pairings retain all nine exact sums and do not mutate inputs', () => {
    const before = JSON.stringify(growthData)
    for (const personal of growthData.characters) {
      for (const selectedClass of growthData.classes) {
        const combined = combineGrowths(personal.growths, selectedClass.growths)
        expect(Object.keys(combined)).toEqual(STATS)
        for (const stat of STATS) expect(combined[stat]).toBe(personal.growths[stat] + selectedClass.growths[stat])
      }
    }
    expect(JSON.stringify(growthData)).toBe(before)
  })
})
