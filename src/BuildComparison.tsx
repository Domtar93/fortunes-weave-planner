import { DATA_STATUS_LABELS, formatPercent, growthData, signedPercent, STATS, STAT_NAMES, type CharacterProfile, type ClassProfile, type SourceText, type SourceNumber } from './growths'
import { compareGrowthBuilds, formatPercentagePoints, type BuildSelection, type ComparedBuild } from './comparison'
import Portrait from './Portrait'

const comparisonStatName = (stat: (typeof STATS)[number]) => stat === 'Cha' ? 'Charisma' : STAT_NAMES[stat]

function BuildControls({ label, selection, notes, onChange }: { label: 'A' | 'B'; selection: BuildSelection; notes: string[]; onChange: (selection: BuildSelection) => void }) {
  return <section className={`comparison-build build-${label.toLowerCase()}`} aria-label={`Build ${label} selections`}>
    <div className="recorded-heading"><h3>Build {label}</h3><span className="eyebrow">Character + class</span></div>
    <div className="comparison-inputs">
      <div><label htmlFor={`comparison-${label}-character`}>Build {label} character</label><select id={`comparison-${label}-character`} value={selection.characterName}
        onChange={event => onChange({ ...selection, characterName: event.target.value })}>
        {growthData.characters.map(profile => <option key={profile.name}>{profile.name}</option>)}
      </select></div>
      <div><label htmlFor={`comparison-${label}-class`}>Build {label} class</label><select id={`comparison-${label}-class`} value={selection.className}
        onChange={event => onChange({ ...selection, className: event.target.value })}>
        {growthData.classes.map(profile => <option key={profile.name}>{profile.name}</option>)}
      </select></div>
    </div>
    <div className="pairing-with-portrait"><Portrait name={selection.characterName} size="small" /><p className="comparison-pairing">{selection.characterName}<span> × {selection.className}</span></p></div>
    {notes.length > 0 && <div role="group" aria-label={`Build ${label} source warnings`}>
      {notes.map(note => <p className="class-source-warning" key={note}>{note}</p>)}
    </div>}
  </section>
}

function ContextField({ label, field }: { label: string; field: SourceText | SourceNumber }) {
  const value = 'text' in field ? field.text : field.value
  return <div><dt>{label}</dt><dd className="comparison-recorded">{value ?? 'Unknown / unrecorded'}</dd>
    <span className="entry-source">{field.source} · {DATA_STATUS_LABELS[field.status]}</span></div>
}

function ClassContext({ label, build }: { label: 'A' | 'B'; build: ComparedBuild }) {
  const profile = build.selectedClass
  const data = profile.details
  return <section className="comparison-class-context" aria-label={`Build ${label} class context`}>
    <h3>Build {label} · {profile.name}</h3>
    <dl className="comparison-context-facts">
      <ContextField label="License category" field={data.license} />
      <ContextField label="Level requirement" field={data.level} />
      <ContextField label="Movement" field={data.movement} />
      <ContextField label="Mount classification" field={data.mountType} />
    </dl>
    <dl className="comparison-context-records">
      <ContextField label="Primary proficiency requirements" field={data.primaryRequirements} />
      <ContextField label="Secondary proficiency requirements" field={data.secondaryRequirements} />
      <ContextField label="Mastery ability" field={data.masteryAbility} />
      <ContextField label="Additional unlock restrictions" field={data.additionalUnlocks} />
    </dl>
  </section>
}

function Contributions({ label, build }: { label: 'A' | 'B'; build: ComparedBuild }) {
  return <section aria-label={`Build ${label} growth contributions`}>
    <h3>Build {label} · {build.character.name} × {build.selectedClass.name}</h3>
    <table className="comparison-contribution-table">
      <caption className="sr-only">Build {label} personal and class growth contributions</caption>
      <thead><tr><th scope="col">Stat</th><th scope="col">Personal</th><th scope="col">Class</th><th scope="col">Combined</th></tr></thead>
      <tbody>{STATS.map(stat => <tr key={stat}><th scope="row"><abbr title={comparisonStatName(stat)}>{stat}</abbr></th>
        <td className="personal-color">{formatPercent(build.character.growths[stat])}</td>
        <td className={build.selectedClass.growths[stat] < 0 ? 'negative-color' : 'class-color'}>{signedPercent(build.selectedClass.growths[stat])}</td>
        <td className="combined-color">{formatPercent(build.combined[stat])}</td></tr>)}</tbody>
    </table>
    <p className="entry-source">Personal: {build.character.source.sheet}!{build.character.source.range} · Class: {build.selectedClass.source.sheet}!{build.selectedClass.source.range}</p>
  </section>
}

export default function BuildComparison({ character, selectedClass, builds, setBuilds }: {
  character: CharacterProfile; selectedClass: ClassProfile
  builds: { a: BuildSelection; b: BuildSelection }
  setBuilds: React.Dispatch<React.SetStateAction<{ a: BuildSelection; b: BuildSelection }>>
}) {
  const comparison = compareGrowthBuilds(builds.a, builds.b)

  return <details className="progression-panel comparison-panel">
    <summary><span>Build Comparison</span><span>Two independent growth builds <span aria-hidden="true">＋</span></span></summary>
    <section aria-label="Character and class growth comparison">
      <p className="details-context">Compare two character and class pairings. Load your current build into A or choose each pairing below.</p>
      <div className="comparison-actions">
        <button type="button" onClick={() => setBuilds(current => ({ ...current, a: { characterName: character.name, className: selectedClass.name } }))}>Load main planner into Build A</button>
        <button type="button" onClick={() => setBuilds(current => ({ a: current.b, b: current.a }))}>Swap builds</button>
      </div>
      <div className="comparison-builds">
        <BuildControls label="A" selection={builds.a} notes={[...comparison.a.character.notes, ...comparison.a.selectedClass.notes]} onChange={selection => setBuilds(current => ({ ...current, a: selection }))} />
        <BuildControls label="B" selection={builds.b} notes={[...comparison.b.character.notes, ...comparison.b.selectedClass.notes]} onChange={selection => setBuilds(current => ({ ...current, b: selection }))} />
      </div>
      <div className="progression-title comparison-heading"><h2>Growth rates side by side</h2><span>Difference = B − A · pp = percentage points</span></div>
      <table className="comparison-growth-table">
        <caption className="sr-only">Build A versus Build B growth rates and B minus A percentage-point differences</caption>
        <thead><tr><th scope="col">Stat</th><th scope="col">Build A</th><th scope="col">Build B</th><th scope="col">Difference<span>B − A</span></th></tr></thead>
        <tbody>{STATS.map(stat => {
          const difference = comparison.difference[stat]
          const direction = difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'equal'
          return <tr key={stat}><th scope="row"><span className="comparison-stat-name">{comparisonStatName(stat)}</span><abbr title={comparisonStatName(stat)}>{stat}</abbr></th>
            <td data-testid={`comparison-A-${stat}`}>{formatPercent(comparison.a.combined[stat])}</td>
            <td data-testid={`comparison-B-${stat}`}>{formatPercent(comparison.b.combined[stat])}</td>
            <td className={`comparison-difference ${direction}`} data-testid={`comparison-difference-${stat}`}>
              <strong>{formatPercentagePoints(difference)}</strong><span>{direction === 'equal' ? 'Equal' : `B ${direction}`}</span></td></tr>
        })}</tbody>
      </table>
      <p className="details-context">Each row compares one growth rate, not an overall build ranking.</p>
      <details className="reader-disclosure"><summary>What this comparison leaves out</summary><p className="details-key">Flat class, mount, battalion, equipment and combat-art bonuses, mount growths and level-up estimates are excluded.</p></details>
      <details className="class-section comparison-breakdown">
        <summary><span>Personal + class breakdown</span><span>Both builds · all nine stats <span aria-hidden="true">＋</span></span></summary>
        <div className="comparison-breakdowns"><Contributions label="A" build={comparison.a} /><Contributions label="B" build={comparison.b} /></div>
      </details>
      <details className="reader-disclosure"><summary>Class context for both builds</summary><div className="comparison-contexts"><ClassContext label="A" build={comparison.a} /><ClassContext label="B" build={comparison.b} /></div></details>
      <p className="sr-only" role="status">Comparing Build A: {builds.a.characterName} as {builds.a.className}; Build B: {builds.b.characterName} as {builds.b.className}.</p>
    </section>
  </details>
}
