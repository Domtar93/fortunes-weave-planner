import imported from './data/weapon-families.json'
import { growthData, type SourceText } from './growths'
import { filterWeapons, weaponData, type WeaponForgingRecord } from './forging'

export const WEAPON_FAMILIES = ['Sword', 'Spear', 'Axe', 'Bow', 'Gauntlets'] as const
export type WeaponFamily = typeof WEAPON_FAMILIES[number]
export interface WeaponFamilyEvidence {
  weaponId: string; name: string; family: WeaponFamily | null; status: 'provisional'
  source: { sheet: string; row: number; cell: string; section: string }
  ambiguityWarning: string | null
}
export const weaponFamilyData = imported
export function familyEvidence(weapon: WeaponForgingRecord): WeaponFamilyEvidence {
  const evidence = imported.records.filter(entry => entry.weaponId === weapon.id)
  const entry = evidence[0]
  if (evidence.length === 1 && imported.sourceSha256 === growthData.metadata.sourceSha256 && weapon.section === 'main'
    && entry.name === weapon.name && entry.source.sheet === weapon.source.sheet && entry.source.row === weapon.source.row
    && entry.status === 'provisional' && WEAPON_FAMILIES.includes(entry.family as WeaponFamily)) return entry as WeaponFamilyEvidence
  return { weaponId: weapon.id, name: weapon.name, family: null, status: 'provisional',
    source: { sheet: weapon.source.sheet, row: weapon.source.row, cell: `${weapon.source.sheet}!A${weapon.source.row}`, section: '' },
    ambiguityWarning: 'Family evidence is absent or does not match this source record. No family inferred from its name.' }
}
const FAMILY_ALIASES: Record<string, WeaponFamily> = {
  sword: 'Sword', swords: 'Sword', spear: 'Spear', spears: 'Spear', axe: 'Axe', axes: 'Axe',
  bow: 'Bow', bows: 'Bow', gauntlet: 'Gauntlets', gauntlets: 'Gauntlets',
}
export type WeaponSupport = { outcome: 'listed' | 'not-listed' | 'unresolved'; message: string; reason: string }
// Receives only column L, never XP, examination requirements or a character's learnset.
export function classWeaponSupport(evidence: WeaponFamilyEvidence, allowed: SourceText): WeaponSupport {
  const unresolved = (reason: string): WeaponSupport => ({ outcome: 'unresolved', message: 'Compatibility not determined.', reason })
  if (!evidence.family || evidence.ambiguityWarning) return unresolved(evidence.ambiguityWarning ?? 'Weapon family is unresolved.')
  if (!allowed.text?.trim() || !['confirmed', 'unverified'].includes(allowed.status)) return unresolved('The class allowed-types source is absent or unavailable.')
  const tokens = allowed.text.split(',').map(value => value.trim())
  const families: WeaponFamily[] = []
  for (const token of tokens) {
    const key = token.toLowerCase()
    const family = Object.hasOwn(FAMILY_ALIASES, key) ? FAMILY_ALIASES[key] : undefined
    if (family) families.push(family)
    else if (!/^(B\. Magic|W\. Magic|Battalions|Infantry|Riding|Armor|Flying)(?: \([^()]*\))?$/i.test(token)) {
      return unresolved('The allowed-types text contains an unrecognized or qualified weapon entry. Read the original source conditions.')
    }
  }
  const listed = families.includes(evidence.family)
  return { outcome: listed ? 'listed' : 'not-listed', message: listed ? 'Weapon family listed by class.' : 'Weapon family not listed by class.',
    reason: `Compares the provisional ${evidence.family} family with the class’s recorded allowed types only. Equip legality under every game condition is not established.` }
}
export type WeaponFamilyFilter = 'all' | WeaponFamily | 'unresolved'
export function filterPlanningWeapons(search: string, family: WeaponFamilyFilter): WeaponForgingRecord[] {
  return filterWeapons({ name: search, effect: '', combatArt: '', completeness: 'all', conflict: 'all' })
    .filter(weapon => family === 'all' || (familyEvidence(weapon).family ?? 'unresolved') === family)
}
export type WeaponSelections = Record<string, string>
export function weaponSelectionReducer(state: WeaponSelections, action: { characterName: string; weaponId: string | null }): WeaponSelections {
  if (!growthData.characters.some(character => character.name === action.characterName)) return state
  if (action.weaponId === null) {
    if (!Object.hasOwn(state, action.characterName)) return state
    const next = { ...state }; delete next[action.characterName]; return next
  }
  if (!weaponData.records.some(weapon => weapon.id === action.weaponId)) return state
  if (Object.hasOwn(state, action.characterName) && state[action.characterName] === action.weaponId) return state
  return { ...state, [action.characterName]: action.weaponId }
}
