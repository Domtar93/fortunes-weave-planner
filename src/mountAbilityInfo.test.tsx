import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import MountAbilityEffects from './MountAbilityEffects'
import MountReference from './MountReference'
import source from './data/community-sheets/sheet-279385932.json'
import type { ReferenceSheet } from './community'
import { mountData } from './mounts'
import { buildMountAbilityIndex, loadMountAbilityIndex, mountAbilityInformation } from './mountAbilityInfo'

afterEach(cleanup)
const index = buildMountAbilityIndex(source)
const mount = (name: string) => mountData.records.find(record => record.name === name)!

describe('source-scoped mount skill effects', () => {
  it('recovers every one of the20 exact note definitions and every listed option for22 mounts', () => {
    expect(index.size).toBe(20)
    expect(mountData.records).toHaveLength(22)
    for (const record of mountData.records) {
      expect(mountAbilityInformation(record, index).map(effect => effect.name)).toEqual(record.abilities.text!.split(',').map(name => name.trim()))
    }
    for (const row of source.rows.filter(row => row.row >= 34 && row.row <= 53)) {
      const cell = row.cells.find(cell => cell.column === 1)!
      expect(index.get(String(cell.value))?.description).toBe(cell.note)
      expect(index.get(String(cell.value))?.source).toBe(`Mounts!A${row.row} (note)`)
    }
  })

  it('preserves the original base/upgrade notation without inventing bond levels or numeric healing', () => {
    expect(index.get('Paired Run')?.description).toBe('Grants Mov+1 (+2).')
    expect(index.get('Paired Healing')?.description).toBe('After combat, restores a little (some) HP to unit')
    expect(index.get('Paired Magic Speed')?.description).toBe('When in combat, grants Avo+10 (+20). Trigger % = Mag')
    expect(index.get('Canto')?.description).toBe('After combat, unit can move up to 1 (2) space(s).')
    expect([...index.values()].some(effect => /bond|level|lvl/iu.test(effect.description))).toBe(false)
  })

  it('requires the exact listed name and mount association instead of borrowing unrelated skill effects', () => {
    const original = mount('White Ornius')
    const change = (text: string) => ({ ...original, abilities: { ...original.abilities, text } })
    expect(mountAbilityInformation(change('Paired Run'), index)).toEqual([])
    expect(mountAbilityInformation(change('Paired Purify+'), index)).toEqual([])
    expect(mountAbilityInformation(change('paired purify'), index)).toEqual([])
    expect(mountAbilityInformation(change('Paired Alertness'), index)).toEqual([])
    expect(mountAbilityInformation({ ...original, name: 'Unlisted Ornius' }, index)).toEqual([])
    expect(mountAbilityInformation(change('Paired Purify, Paired Healing'), index).map(effect => effect.name)).toEqual(['Paired Purify', 'Paired Healing'])
  })

  it('supports only the two explicit recorded mount-name variants and keeps offspring separate', () => {
    for (const name of ["Rocinan (Io's mount)", "Rocinan's Brother", "Bucephalus (Alexandra's mount)", "Bucephalus's Foal"])
      expect(mountAbilityInformation(mount(name), index)).toHaveLength(1)
    expect(mountAbilityInformation({ ...mount("Rocinan's Brother"), name: "Rocinan's Other Brother" }, index)).toEqual([])
  })

  it('rejects malformed, duplicate, incomplete or wrongly identified skill tables', () => {
    const fixture = () => structuredClone(source) as ReferenceSheet
    const wrong = fixture(); wrong.gid = 1
    expect(() => buildMountAbilityIndex(wrong)).toThrow(/Unexpected/)
    const missing = fixture(); missing.rows = missing.rows.filter(row => row.row !== 40)
    expect(() => buildMountAbilityIndex(missing)).toThrow(/Incomplete/)
    const badNote = fixture(); badNote.rows.find(row => row.row === 40)!.cells.find(cell => cell.column === 1)!.note = null
    expect(() => buildMountAbilityIndex(badNote)).toThrow(/Invalid/)
    const duplicate = fixture(); duplicate.rows.find(row => row.row === 40)!.cells.find(cell => cell.column === 1)!.value = 'Paired Run'
    expect(() => buildMountAbilityIndex(duplicate)).toThrow(/Invalid/)
    const association = fixture(); association.rows.find(row => row.row === 40)!.cells.find(cell => cell.column === 2)!.value = null
    expect(() => buildMountAbilityIndex(association)).toThrow(/Invalid/)
  })

  it('uses the shared lazy asset and does not mutate mount records, raw notes or any growth/flat bonuses', async () => {
    const before = JSON.stringify([mountData, source])
    expect(await loadMountAbilityIndex()).toBe(await loadMountAbilityIndex())
    for (const record of mountData.records) mountAbilityInformation(record, index)
    expect(JSON.stringify([mountData, source])).toBe(before)
  })

  it('keeps absent, unavailable and unlisted abilities empty without zero/default effects', () => {
    const original = mount('Wild Ornius')
    expect(mountAbilityInformation({ ...original, abilities: { ...original.abilities, text: null } }, index)).toEqual([])
    expect(mountAbilityInformation({ ...original, abilities: { ...original.abilities, status: 'unavailable' } }, index)).toEqual([])
    expect(mountAbilityInformation({ ...original, abilities: { ...original.abilities, text: 'Unknown skill' } }, index)).toEqual([])
  })

  it('shows the actual alternative effects, retains raw names and leaves sources closed', async () => {
    render(<MountReference mount={mount('White Ornius')} />)
    const effects = await screen.findByRole('region', { name: 'White Ornius possible mount skill effects' })
    expect(within(effects).getByRole('heading', { name: 'Paired Purify' })).toBeDefined()
    expect(within(effects).getByRole('heading', { name: 'Paired Healing' })).toBeDefined()
    expect(effects.textContent).toContain('Trigger % =  50 (100)')
    expect(effects.textContent).toContain('one of its listed skills')
    expect(effects.textContent).not.toContain('Paired Alertness')
    expect(screen.getByRole('group', { name: 'Listed ability names' }).textContent).toContain('Paired Purify, Paired Healing')
    for (const disclosure of effects.querySelectorAll('details')) expect(disclosure.open).toBe(false)
    expect(within(effects).getByRole('link', { name: 'Mounts!A36 (note)' }).getAttribute('href')).toContain('gid=279385932&range=A36')
  })

  it('updates effects for a different mount without stale names or unrelated independent-column notes', async () => {
    const { rerender } = render(<MountAbilityEffects mount={mount('Meganius')} />)
    await screen.findByRole('heading', { name: 'Paired Bulk' })
    rerender(<MountAbilityEffects mount={mount('Dark Pegasus')} />)
    expect(screen.queryByRole('heading', { name: 'Paired Bulk' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Paired Magic Speed' })).toBeDefined()
    expect(screen.getByText('When in combat, grants Avo+10 (+20). Trigger % = Mag')).toBeDefined()
  })
})
