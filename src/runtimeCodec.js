// Lossless JSON structure codec. No game rules or source value normalization.
export function packRuntimeData(value) {
  const counts = new Map(), schemas = [], schemaIndexes = new Map(), prefixes = new Map(), ancestors = new WeakSet()
  const count = text => counts.set(text, (counts.get(text) ?? 0) + 1)
  const prefix = text => /^https?:\/\//u.test(text) && text.length > 80 && text.lastIndexOf('=') >= 60 ? text.slice(0, text.lastIndexOf('=') + 1) : undefined
  function inspect(node) {
    if (node && typeof node === 'object') {
      if (ancestors.has(node)) throw new Error('Cyclic values are not JSON data.')
      ancestors.add(node)
    }
    if (typeof node === 'string') { count(node); const p = prefix(node); if (p) prefixes.set(p, (prefixes.get(p) ?? 0) + 1) }
    else if (Array.isArray(node)) { for (const child of node) inspect(child) }
    else if (node && typeof node === 'object') {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(node))) throw new Error('Only plain JSON objects can be packed.')
      const keys = Object.keys(node), signature = JSON.stringify(keys)
      if (!schemaIndexes.has(signature)) { schemaIndexes.set(signature, schemas.length); schemas.push(keys) }
      Object.values(node).forEach(inspect)
    }
    else if (node !== null && typeof node !== 'boolean' && !(typeof node === 'number' && Number.isFinite(node))) throw new Error('Only finite JSON values can be packed.')
    if (node && typeof node === 'object') ancestors.delete(node)
  }
  inspect(value)
  const strings = [...new Set([...[...counts].filter(([text, count]) => text.length >= 8 && count >= 3).map(([text]) => text), ...[...prefixes].filter(([, count]) => count >= 3).map(([text]) => text)])].sort()
  const index = new Map(strings.map((text, i) => [text, i]))
  function encode(node) {
    if (Object.is(node, -0)) return [4]
    if (typeof node === 'string') {
      const reference = index.get(node)
      if (reference !== undefined && node.length > String(reference).length + 4) return [2, reference]
      const p = prefix(node), pIndex = p === undefined ? undefined : index.get(p)
      if (pIndex !== undefined) return [3, pIndex, node.slice(p.length)]
      return node
    }
    if (Array.isArray(node)) return [0, ...node.map(encode)]
    if (node && typeof node === 'object') return [1, schemaIndexes.get(JSON.stringify(Object.keys(node))), ...Object.values(node).map(encode)]
    return node
  }
  return { version: 2, strings, schemas, root: encode(value) }
}

export function unpackRuntimeData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.version !== 2 || !Array.isArray(payload.strings) || !Array.isArray(payload.schemas)) throw new Error('Unsupported runtime data encoding.')
  for (const text of payload.strings) if (typeof text !== 'string') throw new Error('Invalid runtime string dictionary.')
  for (const schema of payload.schemas) {
    if (!Array.isArray(schema) || new Set(schema).size !== schema.length) throw new Error('Invalid runtime object schema.')
    for (const key of schema) if (typeof key !== 'string') throw new Error('Invalid runtime object key.')
  }
  const strings = payload.strings
  const string = index => {
    if (!Number.isInteger(index) || index < 0 || index >= strings.length) throw new Error('Invalid runtime string reference.')
    return strings[index]
  }
  function decode(node) {
    if (!Array.isArray(node)) {
      if (node === null || typeof node === 'string' || typeof node === 'boolean' || typeof node === 'number' && Number.isFinite(node)) return node
      throw new Error('Invalid runtime data value.')
    }
    if (node[0] === 0) return node.slice(1).map(decode)
    if (node[0] === 1) {
      const schema = payload.schemas[node[1]]
      if (!Number.isInteger(node[1]) || !schema || node.length !== schema.length + 2) throw new Error('Invalid runtime object shape.')
      const result = {}
      for (let i = 0; i < schema.length; i++) {
        const key = schema[i], value = decode(node[i + 2])
        if (key === '__proto__') Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true })
        else result[key] = value
      }
      return result
    }
    if (node[0] === 2 && node.length === 2) return string(node[1])
    if (node[0] === 3 && node.length === 3 && typeof node[2] === 'string') return string(node[1]) + node[2]
    if (node[0] === 4 && node.length === 1) return -0
    throw new Error('Invalid runtime structure tag.')
  }
  return decode(payload.root)
}
