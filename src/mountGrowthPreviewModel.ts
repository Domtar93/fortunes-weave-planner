import rules from './data/mount-growth-rules.json'
import { combineGrowths, growthData, STATS, type CharacterProfile, type ClassProfile } from './growths'
import { mountCompatibility, type MountRecord } from './mounts'
import { canUseWorkbookMountZeros } from './mountWorkbookModel'

export function previewMountGrowth(character: CharacterProfile, selectedClass: ClassProfile, mount?: MountRecord, evidence = rules, interpretWorkbookBlanks = false) {
  const base = combineGrowths(character.growths, selectedClass.growths)
  const compatibility = mount ? mountCompatibility(selectedClass, mount) : undefined
  const evidenceValid = evidence.schemaVersion === 1 && evidence.sourceSha256 === growthData.metadata.sourceSha256 && evidence.normalMultiplier === 1 && evidence.doubledClass === 'Charioteer' && evidence.doubledMultiplier === 2
  const state = !mount ? 'none' : !evidenceValid ? 'unverified-rules' : selectedClass.source.row > evidence.classLookupLastRow ? 'unsupported-class' : compatibility === 'unmounted' || compatibility === 'mismatch' ? 'not-applied'
    : compatibility === 'unknown' ? 'unknown-type' : mount.growthComparison.status !== 'consistent' ? 'disputed' : 'applicable'
  const multiplier = state === 'applicable' ? (selectedClass.name === evidence.doubledClass ? evidence.doubledMultiplier : evidence.normalMultiplier) : 0
  const workbookZeros = !!mount && interpretWorkbookBlanks && canUseWorkbookMountZeros(mount, evidence)
  const rows = STATS.map(stat => {
    const field = mount?.numericGrowths[stat]
    const known = !!field && typeof field.value === 'number' && Number.isFinite(field.value) && ['confirmed', 'unverified'].includes(field.status)
    const blankAsZero = workbookZeros && field?.value === null
    const contribution = state === 'none' || state === 'not-applied' ? 0 : state === 'applicable' && (known || blankAsZero) ? (known ? field!.value! : 0) * multiplier : null
    return { stat, base: base[stat], recorded: known ? field!.value : null, source: field?.source, multiplier,
      blankAsZero, contribution, combined: contribution === null ? null : base[stat] + contribution }
  })
  const messages = {
    none: 'No mount selected. Preview shows character + class only.',
    'not-applied': 'Mount growth is not applied: the documented class type is unmounted or differs from this species.',
    'unverified-rules': 'Calculation evidence does not match the current source snapshot. Mount preview is unavailable.',
    'unsupported-class': 'The workbook mount formula lookup excludes this class row. Preview is unavailable until source evidence is corrected; the class itself remains selectable.',
    'unknown-type': 'Class or mount species is unknown. Mount preview is unavailable.',
    disputed: 'Written and numeric growth evidence is disputed or unresolved. No version is selected; mount preview is unavailable.',
    applicable: workbookZeros ? `Workbook growths ×${multiplier}. Unlisted modifiers count as +0% for comparison; source values remain unverified.`
      : `Uses the recorded numeric mount growths ×${multiplier}. Blank fields remain unknown, so affected totals are unavailable.`,
  }
  return { state, multiplier, rows, message: messages[state], evidence: evidence.sources, workbookZeros }
}

export const previewWorkbookMountGrowth = (character: CharacterProfile, selectedClass: ClassProfile, mount?: MountRecord) => previewMountGrowth(character, selectedClass, mount, rules, true)
