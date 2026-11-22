import { growthData, PROFICIENCIES, type Proficiency } from './growths'
import { learnsetIdentity, proficiencyData, type GlossaryEntry, type LearnsetEntry } from './proficiencies'
import { sourceRangeUrl } from './catalogReferences'
import {ALL_RANKS,communityEntries,communityGlossary,isCommunitySource} from './community'

export const PLANNING_SLOTS = 8
export interface PlanningEntry {
  id: string
  characterName: string
  learnsetCharacter: string
  proficiency: Proficiency
  entry: LearnsetEntry
  glossary?: GlossaryEntry
}
export interface PlanningFeedback { characterName: string; origin: 'progression' | 'shortlist'; error: boolean; text: string }
export interface ShortlistState { byCharacter: Record<string, PlanningEntry[]>; feedback?: PlanningFeedback }
export type ShortlistAction =
  | { type: 'restore'; characterName: string; references: readonly { proficiency: Proficiency; rank: string; source: string }[] }
  | { type: 'add'; characterName: string; proficiency: Proficiency; rank: string; source: string }
  | { type: 'remove' | 'up' | 'down'; characterName: string; id: string; origin?: PlanningFeedback['origin'] }
  | { type: 'clear'; characterName: string }

// Identity belongs to a character profile and a documented source path, never an ability name or list index.
export const planningRecordId = (characterName: string, proficiency: Proficiency, entry: Pick<LearnsetEntry, 'rank' | 'source'>) => JSON.stringify([characterName, proficiency, entry.rank, entry.source])
export function isShortlistable(entry: LearnsetEntry): boolean {
  const text = entry.text?.trim()
  return entry.state === 'documented' && !!text && !!entry.rank && !!entry.source
    && !['N/A', 'NONE', '-', '—'].includes(text.toUpperCase())
    && !/[?\/\n\r(,;]/u.test(text) && entry.evidence !== 'Compound / needs parsing'
}
export function resolvePlanningEntry(characterName: string, proficiency: Proficiency, rank: string, source: string): PlanningEntry | null {
  if (!growthData.characters.some(profile => profile.name === characterName)) return null
  const learnsetCharacter = learnsetIdentity(characterName)
  const candidates = isCommunitySource(source) ? communityEntries(proficiency,learnsetCharacter) : proficiencyData.categories[proficiency]?.characters[learnsetCharacter] ?? []
  const matches = candidates.filter(entry => entry.rank === rank && entry.source === source)
  if (matches.length !== 1 || !isShortlistable(matches[0])) return null
  const entry = matches[0]
  return { id: planningRecordId(characterName, proficiency, entry), characterName, learnsetCharacter, proficiency, entry,
    glossary: isCommunitySource(source) ? communityGlossary(entry.text) : proficiencyData.glossary[entry.text!.trim()] }
}
export function learnsetSourceLink(entry: LearnsetEntry): string {
  return entry.sourceUrl && /^https?:\/\//u.test(entry.sourceUrl) ? entry.sourceUrl : sourceRangeUrl(entry.source.replace(/^'([^']+)'!/u, '$1!'))
}
export function shortlistReducer(state: ShortlistState, action: ShortlistAction): ShortlistState {
  const entries = Object.hasOwn(state.byCharacter, action.characterName) ? state.byCharacter[action.characterName] : []
  const origin = action.type === 'add' ? 'progression' : action.type === 'clear' || action.type === 'restore' ? 'shortlist' : action.origin ?? 'shortlist'
  const feedback = (text: string, error = false): PlanningFeedback => ({ characterName: action.characterName, origin, text, error })
  const changed = (next: PlanningEntry[], text: string): ShortlistState => ({ byCharacter: { ...state.byCharacter, [action.characterName]: next }, feedback: feedback(text) })
  if (action.type === 'restore') {
    const next = action.references.map(reference => resolvePlanningEntry(action.characterName, reference.proficiency, reference.rank, reference.source))
    if (!growthData.characters.some(profile => profile.name === action.characterName) || next.length > PLANNING_SLOTS || next.some(entry => !entry) || new Set(next.map(entry => entry?.id)).size !== next.length) {
      return { ...state, feedback: feedback('The saved planning references could not be restored. No shortlist was changed.', true) }
    }
    return changed(next as PlanningEntry[], `Restored ${next.length} planned abilities for ${action.characterName}.`)
  }
  if (action.type === 'add') {
    const record = resolvePlanningEntry(action.characterName, action.proficiency, action.rank, action.source)
    if (!record) return { ...state, feedback: feedback('This source record is unresolved or not an identifiable single entry; it cannot be shortlisted.', true) }
    if (entries.some(entry => entry.id === record.id)) return { ...state, feedback: feedback('That exact source record is already shortlisted.', true) }
    if (entries.length >= PLANNING_SLOTS) return { ...state, feedback: feedback('All 8 planning slots are filled. Remove an entry before adding another.', true) }
    return changed([...entries, record], `Added ${record.entry.text} · ${record.proficiency} ${record.entry.rank} to ${action.characterName}’s shortlist.`)
  }
  if (action.type === 'clear') return changed([], `Cleared ${action.characterName}’s planning shortlist.`)
  const index = entries.findIndex(entry => entry.id === action.id)
  if (index < 0) return state
  if (action.type === 'remove') return changed(entries.filter(entry => entry.id !== action.id), `Removed ${entries[index].entry.text} from the shortlist.`)
  const destination = index + (action.type === 'up' ? -1 : 1)
  if (destination < 0 || destination >= entries.length) return state
  const next = [...entries]
  ;[next[index], next[destination]] = [next[destination], next[index]]
  return changed(next, `Moved ${entries[index].entry.text} to planning slot ${destination + 1}.`)
}
export function planningRequirements(entries: PlanningEntry[]) {
  return PROFICIENCIES.flatMap(proficiency => {
    const selected = entries.filter(entry => entry.proficiency === proficiency)
    return selected.length ? [{ proficiency, count: selected.length,
      ranks: ALL_RANKS.filter(rank => selected.some(entry => entry.entry.rank === rank)) }] : []
  })
}
