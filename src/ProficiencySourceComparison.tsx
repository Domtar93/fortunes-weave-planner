import {PROFICIENCY_NAMES,type Proficiency} from './growths'
import {communityEntries} from './community'
import {learnsetIdentity,LEARNSET_STATES,proficiencyData,type LearnsetEntry} from './proficiencies'
import {learnsetSourceLink} from './shortlist'

export function compareRankSources(characterName:string,proficiency:Proficiency,rank:string) {
 const identity=learnsetIdentity(characterName)
 const original=(proficiencyData.categories[proficiency].characters[identity]??[]).filter(e=>e.rank===rank)
 const additional=communityEntries(proficiency,identity).filter(e=>e.rank===rank)
 const relation=original.length>1||additional.length>1?'Ambiguous source records':!original.length?'Rank absent from corrected workbook':!additional.length?'Rank absent from additional source':
  original[0].text===additional[0].text&&original[0].state===additional[0].state?'Same recorded entry':'Different recorded entries'
 return {original,additional,relation}
}
function Source({title,entries}:{title:string;entries:LearnsetEntry[]}) {
 return <section aria-label={title}><h4>{title}</h4>{!entries.length?<p>Rank not recorded in this source.</p>:entries.map(entry=><div key={entry.source}>
 <p className="recorded-text">{entry.text===null||entry.text===''?'Unknown / blank':entry.text}</p><p className="learnset-status">{LEARNSET_STATES[entry.state]}</p>
 <a className="entry-source" href={learnsetSourceLink(entry)} target="_blank" rel="noreferrer">{entry.source}</a>
 {entry.note&&<p className="details-key recorded-text">{entry.note}</p>}</div>)}</section>
}
export default function ProficiencySourceComparison({characterName,proficiency,rank}:{characterName:string;proficiency:Proficiency;rank:string}) {
 const result=compareRankSources(characterName,proficiency,rank)
 return <section className="proficiency-source-comparison" aria-label={`Source comparison for ${characterName} ${PROFICIENCY_NAMES[proficiency]} ${rank}`}>
 <h3>Same-rank source comparison · {rank}</h3><p className={result.relation==='Same recorded entry'?'details-key':'class-source-warning'}>{result.relation}</p>
 <div className="source-comparison-pair"><Source title="Corrected workbook entry" entries={result.original}/><Source title="Additional community entry" entries={result.additional}/></div>
 <p className="details-key">Both are community evidence. No winner is selected. Shortlisting uses only the source entry you explicitly choose.</p>
 </section>
}
