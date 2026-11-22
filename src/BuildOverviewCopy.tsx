import { useEffect, useMemo, useRef, useState } from 'react'
import type { MainBuildOverviewData } from './buildOverview'
import { formatBuildOverviewText } from './buildOverviewText'
import { downloadShortlistText, mainBuildFilename } from './shortlistDownload'

export default function BuildOverviewCopy({ data }: { data: MainBuildOverviewData }) {
  const text = useMemo(() => formatBuildOverviewText(data), [data])
  const [feedback, setFeedback] = useState<{ text: string; mode: 'pending' | 'success' | 'fallback'; message: string }>()
  const attempt = useRef(0), mounted = useRef(false), textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { attempt.current++; setFeedback(undefined) }, [text, data.character.name])
  const visible = feedback?.text === text ? feedback : undefined
  useEffect(() => {
    if (visible?.mode !== 'fallback') return
    textarea.current?.focus({ preventScroll: true }); textarea.current?.select()
  }, [visible])
  const copy = async () => {
    const sequence = ++attempt.current
    const show = (mode: 'success' | 'fallback', message: string) => {
      if (mounted.current && attempt.current === sequence) setFeedback({ text, mode, message })
    }
    setFeedback({ text, mode: 'pending', message: 'Copying build overview…' })
    try {
      const clipboard = navigator.clipboard
      if (typeof clipboard?.writeText !== 'function') {
        show('fallback', 'Clipboard API is unavailable. Nothing was copied automatically. Copy the text below manually.')
        return
      }
      await clipboard.writeText(text)
      show('success', `Copied build overview for ${data.character.name}.`)
    } catch {
      show('fallback', 'Clipboard access failed. Nothing was copied automatically. Copy the text below manually.')
    }
  }
  const download = () => {
    attempt.current++
    try {
      downloadShortlistText(text, mainBuildFilename(data.character.name))
      setFeedback({ text, mode: 'success', message: 'Download started.' })
    } catch {
      setFeedback({ text, mode: 'fallback', message: 'The browser could not start the download. Copy the text below manually.' })
    }
  }
  return <div className="shortlist-copy overview-copy" role="group" aria-label="Copy main build overview">
    <div className="shortlist-copy-controls"><button type="button" className="shortlist-button" disabled={visible?.mode === 'pending'} onClick={copy}>Copy Build Overview</button><button type="button" className="shortlist-button" onClick={download}>Download .txt</button></div>
    {visible && <p className={`shortlist-feedback ${visible.mode === 'fallback' ? 'error' : ''}`} role={visible.mode === 'fallback' ? 'alert' : 'status'}>{visible.message}</p>}
    {visible?.mode === 'fallback' && <div className="shortlist-copy-fallback"><label htmlFor="build-overview-copy-text">Build overview text for manual copying</label><textarea ref={textarea} id="build-overview-copy-text" className="shortlist-copy-text" readOnly rows={12} wrap="soft" value={text} /><p className="overview-caveat">Select the text, then use Ctrl+C or your device’s Copy command. Manual copying is not verified by the planner.</p><button type="button" className="shortlist-button" onClick={() => { textarea.current?.focus(); textarea.current?.select() }}>Select build overview text</button></div>}
  </div>
}
