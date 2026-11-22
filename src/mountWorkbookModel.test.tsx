import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { canUseWorkbookMountZeros, listedMountGrowthTotal } from './mountWorkbookModel'
import { previewMountGrowth, previewWorkbookMountGrowth } from './mountGrowthPreviewModel'
import MountReference from './MountReference'
import { mountData } from './mounts'
import { growthData } from './growths'
import rules from './data/mount-growth-rules.json'
const mount = (name = 'Wild Horse') => mountData.records.find(item => item.name === name)!
const profile = (name = 'Light Cavalry') => growthData.classes.find(item => item.name === name)!
const character = growthData.characters.find(item => item.name === 'Alexandra')!
afterEach(cleanup)
describe('explicit workbook interpretation of mount omissions', () => {
  it('verifies the actual source distribution: eighteen totals of 25, four totals of 30, with no 25-percent cap', () => {
    const totals = mountData.records.map(item => ({ name: item.name, total: Object.values(item.numericGrowths).reduce((sum, field) => sum + (field.value ?? 0), 0) }))
    expect(totals.filter(item => item.total === 25)).toHaveLength(18)
    expect(totals.filter(item => item.total === 30).map(item => item.name)).toEqual(["Rocinan (Io's mount)", "Rocinan's Brother", "Bucephalus (Alexandra's mount)", "Bucephalus's Foal"])
    expect(listedMountGrowthTotal(mount('Bucephalus (Alexandra\'s mount)'))).toBe(30)
  })
  it('allows workbook zeros for the 21 consistent records, preserving the remaining dispute', () => {
    expect(mountData.records.filter(item => canUseWorkbookMountZeros(item))).toHaveLength(21)
    expect(canUseWorkbookMountZeros(mount('Meganius'))).toBe(false); expect(listedMountGrowthTotal(mount('Meganius'))).toBeNull()
  })
  it('keeps raw nulls and strict calculations intact while explicitly calculating workbook zero comparisons', () => {
    const source = mount(), before = JSON.stringify(source), strict = previewMountGrowth(character, profile(), source), workbook = previewWorkbookMountGrowth(character, profile(), source)
    expect(strict.rows.find(item => item.stat === 'Str')!.combined).toBeNull()
    expect(workbook.rows.find(item => item.stat === 'Str')).toMatchObject({ recorded: null, blankAsZero: true, contribution: 0, combined: 40 })
    expect(workbook.rows.find(item => item.stat === 'HP')).toMatchObject({ recorded: 5, blankAsZero: false, contribution: 5, combined: 45 })
    expect(JSON.stringify(source)).toBe(before); expect(source.numericGrowths.Str.value).toBeNull()
  })
  it('retains Charioteer doubling and does not turn a conflict into zero or a usable total', () => {
    expect(previewWorkbookMountGrowth(character, profile('Charioteer'), mount()).rows[0].combined).toBe(50)
    const disputed = previewWorkbookMountGrowth(character, profile('Ornius Rider'), mount('Meganius'))
    expect(disputed.state).toBe('disputed'); expect(disputed.rows.every(item => item.combined === null)).toBe(true)
  })
  it('refuses stale evidence, unsupported total formulas, unparsed text, wrong cells and inconsistent/malformed fields', () => {
    const source = mount()
    expect(canUseWorkbookMountZeros(source, { ...rules, sourceSha256: 'stale' })).toBe(false)
    expect(canUseWorkbookMountZeros({ ...source, totalGrowth: { ...source.totalGrowth, formula: '=SUM(H9:P9)' } })).toBe(false)
    expect(canUseWorkbookMountZeros({ ...source, parsed: { ...source.parsed, growths: { ...source.parsed.growths, unparsed: ['?'] } } })).toBe(false)
    expect(canUseWorkbookMountZeros({ ...source, numericGrowths: { ...source.numericGrowths, Str: { ...source.numericGrowths.Str, source: 'Mounts!J8' } } })).toBe(false)
    expect(canUseWorkbookMountZeros({ ...source, numericGrowths: { ...source.numericGrowths, Str: { ...source.numericGrowths.Str, status: 'unavailable' } } })).toBe(false)
    expect(canUseWorkbookMountZeros({ ...source, numericGrowths: { ...source.numericGrowths, HP: { ...source.numericGrowths.HP, value: 99 } } })).toBe(false)
  })
  it('shows concise annotated zeros and the correct total in reference tables without relabeling raw data', () => {
    render(<MountReference mount={mount()} />)
    expect(screen.getByRole('table').textContent).toContain('+0%*'); expect(screen.getByText('Listed growth modifiers total: +25%')).toBeDefined()
    expect(screen.getByText(/raw source blanks are retained/)).toBeDefined(); expect(mount().numericGrowths.Str.status).toBe('unknown')
  })
  it('keeps the disputed reference’s omissions and differences explicit', () => {
    render(<MountReference mount={mount('Meganius')} />)
    expect(screen.getByRole('table').textContent).toContain('Not listed'); expect(screen.getByRole('table').textContent).toContain('Differs')
    expect(screen.getByRole('table').textContent).not.toContain('+0%*')
  })
})
