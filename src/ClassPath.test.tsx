import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { growthData, STATS, type Stat } from './growths'
import { emptyObservations, formatExpected, projectExpectedStats, type ClassStage } from './expectedStats'
import { getCharacterBase, projectCharacterAverage } from './characterBases'
import { decodeSharedBuild, encodeSharedBuild } from './shareLink'
import { LOADOUT_KEY, type FullBuildSelection } from './loadouts'

// Class path (November 25, 2026): earlier classes before the main Class.
const character = (name: string) => growthData.characters.find(profile => profile.name === name)!
const klass = (name: string) => growthData.classes.find(profile => profile.name === name)!
const growth = (characterName: string, className: string, stat: Stat) => Math.max(0, character(characterName).growths[stat] + klass(className).growths[stat])
const observations = (targetLevel: number, classPath?: ClassStage[]) => ({ ...emptyObservations(), targetLevel, ...(classPath ? { classPath } : {}) })
const selection = (): FullBuildSelection => ({ characterName: 'Alexandra', className: 'Gladiator', weaponId: null, mountId: null, battalionId: null, abilities: [] })

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); localStorage.clear() })

describe('class path projection', () => {
  it('gives each class its own level-ups: the level-up into L uses the class held at L−1', () => {
    const base = getCharacterBase('Alexandra')!
    const { result } = projectCharacterAverage(character('Alexandra'), klass('Gladiator'), observations(40, [{ className: 'Commoner / Noble', untilLevel: 10 }]))
    expect(result.error).toBeNull()
    expect(result.segments).toEqual([
      { label: 'Commoner / Noble', fromLevel: 1, toLevel: 10, levelUps: 9 },
      { label: 'Gladiator', fromLevel: 10, toLevel: 40, levelUps: 30 },
    ])
    for (const [index, stat] of STATS.entries()) {
      const expected = base.stats[stat] + 9 * growth('Alexandra', 'Commoner / Noble', stat) / 100 + 30 * growth('Alexandra', 'Gladiator', stat) / 100
      expect(result.rows[index].projected).toBeCloseTo(expected, 10)
      // The growth shown on the tiles stays the main class's rate.
      expect(result.rows[index].effective).toBe(growth('Alexandra', 'Gladiator', stat))
    }
  })
  it('changes nothing when there is no class path', () => {
    const plain = projectCharacterAverage(character('Hong Hua'), klass('Hunter'), observations(50)).result
    const empty = projectCharacterAverage(character('Hong Hua'), klass('Hunter'), observations(50, [])).result
    expect(empty.rows).toEqual(plain.rows)
    expect(plain.segments).toEqual([{ label: 'Hunter', fromLevel: 1, toLevel: 50, levelUps: 49 }])
    const base = getCharacterBase('Hong Hua')!
    STATS.forEach((stat, index) => expect(plain.rows[index].projected).toBe(base.stats[stat] + 49 * growth('Hong Hua', 'Hunter', stat) / 100))
  })
  it('uses only the classes reached between the starting point and the target', () => {
    const path = [{ label: 'A', classGrowth: { HP: 50 }, untilLevel: 10 }, { label: 'B', classGrowth: { HP: 0 }, untilLevel: 20 }]
    const input = { personalGrowth: { HP: 50 }, classGrowth: { HP: -10 }, checkpointStats: { HP: 20 }, earlierClasses: path, finalLabel: 'C' }
    // Starting at 15: class A is already over, B gets 15→20, C gets 20→30.
    const later = projectExpectedStats({ ...input, targetLevel: 30, checkpointLevel: 15 })
    expect(later.segments.map(segment => [segment.label, segment.levelUps])).toEqual([['B', 5], ['C', 10]])
    expect(later.rows[0].projected).toBeCloseTo(20 + 5 * 0.5 + 10 * 0.4, 10)
    // A target before the main class is reached uses only the earlier classes.
    const early = projectExpectedStats({ ...input, targetLevel: 8, checkpointLevel: 1 })
    expect(early.segments.map(segment => [segment.label, segment.levelUps])).toEqual([['A', 7]])
    expect(early.rows[0].projected).toBeCloseTo(20 + 7 * 1, 10)
  })
  it('keeps the 0% growth floor for each class separately', () => {
    const result = projectExpectedStats({ targetLevel: 21, checkpointLevel: 1, personalGrowth: { HP: 20 }, classGrowth: { HP: 10 }, checkpointStats: { HP: 10 },
      earlierClasses: [{ label: 'Weak', classGrowth: { HP: -50 }, untilLevel: 11 }] })
    expect(result.rows[0].projected).toBeCloseTo(10 + 10 * 0 + 10 * 0.3, 10)
  })
  it('reports a path it cannot use instead of guessing', () => {
    const at = (classPath: ClassStage[]) => projectCharacterAverage(character('Alexandra'), klass('Gladiator'), observations(40, classPath)).result
    expect(at([{ className: 'Commoner / Noble', untilLevel: 20 }, { className: 'Archer', untilLevel: 10 }]).error).toBe('Class changes must be at increasing levels.')
    expect(at([{ className: 'Commoner / Noble', untilLevel: 99 }]).error).toMatch(/below level 99/u)
    expect(at([{ className: 'Commoner / Noble', untilLevel: 1 }]).error).toMatch(/from 2 to 99/u)
    const unknown = at([{ className: 'Not a class', untilLevel: 10 }])
    expect(unknown.rows.every(row => row.projected === null && row.unsupported === 'Growth data for an earlier class is missing or malformed.')).toBe(true)
  })
})

describe('class path in share links', () => {
  it('round-trips a class path and still opens links without one', () => {
    const classPath = [{ className: 'Commoner / Noble', untilLevel: 10 }, { className: 'Archer', untilLevel: 20 }]
    expect(decodeSharedBuild(encodeSharedBuild({ selection: selection(), level: 30, classPath }))).toEqual({ selection: selection(), level: 30, classPath })
    const plain = decodeSharedBuild(encodeSharedBuild({ selection: selection(), level: 30 }))
    expect(plain).toEqual({ selection: selection(), level: 30 })
    expect(encodeSharedBuild({ selection: selection(), level: 30, classPath: [] })).toBe(encodeSharedBuild({ selection: selection(), level: 30 }))
  })
  it('rejects damaged or unknown class paths', () => {
    const withPath = (p: unknown) => btoa(JSON.stringify({ v: 1, c: 'Alexandra', k: 'Gladiator', l: 30, w: null, m: null, b: null, a: [], p })).replace(/=+$/u, '')
    expect(() => decodeSharedBuild(withPath([['Commoner / Noble', 120]]))).toThrow('damaged class path')
    expect(() => decodeSharedBuild(withPath('Commoner / Noble'))).toThrow('damaged class path')
    expect(() => decodeSharedBuild(withPath([['Not a class', 10]]))).toThrow('unknown class: Not a class')
  })
})

describe('class path editor', () => {
  it('adds an earlier class, updates the averages and explanation, and clears again', () => {
    render(<App />)
    fireEvent.change(document.getElementById('target-level')!, { target: { value: '40' } })
    const before = screen.getByTestId('average-Str').textContent
    expect(screen.getByText('From level-1 base stats · 39 level-ups as Gladiator')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '+ Add an earlier class' }))
    fireEvent.change(screen.getByLabelText('Earlier class 1'), { target: { value: 'Commoner / Noble' } })
    fireEvent.change(screen.getByLabelText('Earlier class 1: held until level'), { target: { value: '10' } })
    expect(screen.getByText('From level-1 base stats · 9 level-ups as Commoner / Noble, 30 as Gladiator')).toBeTruthy()
    const expected = getCharacterBase('Alexandra')!.stats.Str + 9 * growth('Alexandra', 'Commoner / Noble', 'Str') / 100 + 30 * growth('Alexandra', 'Gladiator', 'Str') / 100
    expect(screen.getByTestId('average-Str').textContent).toBe(formatExpected(expected))
    expect(screen.getByText('level 10 → 40')).toBeTruthy()
    // Still exactly nine stat tiles.
    expect(document.querySelectorAll('article')).toHaveLength(9)

    fireEvent.click(screen.getByRole('button', { name: 'Clear class path' }))
    expect(screen.getByTestId('average-Str').textContent).toBe(before)
    expect(screen.queryByLabelText('Earlier class 1')).toBeNull()
  })
  it('opens a class path from a share link without saving anything', () => {
    const before = localStorage.getItem(LOADOUT_KEY)
    window.history.replaceState(null, '', `/#build=${encodeSharedBuild({ selection: selection(), level: 40, classPath: [{ className: 'Commoner / Noble', untilLevel: 10 }] })}`)
    render(<App />)
    expect((screen.getByLabelText('Earlier class 1') as HTMLSelectElement).value).toBe('Commoner / Noble')
    expect(screen.getByText('From level-1 base stats · 9 level-ups as Commoner / Noble, 30 as Gladiator')).toBeTruthy()
    expect(localStorage.getItem(LOADOUT_KEY)).toBe(before)
  })
})
