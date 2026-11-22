import { describe, expect, it } from 'vitest'
import { createLoadout, type BuildLoadout } from './loadouts'
import { formatLoadoutBackup, MAX_BACKUP_BYTES, parseLoadoutBackup, previewLoadoutImport } from './loadoutBackupModel'
const one = () => createLoadout("Mu’s α plan", { characterName: 'Mu', className: 'Gladiator', weaponId: null, mountId: null, battalionId: null, abilities: [] }, [], '2026-10-26T01:00:00.000Z', 'one')
describe('loadout JSON backup/restore planning', () => {
  it('round-trips exactly with Unicode and deterministic LF text, including an empty collection', () => {
    const data = [one()]; const text = formatLoadoutBackup(data)
    expect(parseLoadoutBackup(text).loadouts).toEqual(data); expect(formatLoadoutBackup(data)).toBe(text); expect(text.endsWith('\n')).toBe(true)
    expect(parseLoadoutBackup('\uFEFF' + text).loadouts).toEqual(data); expect(parseLoadoutBackup(formatLoadoutBackup([])).loadouts).toEqual([])
  })
  it.each(['{broken', '{}', '{"schemaVersion":2,"loadouts":[]}', '{"schemaVersion":1,"presets":[]}', '{"schemaVersion":1,"loadouts":[{}]}'])('rejects malformed or incompatible %s', text => { expect(() => parseLoadoutBackup(text)).toThrow('not a supported') })
  it('bounds UTF-8 byte size, not just character count', () => { expect(() => parseLoadoutBackup('α'.repeat(MAX_BACKUP_BYTES / 2 + 1))).toThrow('5 MiB') })
  it('previews add-only merging and skips exact matches without mutating either collection', () => {
    const a = one(), b = { ...one(), id: 'two', name: 'Other' }; const existing = [a], incoming = [a, b]
    const result = previewLoadoutImport(existing, incoming); expect(result.additions).toEqual([b]); expect(result.skipped).toEqual([a.name]); expect(result.conflicts).toEqual([])
    expect(existing).toEqual([a]); expect(incoming).toEqual([a, b])
  })
  it('ignores JSON property ordering when identifying an identical saved record', () => {
    const a = one(), reversed = Object.fromEntries(Object.entries(a).reverse()) as unknown as BuildLoadout
    expect(previewLoadoutImport([a], [reversed]).skipped).toEqual([a.name])
  })
  it.each(['id', 'name'] as const)('blocks a conflicting %s without overwriting local records', field => {
    const a = one(), b = { ...one(), id: 'other', name: 'Different' }; b[field] = a[field]
    const preview = previewLoadoutImport([a], [b]); expect(preview.conflicts).toHaveLength(1); expect(preview.additions).toEqual([])
  })
  it('retains well-formed stale references in a backup without granting them loadability', () => {
    const a = { ...one(), weaponId: 'Removed source' }; expect(parseLoadoutBackup(formatLoadoutBackup([a])).loadouts).toEqual([a])
  })
  it('classifies a large mixed collection in source order, retaining exact duplicates and conflicts', () => {
    const base = one(), existing = Array.from({ length: 2000 }, (_, index) => ({ ...base, id: `local-${index}`, name: `Local ${index}` }))
    const identical = existing.slice(500, 600), conflicting = existing.slice(600, 700).map(item => ({ ...item, className: 'Hunter' }))
    const additions = Array.from({ length: 1000 }, (_, index) => ({ ...base, id: `new-${index}`, name: `New ${index}` }))
    const preview = previewLoadoutImport(existing, [...identical, ...conflicting, ...additions])
    expect(preview.skipped).toEqual(identical.map(item => item.name)); expect(preview.conflicts).toHaveLength(100); expect(preview.additions).toEqual(additions)
    expect(existing[600].className).toBe(base.className)
  })
})
