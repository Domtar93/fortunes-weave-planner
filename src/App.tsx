import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { growthData } from './growths'
import CharacterDetails from './CharacterDetails'
import ClassDetails from './ClassDetails'
import AbilityPlanningShortlist from './AbilityPlanningShortlist'
import { shortlistReducer } from './shortlist'
import { resolveShortlistTarget, type ProficiencyRequest, type ProficiencyNavigationError, type ShortlistReturnRequest } from './proficiencyNavigation'
import ProficiencyProgression from './ProficiencyProgression'
import MountBrowser from './MountBrowser'
import BattalionBrowser from './BattalionBrowser'
import MagicScrollBrowser from './MagicScrollBrowser'
import DungeonBrowser from './DungeonBrowser'
import WeaponForgingBrowser from './WeaponForgingBrowser'
import SelectedWeapon from './SelectedWeapon'
import SelectedBattalion from './SelectedBattalion'
import SelectedMount from './SelectedMount'
import MainBuildOverview from './MainBuildOverview'
import { selectMainBuildOverview } from './buildOverview'
import { mountSelectionReducer } from './mountPlanning'
import { battalionSelectionReducer } from './battalionPlanning'
import { weaponSelectionReducer } from './weaponPlanning'
import type { CatalogRequest, RewardTarget } from './catalogNavigation'
import BuildComparison from './BuildComparison'
import BuildPresets, { type BuildDestination } from './BuildPresets'
import FullBuildLoadouts from './FullBuildLoadouts'
import { abilityReferences, resolveLoadout, type FullBuildSelection } from './loadouts'
import MountGrowthPreview from './MountGrowthPreview'
import QuickMountPicker from './QuickMountPicker'
import CommunityReferenceBrowser from './CommunityReferenceBrowser'
import type {CommunityReferenceRequest} from './community'
import { calculateBuild, type BuildSelection } from './comparison'
import {validLevel} from './expectedStats'
import LevelControl from './LevelControl'
import CharacterSheet from './CharacterSheet'
import Portrait from './Portrait'
import ShareBuildLink from './ShareBuildLink'
import { decodeSharedBuild, sharedValueFromHash } from './shareLink'
import CharacterFinder from './CharacterFinder'
import { correctionUrl } from './correction'

type PlannerArea = 'build' | 'abilities' | 'compare' | 'reference'
const PLANNER_AREAS: {id: PlannerArea; label: string; hint: string}[] = [
  {id: 'build', label: 'Build', hint: 'Character, class & equipment'},
  {id: 'abilities', label: 'Abilities', hint: 'Rank unlocks & your plan'},
  {id: 'compare', label: 'Compare & saves', hint: 'Compare, save & restore'},
  {id: 'reference', label: 'Reference', hint: 'Catalogs & research'},
]

// Decorative line icons for the four workspaces (hidden from assistive technology).
const AREA_ICON_PATHS: Record<PlannerArea, string> = {
  build: 'M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z M12 7v10 M8.5 11h7',
  abilities: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7Z',
  compare: 'M12 3v18 M5 7h14 M5 7l-3 7h6Z M19 7l-3 7h6Z M8 21h8',
  reference: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4Z M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6Z',
}
function AreaIcon({ area }: { area: PlannerArea }) {
  return <svg className="area-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={AREA_ICON_PATHS[area]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

function Crest({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'crest small' : 'crest'} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 3 56 17v28L32 61 8 45V17Z" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M32 10 49 21v21L32 54 15 42V21Z" fill="none" stroke="currentColor" strokeWidth=".6" />
    <path d="M32 14 39 28 32 25 25 28Z M32 25v25 M22 36h20 M23 47l9 3 9-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="m17 16 30 30M47 16 17 46" fill="none" stroke="currentColor" opacity=".25" />
  </svg>
}

export default function App() {
  const [area, setArea] = useState<PlannerArea>('build')
  const [workspaceFocus, setWorkspaceFocus] = useState<{area: PlannerArea; sequence: number}>()
  const workspaceSequence = useRef(0)
  const focusedWorkspaceSequence = useRef<number | null>(null)
  const [planPanelRequest, setPlanPanelRequest] = useState<{characterName: string; sequence: number}>()
  const [browserRequest, setBrowserRequest] = useState<{characterName: string; sequence: number}>()
  const openWorkspace = (next: PlannerArea) => {
    setArea(next)
    setWorkspaceFocus({area: next, sequence: ++workspaceSequence.current})
  }
  useEffect(() => {
    if (!workspaceFocus || workspaceFocus.area !== area || focusedWorkspaceSequence.current === workspaceFocus.sequence) return
    const destination = document.getElementById(`planner-${area}-heading`)
    destination?.focus({preventScroll: true})
    destination?.scrollIntoView?.({behavior: 'instant', block: 'start'})
    focusedWorkspaceSequence.current = workspaceFocus.sequence
  }, [workspaceFocus, area])
  const [communityNavigation,setCommunityNavigation]=useState<CommunityReferenceRequest>()
  const [planning, dispatchPlanning] = useReducer(shortlistReducer, { byCharacter: {} })
  const [mountSelections, dispatchMountSelection] = useReducer(mountSelectionReducer, {})
  const [battalionSelections, dispatchBattalionSelection] = useReducer(battalionSelectionReducer, {})
  const [weaponSelections, dispatchWeaponSelection] = useReducer(weaponSelectionReducer, {})
  const [characterName, setCharacterName] = useState('Alexandra')
  const [className, setClassName] = useState('Gladiator')
  const [targetLevels,setTargetLevels]=useState<Record<string,number>>({})
  // A character you haven't set a level for opens at the last level you chose (level 1 at first),
  // so switching characters keeps the comparison at the same point in the game.
  const [lastLevel,setLastLevel]=useState(1)
  const targetLevel=Object.hasOwn(targetLevels,characterName)?targetLevels[characterName]:lastLevel
  const setTargetLevel=(level:number)=>{if(validLevel(level)){setTargetLevels(current=>({...current,[characterName]:level}));setLastLevel(level)}}
  const [proficiencyNavigation, setProficiencyNavigation] = useState<{ sequence: number; request?: ProficiencyRequest; error?: ProficiencyNavigationError; returnRequest?: ShortlistReturnRequest }>({ sequence: 0 })
  const navigateToProficiency = (id: string) => {
    setArea('abilities')
    const result = resolveShortlistTarget(characterName, planning.byCharacter[characterName] ?? [], id)
    setProficiencyNavigation(current => ({ sequence: current.sequence + 1,
      ...('error' in result ? { error: { characterName, message: result.error } }
        : { request: { id: result.target.id, characterName, sequence: current.sequence + 1 } }),
    }))
  }
  const returnToShortlist = (origin: ProficiencyRequest, panelOnly = false): string | undefined => {
    const current = proficiencyNavigation.request
    if (origin.characterName !== characterName || !current || current.id !== origin.id || current.sequence !== origin.sequence
      || current.characterName !== characterName || proficiencyNavigation.returnRequest) return 'This navigation origin is no longer active. No shortlist was changed.'
    if (!panelOnly) {
      const result = resolveShortlistTarget(characterName, planning.byCharacter[characterName] ?? [], origin.id)
      if ('error' in result) return result.error
    }
    setArea('abilities')
    setProficiencyNavigation(state => ({ ...state, sequence: state.sequence + 1,
      returnRequest: { id: origin.id, characterName, sequence: state.sequence + 1, panelOnly },
    }))
  }
  const [referenceNavigation, setReferenceNavigation] = useState<{ sequence: number; scroll?: CatalogRequest; dungeon?: CatalogRequest; weapon?: CatalogRequest; battalion?: CatalogRequest; mount?: CatalogRequest }>({ sequence: 0 })
  const navigateReference = (target: 'scroll' | 'dungeon' | 'weapon' | 'battalion' | 'mount', id: string, reward?: RewardTarget) => {
    setArea('reference')
    setReferenceNavigation(current => ({
      ...current, sequence: current.sequence + 1, [target]: { id, sequence: current.sequence + 1, reward },
    }))
  }
  const [builds, setBuilds] = useState<{ a: BuildSelection; b: BuildSelection }>({
    a: { characterName: 'Alexandra', className: 'Gladiator' },
    b: { characterName: 'Alexandra', className: 'Hunter' },
  })
  const loadPreset = (destination: BuildDestination, selection: BuildSelection) => {
    // Resolve identifiers and validate all nine numbers before changing any state.
    calculateBuild(selection)
    if (destination === 'main') { openWorkspace('build'); setCharacterName(selection.characterName); setClassName(selection.className) }
    else setBuilds(current => ({ ...current, [destination]: selection }))
  }
  const character = growthData.characters.find(profile => profile.name === characterName)!
  const selectedClass = growthData.classes.find(profile => profile.name === className)!
  const notes = [...character.notes, ...selectedClass.notes]
  const overview = useMemo(() => selectMainBuildOverview({ character, selectedClass,
    weaponId: Object.hasOwn(weaponSelections, characterName) ? weaponSelections[characterName] : undefined,
    mountId: Object.hasOwn(mountSelections, characterName) ? mountSelections[characterName] : undefined,
    battalionId: Object.hasOwn(battalionSelections, characterName) ? battalionSelections[characterName] : undefined,
    entries: planning.byCharacter[characterName] ?? [],
  }), [character, selectedClass, characterName, weaponSelections, mountSelections, battalionSelections, planning.byCharacter])
  const loadFullBuild = (selection: FullBuildSelection) => {
    // Resolve every source reference before the first state update. No partial load on stale data.
    resolveLoadout(selection)
    openWorkspace('build')
    setCharacterName(selection.characterName); setClassName(selection.className)
    dispatchWeaponSelection({ characterName: selection.characterName, weaponId: selection.weaponId })
    dispatchMountSelection({ characterName: selection.characterName, mountId: selection.mountId })
    dispatchBattalionSelection({ characterName: selection.characterName, battalionId: selection.battalionId })
    dispatchPlanning({ type: 'restore', characterName: selection.characterName, references: selection.abilities })
    setProficiencyNavigation(current => ({ sequence: current.sequence + 1 }))
  }
  const fullSelection: FullBuildSelection = { characterName, className, weaponId: overview.weapon?.record.id ?? null,
    mountId: overview.mount?.record.nameSource.source ?? null, battalionId: overview.battalion?.record.id ?? null,
    abilities: abilityReferences(overview.entries) }
  // Shared links: open the build in the URL hash once, then clear the hash so later edits
  // don't leave a stale link in the address bar. A bad link changes nothing.
  const [shareNotice, setShareNotice] = useState<{error: boolean; text: string}>()
  const loadFullBuildRef = useRef(loadFullBuild)
  loadFullBuildRef.current = loadFullBuild
  useEffect(() => {
    const openSharedLink = () => {
      const value = sharedValueFromHash(window.location.hash)
      if (value === null) return
      try {
        const {selection, level} = decodeSharedBuild(value)
        loadFullBuildRef.current(selection)
        setTargetLevels(current => ({...current, [selection.characterName]: level})); setLastLevel(level)
        setShareNotice({error: false, text: `Opened a shared build: ${selection.characterName} / ${selection.className}, level ${level}.`})
      } catch (error) {
        setShareNotice({error: true, text: `This shared link couldn’t be opened. ${error instanceof Error ? error.message : ''} Nothing was changed.`.replace(/\s+/gu, ' ')})
      }
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
    openSharedLink()
    window.addEventListener('hashchange', openSharedLink)
    return () => window.removeEventListener('hashchange', openSharedLink)
  }, [])

  return <div className="app-shell">
    <a className="skip-to-workspace" href={`#planner-${area}-heading`} onClick={event => { event.preventDefault(); openWorkspace(area) }}>Skip to current workspace</a>
    <header className="masthead">
      <div className="brand"><Crest small /><div><p>Fortune’s Weave<span className="brand-sub">Build Planner</span></p></div></div>
      <span className="fan-badge">Unofficial fan companion</span>
    </header>

    <main>
      <div className="page-intro">
        <h1>Plan a unit in seconds.</h1>
        <p>Pick a character, class and level to see their average stats. Plan abilities and gear, then compare or save builds.<span className="intro-extra"> All {growthData.characters.length} characters and {growthData.classes.length} classes.</span></p>
      </div>

      {shareNotice && <div className={`share-notice${shareNotice.error ? ' is-error' : ''}`} role={shareNotice.error ? 'alert' : 'status'}><p>{shareNotice.text}</p><button type="button" className="link-button" onClick={() => setShareNotice(undefined)}>Dismiss</button></div>}
      <nav className="planner-navigation" aria-label="Planner sections">
        {PLANNER_AREAS.map(item => <button type="button" key={item.id} aria-current={area === item.id ? 'page' : undefined} aria-controls={`planner-${item.id}`} onClick={() => openWorkspace(item.id)}><AreaIcon area={item.id} /><strong>{item.label}</strong><span>{item.hint}</span></button>)}
      </nav>
      <div className="build-context" aria-label="Current build" hidden={area === 'build'}><Portrait name={character.name} size="small" /><div><span className="eyebrow">Current build</span><strong>{character.name} <span> / {selectedClass.name}</span></strong></div><span>{overview.entries.length} planned {overview.entries.length === 1 ? 'ability' : 'abilities'}</span>{area !== 'build' && <button type="button" onClick={() => openWorkspace('build')}>Edit character & class</button>}<div className="build-shortcuts"><button type="button" onClick={() => openWorkspace('abilities')}>Plan abilities</button><button type="button" onClick={() => openWorkspace('compare')}>Save full build</button></div></div>

      <section id="planner-build" className="planner-area" aria-label="Build workspace" hidden={area !== 'build'}>
      <CharacterSheet character={character} selectedClass={selectedClass} targetLevel={targetLevel} onSelectClass={setClassName}
        controls={<div className="sheet-controls">
          <div className="selection-field">
            <label htmlFor="character">Character</label>
            <div className="select-wrap"><select id="character" value={characterName} onChange={event => setCharacterName(event.target.value)}>
              {growthData.characters.map(profile => <option key={profile.name}>{profile.name}</option>)}
            </select><span aria-hidden="true">⌄</span></div>
          </div>
          <div className="selection-field">
            <label htmlFor="class">Class</label>
            <div className="select-wrap"><select id="class" value={className} onChange={event => setClassName(event.target.value)}>
              {growthData.classes.map(profile => <option key={profile.name}>{profile.name}</option>)}
            </select><span aria-hidden="true">⌄</span></div>
          </div>
          <LevelControl level={targetLevel} onChange={setTargetLevel} />
          <QuickMountPicker character={character} selectedClass={selectedClass}
            selectedId={Object.hasOwn(mountSelections, characterName) ? mountSelections[characterName] : undefined}
            onSelect={mountId => dispatchMountSelection({ characterName, mountId })} />
        </div>}
        actions={<div className="sheet-actions">
          <span>{overview.entries.length} planned {overview.entries.length === 1 ? 'ability' : 'abilities'}</span>
          <button type="button" onClick={() => openWorkspace('abilities')}>Plan abilities</button>
          <button type="button" className="primary" onClick={() => openWorkspace('compare')}>Save this build</button>
          <ShareBuildLink build={{selection: fullSelection, level: targetLevel}} />
        </div>}
        notes={notes.length > 0 && <div className="selection-notes" role="note"><span className="note-icon" aria-hidden="true">i</span><div><strong>Data note</strong>{notes.map(note => <p key={note}>{note}</p>)}</div></div>} />
      <CharacterFinder currentCharacter={characterName} selectedClass={selectedClass} onSelect={setCharacterName} />
      <CharacterDetails character={character} />
      <div className="workspace-heading equipment-heading"><h2>Equipment</h2><p>Choose a weapon, battalion and mount for {character.name}.</p></div>
      <div className="equipment-panels">
      <SelectedWeapon characterName={characterName} selectedClass={selectedClass} weaponId={Object.hasOwn(weaponSelections, characterName) ? weaponSelections[characterName] : undefined} onSelect={weaponId => dispatchWeaponSelection({ characterName, weaponId })} onNavigateDungeon={reference => navigateReference('dungeon', reference.location.id, { locationId: reference.location.id, chestId: reference.chest.id, part: reference.part })} />
      <SelectedBattalion characterName={characterName} selectedClass={selectedClass} battalionId={Object.hasOwn(battalionSelections, characterName) ? battalionSelections[characterName] : undefined} onSelect={battalionId => dispatchBattalionSelection({ characterName, battalionId })} onNavigateCatalog={id => navigateReference('battalion', id)} />
      <SelectedMount characterName={characterName} selectedClass={selectedClass} selectedMountId={Object.hasOwn(mountSelections, characterName) ? mountSelections[characterName] : undefined} onSelect={mountId => dispatchMountSelection({ characterName, mountId })} onNavigateCatalog={id => navigateReference('mount', id)} />
      </div>
      <MountGrowthPreview character={character} selectedClass={selectedClass} mount={overview.mount?.record} />
      <ClassDetails profile={selectedClass} />
      <MainBuildOverview data={overview} />
      </section>

      <section id="planner-compare" className="planner-area" aria-label="Compare and save workspace" hidden={area !== 'compare'}>
      <div className="workspace-heading"><h2 id="planner-compare-heading" tabIndex={-1}>Compare & saves</h2><p>Save a full loadout, back up your plans, or compare character and class pairings.</p></div>
      <FullBuildLoadouts initialOpen selection={fullSelection} onLoad={loadFullBuild} />
      <BuildPresets selections={{ main: { characterName, className }, ...builds }} onLoad={loadPreset} />
      <BuildComparison character={character} selectedClass={selectedClass} builds={builds} setBuilds={setBuilds} />
      </section>
      <section id="planner-abilities" className="planner-area" aria-label="Abilities workspace" hidden={area !== 'abilities'}>
      <div className="workspace-heading"><h2 id="planner-abilities-heading" tabIndex={-1}>Plan your abilities</h2><p>Browse rank unlocks, read their effects, and add them to your character’s plan.</p></div>
      <ProficiencyProgression initialOpen browserRequest={browserRequest} onViewPlan={() => setPlanPanelRequest({characterName, sequence: ++workspaceSequence.current})} character={character} selectedClass={selectedClass} shortlist={planning.byCharacter[characterName] ?? []} planningFeedback={planning.feedback} onPlanningAction={dispatchPlanning} navigation={proficiencyNavigation.request} onReturn={returnToShortlist} onNavigateCombatArt={row=>{setArea('reference');setCommunityNavigation(current=>({row,sequence:(current?.sequence??0)+1}))}}/>
      <AbilityPlanningShortlist initialOpen panelRequest={planPanelRequest} onBackToBrowser={() => setBrowserRequest({characterName, sequence: ++workspaceSequence.current})} characterName={characterName} entries={planning.byCharacter[characterName] ?? []} feedback={planning.feedback} onAction={dispatchPlanning} onNavigate={navigateToProficiency} navigationError={proficiencyNavigation.error} returnNavigation={proficiencyNavigation.returnRequest} />
      </section>
      <section id="planner-reference" className="planner-area" aria-label="Reference workspace" hidden={area !== 'reference'}>
      <div className="workspace-heading"><h2 id="planner-reference-heading" tabIndex={-1}>Reference library</h2><p>Look up mounts, battalions, magic scrolls, dungeon chests, weapons and the full community research sheets. Open a catalog, then pick an entry to see its details and sources.</p></div>
      <MountBrowser character={character} selectedClass={selectedClass} navigation={referenceNavigation.mount} />
      <BattalionBrowser character={character} selectedClass={selectedClass} navigation={referenceNavigation.battalion} />
      <MagicScrollBrowser character={character} selectedClass={selectedClass} navigation={referenceNavigation.scroll} onNavigateDungeon={id => navigateReference('dungeon', id)} />
      <DungeonBrowser character={character} selectedClass={selectedClass} navigation={referenceNavigation.dungeon} onNavigateScroll={id => navigateReference('scroll', id)} onNavigateWeapon={reference => navigateReference('weapon', reference.weapon.id, { locationId: reference.location.id, chestId: reference.chest.id, part: reference.part })} />
      <WeaponForgingBrowser characterName={character.name} className={selectedClass.name} navigation={referenceNavigation.weapon} onNavigateDungeon={reference => navigateReference('dungeon', reference.location.id, { locationId: reference.location.id, chestId: reference.chest.id, part: reference.part })} />
      <CommunityReferenceBrowser navigation={communityNavigation}/>

      <details className="source-notes">
        <summary><span>Workbook notes</span><span>{growthData.metadata.unresolvedGrowthIssues.length} unresolved growth {growthData.metadata.unresolvedGrowthIssues.length === 1 ? 'discrepancy' : 'discrepancies'} <span aria-hidden="true">＋</span></span></summary>
        <div className="source-content">
          <p>Character and class data come from the corrected community research workbook. Mu and Mu (with growth) are kept as separate profiles, and the workbook’s repeated character header row is skipped.</p>
          <p>Commoner / Noble uses zero modifiers, because the workbook’s nine SUMIF growth formulas treat its blank modifier cells as zero.</p>
          {growthData.metadata.unresolvedGrowthIssues.map(item => <p className="uncertainty" key={item.location}><strong>{item.location}</strong> — {item.message}</p>)}
          <p className="source-reference">Sources for your current character and class: {character.source.sheet}!{character.source.range} · {selectedClass.source.sheet}!{selectedClass.source.range}</p>
        </div>
      </details>
      </section>
    </main>
    <footer>
      <span>Fortune’s Weave <span className="footer-divider">/</span> Build Planner</span>
      <span>Saved builds stay in this browser. Nothing is uploaded.</span>
      {correctionUrl(characterName, className) && <span className="footer-report">Spot a wrong value? <a href={correctionUrl(characterName, className)} target="_blank" rel="noreferrer">Report a correction</a> with a source.</span>}
      <span className="fan-disclaimer">Unofficial fan-made tool, not affiliated with or endorsed by Nintendo or Intelligent Systems. Game data comes from community research: the Fortune’s Weave research workbook, base stats by u/averysillyman with level-up data by Aggro Incarnate, and Serenes Forest. Character portraits © Nintendo / Intelligent Systems, via the <a href="https://fireemblem.fandom.com/" target="_blank" rel="noreferrer">Fire Emblem Wiki</a>. Averages are estimates.</span>
    </footer>
  </div>
}

