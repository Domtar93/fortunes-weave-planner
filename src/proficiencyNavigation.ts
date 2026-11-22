import { planningRecordId, resolvePlanningEntry, type PlanningEntry } from './shortlist'

export interface ProficiencyRequest { id: string; characterName: string; sequence: number }
export interface ShortlistReturnRequest extends ProficiencyRequest { panelOnly?: boolean }
export interface ProficiencyNavigationError { characterName: string; message: string }
export const PROFICIENCY_HIGHLIGHT_MS = 6000

// Resolve an existing shortlisted source path against current imported data; names never select targets.
export function resolveShortlistTarget(characterName: string, shortlist: PlanningEntry[], id?: string): { target: PlanningEntry } | { error: string } {
  if (!id) return { error: 'This planned entry has no source-record identifier. Your shortlist is unchanged.' }
  const matches = shortlist.filter(entry => entry.id === id && entry.characterName === characterName)
  if (matches.length !== 1) return { error: 'This source record is not available in the selected character’s shortlist. Your shortlist is unchanged.' }
  const planned = matches[0]
  const target = resolvePlanningEntry(characterName, planned.proficiency, planned.entry.rank, planned.entry.source)
  if (!target || target.id !== id || planningRecordId(characterName, planned.proficiency, planned.entry) !== id
    || target.learnsetCharacter !== planned.learnsetCharacter) {
    return { error: 'The original proficiency source record is no longer available. Your shortlist is unchanged.' }
  }
  return { target }
}
