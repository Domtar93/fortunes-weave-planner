import { dungeonData, type DungeonChest, type DungeonLocation } from './dungeons'
import { weaponData, type WeaponForgingRecord } from './forging'

export type RewardPart = 'part1' | 'part3'
export interface DungeonRewardOccurrence {
  location: DungeonLocation; chest: DungeonChest; part: RewardPart; reward: string; source: string
}
export interface ExactWeaponReward extends DungeonRewardOccurrence { kind: 'exact'; weapon: WeaponForgingRecord }
export interface RefinedWeaponCandidate extends DungeonRewardOccurrence { kind: 'refined-candidate'; weapon: WeaponForgingRecord; baseName: string; suffix: string }
export interface AmbiguousWeaponReward extends DungeonRewardOccurrence { kind: 'exact' | 'refined-candidate'; matchingIds: string[] }
export interface WeaponDungeonAudit {
  exact: ExactWeaponReward[]; refinedCandidates: RefinedWeaponCandidate[]
  unmatched: DungeonRewardOccurrence[]; ambiguous: AmbiguousWeaponReward[]; ignoredPhaseFields: number
}
// Complete, case-sensitive names after outer trim only. No aliases, Unicode folding,
// internal whitespace normalization, substring matching or preliminary canonical records.
export function weaponDungeonReferences(locations = dungeonData.records, weapons = weaponData.records): WeaponDungeonAudit {
  const names = new Map<string, WeaponForgingRecord[]>()
  for (const weapon of weapons) {
    if (weapon.section !== 'main' || !weapon.name.trim()) continue
    const key = weapon.name.trim()
    names.set(key, [...(names.get(key) ?? []), weapon])
  }
  const result: WeaponDungeonAudit = { exact: [], refinedCandidates: [], unmatched: [], ambiguous: [], ignoredPhaseFields: 0 }
  for (const location of locations) for (const chest of location.chests) for (const part of ['part1', 'part3'] as const) {
    const field = chest[part]
    if (field.status !== 'documented' || !field.raw?.trim()) { result.ignoredPhaseFields++; continue }
    const occurrence = { location, chest, part, reward: field.raw, source: chest.source }
    const name = field.raw.trim(), exact = names.get(name) ?? []
    if (exact.length === 1) { result.exact.push({ ...occurrence, kind: 'exact', weapon: exact[0] }); continue }
    if (exact.length > 1) { result.ambiguous.push({ ...occurrence, kind: 'exact', matchingIds: exact.map(weapon => weapon.id) }); continue }
    // Suffix is documentary text, never a refine level or a statistics formula.
    const refined = /^(.+) (\+[0-9]+)$/u.exec(name)
    const candidates = refined ? names.get(refined[1]) ?? [] : []
    if (refined && candidates.length === 1) result.refinedCandidates.push({ ...occurrence, kind: 'refined-candidate', weapon: candidates[0], baseName: refined[1], suffix: refined[2] })
    else if (candidates.length > 1) result.ambiguous.push({ ...occurrence, kind: 'refined-candidate', matchingIds: candidates.map(weapon => weapon.id) })
    else result.unmatched.push(occurrence)
  }
  return result
}
export const weaponDungeonAudit = weaponDungeonReferences()
export const REFINED_CANDIDATE_LABEL = 'Possible base-weapon match — refinement unverified'
