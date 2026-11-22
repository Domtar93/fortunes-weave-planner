import { combineGrowths, growthData, STATS, type CharacterProfile, type ClassProfile, type GrowthData, type Growths } from './growths'

export interface BuildSelection {
  characterName: string
  className: string
}
export interface ComparedBuild {
  character: CharacterProfile
  selectedClass: ClassProfile
  combined: Growths
}
export interface GrowthComparison {
  a: ComparedBuild
  b: ComparedBuild
  difference: Growths
}
type ComparisonData = Pick<GrowthData, 'characters' | 'classes'>

export function calculateBuild(selection: BuildSelection, data: ComparisonData = growthData): ComparedBuild {
  const character = data.characters.find(profile => profile.name === selection.characterName)
  const selectedClass = data.classes.find(profile => profile.name === selection.className)
  if (!character) throw new Error(`Unknown character profile: ${selection.characterName}`)
  if (!selectedClass) throw new Error(`Unknown class: ${selection.className}`)
  return { character, selectedClass, combined: combineGrowths(character.growths, selectedClass.growths) }
}

export function compareGrowthBuilds(a: BuildSelection, b: BuildSelection, data: ComparisonData = growthData): GrowthComparison {
  const first = calculateBuild(a, data)
  const second = calculateBuild(b, data)
  const difference = Object.fromEntries(STATS.map(stat => [stat, second.combined[stat] - first.combined[stat]])) as Growths
  return { a: first, b: second, difference }
}

export function formatPercentagePoints(value: number): string {
  return `${value > 0 ? '+' : ''}${value} pp`
}
