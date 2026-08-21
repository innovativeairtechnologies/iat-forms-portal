/* Shapes and constants shared by every report.
   ────────────────────────────────────────────────────────────────────────────
   🔴 THIS FILE MUST NEVER IMPORT A SERVER MODULE. Every report's client
   component imports from here, and the builders it sits alongside import
   supabase-admin. A VALUE import (RANGES) from a builder ships the service-role
   client to the browser and the page dies at hydration with "supabaseKey is
   required" — past tsc AND past a green server render, so only loading the page
   catches it. That happened once; this file is the fix.

   TYPES are erased and are safe to import from a builder with `import type`.
   Constants are not. When in doubt, put it here. */

export type RangeKey = '30d' | '90d' | '12m' | 'all'

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All time', days: null },
]

export const DAY = 86_400_000

/** One labeled row in a bar list. */
export type Bucket = { label: string; count: number; note?: string }

/** A month on an opened-vs-closed style series. */
export type MonthPoint = { month: string; opened: number; closed: number }

export function rangeFor(key: RangeKey, now: Date): { key: RangeKey; label: string; from: Date | null } {
  const r = RANGES.find(x => x.key === key) ?? RANGES[3]
  return { key: r.key, label: r.label, from: r.days ? new Date(now.getTime() - r.days * DAY) : null }
}

/** Median, not mean, everywhere in reporting. One record left open over a
 *  shutdown drags a mean into uselessness, and this data is full of those. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10
}

/** Descending count, then label, so equal counts do not shuffle between loads. */
export function tally(values: (string | null | undefined)[], fallback = 'Not recorded'): Bucket[] {
  const m = new Map<string, number>()
  for (const raw of values) {
    const k = (raw ?? '').trim() || fallback
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Sum a numeric field into labeled buckets — money, not counts. */
export function tallySum(
  rows: { label: string | null | undefined; value: number }[],
  fallback = 'Not recorded',
): Bucket[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = (r.label ?? '').trim() || fallback
    m.set(k, (m.get(k) ?? 0) + (Number.isFinite(r.value) ? r.value : 0))
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count: Math.round(count) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export const money = (n: number | null | undefined): string =>
  n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`

/** Compact money for tiles, where $1,234,567 does not fit. */
export const moneyShort = (n: number | null | undefined): string => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}
