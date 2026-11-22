import { useMemo, useState } from 'react'
import { growthData, STAT_NAMES, STATS, type CharacterProfile, type ClassProfile, type Stat } from './growths'
import Portrait from './Portrait'

// Character finder (November 22, 2026): filter the 64 planning characters by growth rate.
// Rates are either the character's own growth or own + the current class modifier (the same
// sum as the stat tiles). A character with a missing rate for a filtered stat is listed
// separately as "unknown", never treated as passing or failing.
export interface FinderCondition { stat: Stat; min: number }
export type FinderBasis = 'personal' | 'class'
const MAX_CONDITIONS = 3
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function rateFor(character: CharacterProfile, stat: Stat, basis: FinderBasis, selectedClass: ClassProfile): number | null {
  const personal = character.growths[stat]
  if (!finite(personal)) return null
  if (basis === 'personal') return personal
  const modifier = selectedClass.growths[stat]
  return finite(modifier) ? personal + modifier : null
}

export function findCharacters(conditions: FinderCondition[], basis: FinderBasis, selectedClass: ClassProfile, characters: readonly CharacterProfile[] = growthData.characters) {
  const matches: { character: CharacterProfile; rates: number[] }[] = [], unknown: { character: CharacterProfile; stats: Stat[] }[] = []
  for (const character of characters) {
    const rates = conditions.map(condition => rateFor(character, condition.stat, basis, selectedClass))
    const missing = conditions.filter((_, index) => rates[index] === null).map(condition => condition.stat)
    const failsKnown = conditions.some((condition, index) => rates[index] !== null && rates[index]! < condition.min)
    if (failsKnown) continue
    if (missing.length) unknown.push({ character, stats: missing })
    else matches.push({ character, rates: rates as number[] })
  }
  // Highest total of the filtered rates first; ties keep the source order.
  matches.sort((a, b) => b.rates.reduce((sum, rate) => sum + rate, 0) - a.rates.reduce((sum, rate) => sum + rate, 0))
  return { matches, unknown }
}

export default function CharacterFinder({ currentCharacter, selectedClass, onSelect }: {
  currentCharacter: string; selectedClass: ClassProfile; onSelect: (name: string) => void
}) {
  const [conditions, setConditions] = useState<FinderCondition[]>([{ stat: 'Spd', min: 40 }])
  const [basis, setBasis] = useState<FinderBasis>('personal')
  const [open, setOpen] = useState(false)
  const result = useMemo(() => findCharacters(conditions, basis, selectedClass), [conditions, basis, selectedClass])
  const update = (index: number, next: Partial<FinderCondition>) => setConditions(current => current.map((condition, at) => at === index ? { ...condition, ...next } : condition))
  const pick = (name: string) => {
    onSelect(name)
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.querySelector('.unit-hero')?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  }
  return <details className="character-finder" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>Find a character</strong><span className="finder-hint">Filter all {growthData.characters.length} characters by growth rate</span></span><span className="toggle-icon" aria-hidden="true">+</span></summary>
    {open && <div className="finder-body">
      <fieldset className="char-finder-basis">
        <legend>Growth to check</legend>
        <label><input type="radio" name="char-finder-basis" checked={basis === 'personal'} onChange={() => setBasis('personal')} />Character’s own growth</label>
        <label><input type="radio" name="char-finder-basis" checked={basis === 'class'} onChange={() => setBasis('class')} />With {selectedClass.name}’s modifier</label>
      </fieldset>
      <div className="char-finder-conditions">
        {conditions.map((condition, index) => <div className="char-finder-condition" role="group" aria-label={`Condition ${index + 1}`} key={index}>
          <label className="sr-only" htmlFor={`char-finder-stat-${index}`}>Stat for condition {index + 1}</label>
          <div className="select-wrap"><select id={`char-finder-stat-${index}`} value={condition.stat} onChange={event => update(index, { stat: event.target.value as Stat })}>
            {STATS.map(stat => <option key={stat} value={stat}>{STAT_NAMES[stat]}</option>)}
          </select><span aria-hidden="true">⌄</span></div>
          <span aria-hidden="true">at least</span>
          <label className="sr-only" htmlFor={`char-finder-min-${index}`}>Minimum growth for condition {index + 1}, in percent</label>
          <span className="char-finder-min"><input id={`char-finder-min-${index}`} type="number" inputMode="numeric" min={0} max={200} step={5} value={condition.min}
            onChange={event => { const value = Number(event.target.value); if (event.target.value.trim() !== '' && Number.isFinite(value)) update(index, { min: value }) }} /><span aria-hidden="true">%</span></span>
          {conditions.length > 1 && <button type="button" className="link-button" aria-label={`Remove condition ${index + 1}`} onClick={() => setConditions(current => current.filter((_, at) => at !== index))}>Remove</button>}
        </div>)}
        {conditions.length < MAX_CONDITIONS && <button type="button" className="link-button" onClick={() => setConditions(current => [...current, { stat: STATS.find(stat => !current.some(condition => condition.stat === stat)) ?? 'HP', min: 30 }])}>+ Add a condition</button>}
      </div>
      <p className="finder-current-rank" role="status">{result.matches.length} {result.matches.length === 1 ? 'character matches' : 'characters match'}{result.unknown.length > 0 ? `; ${result.unknown.length} with unknown data` : ''}.</p>
      {result.matches.length > 0 && <ul className="char-finder-list" aria-label="Matching characters">
        {result.matches.map(({ character, rates }) => {
          const current = character.name === currentCharacter
          return <li key={character.name} className={current ? 'is-current' : undefined}>
            <Portrait name={character.name} size="small" />
            <div className="char-finder-name"><strong>{character.name}</strong>{current && <span className="finder-current">Current</span>}
              <span className="char-finder-rates">{conditions.map((condition, index) => <span key={index}>{condition.stat} {rates[index]}%</span>)}</span></div>
            {!current && <button type="button" aria-label={`Use ${character.name}`} onClick={() => pick(character.name)}>Use</button>}
          </li>
        })}
      </ul>}
      {result.unknown.length > 0 && <p className="compare-note">Unknown data: {result.unknown.map(({ character, stats }) => `${character.name} (${stats.join(', ')})`).join(', ')}. These characters have no recorded rate for that stat, so they can’t be checked.</p>}
      <p className="compare-note">Growth rates only; base stats, recruitment and class access aren’t checked. Your class choice is kept when you switch character.</p>
    </div>}
  </details>
}
