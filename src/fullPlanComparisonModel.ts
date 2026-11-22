import { compareGrowthBuilds } from './comparison'
import { resolveLoadout, type FullBuildSelection } from './loadouts'
import { selectMainBuildOverview } from './buildOverview'

export function compareFullPlans(a: FullBuildSelection, b: FullBuildSelection) {
  const first = resolveLoadout(a), second = resolveLoadout(b)
  return { growth: compareGrowthBuilds(a, b),
    a: selectMainBuildOverview({ ...first, weaponId: a.weaponId ?? undefined, mountId: a.mountId ?? undefined, battalionId: a.battalionId ?? undefined }),
    b: selectMainBuildOverview({ ...second, weaponId: b.weaponId ?? undefined, mountId: b.mountId ?? undefined, battalionId: b.battalionId ?? undefined }),
  }
}
