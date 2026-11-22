import { DATA_STATUS_LABELS, PROFICIENCIES, PROFICIENCY_NAMES, signedPercent, STAT_NAMES, STATS,
  type ClassProfile, type SourceNumber, type SourceText } from './growths'

function ClassText({ label, entry }: { label: string; entry: SourceText }) {
  return <div className="recorded-entry" role="group" aria-label={label}>
    <div className="recorded-heading"><h3>{label}</h3></div>
    <p className="recorded-text">{entry.text ?? 'Not recorded in the workbook.'}</p>
    <details className="reader-disclosure"><summary>Source details</summary><p className="entry-source">Source: {entry.source} · {DATA_STATUS_LABELS[entry.status]}</p></details>
  </div>
}

function Fact({ label, entry, interpretation }: { label: string; entry: SourceText | SourceNumber; interpretation?: string }) {
  const value = 'text' in entry ? entry.text : entry.value
  return <div className="class-fact" role="group" aria-label={label}>
    <h3>{label}</h3><p>{value ?? 'Unknown'}</p>
    {interpretation && <span className="fact-interpretation">{interpretation}</span>}
    
  </div>
}

function signedPoints(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

export default function ClassDetails({ profile }: { profile: ClassProfile }) {
  const data = profile.details
  const mount = data.mountType.text?.trim()
  const mountInterpretation = mount?.toLowerCase() === 'no' ? 'Not mounted' : undefined

  return <section className="class-details" aria-labelledby="class-details-heading">
    <div className="character-details-heading"><div><span className="eyebrow">Class reference</span><h2 id="class-details-heading">{profile.name} · Class details</h2></div></div>
    <div className="class-facts">
      <Fact label="License category" entry={data.license} />
      <Fact label="Level requirement" entry={data.level} />
      <Fact label="Renown requirement" entry={data.renown} />
      <Fact label="Movement" entry={data.movement} />
      <Fact label="Mount type" entry={data.mountType} interpretation={mountInterpretation} />
    </div>

    <details className="reader-disclosure"><summary>Class sources & details</summary><p className="entry-source">Community workbook · Unverified entries</p>{[data.license, data.level, data.renown, data.movement, data.mountType].map(field => <p className="entry-source" key={field.source}>{field.source}</p>)}</details>

    <details className="class-section">
      <summary><span>Requirements & restrictions</span><span>Proficiencies · unlock conditions <span aria-hidden="true">＋</span></span></summary>
      <p className="details-context">Primary and secondary proficiency requirements influence examination chances. This reference does not calculate certification probabilities or determine eligibility.</p>
      <div className="class-field-grid">
        <ClassText label="Primary proficiency requirements" entry={data.primaryRequirements} />
        <ClassText label="Secondary proficiency requirements" entry={data.secondaryRequirements} />
        <div className="class-wide-field"><ClassText label="Additional unlock conditions" entry={data.additionalUnlocks} /></div>
      </div>
    </details>

    <details className="class-section">
      <summary><span>Mastery & class abilities</span><span>Names · full descriptions <span aria-hidden="true">＋</span></span></summary>
      <div className="class-field-grid">
        <ClassText label="Mastery ability" entry={data.masteryAbility} />
        <ClassText label="Mastery description" entry={data.masteryDescription} />
        <ClassText label="Class abilities" entry={data.abilities} />
        <ClassText label="Class ability descriptions" entry={data.abilityDescriptions} />
      </div>
      <p className="details-context">Effects are shown as recorded text. They are not applied to growth percentages or treated as equip-legality rules.</p>
    </details>

    <details className="class-section">
      <summary><span>Weapons, skills & experience</span><span>Allowed types · 12 proficiencies <span aria-hidden="true">＋</span></span></summary>
      <ClassText label="Allowed weapons and skills" entry={data.allowedWeaponsAndSkills} />
      <p className="details-context">Blank: not listed as usable · 0: usable, no bonus experience · Positive: bonus experience.</p>
      <div className="proficiency-grid">
        {PROFICIENCIES.map(key => {
          const field = data.proficiencyExperience[key]
          return <div className={`proficiency-entry ${field.value === null ? 'unlisted' : ''}`} key={key} role="group" aria-label={`${PROFICIENCY_NAMES[key]} experience`}>
            <h3>{PROFICIENCY_NAMES[key]}</h3>
            <p>{field.value === null ? 'Not listed as usable' : field.value === 0 ? 'Usable · 0 bonus XP' : `${signedPoints(field.value)} bonus XP`}</p>
            <details className="reader-disclosure"><summary>Source</summary><span className="entry-source">{field.source}</span></details>
          </div>
        })}
      </div>
    </details>

    <details className="class-section">
      <summary><span>Growth modifiers & flat bonuses</span><span>Percentages · stat points <span aria-hidden="true">＋</span></span></summary>
      <div className="class-stat-tables">
        <div><h3>Class growth modifiers (%)</h3><table>
          <caption className="sr-only">{profile.name} class growth modifiers</caption>
          <thead><tr><th scope="col">Stat</th><th scope="col">Growth</th></tr></thead>
          <tbody>{STATS.map(stat => <tr key={stat}><th scope="row">{STAT_NAMES[stat]} ({stat})</th><td className="combined-color">{signedPercent(profile.growths[stat])}</td></tr>)}</tbody>
        </table><p className="entry-source">Source: {profile.source.sheet}!{profile.source.range}</p></div>
        <div><h3>Flat stat bonuses (points)</h3><table>
          <caption className="sr-only">{profile.name} flat stat bonuses</caption>
          <thead><tr><th scope="col">Stat</th><th scope="col">Points</th><th scope="col">Source</th></tr></thead>
          <tbody>{STATS.map(stat => {
            const field = data.flatStatBonuses[stat]
            return <tr key={stat}><th scope="row">{STAT_NAMES[stat]} ({stat})</th><td>{field.value === null ? 'Unknown' : signedPoints(field.value)}</td><td className="entry-source">{field.source}</td></tr>
          })}</tbody>
        </table></div>
      </div>
      {profile.notes.map(note => <p className="class-source-warning" key={note}>{note}</p>)}
      <p className="details-context">Growth modifiers are percentages; flat bonuses are stat points. They are kept separate. Work-in-progress base stats are excluded from calculations.</p>
    </details>
  </section>
}
