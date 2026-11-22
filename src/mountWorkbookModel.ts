import rules from './data/mount-growth-rules.json'
import { growthData, STATS } from './growths'
import type { MountRecord } from './mounts'

// A display/calculation interpretation of the workbook, never a source-data edit.
// Do not infer a 25% cap: four named mounts have 30% listed growth totals.
export function canUseWorkbookMountZeros(mount: MountRecord, evidence = rules): boolean {
  if (evidence.sourceSha256 !== growthData.metadata.sourceSha256 || evidence.schemaVersion !== 1
    || mount.growthComparison.status !== 'consistent' || mount.parsed.growths.state !== 'parsed' || mount.parsed.growths.unparsed.length) return false
  const row = /^Mounts!A([1-9]\d*)$/u.exec(mount.nameSource.source)?.[1]
  if (!row || mount.totalGrowth.source !== `Mounts!Q${row}` || mount.totalGrowth.formula?.replace(/[\s$]/gu, '').toLowerCase() !== `=sum(h${row}:p${row})`) return false
  return STATS.every((stat, index) => {
    const numeric = mount.numericGrowths[stat], written = mount.parsed.growths.values[stat]
    if (numeric.source !== `Mounts!${String.fromCharCode(72 + index)}${row}` || written !== numeric.value) return false
    return numeric.value === null ? numeric.status === 'unknown'
      : Number.isFinite(numeric.value) && ['confirmed', 'unverified'].includes(numeric.status)
  })
}

export function listedMountGrowthTotal(mount: MountRecord): number | null {
  return canUseWorkbookMountZeros(mount) ? STATS.reduce((sum, stat) => sum + (mount.numericGrowths[stat].value ?? 0), 0) : null
}
