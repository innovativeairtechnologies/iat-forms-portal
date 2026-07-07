import type { Deal } from './supabase'

/* ────────────────────────────────────────────────────────────────────────────
   Pure, derived-data helpers for the deal pipeline. Nothing here touches the
   network or React state — components call these from useMemo. `weighted` is
   never persisted (see migration 043's header comment); it's always computed
   here so Pipeline / CRM / Focused can never show it out of sync with
   total_cost / confidence.
   ──────────────────────────────────────────────────────────────────────────── */

export function computeWeighted(deal: Pick<Deal, 'total_cost' | 'confidence'>): number {
  return deal.total_cost * (deal.confidence / 100)
}

export type DealSummary = {
  totalCost: number
  totalWeighted: number
  openCount: number
  wonCount: number
  lostCount: number
  winRate: number | null // null until there's at least one closed deal
}

export function computeSummary(deals: Deal[]): DealSummary {
  let totalCost = 0
  let totalWeighted = 0
  let openCount = 0
  let wonCount = 0
  let lostCount = 0
  for (const d of deals) {
    totalCost += d.total_cost
    totalWeighted += computeWeighted(d)
    if (d.status === 'Won') wonCount++
    else if (d.status === 'Lost') lostCount++
    else openCount++
  }
  const closed = wonCount + lostCount
  return {
    totalCost,
    totalWeighted,
    openCount,
    wonCount,
    lostCount,
    winRate: closed > 0 ? (wonCount / closed) * 100 : null,
  }
}

/** Focused view's default filter: open deals worth someone's attention today. */
export function isFocused(deal: Deal): boolean {
  if (deal.status !== null) return false
  return deal.confidence >= 60 || !!deal.projected || !!(deal.notes && deal.notes.trim())
}

/** CRM view's "recent activity" flag: has commentary, still active. */
export function hasRecentActivity(deal: Deal): boolean {
  return deal.status === null && !!(deal.notes && deal.notes.trim())
}
