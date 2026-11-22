// Local benchmark only: no source rewrites, networking or gameplay normalization.
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { gzipSync } from 'node:zlib'
import { isDeepStrictEqual } from 'node:util'
import { unpackRuntimeData } from '../src/runtimeCodec.js'
import { assembleRuntimeParts } from '../src/runtimeParts.js'

const source = fs.readFileSync(new URL('../src/data/growths.json', import.meta.url), 'utf8')
const compact = JSON.stringify(JSON.parse(source))
const encoded = fs.readFileSync(new URL('../src/data/runtime-growths.json', import.meta.url), 'utf8')
const parts = ['reference', 'proficiencies-1', 'proficiencies-2', 'proficiencies-3'].map(name => fs.readFileSync(new URL(`../src/data/runtime/${name}.json`, import.meta.url), 'utf8'))
if (!isDeepStrictEqual(JSON.parse(source), unpackRuntimeData(JSON.parse(encoded)))) throw new Error('Round trip failed; benchmark stopped.')
if (!isDeepStrictEqual(JSON.parse(source), assembleRuntimeParts(parts.map(text => JSON.parse(text))))) throw new Error('Split round trip failed; benchmark stopped.')
const measure = action => {
  for (let i = 0; i < 20; i++) action()
  const times = []
  for (let i = 0; i < 100; i++) { const start = performance.now(); action(); times.push(performance.now() - start) }
  times.sort((a, b) => a - b)
  return { medianMilliseconds: times[50], p95Milliseconds: times[95], samples: times.length }
}
console.log(JSON.stringify({
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  scope: 'Node parse/decode microbenchmark, not a browser startup or memory claim.',
  exactRoundTrip: true,
  bytes: { sourcePretty: Buffer.byteLength(source), sourceCompact: Buffer.byteLength(compact), runtimeEncoded: Buffer.byteLength(encoded),
    compactGzip: gzipSync(compact).length, encodedGzip: gzipSync(encoded).length,
    runtimeSplit: parts.reduce((sum, text) => sum + Buffer.byteLength(text), 0), splitGzipTotal: parts.reduce((sum, text) => sum + gzipSync(text).length, 0) },
  timings: { sourceParse: measure(() => JSON.parse(compact)), runtimeParseAndDecode: measure(() => unpackRuntimeData(JSON.parse(encoded))),
    splitParseDecodeAndAssemble: measure(() => assembleRuntimeParts(parts.map(text => JSON.parse(text)))) },
}, null, 2))
