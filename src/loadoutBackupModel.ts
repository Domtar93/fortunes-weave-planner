import { validateLoadoutPayload, type BuildLoadout, type LoadoutPayload } from './loadouts'
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
export const BACKUP_FILENAME = 'fortunes-weave-full-loadouts.json'
export function formatLoadoutBackup(loadouts: BuildLoadout[]): string {
  return JSON.stringify(validateLoadoutPayload({ schemaVersion: 1, loadouts }), null, 2) + '\n'
}
export function parseLoadoutBackup(text: string): LoadoutPayload {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('The loadout backup exceeds the 5 MiB limit.')
  try { return validateLoadoutPayload(JSON.parse(text.replace(/^\uFEFF/u, ''))) }
  catch (error) { throw new Error(`This is not a supported full-loadout backup. ${error instanceof Error ? error.message : 'Invalid JSON.'}`) }
}
export interface ImportPreview { additions: BuildLoadout[]; skipped: string[]; conflicts: string[] }
const identity = (value: BuildLoadout) => JSON.stringify([value.schemaVersion, value.id, value.name, value.createdAt, value.updatedAt, value.characterName, value.className,
  value.weaponId, value.mountId, value.battalionId, value.abilities.map(reference => [reference.proficiency, reference.rank, reference.source])])
// Add-only merge. Identical records are harmless; ambiguous IDs/names never overwrite local saves.
export function previewLoadoutImport(existing: BuildLoadout[], incoming: BuildLoadout[]): ImportPreview {
  validateLoadoutPayload({ schemaVersion: 1, loadouts: existing }); validateLoadoutPayload({ schemaVersion: 1, loadouts: incoming })
  const additions: BuildLoadout[] = [], skipped: string[] = [], conflicts: string[] = []
  const byId = new Map(existing.map(item => [item.id, item])), byName = new Set(existing.map(item => item.name.toLowerCase()))
  for (const item of incoming) {
    const id = byId.get(item.id), name = byName.has(item.name.toLowerCase())
    if (id && identity(id) === identity(item)) skipped.push(item.name)
    else if (id || name) conflicts.push(`${item.name}: ${id ? 'identifier' : 'name'} conflicts with a local loadout. No record will be overwritten.`)
    else additions.push(item)
  }
  return { additions, skipped, conflicts }
}
