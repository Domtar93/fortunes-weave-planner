import { useEffect, useRef, useState } from 'react'
import { shareUrl, type SharedBuild } from './shareLink'

// "Copy link": puts the current build in a URL. If the clipboard is blocked the link is
// shown in a read-only field so it can be copied by hand. Nothing is saved.
export default function ShareBuildLink({ build }: { build: SharedBuild }) {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; url: string }>({ kind: 'idle' })
  const field = useRef<HTMLInputElement>(null)
  const key = JSON.stringify(build)
  // Any change to the build makes an earlier link out of date.
  useEffect(() => setState({ kind: 'idle' }), [key])
  useEffect(() => { if (state.kind === 'manual') field.current?.select() }, [state])
  const copy = async () => {
    const url = shareUrl(build)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      setState({ kind: 'copied' })
    } catch { setState({ kind: 'manual', url }) }
  }
  return <div className="share-link">
    <button type="button" onClick={copy} aria-describedby="share-link-help">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      Copy share link
    </button>
    <span className="sr-only" id="share-link-help">Copies a link that opens this character, class, level, equipment and ability plan.</span>
    <span className="share-link-status" role="status">{state.kind === 'copied' ? 'Link copied. Anyone who opens it sees this build.' : ''}</span>
    {state.kind === 'manual' && <div className="share-link-manual">
      <label htmlFor="share-link-url">The clipboard is blocked. Copy this link:</label>
      <input id="share-link-url" ref={field} type="text" readOnly value={state.url} onFocus={event => event.currentTarget.select()} />
    </div>}
  </div>
}
