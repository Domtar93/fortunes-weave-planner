import imported from './runtimeData'
import { isDataStatus, type DataStatus } from './growths'

export const REWARD_STATUS_LABELS = { documented: 'Documented · unverified', placeholder: 'Dash placeholder', empty: 'Missing reward entry', unresolved: 'Unresolved source' } as const
export type RewardStatus = keyof typeof REWARD_STATUS_LABELS
export type DungeonPhase = 'all' | 'part1' | 'part3'
export const PHASE_LABELS = { part1: 'Part I', part3: 'Part III' } as const
export interface DungeonReward { raw: string | null; status: RewardStatus }
export interface DungeonWarning { severity: string; code: string; location: string; message: string }
export interface DungeonNote { raw: string | number | boolean | null; rawType: string; text: string | null; confidence: DataStatus; source: string }
export interface DungeonChest {
  id: string; number: number; raw: string | number | boolean | null; rawType: string; source: string
  part1: DungeonReward; part3: DungeonReward; confidence: DataStatus; validation: DungeonWarning[]
}
export interface DungeonLocation {
  id: string; name: string; source: { sheet: string; row: number; range: string }
  chests: DungeonChest[]; notes: DungeonNote[]; warnings: DungeonWarning[]; confidence: DataStatus
}
function confidence(value: string): DataStatus {
  if (!isDataStatus(value)) throw new Error(`Unknown dungeon confidence: ${value}`)
  return value
}
function reward(field: { raw: string | null; status: string }): DungeonReward {
  if (!Object.hasOwn(REWARD_STATUS_LABELS, field.status)) throw new Error(`Unknown dungeon reward status: ${field.status}`)
  return { ...field, status: field.status as RewardStatus }
}
const note = (field: Omit<DungeonNote, 'confidence'> & { confidence: string }): DungeonNote => ({ ...field, confidence: confidence(field.confidence) })
export const dungeonData: { records: DungeonLocation[]; generalNotes: DungeonNote[] } = {
  records: imported.dungeons.records.map(record => ({ ...record, confidence: confidence(record.confidence), notes: record.notes.map(note),
    chests: record.chests.map(chest => ({ ...chest, confidence: confidence(chest.confidence), part1: reward(chest.part1), part3: reward(chest.part3) })),
  })),
  generalNotes: imported.dungeons.generalNotes.map(note),
}
export const normalizeCatalogText = (value: string) => value.trim().replace(/\s+/gu, ' ').toLowerCase()
export const activePhases = (phase: DungeonPhase): ('part1' | 'part3')[] => phase === 'all' ? ['part1', 'part3'] : [phase]
export function hasUnresolvedRewards(location: DungeonLocation, phase: DungeonPhase = 'all'): boolean {
  return location.chests.some(chest => activePhases(phase).some(part => chest[part].status !== 'documented'))
}
export function filterDungeons(options: { search: string; reward: string; phase: DungeonPhase; unresolvedOnly: boolean }, records = dungeonData.records): DungeonLocation[] {
  const search = normalizeCatalogText(options.search), reward = normalizeCatalogText(options.reward)
  return records.filter(location => {
    const rewards = location.chests.flatMap(chest => activePhases(options.phase).map(part => chest[part])).filter(field => field.status === 'documented').map(field => normalizeCatalogText(field.raw ?? ''))
    return (!search || normalizeCatalogText(location.name).includes(search) || rewards.some(value => value.includes(search)))
      && (!reward || rewards.some(value => value.includes(reward)))
      && (!options.unresolvedOnly || hasUnresolvedRewards(location, options.phase))
  })
}
