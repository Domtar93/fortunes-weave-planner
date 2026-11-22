import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { packRuntimeData, unpackRuntimeData } from '../src/runtimeCodec.js'
import { createRuntimeParts, assembleRuntimeParts } from '../src/runtimeParts.js'
const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(root, 'src/data/growths.json'), output = path.join(root, 'src/data/runtime-growths.json')
const bytes = fs.readFileSync(source), data = JSON.parse(bytes.toString('utf8'))
const payload = { ...packRuntimeData(data), sourceJsonSha256: createHash('sha256').update(bytes).digest('hex') }
const text = JSON.stringify(payload) + '\n'
if (!isDeepStrictEqual(unpackRuntimeData(JSON.parse(text)), data)) throw new Error('Runtime data did not round-trip exactly after JSON serialization. No artifact published.')
const parts = createRuntimeParts(data, payload.sourceJsonSha256)
if (!isDeepStrictEqual(assembleRuntimeParts(JSON.parse(JSON.stringify(parts))), data)) throw new Error('Runtime parts did not round-trip exactly. No artifact published.')
const files = [[output, text], ...parts.map(part => [path.join(root, 'src/data/runtime', part.name + '.json'), JSON.stringify(part) + '\n'])]
if (process.argv.includes('--check')) {
  for (const [file, expected] of files) if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected) throw new Error(`Runtime data artifact is missing or stale: ${path.relative(root, file)}. Run pnpm pack:data after importing source data.`)
} else {
  for (const [file, expected] of files) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', expected, 'utf8'); fs.renameSync(file + '.tmp', file) }
}
console.log(`Runtime data ${process.argv.includes('--check') ? 'verified' : 'packed'}: ${bytes.length.toLocaleString('en-US')} source bytes → ${Buffer.byteLength(text).toLocaleString('en-US')} encoded audit bytes / ${files.slice(1).reduce((sum, [, value]) => sum + Buffer.byteLength(value), 0).toLocaleString('en-US')} split runtime bytes; every decoded field matches.`)
