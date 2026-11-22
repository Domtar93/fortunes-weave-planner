import { growthData, type ClassProfile } from './growths'
import { mountCompatibility, mountData, type MountRecord, type Compatibility } from './mounts'

// The existing name-cell source identifies a row without relying on name or array order.
export const mountId = (record: MountRecord): string => record.nameSource.source
export const MOUNT_PLANNING_MESSAGES: Record<Compatibility, string> = {
  match: "Mount species matches the class's documented mount type.",
  mismatch: "Mount species differs from the class's documented mount type.",
  unmounted: 'This class has no mount type listed.',
  unknown: 'Mount compatibility not determined.',
}
export function planningMountCompatibility(profile?: ClassProfile, mount?: MountRecord): Compatibility {
  return profile && mount ? mountCompatibility(profile, mount) : 'unknown'
}

export type MountSelections = Record<string, string>
export function mountSelectionReducer(state: MountSelections, action: { characterName: string; mountId: string | null }): MountSelections {
  if (!growthData.characters.some(profile => profile.name === action.characterName)) return state
  if (action.mountId === null) {
    if (!Object.hasOwn(state, action.characterName)) return state
    const next = { ...state }; delete next[action.characterName]; return next
  }
  if (!mountData.records.some(record => mountId(record) === action.mountId)) return state
  if (Object.hasOwn(state, action.characterName) && state[action.characterName] === action.mountId) return state
  return { ...state, [action.characterName]: action.mountId }
}
