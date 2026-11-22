import type { MountRecord } from './mounts'
import type { ReferenceSheet } from './community'

export interface MountAbilityInformation {
  name: string
  description: string
  source: string
  url: string
  mounts: readonly string[]
}
export type MountAbilityIndex = ReadonlyMap<string, MountAbilityInformation>
const sourceUrl = 'https://docs.google.com/spreadsheets/d/1toaw286JE2caHAnf_5zy-_4m-3PM-ysS9ihmd2SBjtE/edit'
// Exact recorded-name variants only; no species or substring matching.
const mountNames: Record<string, string> = {
  "Rocinan (Io's mount)": 'Rocinan',
  "Bucephalus (Alexandra's mount)": 'Bucephalus',
}

export function buildMountAbilityIndex(sheet: ReferenceSheet): MountAbilityIndex {
  if (sheet.title !== 'Mounts' || sheet.gid !== 279385932 || sheet.key !== 'sheet-279385932') {
    throw new Error('Unexpected mount ability reference sheet.')
  }
  const index = new Map<string, MountAbilityInformation>()
  // This is a separately labelled skill table, not the mount records above it.
  // Only its name-cell notes describe these abilities; other columns have unrelated research.
  for (const row of sheet.rows.filter(row => row.row >= 34 && row.row <= 53)) {
    const name = row.cells.find(cell => cell.column === 1)
    const association = row.cells.find(cell => cell.column === 2)
    if (typeof name?.value !== 'string' || !name.value.trim() || typeof name.note !== 'string' || !name.note.trim()
      || typeof association?.value !== 'string' || !association.value.trim() || index.has(name.value)) {
      throw new Error(`Invalid mount ability definition at Mounts!A${row.row}.`)
    }
    index.set(name.value, {
      name: name.value, description: name.note, source: `Mounts!A${row.row} (note)`,
      url: `${sourceUrl}#gid=279385932&range=A${row.row}`,
      mounts: association.value.split(',').map(name => name.trim()),
    })
  }
  if (index.size !== 20) throw new Error('Incomplete mount ability reference table.')
  return index
}

let pending: Promise<MountAbilityIndex> | undefined
export function loadMountAbilityIndex(): Promise<MountAbilityIndex> {
  // Reuse the existing lazy reference asset; do not duplicate it in the main bundle.
  if (!pending) pending = import('./data/community-sheets/sheet-279385932.json')
    .then(sheet => buildMountAbilityIndex(sheet.default))
    .catch(error => { pending = undefined; throw error })
  return pending
}

export function mountAbilityInformation(mount: Pick<MountRecord, 'name' | 'abilities'>, index: MountAbilityIndex): MountAbilityInformation[] {
  if (!mount.abilities.text || !['confirmed', 'unverified'].includes(mount.abilities.status)) return []
  const mountName = Object.hasOwn(mountNames, mount.name) ? mountNames[mount.name] : mount.name
  return mount.abilities.text.split(',').map(name => name.trim()).flatMap(name => {
    const definition = index.get(name)
    return definition?.mounts.includes(mountName) ? [definition] : []
  })
}
