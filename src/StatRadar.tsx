import {useState,type CSSProperties,type KeyboardEvent} from 'react'
import {STAT_NAMES,STATS,type Stat} from './growths'
import {formatExpected} from './expectedStats'

export interface RadarSeries {name:string;values:(number|null)[]}
const SIZE=360,CENTER=SIZE/2,RADIUS=118,LABEL=RADIUS+24
const angle=(index:number)=>-Math.PI/2+index*2*Math.PI/STATS.length
const point=(index:number,radius:number)=>[CENTER+radius*Math.cos(angle(index)),CENTER+radius*Math.sin(angle(index))] as const
const fixed=(value:number)=>Math.round(value*10)/10
// A round outer ring so the grid reads as 10 / 20 / 30 … rather than odd fractions.
export function radarScale(values:(number|null)[]):number {
 const max=Math.max(0,...values.filter((value):value is number=>value!==null&&Number.isFinite(value)))
 const step=max>60?20:10
 return Math.max(step,Math.ceil(max/step)*step)
}
function shape(values:(number|null)[],scale:number) {
 return STATS.map((_,index)=>{const [x,y]=point(index,Math.max(0,Math.min(1,(values[index]??0)/scale))*RADIUS);return `${index?'L':'M'}${fixed(x)} ${fixed(y)}`}).join(' ')+' Z'
}

// Nine-axis "shape" of the build. Values come from the stat sheet; the tiles remain
// the table view, so the tooltip only repeats what is already readable there.
export default function StatRadar({primary,compare,level}:{primary:RadarSeries;compare?:RadarSeries|null;level:number}) {
 const [active,setActive]=useState<number|null>(null)
 const scale=radarScale([...primary.values,...(compare?.values??[])])
 const empty=primary.values.every(value=>value===null)
 const onKey=(event:KeyboardEvent<SVGSVGElement>)=>{
  const step=event.key==='ArrowRight'||event.key==='ArrowDown'?1:event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:0
  if(!step)return
  event.preventDefault()
  setActive(current=>((current??(step>0?-1:0))+step+STATS.length)%STATS.length)
 }
 const summary=`Stat shape at level ${level} for ${primary.name}${compare?` compared with ${compare.name}`:''}: `
  +STATS.map((stat,index)=>`${STAT_NAMES[stat]} ${formatExpected(primary.values[index])}${compare?` vs ${formatExpected(compare.values[index])}`:''}`).join(', ')
 return <figure className="stat-radar" data-testid="stat-radar">
  {compare&&<figcaption className="radar-legend">
   <span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" className="radar-key-primary"/></svg>{primary.name}</span>
   <span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" className="radar-key-compare"/></svg>{compare.name}</span>
  </figcaption>}
  <div className="radar-frame">
   <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} tabIndex={empty?undefined:0}
    onKeyDown={onKey} onFocus={()=>setActive(current=>current??0)} onBlur={()=>setActive(null)} onPointerLeave={()=>setActive(null)}>
    <g className="radar-grid" aria-hidden="true">
     {[.25,.5,.75,1].map(ring=><path key={ring} d={shape(STATS.map(()=>ring*scale),scale)} className={ring===1?'radar-ring outer':'radar-ring'}/>)}
     {STATS.map((stat,index)=>{const [x,y]=point(index,RADIUS);return <line key={stat} x1={CENTER} y1={CENTER} x2={fixed(x)} y2={fixed(y)} className={active===index?'radar-spoke active':'radar-spoke'}/>})}
    </g>
    {!empty&&<>
     {compare&&<path className="radar-area compare" d={shape(compare.values,scale)} style={{d:`path("${shape(compare.values,scale)}")`}}/>}
     <path className="radar-area primary" d={shape(primary.values,scale)} style={{d:`path("${shape(primary.values,scale)}")`}}/>
    </>}
    {/* Scale numbers sit above the shape (with a halo) so a tall HP value never hides them. */}
    <g aria-hidden="true">
     <text x={CENTER+4} y={CENTER-RADIUS/2-3} className="radar-scale">{scale/2}</text>
     <text x={CENTER+4} y={CENTER-RADIUS-3} className="radar-scale">{scale}</text>
    </g>
    {!empty&&<>
     {[compare,primary].map((series,seriesIndex)=>series&&STATS.map((stat,index)=>{
      const value=series.values[index];if(value===null)return null
      const [x,y]=point(index,Math.min(1,value/scale)*RADIUS)
      return <circle key={`${seriesIndex}-${stat}`} className={`radar-dot ${seriesIndex?'primary':'compare'}${active===index?' active':''}`} r={active===index?5.5:4} style={{cx:fixed(x),cy:fixed(y)} as CSSProperties} cx={fixed(x)} cy={fixed(y)}/>
     }))}
    </>}
    {STATS.map((stat,index)=>{
     const [x,y]=point(index,LABEL),anchor=Math.abs(x-CENTER)<4?'middle':x>CENTER?'start':'end'
     return <text key={stat} x={fixed(x)} y={fixed(y)} dy=".35em" textAnchor={anchor} className={active===index?'radar-label active':'radar-label'} aria-hidden="true">{stat}</text>
    })}
    {!empty&&STATS.map((stat,index)=>{
     // Hit target: the whole wedge around each spoke, far bigger than the 8px dot.
     const [ax,ay]=point(index-.5,LABEL+18),[bx,by]=point(index+.5,LABEL+18)
     return <path key={stat} className="radar-hit" d={`M${CENTER} ${CENTER} L${fixed(ax)} ${fixed(ay)} L${fixed(bx)} ${fixed(by)} Z`} onPointerEnter={()=>setActive(index)} onPointerDown={()=>setActive(index)}/>
    })}
   </svg>
   {empty&&<p className="radar-empty">No base stats to chart for this character.</p>}
  </div>
  {/* Readout slot under the chart: never covers the shape, and works for touch and keyboard. */}
  {!empty&&<p className="radar-readout" aria-live="polite" data-testid="radar-readout">
   {active===null?<span className="radar-hint">Hover, tap or use arrow keys to read a stat</span>:<>
    <strong className="radar-readout-title">{STAT_NAMES[STATS[active] as Stat]}</strong>
    <span className="radar-readout-row"><svg width="14" height="6" aria-hidden="true"><line x1="1" y1="3" x2="13" y2="3" className="radar-key-primary"/></svg><b>{formatExpected(primary.values[active])}</b>{compare&&<span>{primary.name}</span>}</span>
    {compare&&<span className="radar-readout-row"><svg width="14" height="6" aria-hidden="true"><line x1="1" y1="3" x2="13" y2="3" className="radar-key-compare"/></svg><b>{formatExpected(compare.values[active])}</b><span>{compare.name}</span></span>}
   </>}
  </p>}
 </figure>
}
