import {growthData,STATS,type CharacterProfile,type ClassProfile,type Stat} from './growths'
import {type StatObservations} from './expectedStats'
import {projectCharacterAverage} from './characterBases'

// Suggested builds are computed, not curated: each style names three stats and the
// planner picks the classes whose growth rates add up highest for this character.
// No community picks or extra numbers are introduced.
export interface BuildStyle {id:string;name:string;stats:readonly [Stat,Stat,Stat];summary:string}
export const BUILD_STYLES:readonly BuildStyle[]=[
 {id:'physical',name:'Physical attacker',stats:['Str','Spd','Dex'],summary:'Strength, Speed and Dexterity'},
 {id:'magic',name:'Magic attacker',stats:['Mag','Spd','Dex'],summary:'Magic, Speed and Dexterity'},
 {id:'defender',name:'Defender',stats:['HP','Def','Res'],summary:'HP, Defense and Resistance'},
 {id:'leader',name:'Leader',stats:['Cha','Lck','HP'],summary:'Charm, Luck and HP'},
]

export interface ClassPick {
 profile:ClassProfile
 focus:number
 total:number|null
 stats:{stat:Stat;growth:number;average:number|null}[]
}
export interface Suggestion {style:BuildStyle;personal:number;bestMatch:boolean;picks:ClassPick[];tied:number}

// Classes marked in the research sheet as "Limited to only ONE unit".
export const isLimitedClass=(profile:ClassProfile)=>/only ONE unit/iu.test(profile.details.additionalUnlocks.text??'')
const finite=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value)

export function suggestBuilds(character:CharacterProfile,observations:StatObservations,{includeLimited=false,picks=3}:{includeLimited?:boolean;picks?:number}={}):Suggestion[] {
 const classes=growthData.classes.map((profile,order)=>({profile,order,rows:projectCharacterAverage(character,profile,observations).result.rows}))
  .filter(entry=>includeLimited||!isLimitedClass(entry.profile))
 const personalSums=BUILD_STYLES.map(style=>style.stats.reduce((sum,stat)=>sum+(finite(character.growths[stat])?character.growths[stat]:0),0))
 const best=Math.max(...personalSums)
 return BUILD_STYLES.map((style,styleIndex)=>{
  const ranked=classes.flatMap(entry=>{
   const stats=style.stats.map(stat=>{const row=entry.rows[STATS.indexOf(stat)];return {stat,growth:row.effective,average:row.projected}})
   if(!stats.every(item=>finite(item.growth)))return []
   const total=entry.rows.every(row=>finite(row.effective))?entry.rows.reduce((sum,row)=>sum+row.effective!,0):null
   return [{entry,pick:{profile:entry.profile,focus:stats.reduce((sum,item)=>sum+item.growth!,0),total,stats:stats as ClassPick['stats']}}]
  }).sort((a,b)=>b.pick.focus-a.pick.focus||(b.pick.total??-Infinity)-(a.pick.total??-Infinity)||a.entry.order-b.entry.order)
  const top=ranked[0]?.pick
  const tied=top?ranked.filter(item=>item.pick!==top&&item.pick.focus===top.focus&&item.pick.total===top.total).length:0
  return {style,personal:personalSums[styleIndex],bestMatch:personalSums[styleIndex]===best,picks:ranked.slice(0,picks).map(item=>item.pick),tied}
 })
}
