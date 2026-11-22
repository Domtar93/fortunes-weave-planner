import { describe, expect, it } from 'vitest'
import { packRuntimeData, unpackRuntimeData } from './runtimeCodec.js'
import runtime from './runtimeData'
import original from './data/growths.json'
import packed from './data/runtime-growths.json'

const roundTrip = (value: unknown) => unpackRuntimeData(JSON.parse(JSON.stringify(packRuntimeData(value))))
describe('lossless runtime data representation', () => {
  it('reconstructs every actual source field, number, null, evidence label, array order and URL exactly', () => {
    expect(runtime).toStrictEqual(original); expect(JSON.stringify(runtime)).toBe(JSON.stringify(original))
    expect(packed.sourceJsonSha256).toMatch(/^[a-f0-9]{64}$/u)
  })
  it('packs deterministically and round-trips the complete actual snapshot after serialization', () => {
    const first = packRuntimeData(original), second = packRuntimeData(original)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second)); expect(unpackRuntimeData(JSON.parse(JSON.stringify(first)))).toStrictEqual(original)
  })
  it.each([null, false, true, 0, -0, -25, 125.5, '', 'Mu’s α Γ', [], {}, [0, 1, 2, 3, 4], { a: null, b: 0, c: false, d: '', e: [1, [2, 0], [3, 1, 'x']] }])('round-trips legitimate primitive/structure edge %# without interpreting values as tags', value => {
    const result = roundTrip(value); expect(result).toStrictEqual(value); if (Object.is(value, -0)) expect(Object.is(result, -0)).toBe(true)
  })
  it('reuses repeated exact strings and URL prefixes without rewriting suffixes or Unicode', () => {
    const prefix = 'https://docs.google.com/spreadsheets/d/a-long-realistic-identifier-with-many-characters/edit#gid=123&range='
    const values = Array.from({ length: 12 }, (_, i) => ({ source: `${prefix}A${i + 1}%3AB${i + 1}`, status: 'Community-listed / unverified', raw: "α’s unchanged\nC+ / S+" }))
    const encoded = packRuntimeData(values); expect(roundTrip(values)).toStrictEqual(values); expect(encoded.strings).toContain(prefix)
    expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify(values).length)
  })
  it('preserves own __proto__ and constructor keys without polluting any prototype', () => {
    const value = JSON.parse('{"__proto__":{"polluted":true},"constructor":"source value"}'), result = roundTrip(value) as Record<string, unknown>
    expect(result).toStrictEqual(value); expect(Object.hasOwn(result, '__proto__')).toBe(true); expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
  it('does not mutate deeply frozen inputs, and treats shared subobjects as ordinary JSON values', () => {
    const entry = Object.freeze({ name: 'Same source', numeric: -0 }), values = Object.freeze([entry, entry])
    expect(roundTrip(values)).toStrictEqual(values); expect(Object.is((roundTrip(values) as typeof values)[0].numeric, -0)).toBe(true)
  })
  it.each([undefined, NaN, Infinity, -Infinity, BigInt(4), () => 1, new Date(), new Map(), new Set(), new Array(1)])('rejects unsupported non-JSON input %#', value => { expect(() => packRuntimeData(value)).toThrow() })
  it('rejects cyclic input rather than silently dropping or normalizing it', () => {
    const value: { self?: unknown } = {}; value.self = value; expect(() => packRuntimeData(value)).toThrow('Cyclic')
  })
  it.each([
    null, {}, { version: 99, strings: [], schemas: [], root: null },
    { version: 2, strings: [1], schemas: [], root: null }, { version: 2, strings: new Array(1), schemas: [], root: [2, 0] },
    { version: 2, strings: [], schemas: [['a', 'a']], root: [1, 0, 1, 2] }, { version: 2, strings: [], schemas: [new Array(1)], root: [1, 0, 1] },
    { version: 2, strings: [], schemas: [], root: [8] }, { version: 2, strings: [], schemas: [], root: [2, 0] },
    { version: 2, strings: ['x'], schemas: [], root: [2, -1] }, { version: 2, strings: ['x'], schemas: [], root: [2, 0.5] },
    { version: 2, strings: ['x'], schemas: [], root: [3, 0, null] }, { version: 2, strings: ['x'], schemas: [], root: [3, 0] },
    { version: 2, strings: [], schemas: [['a']], root: [1, 0] }, { version: 2, strings: [], schemas: [], root: [1, 999] },
    { version: 2, strings: [], schemas: [], root: [4, 0] }, { version: 2, strings: [], schemas: [], root: undefined },
  ])('fails explicitly on malformed encoded artifact %#', value => { expect(() => unpackRuntimeData(value)).toThrow() })
  it('round-trips 250 seeded mixed trees to catch shape, nesting, order and repeated-text interactions', () => {
    let seed = 14527
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    const tree = (depth: number): unknown => {
      const choice = depth ? Math.floor(random() * 7) : Math.floor(random() * 4)
      if (choice === 0) return null
      if (choice === 1) return random() > 0.5
      if (choice === 2) return Math.round((random() - 0.5) * 4000) / 10
      if (choice === 3) return ['source untouched', 'Unknown', 'α Γ + C+', '', 'https://example.invalid/long-prefix-unchanged?range=A1'][Math.floor(random() * 5)]
      if (choice === 4) return Array.from({ length: Math.floor(random() * 6) }, () => tree(depth - 1))
      return Object.fromEntries(Array.from({ length: Math.floor(random() * 6) }, (_, index) => [`field${index}`, tree(depth - 1)]))
    }
    for (let i = 0; i < 250; i++) { const value = tree(4); expect(roundTrip(value)).toStrictEqual(value) }
  })
})
