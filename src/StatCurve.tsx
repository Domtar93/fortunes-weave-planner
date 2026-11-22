import { useId, useMemo, useState, type PointerEvent } from 'react'
import { STAT_NAMES, STATS, type CharacterProfile, type ClassProfile } from './growths'
import { formatExpected, type StatObservations } from './expectedStats'
import { projectCharacterAverage } from './characterBases'

// Stats by level (November 22, 2026): one small chart per stat showing the average from the
// starting level to 99, with the "Compare with" class dashed. Uses the same projection as the
// stat tiles, so the numbers always match. Hovering or tapping a chart inspects that level
// in all nine charts at once.
const W = 160, H = 72, LEFT = 4, RIGHT = 4, TOP = 6, BOTTOM = 3
const TABLE_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99]
type Series = (number | null)[][]

function curve(character: CharacterProfile, selectedClass: ClassProfile, observations: StatObservations) {
  const probe = projectCharacterAverage(character, selectedClass, { ...observations, targetLevel: 99 }).result
  if (probe.error || !probe.explicitCheckpoint || probe.intervalStart === null) return null
  const start = probe.intervalStart
  const levels = Array.from({ length: 100 - start }, (_, index) => start + index)
  const values: Series = STATS.map(() => [])
  for (const level of levels) {
    const { result } = projectCharacterAverage(character, selectedClass, { ...observations, targetLevel: level })
    result.rows.forEach((row, index) => values[index].push(row.projected))
  }
  return { start, levels, values }
}

const path = (points: (number | null)[], x: (index: number) => number, y: (value: number) => number) => {
  let d = '', pen = false
  points.forEach((value, index) => {
    if (value === null) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`; pen = true
  })
  return d
}

export default function StatCurve({ character, selectedClass, compareClass, observations }: {
  character: CharacterProfile; selectedClass: ClassProfile; compareClass: ClassProfile | null; observations: StatObservations
}) {
  const [open, setOpen] = useState(false)
  const [inspect, setInspect] = useState<number | null>(null)
  const id = useId()
  const primary = useMemo(() => open ? curve(character, selectedClass, observations) : null, [open, character, selectedClass, observations])
  const compared = useMemo(() => open && compareClass ? curve(character, compareClass, observations) : null, [open, character, compareClass, observations])
  const target = observations.targetLevel
  const shown = inspect ?? target
  const start = primary?.start ?? 1
  const span = Math.max(1, 99 - start)
  const x = (level: number) => LEFT + (level - start) / span * (W - LEFT - RIGHT)
  const levelAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width * W - LEFT) / (W - LEFT - RIGHT)))
    return Math.round(start + ratio * span)
  }
  const valueAt = (series: Series | undefined, stat: number, level: number) => {
    const index = level - start
    return series && index >= 0 && index < series[stat].length ? series[stat][index] : null
  }
  return <details className="stat-curve" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><strong>Stats by level</strong><span className="finder-hint">See how {character.name}’s averages grow up to level 99{compareClass ? ` against ${compareClass.name}` : ''}</span></span><span className="toggle-icon" aria-hidden="true">+</span></summary>
    {open && <div className="curve-body">
      {!primary ? <p className="compare-note">Base stats are not available for this character, so there is no curve to draw. Enter your own starting point in Compare with your game to see one.</p> : <>
        <div className="curve-legend">
          <span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" className="radar-key-primary" /></svg>{selectedClass.name}</span>
          {compareClass && <span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" className="radar-key-compare" /></svg>{compareClass.name}</span>}
          <span className="curve-level" role="status">{inspect === null ? `Level ${target} (your level)` : `Level ${inspect}`}</span>
        </div>
        {!compareClass && <p className="curve-hint">Pick a class in “Compare with” above to add a second line.</p>}
        <div className="curve-grid" aria-hidden="true">
          {STATS.map((stat, index) => {
            const all = [...primary.values[index], ...(compared?.values[index] ?? [])].filter((value): value is number => value !== null)
            const top = all.length ? Math.max(5, Math.ceil(Math.max(...all) / 5) * 5) : 5
            const y = (value: number) => TOP + (1 - value / top) * (H - TOP - BOTTOM)
            const here = valueAt(primary.values, index, shown), there = valueAt(compared?.values, index, shown)
            const hx = x(Math.min(99, Math.max(start, shown)))
            return <div className="curve-cell" key={stat}>
              <p className="curve-head"><span>{STAT_NAMES[stat]}</span><strong>{formatExpected(here)}</strong>{compareClass && <span className="curve-other">{formatExpected(there)}</span>}</p>
              <div className="curve-plot"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerMove={event => setInspect(levelAt(event))} onPointerDown={event => setInspect(levelAt(event))} onPointerLeave={event => { if (event.pointerType === 'mouse') setInspect(null) }}>
                <line className="curve-grid-line" x1={LEFT} x2={W - RIGHT} y1={y(top)} y2={y(top)} />
                <line className="curve-grid-line" x1={LEFT} x2={W - RIGHT} y1={y(top / 2)} y2={y(top / 2)} />
                <line className="curve-axis" x1={LEFT} x2={W - RIGHT} y1={y(0)} y2={y(0)} />
                {compared && <path className="curve-line compare" d={path(compared.values[index], i => x(compared.levels[i]), y)} />}
                <path className="curve-line primary" d={path(primary.values[index], i => x(primary.levels[i]), y)} />
                <line className="curve-cursor" x1={hx} x2={hx} y1={TOP - 2} y2={H - BOTTOM} />
                {there !== null && <circle className="curve-dot compare" cx={hx} cy={y(there)} r="3" />}
                {here !== null && <circle className="curve-dot primary" cx={hx} cy={y(here)} r="3.2" />}
              </svg>
              <span className="curve-scale" style={{ top: `${y(top) / H * 100}%` }}>{top}</span></div>
              <p className="curve-ticks"><span>Lv {start}</span><span>99</span></p>
            </div>
          })}
        </div>
        <details className="reader-disclosure curve-table-toggle">
          <summary>Show as a table</summary>
          <div className="curve-table-wrap">
            <table className="curve-table" aria-labelledby={`${id}-caption`}>
              <caption id={`${id}-caption`}>Average stats by level for {character.name} as {selectedClass.name}{compareClass ? `, with ${compareClass.name} in brackets` : ''}</caption>
              <thead><tr><th scope="col">Level</th>{STATS.map(stat => <th scope="col" key={stat}>{stat}</th>)}</tr></thead>
              <tbody>{[start, ...TABLE_LEVELS.filter(level => level > start)].map(level => <tr key={level}>
                <th scope="row">{level}</th>
                {STATS.map((stat, index) => <td key={stat}>{formatExpected(valueAt(primary.values, index, level))}{compared && <span className="curve-other"> ({formatExpected(valueAt(compared.values, index, level))})</span>}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </details>
        <p className="compare-note">Averages use the same rule as the stat tiles: base + level-ups × growth rate, with no stat caps, equipment or class-change bonuses. Each chart has its own scale.</p>
      </>}
    </div>}
  </details>
}
