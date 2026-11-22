import { describe, expect, it } from 'vitest'
import { dungeonData, type DungeonLocation, type RewardStatus } from './dungeons'
import { weaponData } from './forging'
import { weaponDungeonAudit, weaponDungeonReferences } from './weaponDungeonReferences'

function locationWith(reward: string, status: RewardStatus = 'documented'): DungeonLocation[] {
  const location = dungeonData.records[0], chest = location.chests[0]
  return [{ ...location, chests: [{ ...chest, part1: { raw: reward, status }, part3: { raw: null, status: 'empty' } }] }]
}
const names = (name: string) => weaponDungeonAudit.exact.filter(entry => entry.weapon.name === name).map(entry => [entry.location.name.trim(), entry.chest.number, entry.part, entry.reward, entry.source])

describe('weapon / dungeon reference audit', () => {
  it('computes 14 exact occurrences for 13 weapons, 12 candidates, zero ambiguous and 150 unmatched', () => {
    expect(weaponDungeonAudit.exact).toHaveLength(14)
    expect(new Set(weaponDungeonAudit.exact.map(entry => entry.weapon.id)).size).toBe(13)
    expect(weaponDungeonAudit.refinedCandidates).toHaveLength(12)
    expect(weaponDungeonAudit.ambiguous).toEqual([])
    expect(weaponDungeonAudit.unmatched).toHaveLength(150)
    expect(new Set(weaponDungeonAudit.unmatched.map(entry => entry.reward.trim())).size).toBe(74)
    expect(weaponDungeonAudit.ignoredPhaseFields).toBe(4)
    expect(weaponDungeonAudit.exact.length + weaponDungeonAudit.refinedCandidates.length + weaponDungeonAudit.unmatched.length + weaponDungeonAudit.ignoredPhaseFields).toBe(180)
  })
  it.each([
    ['Muen', 'Cougar Woodlands', 'part1', 'Dungeon Chests!B3'],
    ['Onoa', "Giant's Print Fort", 'part1', 'Dungeon Chests!B4'],
    ['Veroquine', 'Masked Woods', 'part1', 'Dungeon Chests!B5'],
    ['Gundogya', 'Sand-Shadow Fort', 'part1', 'Dungeon Chests!B7'],
    ['Velheit', 'Stoppered Shrine', 'part1', 'Dungeon Chests!B8'],
    ['Pilum', 'Shadowy Cave', 'part3', 'Dungeon Chests!B27'],
    ['Hammer', 'Nemea Cavern', 'part1', 'Dungeon Chests!B24'],
  ])('preserves %s location, chest, phase and source', (name, location, part, source) => {
    expect(names(name)).toEqual([[location, 1, part, name, source]])
  })
  it('preserves both Salamander acquisition occurrences instead of merging them', () => {
    expect(names('Salamander')).toEqual([
      ['Palace of Sand', 1, 'part3', 'Salamander', 'Dungeon Chests!B30'],
      ['Southern Passage', 1, 'part1', 'Salamander', 'Dungeon Chests!B31'],
    ])
    expect(new Set(weaponDungeonAudit.exact.map(entry => `${entry.chest.id}/${entry.part}`)).size).toBe(14)
  })
  it.each([['Killing Edge +3', 'Killing Edge', '+3'], ['Zanbato +2', 'Zanbato', '+2'], ['Levin Sword +3', 'Levin Sword', '+3'], ['Horsekiller Bow +2', 'Horsekiller Bow', '+2'], ['Greatsword +1', 'Greatsword', '+1']])('classifies %s as a candidate only', (reward, baseName, suffix) => {
    const candidate = weaponDungeonAudit.refinedCandidates.find(entry => entry.reward === reward)!
    expect(candidate).toMatchObject({ reward, baseName, suffix, weapon: { name: baseName, section: 'main' } })
    expect(weaponDungeonAudit.exact.some(entry => entry.reward === reward)).toBe(false)
    expect(Object.keys(candidate).sort()).toEqual(['baseName', 'chest', 'kind', 'location', 'part', 'reward', 'source', 'suffix', 'weapon'])
  })
  it('trims outer whitespace only and preserves all raw display text', () => {
    const audit = weaponDungeonReferences(locationWith('  Muen\n'), [{ ...weaponData.records.find(entry => entry.name === 'Muen')!, name: ' Muen ' }])
    expect(audit.exact[0].reward).toBe('  Muen\n')
    expect(audit.exact[0].weapon.name).toBe(' Muen ')
    for (const reward of ['muen', 'Muen fragment', 'fragment Muen', 'Wooden  Sword', 'Sword']) expect(weaponDungeonReferences(locationWith(reward)).exact).toEqual([])
  })
  it('rejects unrelated, misspelled, preliminary and Greek/Latin substitutions', () => {
    for (const reward of ['Healing Staff', 'Thick Foreign Tome', 'Swordbreak Amulet', 'Veronique', 'Swarm Z']) {
      const audit = weaponDungeonReferences(locationWith(reward), [...weaponData.records, ...weaponData.preliminary])
      expect(audit.exact).toEqual([])
      expect(audit.refinedCandidates).toEqual([])
    }
    const greek = { ...weaponData.records[0], name: 'Swarm Ζ' }
    expect(weaponDungeonReferences(locationWith('Swarm Z'), [greek]).exact).toEqual([])
    expect(weaponDungeonReferences(locationWith('Swarm Ζ'), [greek]).exact).toHaveLength(1)
  })
  it('suppresses ambiguous exact and candidate names and excludes preliminary entries', () => {
    const muen = weaponData.records.find(entry => entry.name === 'Muen')!
    const duplicated = [muen, { ...muen, id: 'duplicate-muen', name: ' Muen ' }]
    expect(weaponDungeonReferences(locationWith('Muen'), duplicated).ambiguous[0]).toMatchObject({ kind: 'exact', matchingIds: [muen.id, 'duplicate-muen'] })
    expect(weaponDungeonReferences(locationWith('Muen'), duplicated).exact).toEqual([])
    const candidates = weaponDungeonReferences(locationWith('Muen +3'), duplicated)
    expect(candidates.refinedCandidates).toEqual([])
    expect(candidates.ambiguous[0].kind).toBe('refined-candidate')
    expect(weaponDungeonReferences(locationWith('Muen'), [{ ...muen, section: 'preliminary' }]).exact).toEqual([])
    expect(weaponDungeonReferences(locationWith('Wooden Sword'), [...weaponData.records, ...weaponData.preliminary]).exact).toHaveLength(1)
  })
  it('recognizes a suffix only at the end and prioritizes an actual full canonical name', () => {
    for (const reward of ['Muen+3', 'Muen +3 extra', 'Muen +3.5', 'Muen +Ⅲ', 'Muen ＋3', 'Muen -3']) expect(weaponDungeonReferences(locationWith(reward)).refinedCandidates).toEqual([])
    const refinedCanonical = { ...weaponData.records[0], id: 'explicit-refined-record', name: 'Muen +3' }
    const audit = weaponDungeonReferences(locationWith('Muen +3'), [...weaponData.records, refinedCanonical])
    expect(audit.exact[0].weapon.id).toBe('explicit-refined-record')
    expect(audit.refinedCandidates).toEqual([])
  })
  it('ignores placeholder, empty and unresolved rewards even if their raw text resembles a weapon', () => {
    for (const state of ['placeholder', 'empty', 'unresolved'] as const) {
      const audit = weaponDungeonReferences(locationWith('Muen', state))
      expect(audit.exact).toEqual([])
      expect(audit.ignoredPhaseFields).toBe(2)
    }
    expect(weaponDungeonReferences(locationWith('  ')).exact).toEqual([])
  })
  it('is repeatable and does not mutate source data or infer missing weapon statistics', () => {
    const before = JSON.stringify([dungeonData, weaponData])
    expect(weaponDungeonReferences()).toEqual(weaponDungeonAudit)
    expect(weaponDungeonReferences()).toEqual(weaponDungeonAudit)
    expect(JSON.stringify([dungeonData, weaponData])).toBe(before)
    expect(dungeonData.records).toHaveLength(31)
    expect(dungeonData.records.flatMap(entry => entry.chests)).toHaveLength(90)
    expect(weaponData.records).toHaveLength(91)
    expect(weaponData.preliminary).toHaveLength(5)
    expect(weaponData.records.filter(entry => entry.primaryCompleteness === 'incomplete')).toHaveLength(4)
    expect(weaponData.records.find(entry => entry.name === 'Silver Spear')?.durability.value).toBeNull()
    expect(weaponData.records.find(entry => entry.name === 'Zanbato')?.might.text).toBe('14-19')
    expect(weaponData.preliminary.find(entry => entry.name === 'Zanbato')?.might.text).toBe('7-19')
  })
})
