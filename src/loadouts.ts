import { growthData, PROFICIENCIES, type Proficiency } from './growths'
import { weaponData } from './forging'
import { mountData } from './mounts'
import { mountId } from './mountPlanning'
import { battalionData } from './battalions'
import { PLANNING_SLOTS, resolvePlanningEntry, type PlanningEntry } from './shortlist'
import { browserStorage, selectionIssue, validatePayload as validatePresetPayload, validatedName, type BuildPreset, type StorageProvider } from './presets'
import type { BuildSelection } from './comparison'

export const LOADOUT_KEY = 'fortunes-weave.full-loadouts'
export interface AbilityReference { proficiency: Proficiency; rank: string; source: string }
export interface FullBuildSelection extends BuildSelection {
  weaponId: string | null; mountId: string | null; battalionId: string | null
  abilities: AbilityReference[]
}
export interface BuildLoadout extends FullBuildSelection, BuildPreset { schemaVersion: 1 }
export interface LoadoutPayload { schemaVersion: 1; loadouts: BuildLoadout[] }
export interface LoadoutSnapshot { raw: string | null; loadouts: BuildLoadout[]; error: string | null }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value === value.trim()
const optionalId = (value: unknown) => value === null || text(value)
const message = (error: unknown) => error instanceof Error ? error.message : 'Storage access failed.'
const refKey = (reference: AbilityReference) => JSON.stringify([reference.proficiency, reference.rank, reference.source])

// Structural validation retains well-formed stale references for recovery. Loading resolves them separately.
export function validateLoadoutPayload(value: unknown): LoadoutPayload {
  if (!record(value) || value.schemaVersion !== 1) throw new Error('Unsupported or missing full-loadout schema version.')
  if (!exact(value, ['schemaVersion', 'loadouts']) || !Array.isArray(value.loadouts)) throw new Error('Damaged full-loadout collection or unrecognized fields.')
  for (const item of value.loadouts) {
    if (!record(item) || !exact(item, ['schemaVersion', 'id', 'name', 'createdAt', 'updatedAt', 'characterName', 'className', 'weaponId', 'mountId', 'battalionId', 'abilities']) ||
      !optionalId(item.weaponId) || !optionalId(item.mountId) || !optionalId(item.battalionId) || !Array.isArray(item.abilities) || item.abilities.length > PLANNING_SLOTS) throw new Error('Damaged full-loadout fields or planning capacity exceeded.')
    const keys = new Set<string>()
    for (const reference of item.abilities) {
      if (!record(reference) || !exact(reference, ['proficiency', 'rank', 'source']) || !PROFICIENCIES.includes(reference.proficiency as Proficiency) || !text(reference.rank) || !text(reference.source)) throw new Error('Damaged ability source reference.')
      const key = refKey(reference as unknown as AbilityReference)
      if (keys.has(key)) throw new Error('Duplicate ability source reference in a loadout.')
      keys.add(key)
    }
  }
  // Reuse proven name/id/timestamp/version validation without changing the existing preset schema.
  validatePresetPayload({ schemaVersion: 1, presets: value.loadouts.map(item => {
    const { schemaVersion, id, name, characterName, className, createdAt, updatedAt } = item as BuildLoadout
    return { schemaVersion, id, name, characterName, className, createdAt, updatedAt }
  }) })
  return value as unknown as LoadoutPayload
}

export function readLoadouts(storage: StorageProvider = browserStorage): LoadoutSnapshot {
  let raw: string | null = null
  try {
    raw = storage().getItem(LOADOUT_KEY)
    return { raw, loadouts: raw === null ? [] : validateLoadoutPayload(JSON.parse(raw)).loadouts, error: null }
  } catch (error) {
    return { raw, loadouts: [], error: `Full loadouts could not be read. ${message(error)} Stored data is untouched; writes are blocked. Repair or restore it, then retry reading.` }
  }
}
export function writeLoadouts(snapshot: LoadoutSnapshot, loadouts: BuildLoadout[], storage: StorageProvider = browserStorage): LoadoutSnapshot {
  if (snapshot.error) throw new Error('Recover the existing full-loadout data before saving changes.')
  const payload = validateLoadoutPayload({ schemaVersion: 1, loadouts })
  try {
    const target = storage()
    if (target.getItem(LOADOUT_KEY) !== snapshot.raw) throw new Error('Full loadouts changed in another tab. Retry reading before editing.')
    const raw = JSON.stringify(payload); target.setItem(LOADOUT_KEY, raw)
    return { raw, loadouts: payload.loadouts, error: null }
  } catch (error) { throw new Error(`Could not save full loadouts. ${message(error)} Existing saved data has not been replaced.`) }
}
export const abilityReferences = (entries: readonly PlanningEntry[]): AbilityReference[] => entries.map(({ proficiency, entry }) => ({ proficiency, rank: entry.rank, source: entry.source }))

export function resolveLoadout(selection: FullBuildSelection) {
  const issue = selectionIssue(selection)
  if (issue) throw new Error(issue)
  const character = growthData.characters.find(value => value.name === selection.characterName)!
  const selectedClass = growthData.classes.find(value => value.name === selection.className)!
  for (const [label, id, ids] of [
    ['weapon', selection.weaponId, weaponData.records.map(value => value.id)],
    ['mount', selection.mountId, mountData.records.map(mountId)],
    ['battalion', selection.battalionId, battalionData.records.map(value => value.id)],
  ] as const) if (id !== null && !ids.includes(id)) throw new Error(`Missing ${label} source reference: ${id}. No part of this loadout was loaded.`)
  if (selection.abilities.length > PLANNING_SLOTS) throw new Error('Planning capacity exceeded.')
  const keys = new Set<string>()
  const entries = selection.abilities.map(reference => {
    const entry = resolvePlanningEntry(selection.characterName, reference.proficiency, reference.rank, reference.source)
    if (!entry || keys.has(entry.id)) throw new Error(`Missing, unresolved or duplicate ability source: ${reference.proficiency} ${reference.rank} · ${reference.source}. No part of this loadout was loaded.`)
    keys.add(entry.id); return entry
  })
  return { character, selectedClass, entries }
}
export function loadoutIssue(selection: FullBuildSelection): string | null {
  try { resolveLoadout(selection); return null } catch (error) { return message(error) }
}
export function createLoadout(name: string, selection: FullBuildSelection, loadouts: BuildLoadout[], now = new Date().toISOString(), id: string = crypto.randomUUID()): BuildLoadout {
  resolveLoadout(selection)
  const loadout: BuildLoadout = { ...selection, abilities: selection.abilities.map(reference => ({ ...reference })), schemaVersion: 1,
    id, name: validatedName(name, loadouts), createdAt: now, updatedAt: now }
  validateLoadoutPayload({ schemaVersion: 1, loadouts: [...loadouts, loadout] })
  return loadout
}

export function updateLoadoutFromMain(loadout: BuildLoadout, selection: FullBuildSelection, now = new Date().toISOString()): BuildLoadout {
  resolveLoadout(selection)
  const updated: BuildLoadout = { ...loadout, ...selection, abilities: selection.abilities.map(reference => ({...reference})),
    updatedAt: now < loadout.updatedAt ? loadout.updatedAt : now }
  validateLoadoutPayload({schemaVersion:1,loadouts:[updated]})
  return updated
}
