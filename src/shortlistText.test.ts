import { describe, expect, it } from 'vitest'
import { growthData } from './growths'
import { proficiencyData } from './proficiencies'
import { resolvePlanningEntry } from './shortlist'
import { formatShortlistText } from './shortlistText'

const source = growthData.metadata
const profile = { id: 'Alexandra', displayName: 'Alexandra' }
const plan = (rank: string, character = 'Alexandra') => resolvePlanningEntry(character, 'Sword', rank, proficiencyData.categories.Sword.characters[character === 'Mu (with growth)' ? 'Mu' : character].find(entry => entry.rank === rank)!.source)!
const flier = () => resolvePlanningEntry('Alexandra', 'Flying', 'C+', "'Flying'!C2")!

describe('plain-text ability shortlist presentation', () => {
  it('exports Alexandra’s three ordered records with exact ranks, original evidence/reliability and citations', () => {
    const entries = [plan('D'), plan('C'), flier()]
    const text = formatShortlistText(profile, entries, source)
    expect(text).toContain('Character: Alexandra\nPlanned abilities: 3/8')
    expect(text).toContain('Source snapshot: source.xlsx')
    expect(text).toContain('Planning only. Actual ability equip limits and unlock legality are not verified.')
    expect(text.match(/^\d+\. /gm)).toHaveLength(3)
    expect(text.indexOf('1. Haze Slice')).toBeLessThan(text.indexOf('2. Rend Armor'))
    expect(text.indexOf('2. Rend Armor')).toBeLessThan(text.indexOf('3. Flitting Flier'))
    for (const planned of entries) {
      expect(text).toContain(`Proficiency: ${planned.proficiency} ${planned.entry.rank}`)
      expect(text).toContain(`Evidence: ${planned.entry.evidence}`)
      expect(text).toContain(`Reliability: ${planned.entry.reliability}`)
      expect(text).toContain(`Source: ${planned.entry.source}`)
      expect(text).toContain(`Source link: ${planned.entry.sourceUrl}`)
      expect(text).toContain(`Matrix source: ${planned.entry.matrixSource}`)
    }
  })
  it('follows reordering without sorting or mutating frozen records', () => {
    const entries = Object.freeze([plan('C'), plan('D'), flier()].map(planned => Object.freeze({ ...planned, entry: Object.freeze({ ...planned.entry }) })))
    const before = JSON.stringify(entries), text = formatShortlistText(profile, entries, source)
    expect(text).toContain('1. Rend Armor'); expect(text).toContain('2. Haze Slice'); expect(text).toContain('3. Flitting Flier')
    expect(JSON.stringify(entries)).toBe(before)
  })
  it('retains separate same-name records and preserves Unicode, punctuation, apostrophes and S+', () => {
    const first = plan('D'), second = { ...plan('S+'), entry: { ...plan('S+').entry, text: first.entry.text } }
    const third = { ...flier(), entry: { ...flier().entry, text: 'Mu’s α—“Wind” +1 / Γ' } }
    const text = formatShortlistText(profile, [first, second, third], source)
    expect(text.match(/\d+\. Haze Slice/g)).toHaveLength(2)
    expect(text).toContain("Proficiency: Sword S+\n"); expect(text).toContain("Source: 'Sword'!G2")
    expect(text).toContain("Source: 'Sword'!B2"); expect(text).toContain('3. Mu’s α—“Wind” +1 / Γ')
    expect(text).toContain('Proficiency: Flying C+')
  })
  it('keeps Mu profiles independent even when passed a mixed defensive input', () => {
    const mu = plan('D', 'Mu'), alternate = plan('C', 'Mu (with growth)'), entries = [mu, alternate]
    const original = formatShortlistText({ id: 'Mu', displayName: 'Mu' }, entries, source)
    const other = formatShortlistText({ id: 'Mu (with growth)', displayName: 'Mu (with growth)' }, entries, source)
    expect(original).toContain('Character: Mu\nPlanned abilities: 1/8'); expect(original).toContain('1. Wrath Strike')
    expect(original).not.toContain('Shadow Gambit')
    expect(other).toContain('Character: Mu (with growth)\nPlanned abilities: 1/8'); expect(other).toContain('1. Shadow Gambit')
    expect(other).not.toContain('Wrath Strike')
  })
  it('retains a distinct display name, canonical profile and proficiency category labels', () => {
    const entry = { ...plan('D'), proficiency: 'Reason' as const }
    const text = formatShortlistText({ id: 'Alexandra', displayName: 'Alexandra — plan α' }, [entry], source)
    expect(text).toContain('Character: Alexandra — plan α\nProfile ID: Alexandra')
    expect(text).toContain('Proficiency: Reason (Black Magic) D')
  })
  it('does not invent absent effects, evidence, source cells or source URLs', () => {
    const planned = { ...plan('D'), glossary: undefined, entry: { ...plan('D').entry, text:'Unlisted fixture ability', source: '', sourceUrl: null, evidence: null, reliability: '', matrixSource: '' } }
    const text = formatShortlistText(profile, [planned], { sourceFile: '' })
    expect(text).toContain('Evidence: Not documented.'); expect(text).toContain('Source: Not documented.')
    expect(text).not.toContain('Source link:'); expect(text).not.toContain('Effect:'); expect(text).not.toContain('docs.google.com')
    expect(text).not.toContain('Source snapshot:')
  })
  it('preserves actual glossary descriptions, provenance and acquisition caveats', () => {
    const planned = flier(), text = formatShortlistText(profile, [planned], source)
    for (const value of [planned.glossary!.description, planned.glossary!.evidence, planned.glossary!.source, planned.glossary!.note, planned.glossary!.reference]) expect(text).toContain(value)
    expect(text).toContain('mount-bond ability')
  })
  it('exports the same supplied Swordfaire effect shown by the inspector',()=>{
    const text=formatShortlistText(profile,[plan('S+')],source)
    expect(text).toContain('Effect: When unit is equipped with a sword, grants Hit/Avo+10 and Atk+3.')
    expect(text).toContain('Effect reference: Sword!')
    expect(text).not.toContain('Effect not yet documented')
  })
  it('formats an explicit zero-count header without fabricating records or changing any source data', () => {
    const before = JSON.stringify([growthData, proficiencyData])
    const text = formatShortlistText(profile, [], source)
    expect(text).toContain('Planned abilities: 0/8'); expect(text).not.toMatch(/^\d+\. /m)
    formatShortlistText(profile, [plan('D'), flier()], source)
    expect(JSON.stringify([growthData, proficiencyData])).toBe(before)
  })
})
