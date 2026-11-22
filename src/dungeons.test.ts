import { describe, expect, it } from 'vitest'
import { dungeonData, filterDungeons, hasUnresolvedRewards, normalizeCatalogText } from './dungeons'
import { catalogReferences, scrollDungeonReferences, sourceRangeUrl } from './catalogReferences'
import { scrollData } from './scrolls'

const options = { search: '', reward: '', phase: 'all' as const, unresolvedOnly: false }
describe('dungeon references and phase search', () => {
  it('keeps 31 locations, 90 chests and 180 ordered phase fields with unique identities', () => {
    const chests = dungeonData.records.flatMap(location => location.chests)
    expect(dungeonData.records).toHaveLength(31)
    expect(chests).toHaveLength(90)
    expect(new Set(chests.map(chest => chest.id)).size).toBe(90)
    expect(chests.filter(chest => chest.part1.status === 'placeholder')).toHaveLength(4)
    expect(chests.every(chest => chest.part3.status === 'documented')).toBe(true)
    expect(dungeonData.records.find(location => location.name === 'Uncharted Isle')!.chests.map(chest => chest.number)).toEqual([2])
  })
  it('normalizes only incidental search whitespace/case and preserves original display names and suffixes', () => {
    expect(normalizeCatalogText('  Killing\nEdge +3  ')).toBe('killing edge +3')
    expect(filterDungeons({ ...options, search: '  COUGAR   WOODLANDS ' })[0].name).toBe('Cougar Woodlands ')
    expect(filterDungeons({ ...options, reward: 'Horsekiller Bow +2' })[0].name).toBe('Corroios Fort Ruins')
  })
  it('searches only the selected reward phase while dungeon-name search remains independent', () => {
    expect(filterDungeons({ ...options, search: 'Poisonbone Chain', phase: 'part1' }).map(location => location.name)).toEqual(['Corroios Fort Ruins'])
    expect(filterDungeons({ ...options, search: 'Poisonbone Chain', phase: 'part3' })).toEqual([])
    expect(filterDungeons({ ...options, search: 'Corroios', phase: 'part3' })[0].name).toBe('Corroios Fort Ruins')
    expect(filterDungeons({ ...options, reward: 'Killing Edge +3', phase: 'part3' }).map(location => location.name)).toEqual(["Nowah's Cave"])
  })
  it('combines location and reward queries without deduplicating repeated chest items', () => {
    expect(filterDungeons({ ...options, search: 'Cougar', reward: 'Bullion', phase: 'part1' })[0].chests.filter(chest => chest.part1.raw === 'Bullion')).toHaveLength(2)
    expect(filterDungeons({ ...options, search: 'Corroios', reward: 'Talisman', phase: 'part3' })).toHaveLength(1)
    expect(filterDungeons({ ...options, search: 'Nowah', reward: 'Talisman' })).toEqual([])
  })
  it('filters unresolved phase fields including placeholders without interpreting them as reward names', () => {
    expect(filterDungeons({ ...options, unresolvedOnly: true }).map(location => location.name)).toEqual(['Palace of Sand'])
    expect(filterDungeons({ ...options, phase: 'part3', unresolvedOnly: true })).toEqual([])
    expect(filterDungeons({ ...options, reward: '-', phase: 'part1' }).some(location => location.name === 'Palace of Sand')).toBe(false)
    const original = dungeonData.records[0]
    const synthetic = { ...original, chests: [{ ...original.chests[0], part3: { raw: null, status: 'empty' as const } }] }
    expect(hasUnresolvedRewards(synthetic, 'part3')).toBe(true)
    const before = JSON.stringify(dungeonData)
    filterDungeons(options)
    expect(JSON.stringify(dungeonData)).toBe(before)
  })
})

describe('scroll/dungeon location navigation and source links', () => {
  it('links only five complete unambiguous location names, regardless of case and whitespace', () => {
    expect(catalogReferences.map(reference => [reference.scroll.name, reference.part, reference.location.name])).toEqual([
      ['Dark Spikes Τ', 'part3', 'Uncharted Isle'], ['Mire Β', 'part1', 'Cave Behind the Falls'],
      ['Death Γ', 'part1', "Aditi's Cave"], ['Banshee Θ', 'part1', 'Iapetus Cavern'], ['Swarm Ζ', 'part1', 'Southern Passage'],
    ])
  })
  it('does not infer aliases, partial names, Greek/Latin equivalence or ambiguous duplicate locations', () => {
    const scroll = scrollData.records.find(record => record.name === 'Mire Β')!
    const base = dungeonData.records.find(location => location.name === 'Cave Behind the Falls')!
    expect(scrollDungeonReferences([scroll], [{ ...base, name: 'Cave Behind the Waterfall' }])).toEqual([])
    expect(scrollDungeonReferences([scroll], [base, { ...base, id: 'ambiguous', name: 'cave behind the falls' }])).toEqual([])
    const partial = { ...scroll, acquisition: { ...scroll.acquisition, part1: { ...scroll.acquisition.part1, text: 'Cave Behind the Fallsmith' } } }
    expect(scrollDungeonReferences([partial], [base])).toEqual([])
    const southern = dungeonData.records.find(location => location.name === 'Southern Passage')!
    expect(southern.chests[1].part1.raw).toBe('Swarm Z')
    expect(scrollData.records.find(record => record.name === 'Swarm Ζ')!.name).not.toBe(southern.chests[1].part1.raw)
  })
  it('keeps uncharted and archive discrepancies in their own original sources without corrections', () => {
    const reference = catalogReferences.find(reference => reference.location.name === 'Uncharted Isle')!
    expect(reference.scroll.acquisition.part3.text).toContain('Uncharted Isle chest')
    expect(reference.location.chests.map(chest => chest.part3.raw)).toEqual(['Talisman'])
    expect(dungeonData.generalNotes.find(note => note.source === 'Dungeon Chests!H26')!.text).toContain('Archive Τ')
    expect(reference.location.notes).toEqual([])
  })
  it('constructs named-sheet/cell source links without guessing Google grid IDs', () => {
    const url = new URL(sourceRangeUrl('Dungeon Chests!C9'))
    expect(url.origin).toBe('https://docs.google.com')
    expect(url.searchParams.get('sheet')).toBe('Dungeon Chests')
    expect(url.searchParams.get('range')).toBe('C9')
    expect(url.searchParams.get('headers')).toBe('0')
    expect(url.searchParams.get('tqx')).toBe('out:html')
    expect(url.searchParams.has('gid')).toBe(false)
  })
})
