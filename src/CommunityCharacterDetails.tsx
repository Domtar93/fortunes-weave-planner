import { DATA_STATUS_LABELS, PROFICIENCIES, PROFICIENCY_NAMES, ROUTES } from './growths'
import {communityData, type CommunityField} from './community'
import {useState} from 'react'

function Field({label,field}:{label:string;field:CommunityField}) {
 return <div className="recorded-entry"><div className="recorded-heading"><h3>{label}</h3><span className={`data-status ${field.status}`}>{DATA_STATUS_LABELS[field.status]}</span></div>
 <p className="recorded-text">{field.value===null?'Not recorded in this reference.':String(field.value)}</p>
 {field.note&&<p className="recorded-text details-key">Source note: {field.note}</p>}
 <a className="entry-source" href={field.url} target="_blank" rel="noreferrer">{field.source}</a></div>
}
export default function CommunityCharacterDetails({characterName}:{characterName:string}) {
 const [opened,setOpened]=useState(false)
 const character=communityData.characters[characterName]
 if(!character)return null
 return <details className="class-section community-character" onToggle={event=>setOpened(event.currentTarget.open)}><summary>Additional character details · community reference</summary>
 {opened&&<section aria-label={`Additional character details for ${characterName}`}>
 <p className="details-context">Additional community evidence. Original ability names and recruitment notes above remain available for comparison. Paired multiline ability names/descriptions are preserved; progression and eligibility are not inferred.</p>
 <div className="ability-entries"><Field label={`Inherent name · ${characterName}`} field={character.inherent}/><Field label="Inherent description" field={character.inherentDescription}/><Field label={`Equippable name · ${characterName}`} field={character.equippable}/><Field label="Equippable description" field={character.equippableDescription}/><Field label="Bloodmark" field={character.bloodmark}/><Field label="Bloodmark description" field={character.bloodmarkDescription}/></div>
 <details className="class-section"><summary>Proficiency boons and banes</summary><p className="details-key">Raw proficiency modifiers; these do not alter the nine stat growth percentages.</p><div className="community-fields">{PROFICIENCIES.map(category=><Field key={category} label={PROFICIENCY_NAMES[category]} field={character.proficiencies[category]}/>)}</div></details>
 <details className="class-section"><summary>Additional recruitment conditions</summary><div className="recruitment-entries">{ROUTES.map(route=><Field key={route} label={`${route} route · additional source`} field={character.recruitment[route]}/>)}</div></details>
 </section>}</details>
}
