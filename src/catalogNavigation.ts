import { useEffect, useRef, useState, type RefObject } from 'react'

export interface RewardTarget { locationId: string; chestId: string; part: 'part1' | 'part3' }
export interface CatalogRequest { id: string; sequence: number; reward?: RewardTarget }
// Navigation changes inspection only. It neither clears filters nor modifies build state.
export function useCatalogNavigation(initialId: string, request?: CatalogRequest, ready = true, targetRef?: RefObject<HTMLElement | null>) {
  const [selectedId, setSelectedId] = useState(initialId)
  const panelRef = useRef<HTMLDetailsElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const handled = useRef<number | null>(null)
  useEffect(() => { if (request) setSelectedId(request.id) }, [request])
  useEffect(() => {
    if (!request || selectedId !== request.id || handled.current === request.sequence) return
    if (panelRef.current) panelRef.current.open = true
    if (!ready) return
    const destination = targetRef?.current ?? headingRef.current
    destination?.focus()
    destination?.scrollIntoView?.({ block: targetRef?.current ? 'center' : 'start' })
    handled.current = request.sequence
  }, [request, selectedId, ready, targetRef])
  return { selectedId, setSelectedId, panelRef, headingRef }
}

