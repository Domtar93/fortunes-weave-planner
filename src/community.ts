import packed from './data/community-runtime.json'
import { unpackRuntimeData } from './runtimeCodec.js'
import type { DataStatus, Proficiency } from './growths'
import type { GlossaryEntry, LearnsetEntry, LearnsetState } from './proficiencies'

export interface CommunityField { value: string | number | boolean | null; status: DataStatus; source: string; url: string; note: string | null; formula: string | null; error: { type: string; message: string } | null }
export interface CommunityCharacter {
 inherent: CommunityField; inherentDescription: CommunityField; equippable: CommunityField; equippableDescription: CommunityField
 bloodmark: CommunityField; bloodmarkDescription: CommunityField; recruitment: Record<string, CommunityField>; proficiencies: Record<Proficiency, CommunityField>
}
interface CommunityCategory { sheet: string; gid: number; columns: Record<string, number>; characters: Record<string, {row: number; values: Record<string, [string | null, LearnsetState, string | null]>}> }
interface CommunityData {
 schemaVersion: number; sourceUrl: string; sourceTitle: string; snapshotSha256: string; namespace: string
 characters: Record<string, CommunityCharacter>; learnsets: Record<Proficiency, CommunityCategory>
 skills: {name: string; description: CommunityField; access: CommunityField}[]
 combatArts: CombatArtReference[]
 sheets: {title: string; gid: number; key: string; rows: number; cells: number; sha256: string}[]
 issues: {sheet: string; cell: string; kind: string; message: string}[]
}
export interface CombatArtReference { name:string; proficiency:Proficiency; row:number; reference:CommunityField; origin:CommunityField; effect:CommunityField }
export interface CommunityReferenceRequest { row:number; sequence:number }
// The importer validates identities and fields; the packer verifies exact whole-data equality.
export const communityData = unpackRuntimeData(packed) as CommunityData
export const isCommunitySource = (source: string) => source.startsWith(`${communityData.namespace}: `)
export const ALL_RANKS = ['E','E+','D','D+','C','C+','B','B+','A','A+','S','S+']
export function columnName(n: number): string {
 let text=''; for (;n;n=Math.floor((n-1)/26)) text=String.fromCharCode(65+(n-1)%26)+text
 return text
}
export function communityEntries(category: Proficiency, identity: string): LearnsetEntry[] {
 const dataset=communityData.learnsets[category], record=Object.hasOwn(dataset.characters,identity)?dataset.characters[identity]:undefined
 if (!record) return []
 return ALL_RANKS.filter(rank=>Object.hasOwn(record.values,rank)).map(rank=>{
  const [text,state,note]=record.values[rank], cell=`${columnName(dataset.columns[rank])}${record.row}`
  const url=`${communityData.sourceUrl}#gid=${dataset.gid}&range=${cell}`
  return {rank,text,state,note,matrixText:null,matrixSource:'',source:`${communityData.namespace}: ${dataset.sheet}!${cell}`,sourceUrl:url,
   reliability:'unverified',evidence:'Additional community source / unverified; separate from corrected workbook'}
 })
}
export function communityGlossary(text: string | null): GlossaryEntry | undefined {
 const matches=communityData.skills.filter(item=>item.name===text?.trim())
 const descriptions=new Set(matches.map(item=>item.description.value))
 if (!matches.length || descriptions.size!==1 || typeof matches[0].description.value!=='string') return undefined
 const field=matches[0].description
 return {name:text!.trim(),description:String(field.value),evidence:'Additional community source / unverified',note:field.note,
  reference:field.url,source:`${communityData.namespace}: ${field.source}`,reliability:'unverified'}
}
export function combatArtReferences(proficiency:Proficiency,text:string|null):CombatArtReference[] {
 return text ? communityData.combatArts.filter(item=>item.proficiency===proficiency&&item.name===text.trim()) : []
}
export interface ReferenceCell { column: number; value: string | number | boolean | null; formatted: string | null; note: string | null; formula: string | null; error: {type: string; message: string} | null }
export interface ReferenceSheet { title: string; gid: number; key: string; rows: {row: number; cells: ReferenceCell[]}[] }
export function referenceFieldLabel(sheet: ReferenceSheet, rowNumber: number, column: number): string {
 const twoRow=['Characters','Datamined Characters','Classes','Dungeon Chests','Combat Arts','Equipable Skills'].includes(sheet.title)
 const primary=sheet.rows.find(row=>row.row===(twoRow?2:1))
 const repeated=sheet.rows.filter(row=>row.row<=rowNumber&&row.cells.some(c=>c.column===1&&['Name','Skill Name','Class Tier','Weapon','Spell','Dungeon'].includes(String(c.value))))
 const header=repeated.at(-1)??primary
 const label=String(header?.cells.find(c=>c.column===column)?.value??`Column ${columnName(column)}`)
 if(sheet.title==='Dungeon Chests'&&column>=3&&column<=12)return `Part ${column<8?'I':'III'} · ${label}`
 if(sheet.title==='Classes') {
  if(column>=13&&column<=24)return `Proficiency XP bonus · ${label}`
  if(column>=25&&column<=33)return `Growth modifier (%) · ${label}`
  if(column>=34&&column<=42)return `Flat stat bonus (points) · ${label}`
  if(column>=43&&column<=51)return `Base stats (work in progress) · ${label}`
  if(column===9)return 'Class ability description'
  if(column===11)return 'Mastery ability description'
 }
 if(sheet.title==='Characters') {
  if(column>=2&&column<=11)return `Growth rates (%) · ${label}`
  if(column>=12&&column<=21)return `Base stats (reference only) · ${label}`
  if(column>=22&&column<=33)return `Proficiency boon/bane · ${label}`
 }
 if(twoRow&&!['Classes','Dungeon Chests','Combat Arts','Equipable Skills'].includes(sheet.title)) {
  const groups=sheet.rows.find(row=>row.row===1)?.cells.filter(c=>c.column<=column&&typeof c.value==='string')
  const group=groups?.at(-1)?.value
  if(group)return `${group} · ${label}`
 }
 return label
}
export function referenceDisplayValue(cell: ReferenceCell): string {
 return cell.value===null?'Unknown / blank':cell.formatted??String(cell.value)
}
export function referenceRowLabel(sheet: ReferenceSheet, row: ReferenceSheet['rows'][number]): string {
 const refine=row.cells.find(c=>c.column===4)?.value
 if (sheet.title==='Forging' && (refine==='Base'||typeof refine==='number'||typeof refine==='string'&&/^\+\d+$/u.test(refine))) {
  let parent: string | undefined
  for (const candidate of sheet.rows) {
   if(candidate.row>row.row) break
   const name=candidate.cells.find(c=>c.column===1)?.value, level=candidate.cells.find(c=>c.column===4)?.value
   if(typeof name==='string'&&level==='Base')parent=name
  }
  if(parent) return `${parent} · ${row.cells.find(c=>c.column===4)?.value ?? `source row ${row.row}`}`
 }
 const first=row.cells.find(c=>c.column===(sheet.title==='Equipable Skills'?2:1))?.value
 return `${first ?? sheet.title} · row ${row.row}`
}
export function referenceRows(sheet: ReferenceSheet, search: string) {
 const query=search.trim().toLocaleLowerCase()
 return sheet.rows.filter(row=>!query || `${referenceRowLabel(sheet,row)}\n${row.cells.map(c=>`${c.value??''}\n${c.note??''}`).join('\n')}`.toLocaleLowerCase().includes(query))
}
