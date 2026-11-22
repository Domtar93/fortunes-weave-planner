import {useState,type ReactNode} from 'react'
import {growthData,type CharacterProfile,type ClassProfile} from './growths'
import StatCurve from './StatCurve'
import ExpectedStatsByLevel,{useSessionObservations} from './ExpectedStatsByLevel'
import StatSheet from './StatSheet'
import SuggestedBuilds from './SuggestedBuilds'

// Owns the session-only observations so typing a stat re-renders only the sheet
// and comparison, never the rest of the planner. Controls/actions come from App.
// The "compare with" class is a viewing aid only: never saved or exported.
export default function CharacterSheet({character,selectedClass,targetLevel,controls,actions,notes,onSelectClass}:{
 character:CharacterProfile;selectedClass:ClassProfile;targetLevel:number;controls:ReactNode;actions:ReactNode;notes?:ReactNode
 onSelectClass?:(name:string)=>void
}) {
 const [observations,setObservations]=useSessionObservations(character.name,targetLevel)
 const [compareClassName,setCompareClassName]=useState('')
 return <>
  <section className="character-sheet" aria-labelledby="planner-build-heading">
   <h2 id="planner-build-heading" className="sheet-title" tabIndex={-1}>Build your character</h2>
   {controls}
   <StatSheet character={character} selectedClass={selectedClass} observations={observations}
    compareClassName={compareClassName} onCompareClass={setCompareClassName} onSelectClass={onSelectClass}/>
   {actions}
   <StatCurve character={character} selectedClass={selectedClass} observations={observations}
    compareClass={compareClassName&&compareClassName!==selectedClass.name?growthData.classes.find(profile=>profile.name===compareClassName)??null:null}/>
  </section>
  <SuggestedBuilds character={character} selectedClass={selectedClass} observations={observations}
   onSelectClass={onSelectClass} onCompareClass={setCompareClassName}/>
  {notes}
  <ExpectedStatsByLevel character={character} selectedClass={selectedClass} observations={observations} onChange={setObservations}/>
 </>
}
