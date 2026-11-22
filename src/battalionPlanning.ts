import { growthData, type SourceText } from './growths'
import { battalionData } from './battalions'

export const BATTALION_CLASS_MESSAGES = {
  listed: 'Battalions listed by this class.',
  'not-listed': 'Battalions not listed by this class.',
  unresolved: 'Battalion compatibility undetermined.',
} as const

// Only column L is an input: mount classification, XP and training cannot imply permission.
export function classBattalionSupport(allowed?: SourceText): keyof typeof BATTALION_CLASS_MESSAGES {
  if (!allowed?.text?.trim() || !['confirmed', 'unverified'].includes(allowed.status)) return 'unresolved'
  const tokens = allowed.text.split(',').map(token => token.trim())
  // Movement qualifications occur in the workbook. Conditional battalion entries remain unresolved.
  if (tokens.some(token => !/^(Swords?|Spears?|Axes?|Bows?|Gauntlets?|B\. Magic|W\. Magic|Battalions|(?:Infantry|Riding|Armor|Flying)(?: \([^()]*\))?)$/i.test(token))) return 'unresolved'
  return tokens.some(token => /^Battalions$/i.test(token)) ? 'listed' : 'not-listed'
}

export type BattalionSelections = Record<string, string>
export function battalionSelectionReducer(state: BattalionSelections, action: { characterName: string; battalionId: string | null }): BattalionSelections {
  if (!growthData.characters.some(profile => profile.name === action.characterName)) return state
  if (action.battalionId === null) {
    if (!Object.hasOwn(state, action.characterName)) return state
    const next = { ...state }; delete next[action.characterName]; return next
  }
  if (!battalionData.records.some(record => record.id === action.battalionId)) return state
  if (Object.hasOwn(state, action.characterName) && state[action.characterName] === action.battalionId) return state
  return { ...state, [action.characterName]: action.battalionId }
}
