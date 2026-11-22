import { openPlannerPanel } from './plannerTestUtils'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MountGrowthPreview from './MountGrowthPreview'
import { previewMountGrowth } from './mountGrowthPreviewModel'
import { growthData, STATS } from './growths'
import { mountData } from './mounts'
import rules from './data/mount-growth-rules.json'
const character = growthData.characters.find(x => x.name === 'Alexandra')!
const profile = (name = 'Light Cavalry') => growthData.classes.find(x => x.name === name)!
const horse = mountData.records.find(x => x.name === 'Wild Horse')!
afterEach(cleanup)
describe('documented mount growth preview', () => {
  it('adds only documented compatible numeric growths and leaves every blank unknown', () => {
    const result = previewMountGrowth(character, profile(), horse)
    expect(result.state).toBe('applicable'); expect(result.multiplier).toBe(1)
    expect(result.rows.find(x => x.stat === 'HP')).toMatchObject({ recorded: 5, contribution: 5, base: 40, combined: 45, source: 'Mounts!H8' })
    expect(result.rows.find(x => x.stat === 'Str')).toMatchObject({ recorded: null, contribution: null, combined: null })
    expect(result.rows).toHaveLength(9)
  })
  it('uses the workbook’s explicit Charioteer double contribution without doubling the base', () => {
    const result = previewMountGrowth(character, profile('Charioteer'), horse)
    expect(result.multiplier).toBe(2); expect(result.rows.find(x => x.stat === 'HP')).toMatchObject({ base: 40, contribution: 10, combined: 50 })
    expect(result.rows.find(x => x.stat === 'Spd')).toMatchObject({ base: 50, contribution: 10, combined: 60 })
  })
  it.each(['Wing Soldier', 'Gladiator'])('excludes unmatched/unmounted %s contributions explicitly without changing raw blanks', name => {
    const result = previewMountGrowth(character, profile(name), horse); expect(result.state).toBe('not-applied')
    for (const row of result.rows) { expect(row.contribution).toBe(0); expect(row.combined).toBe(row.base) }
    expect(result.rows.find(x => x.stat === 'Str')!.recorded).toBeNull()
  })
  it('shows base-only results for an empty mount selection without inventing a default', () => {
    const result = previewMountGrowth(character, profile('Gladiator')); expect(result.state).toBe('none'); expect(result.rows[0].combined).toBe(40)
  })
  it('blocks all Meganius totals rather than choosing written or numeric evidence', () => {
    const mount = mountData.records.find(x => x.name === 'Meganius')!, result = previewMountGrowth(character, profile('Ornius Rider'), mount)
    expect(result.state).toBe('disputed'); expect(result.rows.every(x => x.combined === null)).toBe(true); expect(result.message).toContain('No version is selected')
  })
  it('blocks unknown species, stale rule evidence and future rows outside the workbook lookup', () => {
    const unknown = { ...profile(), details: { ...profile().details, mountType: { ...profile().details.mountType, status: 'unknown' as const, text: null } } }
    expect(previewMountGrowth(character, unknown, horse).state).toBe('unknown-type')
    expect(previewMountGrowth(character, profile(), horse, { ...rules, sourceSha256: 'stale' }).state).toBe('unverified-rules')
    expect(previewMountGrowth(character, { ...profile(), source: { ...profile().source, row: 999 } }, horse).state).toBe('unsupported-class')
  })
  it('preserves explicit zero, negative modifiers and totals over 100 without applying flat bonuses', () => {
    const modified = { ...horse, numericGrowths: { ...horse.numericGrowths, HP: { ...horse.numericGrowths.HP, value: 80 }, Str: { ...horse.numericGrowths.Str, value: 0, status: 'unverified' as const }, Spd: { ...horse.numericGrowths.Spd, value: -5 } }, flatStatText: { ...horse.flatStatText, text: 'HP +999' } }
    const result = previewMountGrowth(character, profile(), modified)
    expect(result.rows.find(x => x.stat === 'HP')!.combined).toBe(120); expect(result.rows.find(x => x.stat === 'Str')!.combined).toBe(result.rows.find(x => x.stat === 'Str')!.base)
    expect(result.rows.find(x => x.stat === 'Spd')!.contribution).toBe(-5)
  })
  it('does not mutate any character, class or mount data while producing nine source-linked rows', () => {
    const before = JSON.stringify([character, profile(), horse]); previewMountGrowth(character, profile(), horse); expect(JSON.stringify([character, profile(), horse])).toBe(before)
  })
  it('starts collapsed, updates live, labels workbook zero interpretation and displays formula/source caveats', async () => {
    const user = userEvent.setup(), view = render(<MountGrowthPreview character={character} selectedClass={profile()} mount={horse} />)
    expect(screen.queryByRole('region', { name: 'Documented mount growth preview' })).toBeNull(); await openPlannerPanel(user, 'Documented Mount Growth Preview')
    await screen.findByRole('region', { name: 'Documented mount growth preview' }); expect(screen.getByTestId('mount-preview-HP').textContent).toBe('45%'); expect(screen.getByTestId('mount-preview-Str').textContent).toBe('40%')
    expect(screen.getByRole('table').textContent).toContain('+0%*'); expect(screen.getByText(/Raw blanks are retained/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Character Learnsets!D30:L31' }).getAttribute('href')).toContain('range=D30%3AL31')
    expect(screen.getByRole('table').textContent).not.toContain('999'); view.rerender(<MountGrowthPreview character={character} selectedClass={profile('Charioteer')} mount={horse} />)
    expect(screen.getByTestId('mount-preview-HP').textContent).toBe('50%'); expect(screen.getByRole('status').textContent).toContain('×2')
    for (const stat of STATS) expect(screen.getByTestId(`mount-preview-${stat}`)).toBeDefined()
  })
})
