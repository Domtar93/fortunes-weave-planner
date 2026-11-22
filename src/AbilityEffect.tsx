import type { AbilityInformation } from './abilityInfo'

export default function AbilityEffect({ information, className = 'ability-effect' }: { information: AbilityInformation; className?: string }) {
  return <>
    {information.notice && <p className="ability-issue">{information.notice}</p>}
    {information.description ? <p className={className}>{information.description}</p>
      : information.hasConflict && information.alternatives.length ? <div className="ability-effect-variants"><p className="ability-issue">Description varies between references:</p>{information.alternatives.map((description, index) => <p className={className} key={index}>{description}</p>)}</div>
      : information.parts?.length ? <div className="ability-parts">{information.parts.map((part,index)=><section key={part.label+index}><h4>{part.label}</h4><AbilityEffect information={part.information} className={className}/></section>)}</div>
      : !information.notice && <p className={className}>No effect description available.</p>}
    {information.facts.length > 0 && information.descriptionKind!=='recorded-values' && <dl className="ability-facts">{information.facts.map((fact, index) => <div key={fact.label + index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
  </>
}
