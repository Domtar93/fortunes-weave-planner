import imported from './runtimeData'
import { isDataStatus, type ClassProfile, type SourceText, type SourceNumber, type Stat } from './growths'

export const MOUNT_SPECIES = ['Ornius', 'Horse', 'Pegasus', 'Bau', 'Elephant'] as const
export type MountSpecies = (typeof MOUNT_SPECIES)[number]
export interface MountValidation {
  severity: string
  code: string
  location: string
  message: string
}
export interface MountRecord {
  name: string
  nameSource: SourceText
  species: SourceText
  abilities: SourceText
  flatStatText: SourceText
  growthText: SourceText
  acquisition: SourceText
  communityNotes: SourceText
  numericGrowths: Record<Stat, SourceNumber>
  parsed: {
    growths: ParsedModifiers
    flatStats: ParsedModifiers
  }
  growthComparison: {
    status: string
    differences: { stat: string; written: number | null; numeric: number | null; writtenSource: string; numericSource: string }[]
  }
  totalGrowth: { value: number | null; formula: string | null; status: string; source: string }
  validation: MountValidation[]
  source: string
}
interface ParsedModifiers {
  values: Record<Stat, number | null>
  state: string
  unparsed: string[]
  source: string
}
function text(field: { text: string | null; status: string; source: string }): SourceText {
  if (!isDataStatus(field.status)) throw new Error(`Unknown mount evidence at ${field.source}`)
  return { ...field, status: field.status }
}
function number(field: { value: number | null; status: string; source: string }): SourceNumber {
  if (!isDataStatus(field.status)) throw new Error(`Unknown mount numeric evidence at ${field.source}`)
  return { ...field, status: field.status }
}
export const mountData: { records: MountRecord[]; abilityWarning: SourceText | null; sheetNotes: SourceText[] } = {
  ...imported.mounts,
  abilityWarning: imported.mounts.abilityWarning ? text(imported.mounts.abilityWarning) : null,
  sheetNotes: imported.mounts.sheetNotes.map(text),
  records: imported.mounts.records.map(record => ({
    ...record, nameSource: text(record.nameSource), species: text(record.species), abilities: text(record.abilities),
    flatStatText: text(record.flatStatText), growthText: text(record.growthText), acquisition: text(record.acquisition),
    communityNotes: text(record.communityNotes),
    numericGrowths: Object.fromEntries(Object.entries(record.numericGrowths).map(([key, value]) => [key, number(value)])) as Record<Stat, SourceNumber>,
  })),
}

export const COMPATIBILITY_LABELS = {
  match: 'Documented mount type matches', mismatch: 'Documented mount type does not match',
  unmounted: 'Class is documented as unmounted', unknown: 'Mount compatibility is unknown',
} as const
export type Compatibility = keyof typeof COMPATIBILITY_LABELS
export function mountCompatibility(profile: ClassProfile, mount: MountRecord): Compatibility {
  const type = profile.details.mountType
  if (type.status !== 'unverified' && type.status !== 'confirmed') return 'unknown'
  if (type.text === 'No') return 'unmounted'
  if (!MOUNT_SPECIES.some(value => value === type.text) || !MOUNT_SPECIES.some(value => value === mount.species.text)
      || !['unverified', 'confirmed'].includes(mount.species.status)) return 'unknown'
  return type.text === mount.species.text ? 'match' : 'mismatch'
}
export function filterMounts(species: string, search: string): MountRecord[] {
  const query = search.trim().toLocaleLowerCase()
  return mountData.records.filter(record => (species === 'all' || record.species.text === species)
    && record.name.toLocaleLowerCase().includes(query))
}
