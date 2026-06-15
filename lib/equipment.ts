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
  return end >= todayISO() ? 'in' : 'out'
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO + 'T00:00:00').getTime() - new Date(fromISO + 'T00:00:00').getTime()) / 86400000)
}

export const WARRANTY_SOON_DAYS = 90

/** Days until warranty ends (negative once expired); null if no computable end. */
export function daysUntilWarrantyEnd(eq: WarrantyInput): number | null {
  const end = effectiveWarrantyEnd(eq)
  if (!end) return null
  return daysBetween(todayISO(), end)
}

/** In warranty and ending within WARRANTY_SOON_DAYS. */
export function isExpiringSoon(eq: WarrantyInput): boolean {
  const d = daysUntilWarrantyEnd(eq)
  return d !== null && d >= 0 && d <= WARRANTY_SOON_DAYS
}

// ── Preventive maintenance ────────────────────────────────────────────────────
type PmInput = Pick<Equipment, 'pm_interval_months' | 'install_date' | 'ship_date'>

/** Next PM due = (last service | install | ship) + pm_interval_months; null if no schedule. */
export function nextPmDue(eq: PmInput, lastServiceAt: string | null): string | null {
  if (!eq.pm_interval_months || eq.pm_interval_months <= 0) return null
  const base = lastServiceAt || eq.install_date || eq.ship_date
  if (!base) return null
  const d = new Date(base.length <= 10 ? base + 'T00:00:00' : base)
  d.setMonth(d.getMonth() + eq.pm_interval_months)
  return d.toISOString().slice(0, 10)
}

export const PM_SOON_DAYS = 30

/** 'due' = overdue, 'soon' = within PM_SOON_DAYS, 'ok' = later, 'none' = no schedule/date. */
export function pmState(eq: PmInput, lastServiceAt: string | null): 'due' | 'soon' | 'ok' | 'none' {
  const due = nextPmDue(eq, lastServiceAt)
  if (!due) return 'none'
  const days = daysBetween(todayISO(), due)
  if (days <= 0) return 'due'
  return days <= PM_SOON_DAYS ? 'soon' : 'ok'
}
