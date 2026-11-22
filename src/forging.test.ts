import { describe, expect, it } from 'vitest'
import { filterWeapons, weaponData, weaponFieldText, type CompletenessFilter, type ConflictFilter } from './forging'
const find = (name: string) => weaponData.records.find(record => record.name === name)!
const filter = (overrides: Partial<{ name: string; effect: string; combatArt: string; completeness: CompletenessFilter; conflict: ConflictFilter }> = {}) => filterWeapons({ name: '', effect: '', combatArt: '', completeness: 'all', conflict: 'all', ...overrides })

describe('typed forging references', () => {
  it('has 91 distinct main records, five separate preliminary and five independent notes', () => {
    expect(weaponData.records).toHaveLength(91)
    expect(new Set(weaponData.records.map(record => record.id)).size).toBe(91)
    expect(weaponData.preliminary).toHaveLength(5)
    expect(weaponData.generalNotes).toHaveLength(5)
    expect(weaponData.records.every(record => record.section === 'main' && record.reliability === 'unverified')).toBe(true)
    expect(weaponData.preliminary.every(record => record.section === 'preliminary')).toBe(true)
  })
  it('keeps four exact name relationships and a manually reviewed spelling candidate separate', () => {
    expect(weaponData.relationships.filter(record => record.match === 'exact-name')).toHaveLength(4)
    expect(weaponData.relationships.filter(record => record.match === 'possible-spelling')).toHaveLength(1)
    expect(find('Veronique')).toBeUndefined()
    expect(find('Veroquine').source.row).toBe(33)
    expect(weaponData.preliminary.find(record => record.name === 'Veronique')?.source.row).toBe(6)
  })
  it('filters normalized name, effect and combat art independently and together', () => {
    expect(filter({ name: '  LEVIN  SWORD  ' }).map(record => record.name)).toEqual(['Levin Sword'])
    expect(filter({ effect: 'magical attack' }).some(record => record.name === 'Levin Sword')).toBe(true)
    expect(filter({ combatArt: 'lightning strike' }).map(record => record.name)).toEqual(['Levin Sword'])
    expect(filter({ name: 'levin', effect: 'magical', combatArt: 'Lightning' })).toHaveLength(1)
    expect(filter({ name: 'Zanbato', combatArt: 'Lightning' })).toHaveLength(0)
  })
  it('distinguishes four missing primary stats from five incomplete numeric references', () => {
    expect(filter({ completeness: 'primary-incomplete' }).map(record => record.name)).toEqual(['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus'])
    expect(filter({ completeness: 'incomplete' })).toHaveLength(5)
    expect(filter({ completeness: 'complete' })).toHaveLength(86)
    expect(filter({ completeness: 'incomplete' }).map(record => record.name)).toContain('Silver Spear')
  })
  it('distinguishes numerical, wording, missing data and spelling conflicts', () => {
    expect(filter({ conflict: 'any' })).toHaveLength(5)
    expect(filter({ conflict: 'numeric' }).map(record => record.name)).toEqual(['Zanbato'])
    expect(filter({ conflict: 'missing-data' }).map(record => record.name)).toContain('Silver Spear')
    expect(filter({ conflict: 'wording' }).map(record => record.name)).toContain('Wooden Sword')
    expect(filter({ conflict: 'possible-spelling' }).map(record => record.name)).toEqual(['Veroquine'])
    expect(filter({ conflict: 'any', completeness: 'incomplete' }).map(record => record.name)).toEqual(['Silver Spear'])
  })
  it('preserves source values, endpoints and text attack ranges with separate fields', () => {
    const wooden = find('Wooden Sword'), levin = find('Levin Sword')
    expect(wooden.might).toMatchObject({ raw: '2-20', text: '2-20', lower: 2, upper: 20, value: null, kind: 'span', source: 'Forging!C19' })
    expect(wooden.attackRange.text).toBe('1')
    expect(levin.attackRange).toMatchObject({ rawType: 'd', raw: '2026-02-01T00:00:00', numberFormat: 'd-m', text: '1-2', state: 'source-display', excelSerial: 46054 })
    expect(levin.might.text).toBe('12-20')
    expect(levin.additionalNote.text).toBe('Combat art: Lightning Strike')
    expect(levin.source.range).toBe('A28:J28')
  })
  it('keeps valid zero, single Might and blank durability distinct', () => {
    const claw = find("Ursa's Right Claw"), silver = find('Silver Spear')
    expect(claw.might).toMatchObject({ kind: 'single', value: 15, lower: null, upper: null })
    expect(weaponFieldText(claw, 'maxRefinement')).toBe('0')
    expect(weaponFieldText(claw, 'might')).toBe('15')
    expect(weaponFieldText(find('Wooden Sword'), 'critical')).toBe('0')
    expect(weaponFieldText(silver, 'durability')).toBe('Not documented')
    expect(silver.durability.value).toBeNull()
    expect(weaponData.preliminary.find(record => record.name === 'Silver Spear')?.durability.value).toBe(20)
  })
  it('preserves original wording, punctuation, typo and literal text-formula evidence', () => {
    expect(find('Wooden Sword').effects.text).toBe('Grants Spd+5.')
    expect(find('Dodge Gauntlets').effects).toMatchObject({ raw: '="+10 avoid"', text: '+10 avoid', state: 'literal-formula' })
    expect(find('Salamander').effects.text).toContain('atttack')
    expect(weaponData.generalNotes.find(note => note.source === 'Forging!K18')?.text).toContain('Most effects unlock halfway')
    expect(weaponData.records.every(record => !Object.hasOwn(record, 'weaponType') && !Object.hasOwn(record, 'refinementCurve'))).toBe(true)
  })
})


