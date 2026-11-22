import type {Proficiency} from './growths'
import {combatArtReferences} from './community'

export default function CombatArtLinks({proficiency,text,onNavigate}:{proficiency:Proficiency;text:string|null;onNavigate?:(row:number)=>void}) {
 const references=combatArtReferences(proficiency,text)
 if(!references.length)return null
 return <section className="community-effect" aria-label="Related combat-art references"><h3>Combat-art references · unverified</h3>
 <p className="details-key">Exact name and recorded proficiency origin match. Formula mirrors remain the same evidence; effects are not applied to growths.</p>
 {references.map(item=><div key={item.reference.source}><p className="recorded-text">{typeof item.effect.value==='string'?item.effect.value:'Effect not listed; other combat-art properties are available in the reference.'}</p>
 {onNavigate&&<p><button type="button" className="shortlist-button" onClick={()=>onNavigate(item.row)}>View {item.name} in reference · row {item.row}</button></p>}
 <p><a className="entry-source" href={item.reference.url} target="_blank" rel="noreferrer">{item.reference.source}</a> · <a className="entry-source" href={item.origin.url} target="_blank" rel="noreferrer">Recorded origin: {item.origin.source}</a></p></div>)}
 </section>
}
