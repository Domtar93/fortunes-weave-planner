import { useEffect, useRef, useState } from 'react'
import type { PlanningEntry } from './shortlist'
import { formatShortlistText, type ShortlistTextProfile, type ShortlistTextSource } from './shortlistText'
import { downloadShortlistText, shortlistFilename } from './shortlistDownload'

export default function ShortlistCopy({ profile, entries, source }: { profile: ShortlistTextProfile; entries: readonly PlanningEntry[]; source: ShortlistTextSource }) {
  const text = formatShortlistText(profile, entries, source)
  const count = entries.filter(entry => entry.characterName === profile.id).length
  const [feedback, setFeedback] = useState<{ text: string; mode: 'pending' | 'success' | 'fallback'; message: string }>()
  const attempt = useRef(0)
  const mounted = useRef(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { attempt.current++; setFeedback(undefined) }, [text, profile.id])
  const visible = feedback?.text === text ? feedback : undefined
  useEffect(() => {
    if (visible?.mode !== 'fallback') return
    textarea.current?.focus({ preventScroll: true }); textarea.current?.select()
  }, [visible])
  const copy = async () => {
    if (count === 0) return
    const sequence = ++attempt.current
    const show = (mode: 'success' | 'fallback', message: string) => {
      if (mounted.current && attempt.current === sequence) setFeedback({ text, mode, message })
    }
    setFeedback({ text, mode: 'pending', message: 'Copying shortlist…' })
    try {
      const clipboard = navigator.clipboard
      if (typeof clipboard?.writeText !== 'function') {
        show('fallback', 'Clipboard API is unavailable. Nothing was copied automatically. Copy the text below manually.')
        return
      }
      await clipboard.writeText(text)
      show('success', `Copied shortlist for ${profile.displayName} (${count} ${count === 1 ? 'entry' : 'entries'}).`)
    } catch {
      show('fallback', 'Clipboard access failed. Nothing was copied automatically. Copy the text below manually.')
    }
  }
  const download = () => {
    if (count === 0) return
    attempt.current++
    try {
      const filename = shortlistFilename(profile.displayName)
      downloadShortlistText(text, filename)
      setFeedback({ text, mode: 'success', message: `Download started: ${filename}. Check your browser’s downloads.` })
    } catch {
      setFeedback({ text, mode: 'fallback', message: 'The browser could not start the download. Copy the text below manually.' })
    }
  }
  return <div className="shortlist-copy" role="group" aria-label="Copy ability shortlist">
    <div className="shortlist-copy-controls"><button type="button" className="shortlist-button" disabled={count === 0 || visible?.mode === 'pending'} onClick={copy}>Copy Shortlist</button><button type="button" className="shortlist-button" disabled={count === 0} onClick={download}>Download .txt</button>{count === 0 && <span className="details-key">Add a planning entry before copying or downloading.</span>}</div>
    {visible && <p className={`shortlist-feedback ${visible.mode === 'fallback' ? 'error' : ''}`} role={visible.mode === 'fallback' ? 'alert' : 'status'}>{visible.message}</p>}
    {visible?.mode === 'fallback' && <div className="shortlist-copy-fallback"><label htmlFor="shortlist-copy-text">Shortlist text for manual copying</label><textarea ref={textarea} id="shortlist-copy-text" className="shortlist-copy-text" readOnly rows={12} wrap="soft" value={text} /><p className="details-key">Select the text, then use Ctrl+C or your device’s Copy command. Manual copying is not verified by the planner.</p><button type="button" className="shortlist-button" onClick={() => { textarea.current?.focus(); textarea.current?.select() }}>Select shortlist text</button></div>}
  </div>
}
