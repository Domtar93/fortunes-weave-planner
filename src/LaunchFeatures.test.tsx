import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import ShareBuildLink from './ShareBuildLink'
import StatCurve from './StatCurve'
import CharacterFinder, { findCharacters } from './CharacterFinder'
import { decodeSharedBuild, encodeSharedBuild, sharedValueFromHash, shareUrl, type SharedBuild } from './shareLink'
import { correctionUrl } from './correction'
import { LOADOUT_KEY, type FullBuildSelection } from './loadouts'
import { PRESET_KEY } from './presets'
import { weaponData } from './forging'
import { battalionData } from './battalions'
import { proficiencyData } from './proficiencies'
import { growthData, type CharacterProfile } from './growths'
import { emptyObservations } from './expectedStats'
import { projectCharacterAverage } from './characterBases'

// Launch features (November 22, 2026): share links, stats by level, character finder,
// correction link and level carry-over.
const selection = (): FullBuildSelection => ({ characterName: 'Alexandra', className: 'Wing Soldier', weaponId: weaponData.records[0].id, mountId: 'Mounts!A18', battalionId: battalionData.records[0].id,
  abilities: ['D', 'C'].map(rank => ({ proficiency: 'Sword' as const, rank, source: proficiencyData.categories.Sword.characters.Alexandra.find(entry => entry.rank === rank)!.source })) })
const character = (name: string) => growthData.characters.find(profile => profile.name === name)!
const klass = (name: string) => growthData.classes.find(profile => profile.name === name)!

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); localStorage.clear(); vi.restoreAllMocks() })

describe('share links', () => {
  it('round-trips a full build and level, including non-ASCII text', () => {
    const build: SharedBuild = { selection: selection(), level: 37 }
    const value = encodeSharedBuild(build)
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/u)
    expect(decodeSharedBuild(value)).toEqual(build)
    expect(sharedValueFromHash(`#build=${value}`)).toBe(value)
    expect(sharedValueFromHash('#planner-build-heading')).toBeNull()
    expect(shareUrl(build, { origin: 'https://example.test', pathname: '/planner/', search: '' })).toBe(`https://example.test/planner/#build=${value}`)
  })
  it('rejects damaged, unknown or out-of-range links without returning partial data', () => {
    expect(() => decodeSharedBuild('not-base64!')).toThrow()
    expect(() => decodeSharedBuild(encodeSharedBuild({ selection: { ...selection(), characterName: 'Nobody' }, level: 5 }))).toThrow()
    expect(() => decodeSharedBuild(encodeSharedBuild({ selection: { ...selection(), weaponId: 'Missing weapon' }, level: 5 }))).toThrow('Missing weapon')
    expect(() => decodeSharedBuild(encodeSharedBuild({ selection: selection(), level: 120 }))).toThrow('damaged')
  })
  it('opens a shared build in the app, clears the hash and never writes to storage', () => {
    const before = { loadouts: localStorage.getItem(LOADOUT_KEY), presets: localStorage.getItem(PRESET_KEY) }
    window.history.replaceState(null, '', `/#build=${encodeSharedBuild({ selection: selection(), level: 12 })}`)
    render(<App />)
    expect(screen.getByText(/Opened a shared build: Alexandra \/ Wing Soldier, level 12\./u)).toBeTruthy()
    expect((screen.getByLabelText('Class') as HTMLSelectElement).value).toBe('Wing Soldier')
    expect((document.getElementById('target-level') as HTMLInputElement).value).toBe('12')
    expect(window.location.hash).toBe('')
    expect({ loadouts: localStorage.getItem(LOADOUT_KEY), presets: localStorage.getItem(PRESET_KEY) }).toEqual(before)
  })
  it('explains a broken link and leaves the default build alone', () => {
    window.history.replaceState(null, '', '/#build=AAAA')
    render(<App />)
    expect(screen.getByRole('alert').textContent).toMatch(/couldn’t be opened.*Nothing was changed\./u)
    expect((screen.getByLabelText('Character') as HTMLSelectElement).value).toBe('Alexandra')
    expect((screen.getByLabelText('Class') as HTMLSelectElement).value).toBe('Gladiator')
  })
  it('copies the link, or shows it for manual copying when the clipboard is blocked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const build = { selection: selection(), level: 3 }
    const { rerender } = render(<ShareBuildLink build={build} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copy share link/u })) })
    expect(writeText).toHaveBeenCalledWith(shareUrl(build))
    expect(screen.getByText(/Link copied/u)).toBeTruthy()
    rerender(<ShareBuildLink build={{ ...build, level: 4 }} />)
    expect(screen.queryByText(/Link copied/u)).toBeNull()
    writeText.mockRejectedValueOnce(new Error('denied'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copy share link/u })) })
    expect((screen.getByLabelText(/clipboard is blocked/u) as HTMLInputElement).value).toBe(shareUrl({ ...build, level: 4 }))
  })
})

describe('level carry-over', () => {
  it('opens a character you have not set a level for at your last chosen level', () => {
    render(<App />)
    const level = document.getElementById('target-level') as HTMLInputElement
    expect(level.value).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Jump to level 20' }))
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'Hong Hua' } })
    expect(level.value).toBe('20')
  })
})

describe('stats by level', () => {
  const open = (element: HTMLElement) => { const details = element.closest('details')!; details.open = true; fireEvent(details, new Event('toggle')) }
  it('matches the stat tiles at every listed level and labels the compare class', () => {
    const observations = { ...emptyObservations(), targetLevel: 30 }
    render(<StatCurve character={character('Alexandra')} selectedClass={klass('Gladiator')} compareClass={klass('Hunter')} observations={observations} />)
    open(screen.getByText('Stats by level'))
    expect(screen.getByText('Level 30 (your level)')).toBeTruthy()
    const table = screen.getByRole('table')
    const row = within(table).getAllByRole('row').find(item => item.querySelector('th')?.textContent === '50')!
    const expected = projectCharacterAverage(character('Alexandra'), klass('Gladiator'), { ...observations, targetLevel: 50 }).result.rows[1].projected!
    expect(row.querySelectorAll('td')[1].textContent).toContain(expected.toFixed(1))
    expect(within(table).getByText(/with Hunter in brackets/u)).toBeTruthy()
  })
  it('says so instead of drawing a curve when base stats are unavailable', () => {
    const noBase: CharacterProfile = { ...character('Alexandra'), name: 'Nobody' }
    render(<StatCurve character={noBase} selectedClass={klass('Gladiator')} compareClass={null} observations={emptyObservations()} />)
    open(screen.getByText('Stats by level'))
    expect(screen.getByText(/Base stats are not available/u)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('character finder', () => {
  it('keeps characters with unknown rates separate from matches and failures', () => {
    const known = character('Alexandra'), unknown: CharacterProfile = { ...known, name: 'Unknown', growths: { ...known.growths, Spd: Number.NaN } }
    const result = findCharacters([{ stat: 'Spd', min: 0 }], 'personal', klass('Gladiator'), [known, unknown])
    expect(result.matches.map(item => item.character.name)).toEqual(['Alexandra'])
    expect(result.unknown).toEqual([{ character: unknown, stats: ['Spd'] }])
    expect(findCharacters([{ stat: 'Spd', min: 999 }], 'personal', klass('Gladiator'), [known]).matches).toEqual([])
  })
  it('adds the class modifier only when asked, and selecting a match switches character', () => {
    const onSelect = vi.fn()
    const gladiator = klass('Gladiator'), alexandra = character('Alexandra')
    const withClass = findCharacters([{ stat: 'Str', min: 0 }], 'class', gladiator, [alexandra]).matches[0].rates[0]
    expect(withClass).toBe(alexandra.growths.Str + gladiator.growths.Str)
    render(<CharacterFinder currentCharacter="Alexandra" selectedClass={gladiator} onSelect={onSelect} />)
    const details = screen.getByText('Find a character').closest('details')!
    details.open = true; fireEvent(details, new Event('toggle'))
    fireEvent.change(screen.getByLabelText(/Minimum growth for condition 1/u), { target: { value: '0' } })
    const list = screen.getByRole('list', { name: 'Matching characters' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(growthData.characters.filter(profile => Number.isFinite(profile.growths.Spd)).length)
    fireEvent.click(within(list).getByRole('button', { name: 'Use Hong Hua' }))
    expect(onSelect).toHaveBeenCalledWith('Hong Hua')
  })
})

describe('report a correction', () => {
  it('builds a prefilled issue link only for a GitHub repository', () => {
    const url = new URL(correctionUrl('Hong Hua', 'Gladiator', 'https://github.com/someone/planner')!)
    expect(url.pathname).toBe('/someone/planner/issues/new')
    expect(url.searchParams.get('template')).toBe('data-correction.yml')
    expect(url.searchParams.get('character')).toBe('Hong Hua')
    expect(url.searchParams.get('title')).toBe('Data correction: Hong Hua / Gladiator')
    expect(correctionUrl('A', 'B', undefined)).toBeUndefined()
    expect(correctionUrl('A', 'B', 'https://evil.example/x/y')).toBeUndefined()
  })
})
