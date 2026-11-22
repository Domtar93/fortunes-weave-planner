import { PROFICIENCIES, type Proficiency } from './growths'
import { validLevel } from './expectedStats'
import { resolveLoadout, type AbilityReference, type FullBuildSelection } from './loadouts'

// Shareable build links (November 22, 2026). The whole build lives in the URL hash only:
// nothing is read from or written to storage, and saved-build schemas are untouched.
// Format: #build=<base64url of JSON {v:1,c,k,l,w,m,b,a:[[proficiency,rank,source]]}>
export const SHARE_PARAM = 'build'
export interface SharedBuild { selection: FullBuildSelection; level: number }

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}
const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

export function encodeSharedBuild({ selection, level }: SharedBuild): string {
  const payload = { v: 1, c: selection.characterName, k: selection.className, l: level,
    w: selection.weaponId, m: selection.mountId, b: selection.battalionId,
    a: selection.abilities.map(reference => [reference.proficiency, reference.rank, reference.source]) }
  return toBase64Url(JSON.stringify(payload))
}

export function shareUrl(build: SharedBuild, location: Pick<Location, 'origin' | 'pathname' | 'search'> = window.location): string {
  return `${location.origin}${location.pathname}${location.search}#${SHARE_PARAM}=${encodeSharedBuild(build)}`
}

/** The encoded value from a location hash, or null when the hash holds no shared build. */
export function sharedValueFromHash(hash: string): string | null {
  const match = /^#?build=([A-Za-z0-9_-]+)$/u.exec(hash.trim())
  return match ? match[1] : null
}

const optionalId = (value: unknown): value is string | null => value === null || (typeof value === 'string' && value.trim() !== '')
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

/** Decodes and fully resolves a shared build. Throws a readable error; never returns partial data. */
export function decodeSharedBuild(value: string): SharedBuild {
  let raw: unknown
  try { raw = JSON.parse(fromBase64Url(value)) } catch { throw new Error('The link is damaged or incomplete.') }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('The link is damaged or incomplete.')
  const data = raw as Record<string, unknown>
  if (data.v !== 1) throw new Error('The link was made by a different version of the planner.')
  if (!text(data.c) || !text(data.k) || !validLevel(data.l) || !optionalId(data.w) || !optionalId(data.m) || !optionalId(data.b) || !Array.isArray(data.a))
    throw new Error('The link is damaged or incomplete.')
  const abilities: AbilityReference[] = data.a.map(item => {
    if (!Array.isArray(item) || item.length !== 3 || !PROFICIENCIES.includes(item[0] as Proficiency) || !text(item[1]) || !text(item[2]))
      throw new Error('The link has a damaged ability entry.')
    return { proficiency: item[0] as Proficiency, rank: item[1], source: item[2] }
  })
  const selection: FullBuildSelection = { characterName: data.c, className: data.k, weaponId: data.w, mountId: data.m, battalionId: data.b, abilities }
  // Same all-or-nothing resolution as loading a saved full build.
  resolveLoadout(selection)
  return { selection, level: data.l }
}
