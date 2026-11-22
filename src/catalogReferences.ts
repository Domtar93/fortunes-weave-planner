import { dungeonData, normalizeCatalogText, type DungeonLocation } from './dungeons'
import { scrollData, type MagicScroll } from './scrolls'
import {communityData,isCommunitySource} from './community'

export const WORKBOOK_URL = 'https://docs.google.com/spreadsheets/d/1Xl84UvuBz3sGWOaGCny2i5wMIk2H__c3BDnMO_GeDQ0'
// Sheet-name/range URLs avoid guessing Google grid IDs from Excel's unrelated sheet IDs.
// This is an optional source link, never a runtime fetch or dataset dependency.
export function sourceRangeUrl(source: string): string {
  if(isCommunitySource(source)) {
    const locator=source.slice(communityData.namespace.length+2), separator=locator.indexOf('!')
    const sheet=communityData.sheets.find(s=>s.title===locator.slice(0,separator)), cell=locator.slice(separator+1)
    if(sheet&&/^[A-Z]+[1-9]\d*$/u.test(cell))return `${communityData.sourceUrl}#gid=${sheet.gid}&range=${cell}`
    return communityData.sourceUrl
  }
  const separator = source.indexOf('!')
  return `${WORKBOOK_URL}/gviz/tq?sheet=${encodeURIComponent(source.slice(0, separator))}&range=${encodeURIComponent(source.slice(separator + 1))}&headers=0&tqx=out:html`
}
export interface ScrollDungeonReference { scroll: MagicScroll; location: DungeonLocation; part: 'part1' | 'part3' }
export function scrollDungeonReferences(scrolls = scrollData.records, locations = dungeonData.records): ScrollDungeonReference[] {
  const normalized = locations.map(location => ({ location, name: normalizeCatalogText(location.name) }))
  const unique = normalized.filter(entry => normalized.filter(other => other.name === entry.name).length === 1)
  const result: ScrollDungeonReference[] = []
  for (const scroll of scrolls) for (const part of ['part1', 'part3'] as const) {
    if (scroll.acquisition[part].state !== 'documented') continue
    const text = normalizeCatalogText(scroll.acquisition[part].text ?? '')
    for (const { location, name } of unique) {
      // Full location-name boundaries only: no translations, aliases, archive or spell matching.
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text)) result.push({ scroll, location, part })
    }
  }
  return result
}
export const catalogReferences = scrollDungeonReferences()
