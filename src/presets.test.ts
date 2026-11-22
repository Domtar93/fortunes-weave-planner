import { describe, expect, it } from 'vitest'
import { calculateBuild } from './comparison'
import { growthData } from './growths'
import { createPreset, PRESET_KEY, readPresets, selectionIssue, validatedName, validatePayload, writePresets, type BuildPreset, type PresetStorage } from './presets'

const main = { characterName: 'Alexandra', className: 'Gladiator' }
const date = '2026-10-18T12:00:00.000Z'
const preset = (name = 'Frontline', selection = main, id = 'id-1') => createPreset(name, selection, [], date, id)
const payload = (presets: BuildPreset[]) => JSON.stringify({ schemaVersion: 1, presets })
function memory(initial?: string) {
  const data = new Map<string, string>([['unrelated-app', 'keep me']])
  if (initial !== undefined) data.set(PRESET_KEY, initial)
  const storage: PresetStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
  return { data, storage: () => storage }
}

describe('versioned local build presets', () => {
  it('saves Alexandra/Gladiator identifiers only and restores the same current growths in a fresh state', () => {
    const store = memory(), entry = preset('  Frontline  ')
    writePresets(readPresets(store.storage), [entry], store.storage)
    const restored = readPresets(store.storage)
    expect(restored.error).toBeNull()
    expect(restored.presets).toEqual([{ schemaVersion: 1, id: 'id-1', name: 'Frontline', ...main, createdAt: date, updatedAt: date }])
    expect(calculateBuild(restored.presets[0]).combined).toEqual(calculateBuild(main).combined)
    expect(calculateBuild(restored.presets[0]).combined.Str).toBe(45)
    const current = { ...growthData, characters: growthData.characters.map(profile => profile.name === 'Alexandra' ? { ...profile, growths: { ...profile.growths, Str: 50 } } : profile) }
    expect(calculateBuild(restored.presets[0], current).combined.Str).toBe(60)
    expect(store.data.get(PRESET_KEY)).not.toMatch(/growths|flat|mount|battalion|source/)
  })

  it('keeps Hunter and Calamity independent through rename, duplicate and delete', () => {
    const store = memory()
    const hunter = preset('Hunter plan', { ...main, className: 'Hunter' })
    const sofia = preset('Sofia plan', { characterName: 'Sofia', className: 'The Calamity' }, 'id-2')
    let state = writePresets(readPresets(store.storage), [hunter, sofia], store.storage)
    const renamed = { ...hunter, name: validatedName('Renamed hunter', state.presets, hunter.id), updatedAt: '2026-10-19T00:00:00.000Z' }
    state = writePresets(state, [renamed, sofia], store.storage)
    expect(state.presets[1]).toEqual(sofia)
    const copy = createPreset('Copy', sofia, state.presets, date, 'copy')
    state = writePresets(state, [...state.presets, copy], store.storage)
    expect(copy.id).not.toBe(sofia.id)
    state = writePresets(state, state.presets.filter(item => item.id !== hunter.id), store.storage)
    expect(readPresets(store.storage).presets).toEqual([sofia, copy])
    expect(store.data.get('unrelated-app')).toBe('keep me')
  })

  it('preserves separate Mu identifiers and current growth profiles after reloading', () => {
    const store = memory()
    const entries = ['Mu', 'Mu (with growth)'].map((characterName, i) => preset(characterName, { characterName, className: 'Commoner / Noble' }, `mu-${i}`))
    writePresets(readPresets(store.storage), entries, store.storage)
    const restored = readPresets(store.storage).presets
    expect(restored.map(item => item.characterName)).toEqual(['Mu', 'Mu (with growth)'])
    expect(restored.map(item => calculateBuild(item).combined.HP)).toEqual([30, 50])
  })

  it('rejects blank and case-insensitive duplicate names while allowing self-renames', () => {
    expect(() => preset('  ')).toThrow('nonempty')
    expect(() => validatedName(' FRONTLINE ', [preset()])).toThrow('already exists')
    expect(validatedName(' FRONTLINE ', [preset()], 'id-1')).toBe('FRONTLINE')
  })

  it('rejects new presets with absent character or class identifiers', () => {
    expect(() => preset('x', { ...main, characterName: 'Absent' })).toThrow('Missing character')
    expect(() => preset('x', { ...main, className: 'Absent' })).toThrow('Missing class')
  })

  it.each(['{broken', '', 'null', '{"schemaVersion":99,"presets":[]}', '{"schemaVersion":1,"presets":null}'])('blocks writes and preserves damaged/unsupported raw data: %s', raw => {
    const store = memory(raw), loaded = readPresets(store.storage)
    expect(loaded.error).toContain('untouched')
    expect(() => writePresets(loaded, [preset()], store.storage)).toThrow('recovery')
    expect(store.data.get(PRESET_KEY)).toBe(raw)
    expect(store.data.get('unrelated-app')).toBe('keep me')
  })

  it('does not silently drop invalid entries from a mixed payload', () => {
    const store = memory(payload([preset(), { ...preset('Other', main, 'id-2'), className: 7 } as unknown as BuildPreset]))
    const before = store.data.get(PRESET_KEY)
    const state = readPresets(store.storage)
    expect(state.error).toContain('Damaged preset')
    expect(state.presets).toEqual([])
    expect(store.data.get(PRESET_KEY)).toBe(before)
  })

  it('retains well-formed missing source references for identification, rename and deletion', () => {
    const lost = { ...preset(), characterName: 'Retired character', className: 'Retired class' }
    const store = memory(payload([lost]))
    const state = readPresets(store.storage)
    expect(state.error).toBeNull()
    expect(state.presets[0]).toEqual(lost)
    expect(selectionIssue(lost)).toContain('Missing character profile: Retired character; Missing class: Retired class')
    expect(() => calculateBuild(lost)).toThrow('Unknown character')
    expect(writePresets(state, [{ ...lost, name: 'Retained history' }], store.storage).presets[0].characterName).toBe('Retired character')
  })

  it.each([
    { id: '' }, { characterName: '' }, { className: null }, { name: '  ' }, { schemaVersion: 2 },
    { createdAt: 'not a date' }, { updatedAt: '2020-01-01T00:00:00.000Z' }, { unexpectedFutureField: true },
  ])('rejects malformed record fields rather than coercing or discarding them: %j', fields => {
    expect(() => validatePayload({ schemaVersion: 1, presets: [{ ...preset(), ...fields }] })).toThrow()
  })

  it('rejects duplicate IDs, duplicate names and unknown top-level fields', () => {
    expect(() => validatePayload({ schemaVersion: 1, presets: [preset(), preset('Other')] })).toThrow('duplicate')
    expect(() => validatePayload({ schemaVersion: 1, presets: [preset(), preset('FRONTLINE', main, 'id-2')] })).toThrow('duplicate')
    expect(() => validatePayload({ schemaVersion: 1, presets: [], mounts: [] })).toThrow('unrecognized')
  })

  it('handles a security exception obtaining or reading localStorage without writing', () => {
    expect(readPresets(() => { throw new DOMException('Access denied', 'SecurityError') }).error).toContain('Access denied')
    expect(readPresets(() => ({ getItem: () => { throw new Error('read denied') }, setItem: () => { throw new Error('must not write') } })).error).toContain('read denied')
  })

  it('handles quota/security write exceptions without changing the snapshot or stored data', () => {
    const store = memory(payload([preset()])), state = readPresets(store.storage)
    for (const kind of ['QuotaExceededError', 'SecurityError']) {
      const failing = () => ({ getItem: store.storage().getItem, setItem: () => { throw new DOMException('Cannot store', kind) } })
      expect(() => writePresets(state, [], failing)).toThrow('Could not save')
      expect(readPresets(store.storage).presets).toEqual([preset()])
      expect(state.presets).toEqual([preset()])
    }
  })

  it('detects another tab changing the dedicated key before saving and permits explicit rereading', () => {
    const store = memory(), stale = readPresets(store.storage)
    store.data.set(PRESET_KEY, payload([preset()]))
    expect(() => writePresets(stale, [], store.storage)).toThrow('another tab')
    const fresh = readPresets(store.storage)
    expect(fresh.presets).toHaveLength(1)
    expect(writePresets(fresh, [], store.storage).presets).toEqual([])
    expect(store.data.get('unrelated-app')).toBe('keep me')
  })
})
