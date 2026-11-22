import { describe, expect, it } from 'vitest'
import { ACQUISITION_LABELS, filterScrolls, rawScrollValue, scrollData } from './scrolls'

const options = { search: '', part1: 'all', part3: 'all' }
describe('magic scroll reference model', () => {
  it('contains seven exact Unicode names, stable unique identities and unresolved availability', () => {
    expect(scrollData.records.map(record => record.name)).toEqual(['Fimbulvetr Night', "Agnea's Arrow", 'Dark Spikes Τ', 'Mire Β', 'Death Γ', 'Banshee Θ', 'Swarm Ζ'])
    expect(new Set(scrollData.records.map(record => record.id)).size).toBe(7)
    expect(scrollData.records.every(record => record.confidence === 'unverified')).toBe(true)
    expect(Object.keys(ACQUISITION_LABELS)).toEqual(['documented', 'unavailable', 'unknown', 'empty', 'unresolved'])
  })
  it('searches names and archives case-insensitively without Greek-to-Latin substitution', () => {
    for (const name of ['Dark Spikes Τ', 'Mire Β', 'Death Γ', 'Banshee Θ', 'Swarm Ζ']) expect(filterScrolls({ ...options, search: name }).map(record => record.name)).toEqual([name])
    expect(filterScrolls({ ...options, search: '  archive γ  ' })[0].name).toBe('Death Γ')
    expect(filterScrolls({ ...options, search: 'Dark Spikes T' })).toEqual([])
    expect(filterScrolls({ ...options, search: 'Mire B' })).toEqual([])
  })
  it('combines source/name and independent part acquisition filters', () => {
    expect(filterScrolls({ ...options, part1: 'documented' })).toHaveLength(4)
    expect(filterScrolls({ ...options, part1: 'unavailable' })).toHaveLength(3)
    expect(filterScrolls({ ...options, part3: 'unknown' })).toHaveLength(4)
    expect(filterScrolls({ ...options, part3: 'documented' })).toHaveLength(3)
    expect(filterScrolls({ search: 'Archive', part1: 'unavailable', part3: 'documented' }).map(record => record.name)).toEqual(['Dark Spikes Τ'])
    expect(filterScrolls({ ...options, part3: 'unavailable' })).toEqual([])
    expect(filterScrolls({ ...options, part1: 'empty' })).toEqual([])
  })
  it('keeps literal range strings, numeric zero, blanks and unresolved raw text distinguishable', () => {
    expect(scrollData.records.map(record => record.range.text)).toEqual(['1-2', '1-2', '1-2', '1-3', '1-2', '1-3', '1-2'])
    expect(scrollData.records.every(record => record.avoidance.value === 0)).toBe(true)
    expect(rawScrollValue({ raw: 0 })).toBe('0')
    expect(rawScrollValue({ raw: null })).toBe('(blank)')
    expect(rawScrollValue({ raw: '?' })).toBe('?')
  })
  it('does not mutate any source record or attach independent research notes while filtering', () => {
    const before = JSON.stringify(scrollData)
    filterScrolls({ search: 'Archive', part1: 'documented', part3: 'unknown' })
    expect(JSON.stringify(scrollData)).toBe(before)
    expect(scrollData.generalNotes).toHaveLength(8)
    expect(JSON.stringify(scrollData.records)).not.toContain('Nysaides')
    expect(JSON.stringify(scrollData.records)).not.toContain('Chapter 10')
  })
})
