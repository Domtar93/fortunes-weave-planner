import {useMemo,useState} from 'react'
import {STAT_NAMES,type CharacterProfile,type ClassProfile} from './growths'
import {formatExpected,type StatObservations} from './expectedStats'
import {classRequirement} from './ClassFinder'
import {suggestBuilds} from './buildSuggestions'

const STYLE_ICONS:Record<string,string>={
 physical:'M5 19 15 9 M14 4l6 6-3 1-4-4Z M4 16l4 4 M7 21l-4-4',
 magic:'M12 2v5 M12 17v5 M2 12h5 M17 12h5 M5 5l3 3 M16 16l3 3 M19 5l-3 3 M8 16l-3 3 M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
 defender:'M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z M12 6v12',
 leader:'M3 8l4 4 5-7 5 7 4-4-2 11H5Z M5 21h14',
}

// Computed suggestions: for each build style, the classes whose growth rates in that
// style's three stats add up highest for this character. Applying one only sets the class.
export default function SuggestedBuilds({character,selectedClass,observations,onSelectClass,onCompareClass}:{
 character:CharacterProfile;selectedClass:ClassProfile;observations:StatObservations
 onSelectClass?:(name:string)=>void;onCompareClass?:(name:string)=>void
}) {
 const [includeLimited,setIncludeLimited]=useState(false)
 const suggestions=useMemo(()=>suggestBuilds(character,observations,{includeLimited}),[character,observations,includeLimited])
 const level=observations.targetLevel
 // After applying or comparing, bring the updated stat card back into view.
 const reveal=()=>{
  const reduce=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.querySelector('.unit-hero')?.scrollIntoView?.({behavior:reduce?'auto':'smooth',block:'center'})
 }
 const select=(name:string)=>{onSelectClass?.(name);reveal()}
 const compare=(name:string)=>{onCompareClass?.(name);reveal()}
 return <section className="suggested-builds" aria-labelledby="suggested-builds-heading">
  <div className="suggested-head">
   <div>
    <h2 id="suggested-builds-heading">Suggested builds</h2>
    <p>The best classes for four build styles, based on {character.name}’s growth rates. Averages are at level {level}.</p>
   </div>
   <label className="suggested-toggle"><input type="checkbox" checked={includeLimited} onChange={event=>setIncludeLimited(event.target.checked)}/>Include one-unit special classes</label>
  </div>
  <div className="suggested-grid">
   {suggestions.map(({style,personal,bestMatch,picks,tied})=>{
    const top=picks[0],current=top?.profile.name===selectedClass.name
    return <div role="group" key={style.id} className={`build-card${bestMatch?' is-best':''}`} aria-labelledby={`build-${style.id}`} data-testid={`build-${style.id}`}>
     <header className="build-card-head">
      <span className="build-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={STYLE_ICONS[style.id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <div>
       <h3 id={`build-${style.id}`}>{style.name}{bestMatch&&<span className="build-badge">Best match</span>}</h3>
       <p>{style.summary} · {character.name}’s own growth {personal}%</p>
      </div>
     </header>
     {top?<>
      <div className="build-pick">
       <div>
        <p className="build-class">{top.profile.name}{current&&<span className="finder-current">Current</span>}</p>
        {classRequirement(top.profile)&&<p className="build-req">{classRequirement(top.profile)}</p>}
       </div>
       <p className="build-focus"><strong>{top.focus}%</strong><span>combined growth</span></p>
      </div>
      <ul className="build-stats" aria-label={`${top.profile.name} growth in ${style.summary}`}>
       {top.stats.map(item=><li key={item.stat}>
        <span className="build-stat-name">{STAT_NAMES[item.stat]}</span>
        <span className="build-bar" aria-hidden="true"><span style={{width:`${Math.min(100,item.growth)}%`}}/></span>
        <span className="build-stat-growth">{item.growth}%</span>
        <span className="build-stat-avg" title={`Average ${STAT_NAMES[item.stat]} at level ${level}`}>{formatExpected(item.average)}</span>
       </li>)}
      </ul>
      {(picks.length>1||tied>0)&&<p className="build-alts">Also strong: {picks.slice(1).map((pick,index)=><span key={pick.profile.name}>{index?', ':''}{pick.profile.name} {pick.focus}%</span>)}{tied>0&&<span className="build-tied"> · {tied} other {tied===1?'class ties':'classes tie'} with {top.profile.name}</span>}</p>}
      <div className="build-actions">
       {!current&&onSelectClass&&<button type="button" className="build-use" aria-label={`Use ${top.profile.name} for ${style.name}`} onClick={()=>select(top.profile.name)}>Use this class</button>}
       {!current&&onCompareClass&&<button type="button" aria-label={`Compare ${top.profile.name} with ${selectedClass.name}`} onClick={()=>compare(top.profile.name)}>Compare</button>}
       {current&&<p className="build-current-note">{character.name} is already using this class.</p>}
      </div>
     </>:<p className="build-req">No class has complete growth data for this style.</p>}
    </div>
   })}
  </div>
  <p className="compare-note">Ranked by the combined growth rate of each style’s three stats; ties go to the higher total growth. “Best match” is the style where {character.name}’s own growth rates are highest. This doesn’t account for weapon ranks, abilities, or whether {character.name} can unlock a class.{includeLimited?'':' Classes limited to one unit are hidden.'}</p>
 </section>
}
