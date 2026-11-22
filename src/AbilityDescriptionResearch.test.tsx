import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbilityEffect from './AbilityEffect'
import ProficiencyProgression from './ProficiencyProgression'
import {resolveAbilityInformation} from './abilityInfo'
import {growthData} from './growths'
import {proficiencyData} from './proficiencies'
import {resolvePlanningEntry} from './shortlist'
import {formatShortlistText} from './shortlistText'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
describe('researched ability information in the planner',()=>{
 it('shows a researched Excalibur effect without implying a new effectiveness multiplier',()=>{
  render(<AbilityEffect information={resolveAbilityInformation({name:'Excalibur',proficiency:'Reason'})}/>)
  expect(screen.getByText(/Effective against flying foes/)).toBeDefined()
  expect(screen.queryByText(/No effect description/)).toBeNull()
  expect(screen.getByText('15')).toBeDefined()
  expect(screen.queryByText(/2×|3×|double damage|triple damage/)).toBeNull()
 })
 it('shows compound effects separately and preserves original child annotations',()=>{
  const info=resolveAbilityInformation({name:'Heal (base)\nPhysic (A+)\nRestore (A+)',proficiency:'Faith'})
  render(<AbilityEffect information={info}/>)
  for(const name of ['Heal (base)','Physic (A+)','Restore (A+)'])expect(screen.getByRole('heading',{name})).toBeDefined()
  expect(screen.getByText('Restores HP to an ally.')).toBeDefined()
  expect(screen.queryByText(/No effect description/)).toBeNull()
 })
 it('shows only recorded upgrade values, without pretending the effect is fully known',()=>{
  const info=resolveAbilityInformation({name:'Greater Hexblade+',proficiency:'Sword'})
  render(<AbilityEffect information={info}/>)
  expect(info.descriptionKind).toBe('recorded-values')
  expect(screen.getByText('Recorded upgrade values: Might +15; Hit +20.')).toBeDefined()
  expect(screen.queryByText('Cost')).toBeNull()
  expect(screen.queryByText(/No additional effect|no special effect/)).toBeNull()
 })
 it('shows the newly documented Lend Resistance effect while preserving the disputed Ninae unlock',()=>{
  const info=resolveAbilityInformation({name:'Lend Resistance',characterName:'Ninae',proficiency:'Authority',rank:'S',source:"'Authority'!F42"})
  render(<AbilityEffect information={info}/>)
  expect(info.description).toBe("Grants Res+2 to an ally until unit's next phase.")
  expect(info.descriptionKind).toBe('web-reference')
  expect(screen.getByText(/conflicts with Ninae's current Authority S record/)).toBeDefined()
  expect(screen.queryByText(/No effect description/)).toBeNull()
  expect(document.body.textContent).not.toMatch(/Res\+5|Resistance \+5/)
  expect(info.references.some(ref=>ref.url==='https://yuphastemple.com/?item=lend-resistance')).toBe(true)
 })
 it('passes historical source scope from the actual inspector and keeps citations closed',async()=>{
  const user=userEvent.setup()
  render(<ProficiencyProgression initialOpen character={growthData.characters.find(c=>c.name==='Orchel')!} selectedClass={growthData.classes[0]}/>)
  await user.click(screen.getByRole('button',{name:'Spear'}))
  await user.click(screen.getByRole('button',{name:'Brilliant Blow'}))
  const info=screen.getByRole('complementary',{name:'Ability information'})
  expect(within(info).getByText(/After defeating a foe, grants Rsl\+7/)).toBeDefined()
  expect(within(info).getByText('Sources & details').closest('details')?.open).toBe(false)
 })
 it('uses the same corrected historical effect in the shared Copy/TXT formatter',()=>{
  const entry=proficiencyData.categories.Spear.characters.Orchel.find(entry=>entry.text==='Brilliant Blow')!
  const planned=resolvePlanningEntry('Orchel','Spear',entry.rank,entry.source)!
  const text=formatShortlistText({id:'Orchel',displayName:'Orchel'},[planned],growthData.metadata)
  expect(text).toContain('Effect: After defeating a foe, grants Rsl+7')
  expect(text).toContain('Reviewed historical-name reconciliation')
  expect(text).toContain("Source: 'Spear'!E47")
  expect(text).toContain('https://annasnotebook.net/en/skills/brilliant-strike/')
 })
})
