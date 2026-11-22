import AbilityEffect from './AbilityEffect'
import { useEffect, useRef, useState } from 'react'
import { growthData, PROFICIENCY_NAMES } from './growths'
import { ABILITY_DESCRIPTION_LABELS, resolveAbilityInformation } from './abilityInfo'
import ShortlistCopy from './ShortlistCopy'
import { LEARNSET_STATES, learnsetIdentity } from './proficiencies'
import { sourceRangeUrl } from './catalogReferences'
import { PROFICIENCY_HIGHLIGHT_MS, resolveShortlistTarget, type ProficiencyNavigationError, type ShortlistReturnRequest } from './proficiencyNavigation'
import { learnsetSourceLink, planningRequirements, PLANNING_SLOTS, type PlanningEntry, type ShortlistAction, type PlanningFeedback } from './shortlist'

export default function AbilityPlanningShortlist({ characterName, entries, feedback, onAction, onNavigate, navigationError, returnNavigation, panelRequest, onBackToBrowser, initialOpen = false }: {
  initialOpen?: boolean; panelRequest?: {characterName: string; sequence: number}; onBackToBrowser?: () => void;
  characterName: string; entries: PlanningEntry[]; feedback?: PlanningFeedback; onAction: (action: ShortlistAction) => void
  onNavigate?: (id: string) => void; navigationError?: ProficiencyNavigationError; returnNavigation?: ShortlistReturnRequest
}) {
  const [open, setOpen] = useState(initialOpen)
  const [hasOpened, setHasOpened] = useState(initialOpen)
  const [clearTarget, setClearTarget] = useState<string | null>(null)
  const clearButton = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnRef = useRef<HTMLLIElement>(null)
  const focusedPanelRequest = useRef<number | null>(null)
  const handledReturn = useRef<number | null>(null)
  const focusedReturn = useRef<number | null>(null)
  const [returned, setReturned] = useState<{ id?: string; sequence: number; characterName: string; message: string; error: boolean } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  useEffect(() => {
    setReturned(null)
    if (!returnNavigation || handledReturn.current === returnNavigation.sequence) return
    handledReturn.current = returnNavigation.sequence
    if (returnNavigation.characterName !== characterName) return
    setOpen(true); setHasOpened(true); setClearTarget(null)
    const result = resolveShortlistTarget(characterName, entries, returnNavigation.id)
    const target = !returnNavigation.panelOnly && 'target' in result ? result.target : undefined
    setReturned({ id: target?.id, sequence: returnNavigation.sequence, characterName,
      message: target ? `Returned to ${target.entry.text} · ${target.proficiency} ${target.entry.rank}.`
        : returnNavigation.panelOnly ? `Opened ${characterName}’s shortlist panel; no entry was restored.`
        : 'The original shortlist entry is no longer available. No entry was restored.', error: !target && !returnNavigation.panelOnly })
  }, [returnNavigation, characterName])
  useEffect(() => {
    setHighlight(returned?.id ?? null)
    if (!returned?.id) return
    const timer = window.setTimeout(() => setHighlight(null), PROFICIENCY_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [returned])
  useEffect(() => {
    if (!returned || returned.characterName !== characterName || !open || !hasOpened || focusedReturn.current === returned.sequence) return
    const destination = returned.id ? returnRef.current : headingRef.current
    if (!destination) return
    destination.focus({ preventScroll: true })
    destination.scrollIntoView?.({ behavior: 'instant', block: returned.id ? 'center' : 'start' })
    focusedReturn.current = returned.sequence
  }, [returned, open, hasOpened, characterName])
  useEffect(() => {
    if (!panelRequest || panelRequest.characterName !== characterName) return
    setOpen(true); setHasOpened(true); setClearTarget(null)
  }, [panelRequest, characterName])
  useEffect(() => {
    if (!panelRequest || panelRequest.characterName !== characterName || !open || !hasOpened || focusedPanelRequest.current === panelRequest.sequence) return
    headingRef.current?.focus({preventScroll: true})
    headingRef.current?.scrollIntoView?.({behavior: 'instant', block: 'start'})
    focusedPanelRequest.current = panelRequest.sequence
  }, [panelRequest, characterName, open, hasOpened])
  useEffect(() => setClearTarget(null), [characterName])
  const requirements = planningRequirements(entries)
  const visibleFeedback = feedback?.characterName === characterName && feedback.origin === 'shortlist' ? feedback : undefined
  const stopClearing = () => { setClearTarget(null); clearButton.current?.focus() }
  return <details className="progression-panel shortlist-panel" open={open} onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setHasOpened(true) }}>
    <summary><span>Ability Planning Shortlist</span><span>{characterName} · {entries.length} / {PLANNING_SLOTS} planning slots <span aria-hidden="true">＋</span></span></summary>
    {hasOpened && <section aria-label="Ability planning shortlist">
      <div className="character-details-heading"><div><span className="eyebrow">Session planning</span><h2 ref={headingRef} tabIndex={-1} className="shortlist-heading">{characterName} · Ability plans</h2></div></div>
      {onBackToBrowser && <div className="comparison-actions"><button type="button" onClick={onBackToBrowser}>Back to rank browser</button></div>}
      <p className="details-context">Arrange up to eight abilities for this plan. Save a full loadout to keep these choices after refreshing.</p>
      <details className="reader-disclosure"><summary>About ability planning</summary><p className="details-key">These are planning slots; in-game equip limits and legality are not evaluated. Changing class keeps your plans; class allowed types do not establish equip legality. Ability effects are not added to growth calculations.</p>{learnsetIdentity(characterName) !== characterName && <p className="mapping-note">Mu (with growth) uses Mu’s source learnset through the existing explicit mapping. Each profile has its own planning shortlist and growths.</p>}</details>
      <div className="shortlist-overview"><p><strong>{entries.length} / {PLANNING_SLOTS}</strong> planning slots filled{entries.length === PLANNING_SLOTS ? ' · Full — remove an entry to free a slot.' : ''}</p><button ref={clearButton} type="button" className="shortlist-button" disabled={entries.length === 0} onClick={() => setClearTarget(characterName)}>Clear shortlist</button></div>
      {entries.length === 0 && <p className="empty-state">No abilities planned yet. Pick one in the rank browser above to fill a slot.</p>}
      <ShortlistCopy key={characterName} profile={{ id: characterName, displayName: characterName }} entries={entries} source={growthData.metadata} />
      {clearTarget === characterName && <div className="shortlist-confirmation" role="group" aria-label={`Clear ${characterName} ability shortlist`}><p>Clear all {entries.length} planned entries for {characterName}? Other characters keep their shortlists.</p><div className="comparison-actions"><button autoFocus type="button" onClick={stopClearing}>Cancel</button><button type="button" onClick={() => { onAction({ type: 'clear', characterName }); setClearTarget(null) }}>Confirm clear shortlist</button></div></div>}
      {visibleFeedback && <p className={`shortlist-feedback ${visibleFeedback.error ? 'error' : ''}`} role={visibleFeedback.error ? 'alert' : 'status'}>{visibleFeedback.text}</p>}
      {navigationError?.characterName === characterName && <p className="shortlist-feedback error" role="alert">{navigationError.message}</p>}
      {returned?.characterName === characterName && <p className={`shortlist-feedback ${returned.error ? 'error' : ''}`} role={returned.error ? 'alert' : 'status'}>{returned.message}</p>}
      <details className="reader-disclosure"><summary>Planned proficiency paths</summary><div className="shortlist-requirements" role="group" aria-label="Planned proficiency ranks"><h3 className="shortlist-requirements-title">Recorded proficiency paths</h3>{requirements.length ? requirements.map(requirement => <p className="shortlist-requirement-row" key={requirement.proficiency}><strong>{requirement.proficiency}</strong>{PROFICIENCY_NAMES[requirement.proficiency] !== requirement.proficiency ? ` (${PROFICIENCY_NAMES[requirement.proficiency]})` : ''} · {requirement.count} {requirement.count === 1 ? 'entry' : 'entries'} · ranks {requirement.ranks.join(', ')}</p>) : <p>No proficiency paths selected.</p>}<p className="details-key">Counts summarize selected source paths. Training time, XP costs and optimal order are not inferred.</p></div>
      </details>
      <ol className="shortlist-slots" aria-label={`${characterName} ability planning slots`}>{Array.from({ length: PLANNING_SLOTS }, (_, index) => {
        const planned = entries[index]
        if (!planned) return <li className="shortlist-slot empty" key={`empty-${index}`} aria-label={`Planning slot ${index + 1}: empty`}><span className="eyebrow">Slot {index + 1}</span><p>Open planning slot</p></li>
        const { entry, glossary } = planned
        const information = resolveAbilityInformation({name: entry.text, proficiency: planned.proficiency, fallback: glossary?.description, characterName,rank:entry.rank,source:entry.source})
        const path = `${entry.text} · ${planned.proficiency} ${entry.rank}`
        return <li className={`shortlist-slot${returned?.characterName === characterName && returned.id === planned.id && highlight === planned.id ? ' shortlist-return-target' : ''}`} key={planned.id} data-source-record-id={planned.id} ref={returned?.id === planned.id ? returnRef : undefined} tabIndex={-1} aria-label={`Planning slot ${index + 1}: ${path}`}>
          <span className="eyebrow">Planning slot {index + 1}</span><h3 className="shortlist-name">{entry.text}</h3>
          {returned?.id === planned.id && highlight === planned.id && <p className="shortlist-return-marker">↳ Returned from proficiency source</p>}
          <p className="shortlist-rank">{planned.proficiency}{PROFICIENCY_NAMES[planned.proficiency] !== planned.proficiency ? ` (${PROFICIENCY_NAMES[planned.proficiency]})` : ''} · Required rank <strong>{entry.rank}</strong></p>
          <AbilityEffect className="shortlist-effect" information={information} />
          {information.description && information.hasConflict && <p className="ability-issue">Descriptions differ between references.</p>}
          {onNavigate && <p><button type="button" className="shortlist-button shortlist-navigation-button" aria-label={`View in Proficiency Progression: ${path}`} onClick={() => onNavigate(planned.id)}>View in Proficiency Progression</button></p>}
          <details className="reader-disclosure"><summary className="shortlist-source-summary">Source details · {planned.proficiency} {entry.rank}</summary>{information.descriptionKind && <p className="entry-source">Description basis: {ABILITY_DESCRIPTION_LABELS[information.descriptionKind]}</p>}
            <p className={`learnset-status ${entry.state}`}>{entry.evidence ?? LEARNSET_STATES[entry.state]}</p>
            <a className="entry-source shortlist-source-link" href={learnsetSourceLink(entry)} target="_blank" rel="noreferrer">{entry.source}</a>
            <p className="recorded-text">Character profile: {planned.characterName}. Learnset identity: {planned.learnsetCharacter}.</p><p className="recorded-text">Original unlock text: {entry.text}</p><p className="recorded-text">Matrix text: {entry.matrixText ?? '(blank)'}</p><p className="entry-source">State: {LEARNSET_STATES[entry.state]} · Reliability: {entry.reliability} · Evidence: {entry.evidence}</p>
            {entry.matrixSource && <a className="entry-source shortlist-source-link" href={sourceRangeUrl(entry.matrixSource)} target="_blank" rel="noreferrer">{entry.matrixSource}</a>}{entry.note && <p className="recorded-text">{entry.note}</p>}
            {glossary?.evidence && <p className="entry-source">Glossary effect evidence: {glossary.evidence}</p>}
            {glossary?.note && <p className="details-key recorded-text">{glossary.note}</p>}
            {information.references.map(reference => <p key={reference.url + reference.label}><a className="entry-source" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></p>)}
            {information.alternatives.map((description, index) => <p key={index} className="recorded-text">{description}</p>)}
          </details>
          <div className="shortlist-controls"><button type="button" className="shortlist-button" disabled={index === 0} aria-label={`Move ${path} up`} onClick={() => onAction({ type: 'up', characterName, id: planned.id })}>↑ Up</button><button type="button" className="shortlist-button" disabled={index === entries.length - 1} aria-label={`Move ${path} down`} onClick={() => onAction({ type: 'down', characterName, id: planned.id })}>↓ Down</button><button type="button" className="shortlist-button" aria-label={`Remove ${path} from shortlist`} onClick={() => onAction({ type: 'remove', characterName, id: planned.id })}>Remove</button></div>
        </li>
      })}</ol>
    </section>}
  </details>
}

