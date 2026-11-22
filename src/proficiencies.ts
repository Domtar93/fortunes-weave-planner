import imported from './runtimeData'
import type { ClassProfile, Proficiency } from './growths'

export const LEARNSET_STATES = {
  documented: 'Documented · unverified', unavailable: 'Explicitly unavailable',
  unknown: 'Unknown / unrecorded', placeholder: 'Unresolved placeholder', compound: 'Compound · needs review',
} as const
export type LearnsetState = keyof typeof LEARNSET_STATES
export type RankFilter = 'all' | 'documented' | 'unresolved'
export interface LearnsetEntry {
  rank: string
  text: string | null
  matrixText: string | null
  state: LearnsetState
  reliability: string
  evidence: string | null
  source: string
  matrixSource: string
  note: string | null
  sourceUrl: string | null
}
export interface ProficiencyCategory {
  ranks: string[]
  rankSources: string[]
  characters: Record<string, LearnsetEntry[]>
}
export interface GlossaryEntry {
  name: string
  description: string | null
  evidence: string | null
  note: string | null
  reference: string | null
  source: string
  reliability: string
}

function entry(value: Omit<LearnsetEntry, 'state'> & { state: string }): LearnsetEntry {
  if (!Object.hasOwn(LEARNSET_STATES, value.state)) throw new Error(`Unknown learnset state at ${value.source}`)
  return { ...value, state: value.state as LearnsetState }
}

export const proficiencyData: {
  categories: Record<Proficiency, ProficiencyCategory>
  profileMapping: Record<string, string>
  glossary: Record<string, GlossaryEntry>
} = {
  ...imported.proficiencies,
  categories: Object.fromEntries(Object.entries(imported.proficiencies.categories).map(([key, value]) => [key, {
    ...value,
    characters: Object.fromEntries(Object.entries(value.characters).map(([name, entries]) => [name, entries.map(entry)])),
  }])) as Record<Proficiency, ProficiencyCategory>,
}

export function learnsetIdentity(name: string): string {
  return Object.hasOwn(proficiencyData.profileMapping, name) ? proficiencyData.profileMapping[name] : name
}

export function filterEntries(entries: LearnsetEntry[], filter: RankFilter, search: string): LearnsetEntry[] {
  const query = search.trim().toLocaleLowerCase()
  return entries.filter(value => (filter === 'all' || (filter === 'documented' ? value.state === 'documented'
    : ['unknown', 'placeholder', 'compound'].includes(value.state)))
    && (!query || (value.text ?? '').toLocaleLowerCase().includes(query)))
}

// Match only literal allowed-type tokens. XP presence/absence never decides equipment legality.
const ALLOWED_NAMES: Record<Proficiency, string[]> = {
  Sword: ['Sword'], Spear: ['Spear'], Axe: ['Axe'], Bow: ['Bow'], Gauntlet: ['Gauntlets'],
  Reason: ['B. Magic'], Faith: ['W. Magic'], Authority: ['Battalions'],
  Infantry: ['Infantry'], Riding: ['Riding'], Armor: ['Armor'], Flying: ['Flying'],
}
export function explicitlyListed(profile: ClassProfile, proficiency: Proficiency): boolean {
  const tokens = (profile.details.allowedWeaponsAndSkills.text ?? '').split(',').map(value => value.trim())
  return ALLOWED_NAMES[proficiency].some(name => tokens.some(token => token === name || token.startsWith(`${name} (`)))
}
