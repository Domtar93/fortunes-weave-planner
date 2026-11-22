import {useEffect,useState} from 'react'
import {validLevel} from './expectedStats'

// Common planning targets, one tap away. Any level from 1 to 99 can still be typed.
export const LEVEL_SHORTCUTS=[1,10,20,30,40,50] as const

// One level control for the whole build: stepper, typed value and slider stay in sync.
// Partial typing (an empty field, "4" on the way to "41") is kept as a local draft.
export default function LevelControl({level,onChange}:{level:number;onChange:(level:number)=>void}) {
 const [draft,setDraft]=useState(String(level))
 useEffect(()=>setDraft(String(level)),[level])
 const commit=(value:number)=>{if(validLevel(value))onChange(value)}
 return <div className="level-control">
  <label htmlFor="target-level">Level</label>
  <div className="level-stepper">
   <button type="button" aria-label="Decrease level" disabled={level<=1} onClick={()=>commit(level-1)}>−</button>
   <input id="target-level" type="number" inputMode="numeric" min={1} max={99} step={1} value={draft} aria-describedby="target-level-help"
    onChange={event=>{setDraft(event.target.value);const value=Number(event.target.value);if(event.target.value.trim()!==''&&validLevel(value))onChange(value)}}
    onBlur={()=>setDraft(String(level))}/>
   <button type="button" aria-label="Increase level" disabled={level>=99} onClick={()=>commit(level+1)}>+</button>
  </div>
  <input className="level-slider" type="range" min={1} max={99} step={1} value={level} aria-label="Level slider" onChange={event=>commit(Number(event.target.value))}/>
  <div className="level-shortcuts" role="group" aria-label="Level shortcuts">
   {LEVEL_SHORTCUTS.map(value=><button type="button" key={value} aria-label={`Jump to level ${value}`} aria-pressed={level===value} onClick={()=>commit(value)}>{value}</button>)}
  </div>
  <span className="sr-only" id="target-level-help">Level 1 to 99. A planning target, not saved.</span>
 </div>
}
