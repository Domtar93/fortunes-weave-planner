import imported from './runtimeData'
import { isDataStatus, type DataStatus, type ClassProfile, type SourceNumber, type SourceText, type Stat } from './growths'
import { MOUNT_SPECIES } from './mounts'

export const BATTALION_CATEGORIES = ['Physical', 'Magical', 'Defense', 'Support'] as const
export const AUTHORITY_TIERS = ['E', 'D', 'C', 'B', 'A'] as const
export interface Battalion {
  id: string
  name: string
  nameSource: SourceText
  category: SourceText
  authorityRank: SourceText
  gatherLimit: SourceNumber
  ability: SourceText
  flatStatText: SourceText
  acquisition: SourceText
  parsedStats: { state: 'parsed' | 'unknown' | 'unresolved'; values: Record<Stat, number | null>; unparsed: string[]; source: string }
  reliability: DataStatus
  validation: { severity: string; code: string; location: string; message: string }[]
  source: { sheet: string; row: number; range: string }
}
function text(field: { text: string | null; status: string; source: string }): SourceText {
  if (!isDataStatus(field.status)) throw new Error(`Unknown battalion evidence at ${field.source}`)
  return { ...field, status: field.status }
}
function number(field: { value: number | null; status: string; source: string }): SourceNumber {
  if (!isDataStatus(field.status)) throw new Error(`Unknown gather evidence at ${field.source}`)
  return { ...field, status: field.status }
}
export const battalionData: { records: Battalion[]; generalNotes: { value: string | number; status: string; source: string }[] } = {
  ...imported.battalions,
  records: imported.battalions.records.map(record => {
    if (!isDataStatus(record.reliability)) throw new Error(`Unknown battalion reliability: ${record.name}`)
    const state = record.parsedStats.state
    if (state !== 'parsed' && state !== 'unknown' && state !== 'unresolved') throw new Error(`Unknown flat stat parsing state: ${record.name}`)
    return { ...record, reliability: record.reliability, parsedStats: { ...record.parsedStats, state },
      nameSource: text(record.nameSource), category: text(record.category), authorityRank: text(record.authorityRank),
      ability: text(record.ability), flatStatText: text(record.flatStatText), acquisition: text(record.acquisition), gatherLimit: number(record.gatherLimit) }
  }),
}
export const BATTALION_SUPPORT_LABELS = {
  listed: 'Listed as allowed', not_listed_mounted: 'Not listed as allowed while mounted',
  not_listed: 'Not listed in allowed types', unknown: 'Battalion support unknown',
} as const
export function battalionSupport(profile: ClassProfile): keyof typeof BATTALION_SUPPORT_LABELS {
  const allowed = profile.details.allowedWeaponsAndSkills
  if (!['unverified', 'confirmed'].includes(allowed.status) || !allowed.text) return 'unknown'
  if (allowed.text.split(',').some(token => token.trim() === 'Battalions')) return 'listed'
  return MOUNT_SPECIES.some(type => type === profile.details.mountType.text) ? 'not_listed_mounted' : 'not_listed'
}
export function filterBattalions(options: { search: string; category: string; rank: string; classSupportOnly: boolean }, profile: ClassProfile): Battalion[] {
  if (options.classSupportOnly && battalionSupport(profile) !== 'listed') return []
  const query = options.search.trim().toLocaleLowerCase()
  return battalionData.records.filter(record => record.name.toLocaleLowerCase().includes(query)
    && (options.category === 'all' || record.category.text === options.category)
    && (options.rank === 'all' || record.authorityRank.text === options.rank))
}
