import type { RuntimePackedData } from './runtimeCodec.js'
export interface RuntimePart { version: 1; name: string; sourceJsonSha256: string; payload: RuntimePackedData }
export function createRuntimeParts(snapshot: unknown, sourceJsonSha256: string): RuntimePart[]
export function assembleRuntimeParts(parts: unknown): unknown
