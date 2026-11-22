import imported from './runtimeData'
import { isDataStatus, type DataStatus } from './growths'

export const ACQUISITION_LABELS = {
  documented: 'Documented · unverified', unavailable: 'Unavailable (N/A)', unknown: 'Unknown (?)',
  empty: 'No source entry', unresolved: 'Unresolved source value',
} as const
export type AcquisitionState = keyof typeof ACQUISITION_LABELS
export interface ScrollRaw { raw: string | number | boolean | null; rawType: string; source: string; confidence: DataStatus }
export interface ScrollText extends ScrollRaw { text: string | null; state: AcquisitionState }
export interface ScrollNumber extends ScrollRaw { value: number | null; state: 'parsed' | 'unresolved' }
export interface ScrollRange extends ScrollRaw { text: string | null; state: 'parsed' | 'unresolved' }
export interface MagicScroll {
  id: string; name: string; nameSource: ScrollText; tome: ScrollText; range: ScrollRange
  hit: ScrollNumber; might: ScrollNumber; weight: ScrollNumber; critical: ScrollNumber; avoidance: ScrollNumber; uses: ScrollNumber
  description: ScrollText; acquisition: { part1: ScrollText; part3: ScrollText }
  confidence: DataStatus
  source: { sheet: string; row: number; range: string }
  validation: { severity: string; code: string; location: string; message: string }[]
}

function confidence(value: string): DataStatus {
  if (!isDataStatus(value)) throw new Error(`Unknown scroll confidence: ${value}`)
  return value
}
function text(field: { text: string | null; state: string; confidence: string; raw: string | number | boolean | null; rawType: string; source: string }): ScrollText {
  const state = field.state
  if (!Object.hasOwn(ACQUISITION_LABELS, state)) throw new Error(`Unknown scroll text state at ${field.source}`)
  return { ...field, state: state as AcquisitionState, confidence: confidence(field.confidence) }
}
function parsed<T extends { state: string; confidence: string; source: string }>(field: T): Omit<T, 'state' | 'confidence'> & { state: 'parsed' | 'unresolved'; confidence: DataStatus } {
  const state = field.state
  if (state !== 'parsed' && state !== 'unresolved') throw new Error(`Unknown scroll parsing state at ${field.source}`)
  return { ...field, state, confidence: confidence(field.confidence) }
}
export const scrollData: { records: MagicScroll[]; generalNotes: (ScrollRaw & { text: string | null })[] } = {
  records: imported.magicScrolls.records.map(record => ({ ...record, confidence: confidence(record.confidence),
    nameSource: text(record.nameSource), tome: text(record.tome), description: text(record.description), range: parsed(record.range),
    hit: parsed(record.hit), might: parsed(record.might), weight: parsed(record.weight), critical: parsed(record.critical), avoidance: parsed(record.avoidance), uses: parsed(record.uses),
    acquisition: { part1: text(record.acquisition.part1), part3: text(record.acquisition.part3) },
  })),
  generalNotes: imported.magicScrolls.generalNotes.map(note => ({ ...note, confidence: confidence(note.confidence) })),
}

export function filterScrolls(options: { search: string; part1: string; part3: string }, records = scrollData.records): MagicScroll[] {
  const query = options.search.trim().toLowerCase()
  return records.filter(record => (record.name.toLowerCase().includes(query) || (record.tome.text ?? '').toLowerCase().includes(query))
    && (options.part1 === 'all' || record.acquisition.part1.state === options.part1)
    && (options.part3 === 'all' || record.acquisition.part3.state === options.part3))
}

export function rawScrollValue(field: Pick<ScrollRaw, 'raw'>): string {
  return field.raw === null ? '(blank)' : String(field.raw)
}
