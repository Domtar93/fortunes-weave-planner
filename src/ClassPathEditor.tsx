import {useState} from 'react'
import {growthData,type ClassProfile} from './growths'
import {MAX_EARLIER_CLASSES,type ClassStage} from './expectedStats'

// Most characters start in this class, so it is the first suggestion for an earlier class.
const STARTING_CLASS='Commoner / Noble'

// Class path (November 25, 2026): optional classes used before the main Class, each held
// until a chosen level. Session-only, like the stat observations; the averages, chart, class
// finder and suggestions all read it through projectCharacterAverage.
export default function ClassPathEditor({path,finalClass,targetLevel,startLevel,onChange}:{
 path:readonly ClassStage[];finalClass:ClassProfile;targetLevel:number;startLevel:number|null;onChange:(next:ClassStage[])=>void
}) {
 // Typed levels stay as text until they are a whole number, so a field can be cleared and retyped.
 const [drafts,setDrafts]=useState<Record<number,string>>({})
 const lastUntil=path.at(-1)?.untilLevel??startLevel??1
 const canAdd=path.length<MAX_EARLIER_CLASSES&&lastUntil<98
 const update=(index:number,stage:Partial<ClassStage>)=>onChange(path.map((current,position)=>position===index?{...current,...stage}:current))
 const remove=(index:number)=>{setDrafts({});onChange(path.filter((_,position)=>position!==index))}
 const add=()=>{
  const used=new Set([finalClass.name,...path.map(stage=>stage.className)])
  const preferred=path.length===0&&finalClass.name!==STARTING_CLASS&&growthData.classes.some(profile=>profile.name===STARTING_CLASS)?STARTING_CLASS
   :growthData.classes.find(profile=>!used.has(profile.name))?.name??growthData.classes[0].name
  onChange([...path,{className:preferred,untilLevel:Math.min(98,Math.max(2,Math.floor(lastUntil/10)*10+10))}])
 }
 const finalFrom=path.at(-1)?.untilLevel
 return <section className="class-path" aria-labelledby="class-path-heading">
  <div className="class-path-head">
   <h3 id="class-path-heading">Class path</h3>
   <p>{path.length===0?<>Optional. Changed class along the way? Add the classes you used before {finalClass.name}.</>
    :<>Each level-up uses the class you hold before it: after changing class at level 10, the level-up to 11 uses the new class.</>}</p>
  </div>
  {path.length>0&&<ol className="class-path-steps" aria-label="Classes in order">
   {path.map((stage,index)=>{
    const levelId=`class-path-level-${index}`
    return <li className="class-path-step" key={index}>
     <span className="class-path-number" aria-hidden="true">{index+1}</span>
     <div className="select-wrap"><select aria-label={`Earlier class ${index+1}`} value={stage.className} onChange={event=>update(index,{className:event.target.value})}>
      {growthData.classes.map(profile=><option key={profile.name} value={profile.name}>{profile.name}</option>)}
     </select><span aria-hidden="true">⌄</span></div>
     <label className="class-path-until" htmlFor={levelId}>until level</label>
     <input id={levelId} className="class-path-level" type="number" inputMode="numeric" min={2} max={98}
      aria-label={`Earlier class ${index+1}: held until level`}
      value={Object.hasOwn(drafts,index)?drafts[index]:String(stage.untilLevel)}
      onChange={event=>{
       const text=event.target.value
       setDrafts(current=>({...current,[index]:text}))
       if(/^\d{1,2}$/u.test(text))update(index,{untilLevel:Number(text)})
      }}
      onBlur={()=>setDrafts(current=>{const next={...current};delete next[index];return next})}/>
     <button type="button" className="class-path-remove" aria-label={`Remove earlier class ${index+1}`} onClick={()=>remove(index)}>×</button>
    </li>
   })}
   <li className="class-path-step is-final">
    <span className="class-path-number" aria-hidden="true">{path.length+1}</span>
    <strong>{finalClass.name}</strong>
    <span className="class-path-range">{finalFrom!==undefined&&targetLevel<=finalFrom?`not reached by level ${targetLevel}`:`level ${finalFrom} → ${targetLevel}`}</span>
    <span className="class-path-hint">your Class above</span>
   </li>
  </ol>}
  <div className="class-path-actions">
   {canAdd&&<button type="button" className="class-path-add" onClick={add}>+ Add an earlier class</button>}
   {path.length>0&&<button type="button" className="link-button" onClick={()=>{setDrafts({});onChange([])}}>Clear class path</button>}
  </div>
  {path.length>0&&<p className="class-path-note">Only growth rates change with the class. Fixed class stat bonuses, mounts and certification exams aren’t included.</p>}
 </section>
}
