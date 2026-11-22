import { PROFICIENCY_NAMES, type GrowthData } from './growths'
import { LEARNSET_STATES } from './proficiencies'
import { PLANNING_SLOTS, type PlanningEntry } from './shortlist'
import { ABILITY_DESCRIPTION_LABELS, meaningfulAbilityText, resolveAbilityInformation } from './abilityInfo'

export interface ShortlistTextProfile { id: string; displayName: string }
export type ShortlistTextSource = Pick<GrowthData['metadata'], 'sourceFile'>

// Presentation only: preserve source values, identities and array order.
export function formatShortlistText(profile: ShortlistTextProfile, records: readonly PlanningEntry[], source: ShortlistTextSource): string {
  const entries = records.filter(record => record.characterName === profile.id)
  const lines = ["Fortune's Weave — Ability Planning Shortlist", `Character: ${profile.displayName}`]
  if (profile.id !== profile.displayName) lines.push(`Profile ID: ${profile.id}`)
  lines.push(`Planned abilities: ${entries.length}/${PLANNING_SLOTS}`)
  if (source.sourceFile) lines.push(`Source snapshot: ${source.sourceFile}`)
  lines.push('', 'Planning only. Actual ability equip limits and unlock legality are not verified.')
  lines.push(...formatShortlistEntryLines(entries))
  return lines.join('\n')
}

// Shared verbatim entry formatting for shortlist and main-overview exports.
export function formatShortlistEntryLines(entries: readonly PlanningEntry[]): string[] {
  const lines: string[] = []
  entries.forEach((planned, index) => {
    const { entry, glossary } = planned
    const label = PROFICIENCY_NAMES[planned.proficiency]
    lines.push('', `${index + 1}. ${entry.text ?? '(Unlock text not documented)'}`,
      `   Proficiency: ${planned.proficiency}${label !== planned.proficiency ? ` (${label})` : ''} ${entry.rank}`,
      `   Evidence: ${entry.evidence ?? 'Not documented.'}`,
      `   Reliability: ${entry.reliability || 'Not documented.'}`,
      `   State: ${LEARNSET_STATES[entry.state]}`,
      `   Source: ${entry.source || 'Not documented.'}`)
    if (entry.sourceUrl) lines.push(`   Source link: ${entry.sourceUrl}`)
    if (entry.matrixSource) lines.push(`   Matrix source: ${entry.matrixSource}`)
    if (entry.note) lines.push(`   Source note: ${entry.note}`)
    const information = resolveAbilityInformation({name:entry.text,proficiency:planned.proficiency,characterName:planned.characterName,fallback:glossary?.description,rank:entry.rank,source:entry.source})
    if (information.description) lines.push(`   Effect: ${information.description}`)
    else if(information.hasConflict)for(const description of information.alternatives)lines.push(`   Effect variant: ${description}`)
    if(information.notice)lines.push(`   Record note: ${information.notice}`)
    if(information.descriptionKind)lines.push(`   Description basis: ${ABILITY_DESCRIPTION_LABELS[information.descriptionKind]}`)
    for(const part of information.parts??[])lines.push(`   ${part.label}: ${part.information.description??part.information.notice??'No matching effect description.'}`)
    for(const fact of information.facts)lines.push(`   ${fact.label}: ${fact.value}`)
    for(const reference of information.references)lines.push(`   Effect reference: ${reference.label} — ${reference.url}`)
    if(meaningfulAbilityText(glossary?.description)&&glossary.description!==information.description)lines.push(`   Recorded glossary description: ${glossary.description}`)
    if (glossary?.evidence) lines.push(`   Glossary evidence: ${glossary.evidence}`)
    if (glossary?.source) lines.push(`   Glossary source: ${glossary.source}`)
    if (glossary?.note) lines.push(`   Glossary caveat: ${glossary.note}`)
    if (glossary?.reference) lines.push(`   Glossary reference: ${glossary.reference}`)
  })
  return lines
}
