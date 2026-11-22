import { DATA_STATUS_LABELS, ROUTES, type CharacterProfile, type SourceText } from './growths'
import { communityData } from './community'
import AbilityEffect from './AbilityEffect'
import { resolveAbilityInformation, type AbilityInformation } from './abilityInfo'
import CommunityCharacterDetails from './CommunityCharacterDetails'
import Portrait from './Portrait'

function RecordedEntry({ label, entry, effect }: { label: string; entry: SourceText; effect?: AbilityInformation }) {
  const separateNames=effect?.descriptionKind==='reviewed-personal'&&effect.parts?.length&&entry.text?.includes('\n')
  return <div className="recorded-entry" role="group" aria-label={label}>
    <div className="recorded-heading"><h3>{label}</h3></div>
    {!separateNames&&<p className="recorded-text">{entry.status === 'unavailable' ? 'Unavailable' : entry.text ?? 'Not recorded.'}</p>}
    {effect && entry.text && !['unknown', 'unavailable'].includes(entry.status) && <AbilityEffect information={effect} />}
    <details className="reader-disclosure"><summary>Source details</summary><span className={`data-status ${entry.status}`}>{DATA_STATUS_LABELS[entry.status]}</span>
    {entry.status === 'unavailable' && <p className="recorded-explanation">Marked unavailable in the source. Original entry: {entry.text ?? '(blank)'}.</p>}
    <p className="entry-source">Source: {entry.source}</p>
    {separateNames&&<p className="recorded-text">{entry.text}</p>}
    {effect?.references.map(reference=><p key={reference.url}><a className="entry-source" href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></p>)}
    {effect?.alternatives.map((text,index)=><p className="recorded-explanation" key={index}>{text}</p>)}
    </details>
  </div>
}

export default function CharacterDetails({ character }: { character: CharacterProfile }) {
  const reference = communityData.characters[character.name]
  const inherentEffect = resolveAbilityInformation({name: character.personal.inherent.text, characterName: character.name, personalKind:'inherent', fallback: reference?.inherent.value === character.personal.inherent.text && typeof reference?.inherentDescription.value === 'string' ? reference.inherentDescription.value : null})
  const equippableEffect = resolveAbilityInformation({name: character.personal.equippable.text, characterName: character.name, personalKind:'equippable', fallback: reference?.equippable.value === character.personal.equippable.text && typeof reference?.equippableDescription.value === 'string' ? reference.equippableDescription.value : null})
  return <section className="character-details" aria-labelledby="character-details-heading">
    <div className="character-details-heading"><Portrait name={character.name} size="medium" /><div><span className="eyebrow">Character reference</span><h2 id="character-details-heading">{character.name} · Abilities & recruitment</h2></div></div>
    <div className="ability-entries">
      <RecordedEntry label="Inherent ability" entry={character.personal.inherent} effect={inherentEffect} />
      <RecordedEntry label="Equippable abilities" entry={character.personal.equippable} effect={equippableEffect} />
    </div>
    <details className="reader-disclosure"><summary>Recruitment by route</summary><h3 className="recruitment-heading">Recruitment by route</h3>
    <div className="recruitment-entries">
      {ROUTES.map(route => <RecordedEntry key={route} label={`${route}’s Path`} entry={character.recruitment[route]} />)}
    </div>
    </details><details className="reader-disclosure"><summary>Research notes & additional character details</summary>
    <p className="details-key">Confirmed: independently verified · Unverified: listed community data · Unknown: no entry · Unavailable: explicit source marker.</p>
    <CommunityCharacterDetails characterName={character.name} /></details>
  </section>
}
