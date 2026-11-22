import { type CharacterProfile, type ClassProfile } from './growths'
import { weaponData, weaponFieldText, WEAPON_FIELDS } from './forging'
import { classWeaponSupport, familyEvidence } from './weaponPlanning'
import { battalionData } from './battalions'
import { BATTALION_CLASS_MESSAGES, classBattalionSupport } from './battalionPlanning'
import { mountData } from './mounts'
import { mountId, MOUNT_PLANNING_MESSAGES, planningMountCompatibility } from './mountPlanning'
import { type PlanningEntry } from './shortlist'

// Index existing identities/relationships once. No name matching, reparsing or source reconciliation.
const weapons = new Map(weaponData.records.map(record => [record.id, record]))
const battalions = new Map(battalionData.records.map(record => [record.id, record]))
const mounts = new Map(mountData.records.map(record => [mountId(record), record]))
const preliminary = new Map(weaponData.preliminary.map(record => [record.id, record]))
const relationships = new Map(weaponData.records.map(record => [record.id, weaponData.relationships.filter(relation => relation.mainId === record.id)]))

export interface OverviewWarning { source: string; message: string }
const sourceWarnings = (entries: { severity: string; location: string; message: string }[]): OverviewWarning[] =>
  entries.filter(entry => entry.severity === 'warning' || entry.severity === 'error').map(entry => ({ source: entry.location, message: entry.message }))

export interface MainBuildOverviewInput {
  character: CharacterProfile; selectedClass: ClassProfile
  weaponId?: string; mountId?: string; battalionId?: string
  entries: readonly PlanningEntry[]
}
// A transient presentation projection, never stored or used for calculations or preset payloads.
export function selectMainBuildOverview(input: MainBuildOverviewInput) {
  const { character, selectedClass } = input
  const weapon = input.weaponId ? weapons.get(input.weaponId) : undefined
  const battalion = input.battalionId ? battalions.get(input.battalionId) : undefined
  const mount = input.mountId ? mounts.get(input.mountId) : undefined
  const family = weapon ? familyEvidence(weapon) : undefined
  const weaponSupport = family ? classWeaponSupport(family, selectedClass.details.allowedWeaponsAndSkills) : undefined
  const battalionSupport = classBattalionSupport(selectedClass.details.allowedWeaponsAndSkills)
  const mountSupport = planningMountCompatibility(selectedClass, mount)
  const differences: OverviewWarning[] = weapon ? (relationships.get(weapon.id) ?? []).flatMap(relation => {
    const other = preliminary.get(relation.preliminaryId)
    if (!other) return []
    return relation.differences.map(diff => ({ source: `${diff.mainSource} / ${diff.preliminarySource}`,
      message: `${relation.match === 'possible-spelling' ? 'Possible spelling variant; not merged' : 'Unresolved source difference'} · ${WEAPON_FIELDS[diff.field]}: main ${weaponFieldText(weapon, diff.field)}; preliminary ${other.name} ${weaponFieldText(other, diff.field)}. Neither source is reconciled here.` }))
  }) : []
  return {
    character, selectedClass,
    classNotes: selectedClass.notes,
    weapon: weapon && family && weaponSupport ? { record: weapon, family, support: weaponSupport,
      warnings: [...sourceWarnings(weapon.validation), ...differences] } : undefined,
    mount: mount ? { record: mount, outcome: mountSupport, message: MOUNT_PLANNING_MESSAGES[mountSupport], warnings: sourceWarnings(mount.validation) } : undefined,
    battalion: battalion ? { record: battalion, outcome: battalionSupport, message: BATTALION_CLASS_MESSAGES[battalionSupport], warnings: sourceWarnings(battalion.validation) } : undefined,
    unavailable: { weapon: !!input.weaponId && !weapon, mount: !!input.mountId && !mount, battalion: !!input.battalionId && !battalion },
    entries: input.entries.filter(entry => entry.characterName === character.name),
  }
}
export type MainBuildOverviewData = ReturnType<typeof selectMainBuildOverview>
