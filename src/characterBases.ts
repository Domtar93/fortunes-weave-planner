import imported from './data/character-bases.json'
import {growthData,type CharacterProfile,type ClassProfile,type Growths} from './growths'
import {numericObservations,parseObservation,projectExpectedStats,type ClassStage,type EarlierClassInput,type StatObservations} from './expectedStats'

export interface CharacterBase {
 name:string;sourceCharacter:string;level:number;stats:Growths
 sources:{url:string;location:string}[]
 conflicts:{stat:string;used:number;alternative:number;alternativeUrl:string}[]
 profileNote:string|null
}
export const characterBases:readonly CharacterBase[]=imported.characters
export const baseStatCredits=imported.credits
const bases=new Map(characterBases.map(base=>[base.name,base]))
export function getCharacterBase(name:string):CharacterBase|null {
 return bases.get(name)??null
}

// Merely typing a checkpoint does not override the automatic result: opt in.
export function projectCharacterAverage(character:CharacterProfile,selectedClass:ClassProfile,observations:StatObservations) {
 const base=getCharacterBase(character.name)
 const custom=observations.startingPoint==='custom'
 const result=projectExpectedStats({targetLevel:observations.targetLevel,
  checkpointLevel:custom?parseObservation(observations.checkpointLevel):base?.level,
  checkpointStats:custom?numericObservations(observations.checkpointStats):base?.stats,
  actualStats:numericObservations(observations.actualStats),
  personalGrowth:character.growths,classGrowth:selectedClass.growths,
  earlierClasses:earlierClassInputs(observations.classPath),finalLabel:selectedClass.name})
 return {base,custom,result}
}
// Unknown class names resolve to missing growth, which marks the stats unsupported rather than guessing.
function earlierClassInputs(path:readonly ClassStage[]|undefined):EarlierClassInput[]|undefined {
 if(!path?.length)return undefined
 return path.map(stage=>({label:stage.className,untilLevel:stage.untilLevel,
  classGrowth:growthData.classes.find(profile=>profile.name===stage.className)?.growths??{}}))
}
