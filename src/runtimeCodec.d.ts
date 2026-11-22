export interface RuntimePackedData { version: 2; strings: string[]; schemas: string[][]; root: unknown; sourceJsonSha256?: string }
/** Lossless JSON structure/string encoding; rejects unsupported non-JSON values. */
export function packRuntimeData(value: unknown): RuntimePackedData
/** Decode only supported tagged structures; invalid references fail explicitly. */
export function unpackRuntimeData(payload: unknown): unknown
