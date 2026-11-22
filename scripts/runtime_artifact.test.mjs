import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { packRuntimeData, unpackRuntimeData } from '../src/runtimeCodec.js'
import { createRuntimeParts, assembleRuntimeParts } from '../src/runtimeParts.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const sourcePath = new URL('../src/data/growths.json', import.meta.url)
const artifactPath = new URL('../src/data/runtime-growths.json', import.meta.url)

test('the published runtime artifact has the exact source-byte hash and every original field', () => {
  const bytes = fs.readFileSync(sourcePath), original = JSON.parse(bytes.toString('utf8'))
  const expected = { ...packRuntimeData(original), sourceJsonSha256: createHash('sha256').update(bytes).digest('hex') }
  assert.equal(fs.readFileSync(artifactPath, 'utf8'), JSON.stringify(expected) + '\n')
  assert.deepStrictEqual(unpackRuntimeData(expected), original)
  const parts = createRuntimeParts(original, expected.sourceJsonSha256)
  for (const part of parts) assert.equal(fs.readFileSync(new URL(`../src/data/runtime/${part.name}.json`, import.meta.url), 'utf8'), JSON.stringify(part) + '\n')
  assert.deepStrictEqual(assembleRuntimeParts(parts), original)
})

test('the build freshness check succeeds without rewriting either data file', () => {
  const files = [sourcePath, artifactPath, ...['reference', 'proficiencies-1', 'proficiencies-2', 'proficiencies-3'].map(name => new URL(`../src/data/runtime/${name}.json`, import.meta.url))]
  const before = files.map(path => ({ bytes: fs.readFileSync(path), time: fs.statSync(path).mtimeMs }))
  const output = execFileSync(process.execPath, ['scripts/pack_runtime_data.mjs', '--check'], { cwd: root, encoding: 'utf8' })
  assert.match(output, /every decoded field matches/u)
  for (const [index, path] of files.entries()) {
    assert.deepStrictEqual(fs.readFileSync(path), before[index].bytes)
    assert.equal(fs.statSync(path).mtimeMs, before[index].time)
  }
})

test('the real CLI blocks stale or missing split artifacts without rewriting data', () => {
  const work = fs.realpathSync(new URL('../work', import.meta.url))
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(work, 'artifact-check-')))
  const relative = path.relative(work, temporary)
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Test cleanup must remain within work/.')
  try {
    const files = ['scripts/pack_runtime_data.mjs', 'src/runtimeCodec.js', 'src/runtimeParts.js', 'src/data/growths.json', 'src/data/runtime-growths.json',
      ...['reference', 'proficiencies-1', 'proficiencies-2', 'proficiencies-3'].map(name => `src/data/runtime/${name}.json`)]
    for (const file of files) { fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true }); fs.copyFileSync(path.join(root, file), path.join(temporary, file)) }
    const target = path.join(temporary, 'src/data/runtime/proficiencies-2.json')
    fs.appendFileSync(target, ' ')
    const run = () => execFileSync(process.execPath, ['scripts/pack_runtime_data.mjs', '--check'], { cwd: temporary, encoding: 'utf8', stdio: 'pipe' })
    assert.throws(run, /artifact is missing or stale/u)
    assert.equal(fs.readFileSync(target, 'utf8').endsWith(' '), true)
    fs.unlinkSync(target); assert.throws(run, /artifact is missing or stale/u)
    assert.deepStrictEqual(fs.readFileSync(path.join(temporary, 'src/data/growths.json')), fs.readFileSync(sourcePath))
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
})
