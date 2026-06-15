import type { Equipment } from './supabase'

type WarrantyInput = Pick<Equipment, 'warranty_end' | 'ship_date' | 'warranty_months'>

/** Effective warranty end: explicit override, else ship_date + warranty_months. */
export function effectiveWarrantyEnd(eq: WarrantyInput): string | null {
  if (eq.warranty_end) return eq.warranty_end
  if (!eq.ship_date) return null
  const d = new Date(eq.ship_date + 'T00:00:00')
  d.setMonth(d.getMonth() + (eq.warranty_months ?? 12))
  return d.toISOString().slice(0, 10)
}

/** 'in' = under warranty, 'out' = expired, 'unknown' = no ship date / end set. */
export function warrantyState(eq: WarrantyInput): 'in' | 'out' | 'unknown' {
  const end = effectiveWarrantyEnd(eq)
  if (!end) return 'unknown'
  const today = new Date().toISOString().slice(0, 10)
  return end >= today ? 'in' : 'out'
}
