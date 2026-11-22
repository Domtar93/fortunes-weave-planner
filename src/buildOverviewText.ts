import type { MainBuildOverviewData } from './buildOverview'
import { DATA_STATUS_LABELS } from './growths'
import { weaponFieldText, WEAPON_FIELDS, type WeaponFieldKey } from './forging'
import { sourceRangeUrl } from './catalogReferences'
import { formatShortlistEntryLines } from './shortlistText'
import { PLANNING_SLOTS } from './shortlist'

export const BUILD_PLAN_DISCLAIMER = 'This is a planning reference. Equipment legality, ability slot limits, acquisition requirements and combined combat effects are not fully verified. No equipment bonuses have been applied to calculated character statistics.'

// Format only already-derived state. No compatibility checks, fetches, storage or calculations.
export function formatBuildOverviewText(data: MainBuildOverviewData): string {
  const { character, selectedClass, weapon, mount, battalion, unavailable } = data
  const entries = data.entries.filter(entry => entry.characterName === character.name)
  const lines = ["FORTUNE'S WEAVE — MAIN BUILD PLAN", '', `Character: ${character.name}`, `Class: ${selectedClass.name}`]
  const source = (reference: string, label = 'Source') => {
    lines.push(`${label}: ${reference || 'Not documented.'}`)
    if (reference.includes('!')) lines.push(`${label} link: ${sourceRangeUrl(reference)}`)
  }
  const missing = (stale: boolean) => stale ? 'Selected reference unavailable. No replacement selected.' : 'Not selected.'
  source(`${character.source.sheet}!${character.source.range}`, 'Character source')
  source(`${selectedClass.source.sheet}!${selectedClass.source.range}`, 'Class source')
  lines.push('', 'WEAPON')
  if (weapon) {
    lines.push(`Name: ${weapon.record.name}`, `Family: ${weapon.family.family ?? 'Unresolved'} (provisional classification)`,
      `Class context: ${weapon.support.message}`, `Might: ${weaponFieldText(weapon.record, 'might')}${weapon.record.might.kind === 'span' ? ' (documented span, not calculated refinement)' : ''}`,
      `Attack range: ${weaponFieldText(weapon.record, 'attackRange')}`, 'Family context does not prove current rank or equip legality.')
    if (weapon.support.outcome === 'unresolved') lines.push(`Context uncertainty: ${weapon.support.reason}`)
    if (weapon.family.ambiguityWarning) lines.push(`Family warning: ${weapon.family.ambiguityWarning}`)
    if (weapon.record.completeness === 'incomplete') lines.push(`Incomplete source data. Undocumented properties: ${weapon.record.missingFields.map(field => WEAPON_FIELDS[field as WeaponFieldKey] ?? field).join(', ') || 'See source warnings'}. Missing values are not zero.`)
    lines.push(`Might source: ${weapon.record.might.source}`, `Attack range source: ${weapon.record.attackRange.source}`, 'Reliability: Community data · Unverified')
    source(`${weapon.record.source.sheet}!${weapon.record.source.range}`)
    source(weapon.family.source.cell, 'Family source')
    source(selectedClass.details.allowedWeaponsAndSkills.source, 'Class context source')
  } else lines.push(`Weapon: ${missing(unavailable.weapon)}`)
  lines.push('', 'MOUNT')
  if (mount) {
    lines.push(`Name: ${mount.record.name}`, `Species: ${mount.record.species.text ?? 'Unknown'} · ${DATA_STATUS_LABELS[mount.record.species.status]}`, `Class context: ${mount.message}`,
      'Species context does not prove ownership or equip legality. No mount bonuses applied.')
    source(mount.record.source)
    source(selectedClass.details.mountType.source, 'Class context source')
    lines.push(`Species source: ${mount.record.species.source}`, 'Reliability: Community data · Unverified')
  } else lines.push(`Mount: ${missing(unavailable.mount)}`)
  lines.push('', 'BATTALION')
  if (battalion) {
    lines.push(`Name: ${battalion.record.name}`, `Category: ${battalion.record.category.text ?? 'Unknown'}`, `Authority requirement: ${battalion.record.authorityRank.text ?? 'Unknown'} · ${DATA_STATUS_LABELS[battalion.record.authorityRank.status]}`,
      `Class context: ${battalion.message}`, 'Authority requirement documented; character eligibility not verified. Current Authority rank is not tracked. No battalion stats or gambit effects applied.')
    source(`${battalion.record.source.sheet}!${battalion.record.source.range}`)
    source(selectedClass.details.allowedWeaponsAndSkills.source, 'Class context source')
    lines.push(`Authority source: ${battalion.record.authorityRank.source}`, `Reliability: ${DATA_STATUS_LABELS[battalion.record.reliability]}`)
  } else lines.push(`Battalion: ${missing(unavailable.battalion)}`)
  lines.push('', `PLANNED ABILITIES (${entries.length}/${PLANNING_SLOTS})`, 'Eight slots organize planning; they do not establish a game equip limit or simultaneous ability legality.')
  if (entries.length === 0) lines.push('No abilities shortlisted.')
  for (const identity of new Set(entries.map(entry => entry.learnsetCharacter))) {
    if (identity !== character.name) lines.push(`Learnset source mapping: ${character.name} uses ${identity}'s source learnset through the existing explicit mapping. Profile plans remain separate.`)
  }
  lines.push(...formatShortlistEntryLines(entries))
  lines.push('', 'SOURCE WARNINGS')
  const warnings = [
    ...data.classNotes.map(note => `Class: ${note}`),
    ...(weapon?.warnings ?? []).map(warning => `Weapon · ${warning.source}: ${warning.message}`),
    ...(mount?.warnings ?? []).map(warning => `Mount · ${warning.source}: ${warning.message}`),
    ...(battalion?.warnings ?? []).map(warning => `Battalion · ${warning.source}: ${warning.message}`),
  ]
  lines.push(...(warnings.length ? warnings : ['No additional record-specific warnings for these selections. Community data and gameplay mechanics remain unverified.']))
  lines.push('', 'PLANNING DISCLAIMER', BUILD_PLAN_DISCLAIMER)
  return lines.join('\n').replace(/\r\n?/g, '\n')
}
