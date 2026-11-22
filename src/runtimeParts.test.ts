import { describe, expect, it } from 'vitest'
import { assembleRuntimeParts, createRuntimeParts } from './runtimeParts.js'
import { packRuntimeData, unpackRuntimeData } from './runtimeCodec.js'
import original from './data/growths.json'
import reference from './data/runtime/reference.json'
import one from './data/runtime/proficiencies-1.json'
import two from './data/runtime/proficiencies-2.json'
import three from './data/runtime/proficiencies-3.json'

const actual = [reference, one, two, three]
const clone = () => structuredClone(actual)
describe('independently cached runtime data parts', () => {
  it('reassembles the actual source exactly including property order and all uncertainty/source fields', () => {
    expect(assembleRuntimeParts(actual)).toStrictEqual(original)
    expect(JSON.stringify(assembleRuntimeParts(actual))).toBe(JSON.stringify(original))
    expect(actual).toEqual(createRuntimeParts(original, reference.sourceJsonSha256))
  })
  it('is deterministic, does not mutate any input, and retains the category order after serializing parts', () => {
    const before = JSON.stringify([original, actual]), first = createRuntimeParts(original, reference.sourceJsonSha256)
    expect(first).toEqual(createRuntimeParts(original, reference.sourceJsonSha256))
    expect(assembleRuntimeParts(JSON.parse(JSON.stringify(first)))).toStrictEqual(original)
    expect(JSON.stringify([original, actual])).toBe(before)
  })
  it('reconstructs out-of-order category source keys without sorting or renaming them', () => {
    const changed = { ...original, proficiencies: { ...original.proficiencies, categories: Object.fromEntries(Object.entries(original.proficiencies.categories).reverse()) } }
    expect(JSON.stringify(assembleRuntimeParts(createRuntimeParts(changed, reference.sourceJsonSha256)))).toBe(JSON.stringify(changed))
  })
  it.each([null, [], {}, [reference], [reference, one, two], [one, reference, two, three], [reference, one, two, three, three]])('rejects missing, extra or reordered parts %#', value => {
    expect(() => assembleRuntimeParts(value)).toThrow()
  })
  it.each(['hash', 'version', 'name'] as const)('rejects inconsistent %s metadata instead of mixing snapshots', field => {
    const parts = clone()
    if (field === 'hash') parts[2].sourceJsonSha256 = '0'.repeat(64)
    else if (field === 'version') parts[2].version = 99
    else parts[2].name = 'reference'
    expect(() => assembleRuntimeParts(parts)).toThrow()
  })
  it('rejects duplicate/unknown categories and partial groups without filling missing data', () => {
    const parts = clone(), group = unpackRuntimeData(parts[1].payload) as Record<string, unknown>, keys = Object.keys(group)
    parts[2].payload = packRuntimeData(group) as typeof parts[2]['payload']; expect(() => assembleRuntimeParts(parts)).toThrow('Duplicate')
    parts[1].payload = packRuntimeData({ ...group, Unknown: group[keys[0]] }) as typeof parts[1]['payload']; expect(() => assembleRuntimeParts(parts)).toThrow()
    delete group[keys[0]]; parts[1].payload = packRuntimeData(group) as typeof parts[1]['payload']; expect(() => assembleRuntimeParts(parts)).toThrow()
  })
  it.each([null, {}, { proficiencies: { categories: {} } }])('refuses unsupported input shapes before generating artifacts %#', value => {
    expect(() => createRuntimeParts(value, reference.sourceJsonSha256)).toThrow()
  })
  it('rejects a nonempty/non-null base skeleton and invalid source hashes', () => {
    const parts = clone(), base = unpackRuntimeData(parts[0].payload) as { proficiencies: { categories: Record<string, unknown> } }
    base.proficiencies.categories.Sword = {}; parts[0].payload = packRuntimeData(base) as typeof parts[0]['payload']
    expect(() => assembleRuntimeParts(parts)).toThrow('skeleton')
    expect(() => createRuntimeParts(original, 'not-a-hash')).toThrow()
  })
})
