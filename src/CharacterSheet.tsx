import {useState,type ReactNode} from 'react'
import {growthData,type CharacterProfile,type ClassProfile} from './growths'
import StatCurve from './StatCurve'
import ExpectedStatsByLevel,{useSessionObservations} from './ExpectedStatsByLevel'
import ClassPathEditor from './ClassPathEditor'
import {projectCharacterAverage} from './characterBases'
import {type ClassStage} from './expectedStats'
import StatSheet from './StatSheet'
import SuggestedBuilds from './SuggestedBuilds'

// Owns the session-only observations so typing a stat re-renders only the sheet
// and comparison, never the rest of the planner. Controls/actions come from App.
// The "compare with" class is a viewing aid only: never saved or exported.
export default function CharacterSheet({character,selectedClass,targetLevel,controls,actions,notes,onSelectClass,classPath=[],onClassPathChange}:{
 character:CharacterProfile;selectedClass:ClassProfile;targetLevel:number;controls:ReactNode;actions:ReactNode;notes?:ReactNode
 onSelectClass?:(name:string)=>void;classPath?:ClassStage[];onClassPathChange?:(path:ClassStage[])=>void
}) {
 const [sessionObservations,setObservations]=useSessionObservations(character.name,targetLevel)
 // The class path is owned by App (it goes into share links); every projection below reads it.
 const observations=classPath.length>0?{...sessionObservations,classPath}:sessionObservations
 const startLevel=onClassPathChange?projectCharacterAverage(character,selectedClass,{...sessionObservations,targetLevel:99}).result.intervalStart:null
 const [compareClassName,setCompareClassName]=useState('')
 return <>
  <section className="character-sheet" aria-labelledby="planner-build-heading">
   <h2 id="planner-build-heading" className="sheet-title" tabIndex={-1}>Build your character</h2>
   {controls}
   {onClassPathChange&&<ClassPathEditor path={classPath} finalClass={selectedClass} targetLevel={targetLevel} startLevel={startLevel} onChange={onClassPathChange}/>}
   <StatSheet character={character} selectedClass={selectedClass} observations={observations}
    compareClassName={compareClassName} onCompareClass={setCompareClassName} onSelectClass={onSelectClass}/>
   {actions}
   <StatCurve character={character} selectedClass={selectedClass} observations={observations}
    compareClass={compareClassName&&compareClassName!==selectedClass.name?growthData.classes.find(profile=>profile.name===compareClassName)??null:null}/>
  </section>
  <SuggestedBuilds character={character} selectedClass={selectedClass} observations={observations}
   onSelectClass={onSelectClass} onCompareClass={setCompareClassName}/>
  {notes}
  <ExpectedStatsByLevel character={character} selectedClass={selectedClass} observations={observations} onChange={next=>setObservations({...next,classPath:undefined})}/>
 </>
}
