import AbilityEffect from './AbilityEffect'
import { useEffect, useRef, useState } from 'react'
import { PROFICIENCIES, PROFICIENCY_NAMES, type CharacterProfile, type ClassProfile, type Proficiency } from './growths'
import { isShortlistable, learnsetSourceLink, planningRecordId, type PlanningEntry, type PlanningFeedback, type ShortlistAction, PLANNING_SLOTS } from './shortlist'
import { explicitlyListed, filterEntries, learnsetIdentity, LEARNSET_STATES, proficiencyData, type RankFilter } from './proficiencies'
import { PROFICIENCY_HIGHLIGHT_MS, resolveShortlistTarget, type ProficiencyRequest } from './proficiencyNavigation'
import {communityEntries,communityGlossary,isCommunitySource} from './community'
import ProficiencySourceComparison from './ProficiencySourceComparison'
import { ABILITY_DESCRIPTION_LABELS, resolveAbilityInformation } from './abilityInfo'
import CombatArtLinks from './CombatArtLinks'

export default function ProficiencyProgression({ character, selectedClass, shortlist = [], planningFeedback, onPlanningAction, navigation, onReturn, onNavigateCombatArt, onViewPlan, browserRequest, initialOpen = false }: { onViewPlan?: () => void; browserRequest?: {characterName: string; sequence: number}; initialOpen?: boolean; character: CharacterProfile; selectedClass: ClassProfile; shortlist?: PlanningEntry[]; planningFeedback?: PlanningFeedback; onPlanningAction?: (action: ShortlistAction) => void; navigation?: ProficiencyRequest; onReturn?: (origin: ProficiencyRequest, panelOnly?: boolean) => string | undefined; onNavigateCombatArt?:(row:number)=>void }) {
  const [open, setOpen] = useState(initialOpen)
  const [proficiency, setProficiency] = useState<Proficiency>('Sword')
  const [filter, setFilter] = useState<RankFilter>('all')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState('')
  const [community,setCommunity] = useState(false)
  const [inspectedRank,setInspectedRank]=useState<{characterName:string;proficiency:Proficiency;rank:string}>()
  const [arrival, setArrival] = useState<{ target: PlanningEntry; sequence: number } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<{ target: PlanningEntry; request: ProficiencyRequest } | null>(null)
  const [returnError, setReturnError] = useState<string | null>(null)
  const handled = useRef<number | null>(null)
  const focused = useRef<number | null>(null)
  const targetRef = useRef<HTMLLIElement>(null)
  const browserHeading = useRef<HTMLHeadingElement>(null)
  const focusedBrowserRequest = useRef<number | null>(null)
  const informationHeading = useRef<HTMLHeadingElement>(null)
  const [inspectionSequence, setInspectionSequence] = useState(0)
  useEffect(() => {
    if (!inspectionSequence || !window.matchMedia?.('(max-width: 780px)').matches) return
    informationHeading.current?.focus({preventScroll: true})
    informationHeading.current?.scrollIntoView?.({behavior: 'instant', block: 'start'})
  }, [inspectionSequence])
  useEffect(() => {
    setArrival(null); setNavigationError(null); setOrigin(null); setReturnError(null)
    if (!navigation || handled.current === navigation.sequence) return
    handled.current = navigation.sequence
    if (navigation.characterName !== character.name) return
    const result = resolveShortlistTarget(character.name, shortlist, navigation.id)
    if ('error' in result) { setOpen(true); setNavigationError(result.error); return }
    setOpen(true); setProficiency(result.target.proficiency); setSelection(result.target.id)
    setCommunity(isCommunitySource(result.target.entry.source))
    setInspectedRank(undefined)
    setArrival({ target: result.target, sequence: navigation.sequence })
    setOrigin({ target: result.target, request: navigation })
  }, [navigation, character.name])
  useEffect(() => {
    setHighlight(arrival?.target.id ?? null)
    if (!arrival) return
    const timer = window.setTimeout(() => setHighlight(null), PROFICIENCY_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [arrival])
  useEffect(() => {
    if (!arrival || arrival.target.characterName !== character.name || arrival.target.proficiency !== proficiency || !open
      || focused.current === arrival.sequence || !targetRef.current) return
    // Instant scrolling also respects reduced motion; focus does not trigger a second automatic scroll.
    targetRef.current.focus({ preventScroll: true })
    targetRef.current.scrollIntoView?.({ behavior: 'instant', block: 'center' })
    focused.current = arrival.sequence
  }, [arrival, proficiency, open, character.name])
  useEffect(() => {
    if (!browserRequest || browserRequest.characterName !== character.name) return
    setOpen(true)
  }, [browserRequest, character.name])
  useEffect(() => {
    if (!open || !browserRequest || browserRequest.characterName !== character.name || focusedBrowserRequest.current === browserRequest.sequence) return
    const destination = browserHeading.current
    if (!destination) return
    destination.focus({preventScroll: true})
    destination.scrollIntoView?.({behavior: 'instant', block: 'start'})
    focusedBrowserRequest.current = browserRequest.sequence
  }, [browserRequest, open, character.name])
  const clearArrival = () => { setArrival(null); setNavigationError(null) }
  const activeOrigin = origin?.request.characterName === character.name ? origin : undefined
  const originResult = activeOrigin ? resolveShortlistTarget(character.name, shortlist, activeOrigin.target.id) : undefined
  const originError = returnError ?? (originResult && 'error' in originResult ? originResult.error : undefined)
  const goBack = (panelOnly = false) => {
    if (!activeOrigin || !onReturn) return
    const error = onReturn(activeOrigin.request, panelOnly)
    if (error) setReturnError(error)
    else { setOrigin(null); setReturnError(null) }
  }
  const identity = learnsetIdentity(character.name)
  const category = proficiencyData.categories[proficiency]
  const entries = community ? communityEntries(proficiency,identity) : category.characters[identity] ?? []
  const filtered = filterEntries(entries, filter, search)
  const target = arrival?.target.characterName === character.name && arrival.target.proficiency === proficiency ? arrival.target : undefined
  const key = (value: typeof entries[number]) => planningRecordId(character.name, proficiency, value)
  const visible = target ? entries.filter(value => filtered.includes(value) || key(value) === target.id) : filtered
  const outsideFilters = target && !filtered.some(value => key(value) === target.id)
  const selected = visible.find(value => key(value) === selection) ?? visible.find(value => value.state === 'documented' || value.state === 'compound')
  const comparisonRank=inspectedRank?.characterName===character.name&&inspectedRank.proficiency===proficiency?inspectedRank.rank:selected?.rank
  const glossary = selected?.text ? community ? communityGlossary(selected.text) : proficiencyData.glossary[selected.text.trim()] : undefined
  const information = resolveAbilityInformation({name: selected?.text ?? null, proficiency, characterName: character.name, rank:selected?.rank, source:selected?.source})
  const experience = selectedClass.details.proficiencyExperience[proficiency]
  const listed = explicitlyListed(selectedClass, proficiency)
  const label = PROFICIENCY_NAMES[proficiency]

  return <details className="progression-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span>Proficiency Progression</span><span>{character.name} · 12 categories <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Proficiency progression browser">
      <p className="details-context">Choose a proficiency and select an ability to read its effect. Add abilities to your plan below.</p>
      <details className="reader-disclosure learnset-options"><summary>Learnset source & profile notes</summary>
      <div className="selection-field community-source-selector"><label htmlFor="learnset-source">Learnset source</label><select id="learnset-source" value={community?'community':'corrected'} onChange={event=>{clearArrival();setOrigin(null);setSelection('');setInspectedRank(undefined);setCommunity(event.target.value==='community')}}><option value="corrected">Corrected original workbook</option><option value="community">Additional community sheet · expanded ranks</option></select></div>
      {community&&<p className="class-source-warning">Additional community snapshot, kept separate from the corrected workbook. Entries may disagree. Choosing this source does not replace old saves or calculations. Source-specific references remain distinct, even for equal ability names.</p>}
      {identity !== character.name && <p className="mapping-note">Mu (with growth) uses Mu’s learnset by explicit profile mapping. The workbook has no separate alternate-state learnset. Personal growths remain separate.</p>}
      <details className="reader-disclosure"><summary>All rank source records</summary><div className="rank-source-records">{entries.map(value => <div key={key(value)}><strong>{value.rank} · {value.text ?? 'No recorded unlock'}</strong><p className="entry-source">{LEARNSET_STATES[value.state]} · {value.evidence}</p><a className="entry-source shortlist-source-link" href={learnsetSourceLink(value)} target="_blank" rel="noreferrer">{value.source}</a></div>)}</div></details>
      </details>
      {onViewPlan && <div className="ability-plan-toolbar"><p role="status"><strong>{shortlist.length} / {PLANNING_SLOTS}</strong> planned</p><button type="button" className="shortlist-button" onClick={onViewPlan}>View ability plan</button></div>}
      <div className="proficiency-buttons" role="group" aria-label="Proficiency categories">
        {PROFICIENCIES.map(value => <button key={value} type="button" aria-pressed={proficiency === value}
          onClick={() => { clearArrival(); setProficiency(value) }}>{PROFICIENCY_NAMES[value]}</button>)}
      </div>
      <details className="reader-disclosure progression-context" aria-label="Selected class proficiency context"><summary>Class training context · {selectedClass.name}</summary>
        <div><span className="eyebrow">Class context</span><h3>{selectedClass.name} · {label}</h3></div>
        <p>{listed ? `${label} appears in the class’s allowed-types list; retain any qualifications below.` : `${label} support is not established by the class’s allowed-types text.`}</p>
        <p className="recorded-text">Allowed types: {selectedClass.details.allowedWeaponsAndSkills.text ?? 'Unknown / unrecorded'}</p>
        <p className="entry-source">{selectedClass.details.allowedWeaponsAndSkills.source} · Unverified</p>
        <p>Proficiency XP: {experience.value === null ? 'Blank / unlisted' : `${experience.value > 0 ? '+' : ''}${experience.value} bonus XP`} <span className="entry-source">({experience.source})</span></p>
        <p className="details-key">XP is separate context. A blank does not establish prohibited equipment. Unlocks below are never suppressed by class selection; equip legality is not evaluated.</p>
        {selectedClass.name === 'Dancer' && <p className="class-source-warning">Source conflict: Dancer lists Bow in allowed types (Classes!L22), but Bow XP is blank (P22) and Axe XP is +2 (O22). No resolution is assumed.</p>}
      </details>
      <div className="progression-tools" role="group" aria-label="Proficiency filters">
        <div><label htmlFor="rank-filter">Rank filter</label><select id="rank-filter" value={filter} onChange={event => { clearArrival(); setFilter(event.target.value as RankFilter) }}>
          <option value="all">All ranks</option><option value="documented">Documented unlocks only</option>
          <option value="unresolved">Unknown or unresolved entries only</option>
        </select></div>
        <div><label htmlFor="ability-search">Search ability names</label><input id="ability-search" type="search" value={search}
          placeholder="Find an ability…" onChange={event => { clearArrival(); setSearch(event.target.value) }} /></div>
      </div>
      {navigationError && <p className="shortlist-feedback error" role="alert">{navigationError}</p>}
      {target && <div className="proficiency-arrival"><p role="status">Navigation target: {target.entry.text} · {label} {target.entry.rank} · {target.entry.source}. {outsideFilters ? 'Temporarily showing this source record outside your filters. Search and rank filters are unchanged.' : 'Search and rank filters are unchanged.'}</p><button type="button" className="shortlist-button" onClick={clearArrival}>Return to filtered results</button></div>}
      {activeOrigin && onReturn && <div className="proficiency-return-context" role="group" aria-label="Shortlist navigation origin"><p>From shortlist: {activeOrigin.target.entry.text} · {activeOrigin.target.proficiency} {activeOrigin.target.entry.rank} · {activeOrigin.target.entry.source}</p>{originError ? <><p role="alert">{originError}</p><button type="button" className="shortlist-button" onClick={() => goBack(true)}>Open Shortlist Panel</button></> : <button type="button" className="shortlist-button" onClick={() => goBack()}>Return to Shortlist</button>}</div>}
      {planningFeedback?.characterName === character.name && planningFeedback.origin === 'progression' && <p className={`shortlist-feedback ${planningFeedback.error ? 'error' : ''}`} role={planningFeedback.error ? 'alert' : 'status'}>{planningFeedback.text}</p>}
      <div className="progression-title"><h2 ref={browserHeading} tabIndex={-1} className="rank-browser-heading">{label} — {character.name}</h2><span>{visible.length} / {entries.length} rank entries</span></div>
      <div className="progression-layout">
        <ol className="rank-list" aria-label={`${character.name} ${label} rank progression`}>
          {visible.map(value => <li key={key(value)} data-source-record-id={key(value)} ref={key(value) === target?.id ? targetRef : undefined} tabIndex={-1} aria-label={`${character.name} · ${label} ${value.rank} · ${value.text ?? 'No recorded unlock'}`} className={`rank-entry ${value.state}${key(value) === target?.id && highlight === target.id ? ' proficiency-navigation-target' : ''}`}>
            <span className="rank-marker">{value.rank}</span>
            <div>{['documented', 'compound'].includes(value.state)
              ? <button type="button" className="unlock-button" aria-pressed={selected === value}
                onClick={() => { setSelection(key(value)); setInspectionSequence(current => current + 1); setInspectedRank(undefined); if (key(value) !== activeOrigin?.target.id) { setOrigin(null); setReturnError(null) } }}>{value.text}</button>
              : <p className="unlock-text">{value.state === 'unknown' ? 'No recorded unlock' : value.text}</p>}
              {key(value) === target?.id && highlight === target.id && <span className="proficiency-target-marker">↳ Shortlist navigation target</span>}
              {isShortlistable(value) && onPlanningAction && <div className="rank-planning-action">{shortlist.some(entry => entry.id === planningRecordId(character.name, proficiency, value))
                ? <><span className="shortlist-selected">Shortlisted</span><button type="button" className="shortlist-button" aria-label={`Remove ${value.text} · ${proficiency} ${value.rank} from shortlist`} onClick={() => onPlanningAction({ type: 'remove', characterName: character.name, id: planningRecordId(character.name, proficiency, value), origin: 'progression' })}>Remove from shortlist</button></>
                : <button type="button" className="shortlist-button" aria-label={`Add to shortlist: ${value.text} · ${proficiency} ${value.rank}`} onClick={() => onPlanningAction({ type: 'add', characterName: character.name, proficiency, rank: value.rank, source: value.source })}>Add to shortlist</button>}</div>}
            </div>
          </li>)}
        </ol>
        {visible.length === 0 && <p className="empty-state">No entries match these filters. Try All ranks or clear the search.</p>}
        <aside className="ability-information" aria-label="Ability information" aria-live="polite">
          <span className="eyebrow">Selected ability</span>
          {selected ? <>
            <h3 className="ability-name" ref={informationHeading} tabIndex={-1}>{selected.text ?? 'Unknown entry'}</h3>
            <p className="ability-rank">{label} · Required rank <strong>{selected.rank}</strong></p>
            <AbilityEffect information={information} />
            {isShortlistable(selected) && onPlanningAction && <div className="inspector-planning-action">
              {shortlist.some(entry => entry.id === key(selected)) ? <button type="button" className="shortlist-button" aria-label={`Remove selected ability from shortlist: ${selected.text} · ${proficiency} ${selected.rank}`} onClick={() => onPlanningAction({type: 'remove', characterName: character.name, id: key(selected), origin: 'progression'})}>Remove from shortlist</button>
                : <button type="button" className="shortlist-button primary-planning-action" disabled={shortlist.length >= PLANNING_SLOTS} aria-label={`Add selected ability to shortlist: ${selected.text} · ${proficiency} ${selected.rank}`} onClick={() => onPlanningAction({type: 'add', characterName: character.name, proficiency, rank: selected.rank, source: selected.source})}>Add to shortlist</button>}
              <span>{shortlist.length} / {PLANNING_SLOTS} planned{shortlist.length >= PLANNING_SLOTS ? ' · Plan full; remove an ability first.' : ''}</span>
            </div>}
            {information.description && information.hasConflict && <p className="ability-issue">Descriptions differ between references. See sources & details.</p>}
            {selected.state === 'compound' && <p className="ability-issue">This entry lists multiple unlocks or conditions.</p>}
            <details className="reader-disclosure ability-research"><summary>Sources & details</summary>
              {information.descriptionKind && <p className="entry-source">Description basis: {ABILITY_DESCRIPTION_LABELS[information.descriptionKind]}</p>}
              <p className="learnset-status">{LEARNSET_STATES[selected.state]}</p>
              <p className="entry-source">Learnset evidence: {selected.evidence}</p>
              <p className="entry-source">Source: <a href={learnsetSourceLink(selected)} target="_blank" rel="noreferrer">{selected.source}</a>{selected.matrixSource && ` · ${selected.matrixSource}`}</p>
              {glossary && <><p className="entry-source">Glossary: {glossary.source} · {glossary.evidence}</p>{glossary.note && <p className="recorded-explanation">{glossary.note}</p>}</>}
              {selected.note && <p className="recorded-explanation">{selected.note}</p>}
              {information.references.map(reference => <p key={reference.url + reference.label}><a className="entry-source" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></p>)}
              {information.alternatives.map((description, index) => <p className="recorded-text" key={index}>{description}</p>)}
              <CombatArtLinks proficiency={proficiency} text={selected.text} onNavigate={onNavigateCombatArt}/>
              <label htmlFor="compare-source-rank">Compare rank sources</label><select id="compare-source-rank" value={comparisonRank ?? ''} onChange={event => setInspectedRank(event.target.value ? {characterName: character.name, proficiency, rank: event.target.value} : undefined)}><option value="">Choose a rank to compare…</option>{entries.map(entry => <option key={entry.rank} value={entry.rank}>{entry.rank}</option>)}</select>
              {comparisonRank && <ProficiencySourceComparison characterName={character.name} proficiency={proficiency} rank={comparisonRank}/>}
            </details>
          </> : <p className="details-context">Select an ability to see its effect and required rank.</p>}
          {!selected && <details className="reader-disclosure"><summary>Compare rank sources</summary><label htmlFor="compare-source-rank">Compare rank sources</label><select id="compare-source-rank" value={comparisonRank ?? ''} onChange={event => setInspectedRank(event.target.value ? {characterName: character.name, proficiency, rank: event.target.value} : undefined)}><option value="">Choose a rank to compare…</option>{entries.map(entry => <option key={entry.rank} value={entry.rank}>{entry.rank}</option>)}</select>{comparisonRank && <ProficiencySourceComparison characterName={character.name} proficiency={proficiency} rank={comparisonRank}/>}</details>}
        </aside>
      </div>
    </section>
  </details>
}
