// This module receives already-formatted text; Copy and Download share the caller's exact string.
function textExportFilename(profileName: string, suffix: 'ability-shortlist' | 'main-build'): string {
  let name = Array.from(profileName.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')).slice(0, 80).join('').replace(/-+$/, '') || 'character'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `character-${name}`
  return `${name}-${suffix}.txt`
}

export const shortlistFilename = (profileName: string): string => textExportFilename(profileName, 'ability-shortlist')
export const mainBuildFilename = (profileName: string): string => textExportFilename(profileName, 'main-build')

export function downloadShortlistText(text: string, filename: string, mimeType: 'text/plain;charset=utf-8' | 'application/json;charset=utf-8' = 'text/plain;charset=utf-8'): void {
  if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') throw new Error('Browser downloads unavailable')
  const anchor = document.createElement('a')
  if (!('download' in anchor)) throw new Error('Browser downloads unavailable')
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const revoke = URL.revokeObjectURL.bind(URL, url)
  let started = false
  try {
    anchor.href = url
    anchor.download = filename
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    started = true
  } finally {
    anchor.remove()
    // Give the browser time to consume the URL; failed starts release it immediately.
    if (started) window.setTimeout(revoke, 1000)
    else revoke()
  }
}
