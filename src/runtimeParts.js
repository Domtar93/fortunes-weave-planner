import { packRuntimeData, unpackRuntimeData } from './runtimeCodec.js'

const names = ['reference', 'proficiencies-1', 'proficiencies-2', 'proficiencies-3']
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)

// Build-time partitioning only. Original key order is retained by the base skeleton.
export function createRuntimeParts(snapshot, sourceJsonSha256) {
  const categories = snapshot?.proficiencies?.categories
  if (!object(categories) || Object.keys(categories).length !== 12 || !hash(sourceJsonSha256)) throw new Error('Unsupported runtime source structure or hash.')
  const entries = Object.entries(categories)
  const base = { ...snapshot, proficiencies: { ...snapshot.proficiencies, categories: Object.fromEntries(entries.map(([key]) => [key, null])) } }
  return [base, ...[0, 4, 8].map(start => Object.fromEntries(entries.slice(start, start + 4)))].map((value, index) => ({
    version: 1, name: names[index], sourceJsonSha256, payload: packRuntimeData(value),
  }))
}

export function assembleRuntimeParts(parts) {
  if (!Array.isArray(parts) || parts.length !== names.length) throw new Error('Missing runtime data parts.')
  for (let index = 0; index < names.length; index++) {
    const part = parts[index]
    if (!object(part) || part.version !== 1 || part.name !== names[index] || !hash(part.sourceJsonSha256) || part.sourceJsonSha256 !== parts[0].sourceJsonSha256) throw new Error('Mixed, reordered or unsupported runtime data parts.')
  }
  const base = unpackRuntimeData(parts[0].payload), categories = base?.proficiencies?.categories
  if (!object(base) || !object(categories) || Object.keys(categories).length !== 12 || Object.values(categories).some(value => value !== null)) throw new Error('Invalid runtime category skeleton.')
  const seen = new Set()
  for (const part of parts.slice(1)) {
    const group = unpackRuntimeData(part.payload)
    if (!object(group) || Object.keys(group).length !== 4) throw new Error('Invalid runtime category group.')
    for (const [name, value] of Object.entries(group)) {
      if (!Object.hasOwn(categories, name) || seen.has(name) || !object(value)) throw new Error('Duplicate, missing or unknown runtime category.')
      categories[name] = value; seen.add(name)
    }
  }
  if (seen.size !== 12) throw new Error('Incomplete runtime categories.')
  return base
}
