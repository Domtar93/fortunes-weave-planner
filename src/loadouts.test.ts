import { describe, expect, it, vi } from 'vitest'
import { abilityReferences, createLoadout, LOADOUT_KEY, loadoutIssue, readLoadouts, resolveLoadout, validateLoadoutPayload, writeLoadouts, type FullBuildSelection } from './loadouts'
import { PRESET_KEY } from './presets'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { resolvePlanningEntry, shortlistReducer } from './shortlist'
import { proficiencyData } from './proficiencies'

const now = '2026-10-26T01:00:00.000Z'
const selection = (name = 'Alexandra'): FullBuildSelection => ({ characterName: name, className: 'Wing Soldier', weaponId: weaponData.records[0].id,
  mountId: 'Mounts!A18', battalionId: battalionData.records[0].id, abilities: [{ proficiency: 'Sword', rank: 'D', source: proficiencyData.categories.Sword.characters[name === 'Mu (with growth)' ? 'Mu' : name][0].source }] })
const saved = (name = 'Alexandra') => createLoadout(`${name} plan`, selection(name), [], now, name)
const memory = (initial: string | null = null) => {
  let raw = initial
  const target = { getItem: vi.fn((key: string) => key === LOADOUT_KEY ? raw : null), setItem: vi.fn((key: string, next: string) => { expect(key).toBe(LOADOUT_KEY); raw = next }) }
  return { target, storage: () => target, raw: () => raw, replace: (next: string) => { raw = next } }
}

describe('full loadout model and storage', () => {
  it.each(['Alexandra', 'Sofia', 'Mu', 'Mu (with growth)'])('round-trips %s through a separate versioned collection with exact source identities', name => {
    const store = memory(), loadout = saved(name), snapshot = writeLoadouts(readLoadouts(store.storage), [loadout], store.storage)
    expect(readLoadouts(store.storage)).toEqual(snapshot); expect(snapshot.loadouts).toEqual([loadout]); expect(LOADOUT_KEY).not.toBe(PRESET_KEY)
    const result = resolveLoadout(loadout); expect(result.character.name).toBe(name); expect(result.selectedClass.name).toBe('Wing Soldier')
    expect(abilityReferences(result.entries)).toEqual(loadout.abilities); expect(result.entries[0].characterName).toBe(name)
    if (name.startsWith('Mu')) expect(result.entries[0].learnsetCharacter).toBe('Mu')
  })
  it('saves meaningful empty equipment/ability plans and snapshots arrays without retaining caller aliases', () => {
    const source = selection(), loadout = createLoadout('  Empty  ', { ...source, weaponId: null, mountId: null, battalionId: null, abilities: [] }, [], now, 'empty')
    expect(loadout.name).toBe('Empty'); expect(resolveLoadout(loadout).entries).toEqual([])
    const full = createLoadout('Full', source, [], now, 'full'); source.abilities[0].rank = 'S+'
    expect(full.abilities[0].rank).toBe('D')
  })
  it('retains order, plus ranks and distinct source paths without storing copied game effects or names', () => {
    const first = resolvePlanningEntry('Alexandra', 'Sword', 'S+', "'Sword'!G2")!, second = resolvePlanningEntry('Alexandra', 'Flying', 'C+', "'Flying'!C2")!
    const refs = abilityReferences([second, first]); const data = createLoadout('Ordered', { ...selection(), abilities: refs }, [], now, 'order')
    expect(resolveLoadout(data).entries.map(item => item.id)).toEqual([second.id, first.id])
    expect(JSON.stringify(data)).not.toMatch(/Swordfaire|Flitting Flier|description|growths/)
    expect(data.abilities.map(item => item.rank)).toEqual(['C+', 'S+'])
  })
  it.each(['characterName', 'className', 'weaponId', 'mountId', 'battalionId'] as const)('retains stale %s data but blocks complete resolution', key => {
    const data = { ...saved(), [key]: 'Missing source' }
    const payload = { schemaVersion: 1, loadouts: [data] }; expect(validateLoadoutPayload(payload)).toBe(payload)
    expect(loadoutIssue(data)).not.toBeNull(); expect(() => resolveLoadout(data)).toThrow()
  })
  it('retains a stale ability source for recovery while blocking loading without substitution', () => {
    const data = { ...saved(), abilities: [{ proficiency: 'Sword' as const, rank: 'D', source: "'Sword'!ZZ999" }] }
    expect(validateLoadoutPayload({ schemaVersion: 1, loadouts: [data] }).loadouts[0]).toBe(data)
    expect(() => resolveLoadout(data)).toThrow('No part of this loadout was loaded')
  })
  it.each([
    (x: Record<string, unknown>) => { x.schemaVersion = 2 },
    (x: Record<string, unknown>) => { x.extra = true },
    (x: Record<string, unknown>) => { x.weaponId = undefined },
    (x: Record<string, unknown>) => { x.mountId = '' },
    (x: Record<string, unknown>) => { x.createdAt = 'yesterday' },
    (x: Record<string, unknown>) => { x.updatedAt = '2020-01-01T00:00:00.000Z' },
    (x: Record<string, unknown>) => { x.name = ' ' },
    (x: Record<string, unknown>) => { x.abilities = [{ proficiency: 'Invented', rank: 'D', source: 'A1' }] },
    (x: Record<string, unknown>) => { x.abilities = Array(9).fill(selection().abilities[0]) },
    (x: Record<string, unknown>) => { x.abilities = [selection().abilities[0], selection().abilities[0]] },
  ])('rejects malformed fields without replacing stored bytes (%#)', mutate => {
    const data = { ...saved() }; mutate(data as unknown as Record<string, unknown>)
    const raw = JSON.stringify({ schemaVersion: 1, loadouts: [data] }), store = memory(raw), snapshot = readLoadouts(store.storage)
    expect(snapshot.error).not.toBeNull(); expect(snapshot.raw).toBe(raw); expect(store.target.setItem).not.toHaveBeenCalled()
    expect(() => writeLoadouts(snapshot, [], store.storage)).toThrow(); expect(store.raw()).toBe(raw)
  })
  it('rejects duplicate collection names/IDs, unknown envelope fields and unsupported versions', () => {
    const one = saved()
    for (const payload of [{ schemaVersion: 2, loadouts: [] }, { schemaVersion: 1, loadouts: [], extra: true }, { schemaVersion: 1, loadouts: [one, { ...one, id: 'other', name: one.name.toUpperCase() }] }, { schemaVersion: 1, loadouts: [one, { ...one, name: 'Other' }] }]) expect(() => validateLoadoutPayload(payload)).toThrow()
  })
  it('is read-only on malformed JSON, denied reads and quota failures', () => {
    const store = memory('{bad'), snapshot = readLoadouts(store.storage); expect(snapshot.error).not.toBeNull(); expect(store.target.setItem).not.toHaveBeenCalled()
    expect(readLoadouts(() => { throw new Error('Denied') }).error).toContain('Denied')
    const full = memory(); const before = readLoadouts(full.storage); full.target.setItem.mockImplementation(() => { throw new Error('Quota exceeded') })
    expect(() => writeLoadouts(before, [saved()], full.storage)).toThrow('Quota exceeded'); expect(full.raw()).toBeNull()
  })
  it('blocks concurrent-tab replacement until explicit re-read', () => {
    const store = memory(), snapshot = readLoadouts(store.storage), external = JSON.stringify({ schemaVersion: 1, loadouts: [saved()] })
    store.replace(external); expect(() => writeLoadouts(snapshot, [], store.storage)).toThrow('another tab'); expect(store.raw()).toBe(external)
    expect(writeLoadouts(readLoadouts(store.storage), [], store.storage).loadouts).toEqual([])
  })
  it('restores canonical source entries only for the target profile and rejects invalid batches atomically', () => {
    const other = resolvePlanningEntry('Sofia', 'Sword', 'D', proficiencyData.categories.Sword.characters.Sofia[0].source)!
    const before = { byCharacter: { Sofia: [other] } }, refs = selection().abilities
    const result = shortlistReducer(before, { type: 'restore', characterName: 'Alexandra', references: refs })
    expect(result.byCharacter.Sofia).toBe(before.byCharacter.Sofia); expect(abilityReferences(result.byCharacter.Alexandra)).toEqual(refs)
    for (const references of [[...refs, ...refs], [{ ...refs[0], source: 'bad' }], Array(9).fill(refs[0])]) {
      const failed = shortlistReducer(result, { type: 'restore', characterName: 'Alexandra', references }); expect(failed.byCharacter).toBe(result.byCharacter); expect(failed.feedback?.error).toBe(true)
    }
    expect(shortlistReducer(result, { type: 'restore', characterName: 'Invented', references: [] }).byCharacter).toBe(result.byCharacter)
  })
})
