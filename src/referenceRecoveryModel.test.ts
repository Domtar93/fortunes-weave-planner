import {describe,it,expect} from 'vitest'
import {communityData,communityEntries} from './community'
import {createLoadout,resolveLoadout,type BuildLoadout} from './loadouts'
import {formatLoadoutBackup,MAX_BACKUP_BYTES} from './loadoutBackupModel'
import {formatReferenceRecovery,parseReferenceRecovery,validateReferenceRecovery,previewReferenceRecovery,createRecoveredLoadout,suggestedRecoveryName,type ReferenceRecoveryPackage} from './referenceRecoveryModel'

const now='2026-10-28T03:00:00.000Z'
function saved(characterName='Alexandra',id='old'):BuildLoadout {
 const source=communityEntries('Reason',characterName.startsWith('Mu')?'Mu':characterName).find(e=>e.rank==='S+')!.source
 return createLoadout(`Plan ${id}`,{characterName,className:'Gladiator',weaponId:null,mountId:null,battalionId:null,abilities:[{proficiency:'Reason',rank:'S+',source}]},[],now,id)
}
export function previousRecovery(records=[saved()]):ReferenceRecoveryPackage {
 const value=parseReferenceRecovery(formatReferenceRecovery(records)),prefix=`Community ${'a'.repeat(12)}`
 value.snapshotSha256='a'.repeat(64)
 for(const record of value.loadouts)for(const ref of record.abilities)ref.source=ref.source.replace(communityData.namespace,prefix)
 for(const item of value.evidence)item.source=item.source.replace(communityData.namespace,prefix)
 return validateReferenceRecovery(value)
}
describe('reviewed source recovery model',()=>{
 it('exports complete ordered saves and deduplicated evidence, without changing them',()=>{
  const original=[saved()],before=JSON.stringify(original),copy={...original[0],id:'second',name:'Second'}
  const packageValue=parseReferenceRecovery('\uFEFF'+formatReferenceRecovery([...original,copy]))
  expect(packageValue.loadouts).toHaveLength(2);expect(packageValue.evidence).toHaveLength(1)
  expect(packageValue.evidence[0].text).toBe('Black Magic Mastery');expect(JSON.stringify(original)).toBe(before)
  packageValue.evidence[0].text="Leda’s Γ + skill"
  expect(parseReferenceRecovery(JSON.stringify(packageValue)).evidence[0].text).toBe("Leda’s Γ + skill")
 })
 it('maps exact profile/category/rank after a snapshot change while preserving order and original saves',()=>{
  const value=previousRecovery(),old=structuredClone(value.loadouts[0]),preview=previewReferenceRecovery(value,'old')
  expect(preview.mappings[0].status).toBe('source-update');expect(preview.blockingIssues).toEqual([])
  const copy=createRecoveredLoadout(value,'old',new Set(),'Recovered',[old],now,'new')
  expect(copy.id).toBe('new');expect(copy.abilities[0].source).toContain(communityData.namespace)
  expect(value.loadouts[0]).toEqual(old);expect(resolveLoadout(copy).entries[0].entry.text).toBe('Black Magic Mastery')
 })
 it('requires individual approval when recorded unlock text differs, and rejects stale approvals',()=>{
  const value=previousRecovery();value.evidence[0].text='Previous recorded skill'
  const preview=previewReferenceRecovery(value,'old'),key=preview.mappings[0].key
  expect(preview.mappings[0].status).toBe('changed')
  expect(()=>createRecoveredLoadout(value,'old',new Set(),'New',[],now,'new')).toThrow(/individually approve/)
  expect(createRecoveredLoadout(value,'old',new Set([key]),'New',[],now,'new').abilities[0].source).toContain(communityData.namespace)
  value.evidence[0].text='Another old value'
  expect(()=>createRecoveredLoadout(value,'old',new Set([key]),'New',[],now,'new')).toThrow(/individually approve/)
 })
 it.each([[null,'unknown'],['N/A','unavailable'],['One / Two','compound'],['Skill?','placeholder']] as const)('blocks a current %s / %s target without removing or substituting it',(text,state)=>{
  const value=previousRecovery(),record=communityData.learnsets.Reason.characters.Alexandra,original=record.values['S+']
  try{
   record.values['S+']=[text,state,null]
   const preview=previewReferenceRecovery(value,'old');expect(preview.mappings[0].status).toBe('blocked');expect(preview.blockingIssues.length).toBeGreaterThan(0)
   expect(()=>createRecoveredLoadout(value,'old',new Set(preview.mappings.map(r=>r.key)),'New',[])).toThrow(/blocked/)
   expect(value.loadouts[0].abilities).toHaveLength(1)
  }finally{record.values['S+']=original}
 })
 it('blocks missing equipment and duplicate target mappings',()=>{
  const value=previousRecovery();value.loadouts[0].weaponId='missing weapon'
  expect(previewReferenceRecovery(value,'old').blockingIssues.join(' ')).toContain('Missing weapon')
  value.loadouts[0].weaponId=null
  const second={...value.loadouts[0].abilities[0],source:value.loadouts[0].abilities[0].source.replace('K2','L2')}
  value.loadouts[0].abilities.push(second);value.evidence.push({...value.evidence[0],source:second.source,url:value.evidence[0].url.replace('K2','L2')})
  expect(previewReferenceRecovery(value,'old').blockingIssues.join(' ')).toContain('same current source')
 })
 it('retains both Mu profile identities independently',()=>{
  const value=previousRecovery([saved('Mu','one'),saved('Mu (with growth)','two')])
  expect(value.evidence).toHaveLength(2)
  expect(createRecoveredLoadout(value,'one',new Set(),'One',[],now,'r1').characterName).toBe('Mu')
  expect(createRecoveredLoadout(value,'two',new Set(),'Two',[],now,'r2').characterName).toBe('Mu (with growth)')
 })
 it('retains original-workbook references without remapping or requiring invented evidence',()=>{
  const record=saved();record.abilities.push({proficiency:'Sword',rank:'D',source:"'Sword'!B2"})
  const value=previousRecovery([record]),preview=previewReferenceRecovery(value,'old')
  expect(preview.mappings.map(r=>r.status)).toEqual(['source-update','unchanged'])
  expect(preview.selection.abilities.map(r=>r.rank)).toEqual(['S+','D'])
  expect(preview.selection.abilities[1].source).toBe("'Sword'!B2")
 })
 it('can restore an empty plan as a copy and prevents case-insensitive name conflicts',()=>{
  const record=saved();record.abilities=[];const value=parseReferenceRecovery(formatReferenceRecovery([record]))
  expect(createRecoveredLoadout(value,'old',new Set(),'Empty copy',[],now,'new').abilities).toEqual([])
  expect(()=>createRecoveredLoadout(value,'old',new Set(),record.name.toUpperCase(),[record])).toThrow(/already exists/)
  expect(suggestedRecoveryName(record.name,[{...record,name:`${record.name} (recovered)`}])).toBe(`${record.name} (recovered 2)`)
 })
 it('rejects missing/duplicate/unrelated evidence and unsafe or mismatched source links',()=>{
  const original=previousRecovery()
  for(const mutate of [
   (v:ReferenceRecoveryPackage)=>{v.evidence=[]},
   (v:ReferenceRecoveryPackage)=>{v.evidence.push({...v.evidence[0]})},
   (v:ReferenceRecoveryPackage)=>{v.evidence.push({...v.evidence[0],characterName:'Sofia'})},
   (v:ReferenceRecoveryPackage)=>{v.evidence[0].url='javascript:alert(1)'},
   (v:ReferenceRecoveryPackage)=>{v.evidence[0].source=v.evidence[0].source.replace('Black Magic','Sword')},
  ]){const value=structuredClone(original);mutate(value);expect(()=>validateReferenceRecovery(value)).toThrow()}
  expect(()=>validateReferenceRecovery({...original,unexpected:true})).toThrow()
  expect(()=>parseReferenceRecovery('x'.repeat(MAX_BACKUP_BYTES+1))).toThrow(/5 MiB/)
 })
 it('refuses to invent already stale names but keeps normal backups available',()=>{
  const value=previousRecovery()
  expect(()=>formatReferenceRecovery(value.loadouts)).toThrow(/already stale/)
  expect(formatLoadoutBackup(value.loadouts)).toContain('Community aaaaaaaaaaaa')
 })
 it('blocks removed profiles including prototype-like names',()=>{
  const value=previousRecovery();value.loadouts[0].characterName='constructor';value.evidence[0].characterName='constructor'
  expect(previewReferenceRecovery(value,'old').blockingIssues.length).toBeGreaterThan(0)
 })
})
