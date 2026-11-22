import type { BuildSelection } from './comparison'
import { growthData, type GrowthData } from './growths'

export const PRESET_KEY = 'fortunes-weave.build-presets'
export const PRESET_VERSION = 1
export interface BuildPreset extends BuildSelection {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
export interface PresetPayload { schemaVersion: 1; presets: BuildPreset[] }
export interface PresetSnapshot { raw: string | null; presets: BuildPreset[]; error: string | null }
export type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>
export type StorageProvider = () => PresetStorage
export const browserStorage: StorageProvider = () => window.localStorage
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value === value.trim()
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const nameKey = (name: string) => name.trim().toLowerCase()
const errorMessage = (error: unknown) => record(error) && typeof error.message === 'string' ? error.message : 'Storage access failed.'

export function validatePayload(value: unknown): PresetPayload {
  if (!record(value) || value.schemaVersion !== PRESET_VERSION) throw new Error('Unsupported or missing saved-build schema version. Open it with a compatible application version.')
  if (!exactKeys(value, ['schemaVersion', 'presets']) || !Array.isArray(value.presets)) throw new Error('Damaged saved-build payload or unrecognized fields.')
  const ids = new Set<string>(), names = new Set<string>()
  for (const item of value.presets) {
    if (!record(item) || !exactKeys(item, ['schemaVersion', 'id', 'name', 'characterName', 'className', 'createdAt', 'updatedAt']) || item.schemaVersion !== 1 ||
      !nonempty(item.id) || !nonempty(item.name) || !nonempty(item.characterName) || !nonempty(item.className) ||
      !timestamp(item.createdAt) || !timestamp(item.updatedAt) || Date.parse(item.updatedAt) < Date.parse(item.createdAt)) throw new Error('Damaged preset fields, identifiers, timestamps or unsupported preset version.')
    if (ids.has(item.id) || names.has(nameKey(item.name))) throw new Error('Saved builds contain duplicate identifiers or names.')
    ids.add(item.id); names.add(nameKey(item.name))
  }
  return value as unknown as PresetPayload
}

export function readPresets(storage: StorageProvider = browserStorage): PresetSnapshot {
  let raw: string | null = null
  try {
    raw = storage().getItem(PRESET_KEY)
    return { raw, presets: raw === null ? [] : validatePayload(JSON.parse(raw)).presets, error: null }
  } catch (error) {
    return { raw, presets: [], error: `Saved builds could not be read. ${error instanceof SyntaxError ? 'Malformed JSON.' : errorMessage(error)} Existing saved data is untouched. Writes are blocked; restore or repair the stored data, then retry reading.` }
  }
}

// No automatic writes: every mutation is validated and checks for changes made by another tab.
export function writePresets(snapshot: PresetSnapshot, presets: BuildPreset[], storage: StorageProvider = browserStorage): PresetSnapshot {
  if (snapshot.error) throw new Error('Saved data needs recovery before any changes can be saved.')
  const payload = validatePayload({ schemaVersion: PRESET_VERSION, presets })
  try {
    const target = storage()
    if (target.getItem(PRESET_KEY) !== snapshot.raw) throw new Error('Saved builds changed in another tab. Retry reading before editing.')
    const raw = JSON.stringify(payload)
    target.setItem(PRESET_KEY, raw)
    return { raw, presets: payload.presets, error: null }
  } catch (error) {
    throw new Error(`Could not save builds. ${errorMessage(error)} The app has not replaced your saved data. Retry reading before trying again.`)
  }
}

export function validatedName(name: string, presets: BuildPreset[], exceptId?: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a nonempty build name.')
  if (presets.some(preset => preset.id !== exceptId && nameKey(preset.name) === nameKey(trimmed))) throw new Error('A build with that name already exists (names ignore case).')
  return trimmed
}

export function selectionIssue(selection: BuildSelection, data: Pick<GrowthData, 'characters' | 'classes'> = growthData): string | null {
  const issues = []
  if (!data.characters.some(profile => profile.name === selection.characterName)) issues.push(`Missing character profile: ${selection.characterName}`)
  if (!data.classes.some(profile => profile.name === selection.className)) issues.push(`Missing class: ${selection.className}`)
  return issues.length ? `${issues.join('; ')}. This preset cannot load.` : null
}

export function createPreset(name: string, selection: BuildSelection, presets: BuildPreset[], now = new Date().toISOString(), id: string = crypto.randomUUID()): BuildPreset {
  const issue = selectionIssue(selection)
  if (issue) throw new Error(issue)
  return { schemaVersion: 1, id, name: validatedName(name, presets), characterName: selection.characterName, className: selection.className, createdAt: now, updatedAt: now }
}
