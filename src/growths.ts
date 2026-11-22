import imported from './runtimeData'

export const STATS = ['HP', 'Str', 'Mag', 'Spd', 'Dex', 'Def', 'Res', 'Lck', 'Cha'] as const
export type Stat = (typeof STATS)[number]
export type Growths = Record<Stat, number>
export const ROUTES = ['Cai', 'Dietrich', 'Theodora', 'Leda'] as const
export type Route = (typeof ROUTES)[number]
export const PROFICIENCIES = ['Sword', 'Spear', 'Axe', 'Bow', 'Gauntlet', 'Reason', 'Faith', 'Authority', 'Infantry', 'Riding', 'Armor', 'Flying'] as const
export type Proficiency = (typeof PROFICIENCIES)[number]
export const PROFICIENCY_NAMES: Record<Proficiency, string> = {
  Sword: 'Sword', Spear: 'Spear', Axe: 'Axe', Bow: 'Bow', Gauntlet: 'Gauntlets',
  Reason: 'Black Magic', Faith: 'White Magic', Authority: 'Authority', Infantry: 'Infantry',
  Riding: 'Riding', Armor: 'Heavy Armor', Flying: 'Flying',
}
export const DATA_STATUS_LABELS = {
  confirmed: 'Confirmed', unverified: 'Unverified', unknown: 'Unknown', unavailable: 'Unavailable',
} as const
export type DataStatus = keyof typeof DATA_STATUS_LABELS
export interface SourceText {
  text: string | null
  // JSON string values are narrowed at the import boundary; see isDataStatus.
  status: DataStatus
  source: string
}
export interface SourceNumber {
  value: number | null
  status: DataStatus
  source: string
}
export interface Profile {
  name: string
  growths: Growths
  source: { sheet: string; row: number; range: string }
  notes: string[]
}
export interface CharacterProfile extends Profile {
  personal: { inherent: SourceText; equippable: SourceText }
  recruitment: Record<Route, SourceText>
}
export interface ClassDetailsData {
  license: SourceText
  level: SourceText
  renown: SourceText
  primaryRequirements: SourceText
  secondaryRequirements: SourceText
  masteryAbility: SourceText
  masteryDescription: SourceText
  abilities: SourceText
  abilityDescriptions: SourceText
  additionalUnlocks: SourceText
  allowedWeaponsAndSkills: SourceText
  mountType: SourceText
  proficiencyExperience: Record<Proficiency, SourceNumber>
  flatStatBonuses: Record<Stat, SourceNumber>
  movement: SourceNumber
}
export interface ClassProfile extends Profile {
  details: ClassDetailsData
}
export interface GrowthData {
  schemaVersion: number
  units: string
  stats: string[]
  characters: CharacterProfile[]
  classes: ClassProfile[]
  metadata: {
    sourceFile: string
    sourceSha256: string
    counts: { characters: number; classes: number }
    unresolvedGrowthIssues: { severity: string; code: string; location: string; message: string }[]
  }
}

export function isDataStatus(value: string): value is DataStatus {
  return Object.hasOwn(DATA_STATUS_LABELS, value)
}

function sourceText(field: { text: string | null; status: string; source: string }): SourceText {
  if (!isDataStatus(field.status)) throw new Error(`Unknown data status at ${field.source}: ${field.status}`)
  return { ...field, status: field.status }
}

function sourceNumber(field: { value: number | null; status: string; source: string }): SourceNumber {
  if (!isDataStatus(field.status)) throw new Error(`Unknown data status at ${field.source}: ${field.status}`)
  return { ...field, status: field.status }
}

// Preserve every required key while narrowing the JSON's widened status strings.
function numberFields<T extends string>(fields: Record<T, { value: number | null; status: string; source: string }>): Record<T, SourceNumber> {
  const result = { ...fields } as Record<T, SourceNumber>
  for (const key of Object.keys(fields) as T[]) result[key] = sourceNumber(fields[key])
  return result
}

// Structural typing checks all nine growth keys and required text fields.
// JSON widens string literals, so explicitly validate evidence statuses instead of casting them.
export const growthData: GrowthData = {
  ...imported,
  characters: imported.characters.map(profile => ({
    ...profile,
    personal: { inherent: sourceText(profile.personal.inherent), equippable: sourceText(profile.personal.equippable) },
    recruitment: {
      Cai: sourceText(profile.recruitment.Cai), Dietrich: sourceText(profile.recruitment.Dietrich),
      Theodora: sourceText(profile.recruitment.Theodora), Leda: sourceText(profile.recruitment.Leda),
    },
  })),
  classes: imported.classes.map(profile => ({
    ...profile,
    details: {
      license: sourceText(profile.details.license), level: sourceText(profile.details.level),
      renown: sourceText(profile.details.renown), primaryRequirements: sourceText(profile.details.primaryRequirements),
      secondaryRequirements: sourceText(profile.details.secondaryRequirements),
      masteryAbility: sourceText(profile.details.masteryAbility), masteryDescription: sourceText(profile.details.masteryDescription),
      abilities: sourceText(profile.details.abilities), abilityDescriptions: sourceText(profile.details.abilityDescriptions),
      additionalUnlocks: sourceText(profile.details.additionalUnlocks),
      allowedWeaponsAndSkills: sourceText(profile.details.allowedWeaponsAndSkills), mountType: sourceText(profile.details.mountType),
      proficiencyExperience: numberFields(profile.details.proficiencyExperience),
      flatStatBonuses: numberFields(profile.details.flatStatBonuses), movement: sourceNumber(profile.details.movement),
    },
  })),
} satisfies GrowthData

export function combineGrowths(personal: Growths, classModifier: Growths): Growths {
  return Object.fromEntries(STATS.map(stat => {
    if (!Number.isFinite(personal[stat]) || !Number.isFinite(classModifier[stat])) {
      throw new Error(`Missing or malformed ${stat} growth`)
    }
    return [stat, personal[stat] + classModifier[stat]]
  })) as Growths
}

export function formatPercent(value: number): string {
  return `${value}%`
}

export function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${formatPercent(value)}`
}

export const STAT_NAMES: Record<Stat, string> = {
  HP: 'Health', Str: 'Strength', Mag: 'Magic', Spd: 'Speed', Dex: 'Dexterity',
  Def: 'Defense', Res: 'Resistance', Lck: 'Luck', Cha: 'Charm',
}
