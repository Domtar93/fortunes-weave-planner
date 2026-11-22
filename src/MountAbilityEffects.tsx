import { useEffect, useState } from 'react'
import type { MountRecord } from './mounts'
import { loadMountAbilityIndex, mountAbilityInformation, type MountAbilityIndex } from './mountAbilityInfo'

export default function MountAbilityEffects({ mount }: { mount: MountRecord }) {
  const [index, setIndex] = useState<MountAbilityIndex>()
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    loadMountAbilityIndex().then(value => { if (active) setIndex(value) }, () => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  const effects = index ? mountAbilityInformation(mount, index) : []
  if (error) return <p className="details-context" role="status">Mount effects could not be loaded. Listed ability names remain available.</p>
  if (!effects.length) return null
  return <section aria-label={`${mount.name} possible mount skill effects`}>
    <h3>Possible mount skills</h3>
    <p className="details-context">An individual mount has one of its listed skills. Parentheses show upgraded effects; these options do not stack.</p>
    <div className="ability-parts">{effects.map(effect => <section className="recorded-entry" key={effect.name}>
      <h4>{effect.name}</h4><p className="recorded-text">{effect.description}</p>
      <details className="reader-disclosure"><summary>Source details</summary><a className="entry-source" href={effect.url} target="_blank" rel="noreferrer">{effect.source}</a></details>
    </section>)}</div>
  </section>
}
