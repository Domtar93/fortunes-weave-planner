import { describe, expect, it } from 'vitest'
import { growthData, type SourceText } from './growths'
import { weaponData } from './forging'
import { classWeaponSupport, familyEvidence, filterPlanningWeapons, weaponFamilyData, weaponSelectionReducer, WEAPON_FAMILIES } from './weaponPlanning'

const weapon = (name: string) => weaponData.records.find(record => record.name === name)!
const profile = (name: string) => growthData.classes.find(record => record.name === name)!
const allowed = (text: string | null, status: SourceText['status'] = 'unverified'): SourceText => ({ text, status, source: 'Classes!L4' })

describe('provisional weapon family evidence', () => {
  it('covers precisely 91 canonical records with reviewed family counts and original source evidence', () => {
    expect(weaponFamilyData.counts).toEqual({ Sword: 20, Spear: 22, Axe: 19, Bow: 15, Gauntlets: 15 })
    expect(weaponFamilyData.records).toHaveLength(91); expect(weaponData.preliminary).toHaveLength(5)
    expect(weaponFamilyData.sourceSha256).toBe(growthData.metadata.sourceSha256)
    for (const record of weaponData.records) {
      const evidence = familyEvidence(record)
      expect(evidence.status).toBe('provisional'); expect(evidence.family).not.toBeNull(); expect(evidence.ambiguityWarning).toBeNull()
      expect(evidence.source.row).toBe(record.source.row); expect(evidence.source.cell).toBe(`Forging!A${record.source.row}`)
    }
    for (const record of weaponData.preliminary) expect(familyEvidence(record).family).toBeNull()
  })
  it('refuses stale/moved/renamed records instead of guessing from a weapon name', () => {
    const record = weapon('Levin Sword')
    expect(familyEvidence({ ...record, source: { ...record.source, row: 80 } }).family).toBeNull()
    expect(familyEvidence({ ...record, name: 'Levin Bow' }).family).toBeNull()
    expect(familyEvidence({ ...record, id: 'missing' }).ambiguityWarning).toContain('No family inferred')
    expect(familyEvidence(weapon("Ursa's Right Claw")).family).toBe('Gauntlets')
  })
  it('filters all five families and names without removing incomplete or class-mismatched weapons', () => {
    expect(filterPlanningWeapons('', 'all')).toHaveLength(91)
    for (const family of WEAPON_FAMILIES) expect(filterPlanningWeapons('', family)).toHaveLength(weaponFamilyData.counts[family])
    expect(filterPlanningWeapons(' LEVIN SWORD ', 'Sword').map(record => record.name)).toEqual(['Levin Sword'])
    expect(filterPlanningWeapons('Levin', 'Bow')).toEqual([])
    for (const name of ['Whirlwind Blade', 'Shining Spear', 'Dodge Gauntlets', 'Zerberus']) expect(filterPlanningWeapons(name, 'all')).toEqual([weapon(name)])
  })
})

describe('documented class family comparison only', () => {
  it.each([
    ['Gladiator', 'Levin Sword', 'listed'], ['Archer', 'Levin Sword', 'not-listed'],
    ['Pugilist', 'Wooden Gauntlets', 'listed'], ['Wing Soldier', 'War Bow', 'not-listed'],
    ['Dancer', 'War Bow', 'listed'], ['Elephant Rider', 'Levin Sword', 'not-listed'],
  ])('%s + %s reports %s without using XP or examination requirements', (name, item, outcome) => {
    expect(classWeaponSupport(familyEvidence(weapon(item)), profile(name).details.allowedWeaponsAndSkills).outcome).toBe(outcome)
  })
  it.each([
    ['Sword', 'Sword'], ['Swords', 'Sword'], ['Spear', 'Spear'], ['Spears', 'Spear'], ['Axe', 'Axe'], ['Axes', 'Axe'],
    ['Bow', 'Bow'], ['Bows', 'Bow'], ['Gauntlet', 'Gauntlets'], ['Gauntlets', 'Gauntlets'],
  ])('recognizes the explicit %s alias only', (token, family) => {
    const evidence = { ...familyEvidence(weapon('Levin Sword')), family: family as typeof WEAPON_FAMILIES[number] }
    expect(classWeaponSupport(evidence, allowed(` ${token} , Riding (Infantry when dismounted)`)).message).toBe('Weapon family listed by class.')
  })
  it.each([null, '', 'Swordfish', 'Sword / Bow', 'Sword (only at night)', 'Sword, unknown', 'Sword, no Sword', 'constructor', 'Sword,'])('leaves absent/unparseable/conditional data %j unresolved', value => {
    expect(classWeaponSupport(familyEvidence(weapon('Levin Sword')), allowed(value)).message).toBe('Compatibility not determined.')
  })
  it('leaves ambiguous family and unavailable allowed-types data unresolved', () => {
    const evidence = familyEvidence(weapon('Levin Sword'))
    expect(classWeaponSupport({ ...evidence, ambiguityWarning: 'Conflicting family evidence' }, allowed('Sword')).outcome).toBe('unresolved')
    expect(classWeaponSupport({ ...evidence, family: null }, allowed('Sword')).outcome).toBe('unresolved')
    expect(classWeaponSupport(evidence, allowed('Sword', 'unknown')).outcome).toBe('unresolved')
    expect(classWeaponSupport(evidence, allowed('Sword', 'unavailable')).outcome).toBe('unresolved')
  })
  it('parses every present class list and retains literal qualifications without inventing rank eligibility', () => {
    for (const record of growthData.classes) expect(classWeaponSupport(familyEvidence(weapon('Levin Sword')), record.details.allowedWeaponsAndSkills).outcome).not.toBe('unresolved')
    expect(classWeaponSupport(familyEvidence(weapon('Levin Sword')), allowed('Bow')).reason).toContain('Equip legality')
  })
})

describe('session-only main weapon selections', () => {
  it('keeps Alexandra, Sofia and both Mu identities independent and clears only the requested profile', () => {
    let state = {}
    for (const [name, item] of [['Alexandra', 'Levin Sword'], ['Sofia', 'War Bow'], ['Mu', 'Muen'], ['Mu (with growth)', 'Salamander']]) state = weaponSelectionReducer(state, { characterName: name, weaponId: weapon(item).id })
    expect(new Set(Object.values(state)).size).toBe(4)
    const before = JSON.stringify(state), next = weaponSelectionReducer(Object.freeze(state), { characterName: 'Mu', weaponId: null })
    expect(Object.keys(next)).toEqual(['Alexandra', 'Sofia', 'Mu (with growth)']); expect(JSON.stringify(state)).toBe(before)
    expect(weaponSelectionReducer({}, { characterName: 'Alexandra', weaponId: null })).toEqual({})
  })
  it('rejects preliminary/unknown weapon and profile IDs without changing state or source data', () => {
    const before = JSON.stringify([weaponData, growthData]), state = { Alexandra: weapon('Levin Sword').id }
    for (const action of [{ characterName: 'Alexandra', weaponId: weaponData.preliminary[0].id }, { characterName: 'Alexandra', weaponId: 'missing' }, { characterName: 'Name', weaponId: weapon('Muen').id }]) expect(weaponSelectionReducer(state, action)).toBe(state)
    expect(weaponSelectionReducer(state, { characterName: 'Alexandra', weaponId: state.Alexandra })).toBe(state)
    expect(JSON.stringify([weaponData, growthData])).toBe(before)
  })
})
