/* ────────────────────────────────────────────────────────────────────────────
   Marketing calendar taxonomy (migration 071).

   The single source of truth for channels / platforms / statuses. The API
   routes validate writes against these lists and the UI renders from them, so
   adding a channel is a one-line edit here — the DB deliberately carries no
   CHECK constraint (see 071_marketing_calendar.sql for why).

   Tones are the DESIGN.md §2.4 semantic tones. Channel drives the chip colour
   on the month grid (what kind of thing it is, the primary scanning axis);
   status is shown as a pill in the side panel and as a small state mark on the
   chip. Anything unrecognised falls back to `slate` rather than rendering blank.
   ──────────────────────────────────────────────────────────────────────────── */

export type Tone = 'slate' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'

export type MarketingChannel = 'social' | 'email' | 'blog' | 'event' | 'ad' | 'pr' | 'other'
export type MarketingStatus = 'planned' | 'drafting' | 'scheduled' | 'published' | 'cancelled'
export type MarketingPlatform = 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'x' | 'other'

export const CHANNELS: { value: MarketingChannel; label: string; short: string; tone: Tone }[] = [
  { value: 'social', label: 'Social post', short: 'Social', tone: 'violet' },
  { value: 'email', label: 'Email campaign', short: 'Email', tone: 'sky' },
  { value: 'blog', label: 'Blog / article', short: 'Blog', tone: 'amber' },
  { value: 'event', label: 'Event / trade show', short: 'Event', tone: 'emerald' },
  { value: 'ad', label: 'Paid ad', short: 'Ad', tone: 'rose' },
  { value: 'pr', label: 'PR / announcement', short: 'PR', tone: 'slate' },
  { value: 'other', label: 'Other', short: 'Other', tone: 'slate' },
]

// Ordered as the work actually flows: on the calendar → being made → queued in
// the posting tool → live. `cancelled` is terminal and dropped from counts.
export const STATUSES: { value: MarketingStatus; label: string; tone: Tone }[] = [
  { value: 'planned', label: 'Planned', tone: 'slate' },
  { value: 'drafting', label: 'Drafting', tone: 'amber' },
  { value: 'scheduled', label: 'Scheduled', tone: 'sky' },
  { value: 'published', label: 'Published', tone: 'emerald' },
  { value: 'cancelled', label: 'Cancelled', tone: 'rose' },
]

// Only offered when channel = 'social'.
export const PLATFORMS: { value: MarketingPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'x', label: 'X' },
  { value: 'other', label: 'Other' },
]

export const DEFAULT_CHANNEL: MarketingChannel = 'social'
export const DEFAULT_STATUS: MarketingStatus = 'planned'

export const CHANNEL_VALUES = CHANNELS.map((c) => c.value) as string[]
export const STATUS_VALUES = STATUSES.map((s) => s.value) as string[]
export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as string[]

export const isChannel = (v: unknown): v is MarketingChannel =>
  typeof v === 'string' && CHANNEL_VALUES.includes(v)
export const isStatus = (v: unknown): v is MarketingStatus =>
  typeof v === 'string' && STATUS_VALUES.includes(v)
export const isPlatform = (v: unknown): v is MarketingPlatform =>
  typeof v === 'string' && PLATFORM_VALUES.includes(v)

const NEUTRAL = { label: 'Other', short: 'Other', tone: 'slate' as Tone }

export const channelMeta = (v: string) => CHANNELS.find((c) => c.value === v) ?? NEUTRAL
export const statusMeta = (v: string) =>
  STATUSES.find((s) => s.value === v) ?? { label: 'Planned', tone: 'slate' as Tone }
export const platformLabel = (v: string | null) =>
  (v && PLATFORMS.find((p) => p.value === v)?.label) || null

/* ── Field limits, enforced identically on both write routes ──────────────── */
export const LIMITS = { title: 200, owner: 120, link: 500, notes: 2000 } as const

/** True only for a real calendar date. A shape-only regex passes 2026-02-31 /
 *  2026-13-01, which Postgres' `date` type would reject as a raw 500 — so the
 *  write routes validate with this before inserting. (Same guard as
 *  lib/deals.isRealDate; duplicated so marketing carries no dependency on the
 *  CRM module.) */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

/** 'YYYY-MM-DD' for a Date, in LOCAL time — `toISOString()` would shift the day
 *  either side of UTC midnight for anyone west of Greenwich. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** A bare 'YYYY-MM-DD' parsed to LOCAL midnight (TZ-drift trap: `new Date(s)`
 *  on a date-only string parses as UTC and renders as the previous day). */
export function parseDay(s: string): Date {
  return new Date(s + 'T00:00:00')
}

/* ── Tailwind recipes for the tones (DESIGN.md §2.4 soft washes) ──────────── */

/** Grid chips + status pills. */
export const TONE_WASH: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
}

/** Legend + filter swatches — the wash alone, no text colour. */
export const TONE_DOT: Record<Tone, string> = {
  slate: 'bg-slate-300 dark:bg-slate-500/40',
  emerald: 'bg-emerald-300 dark:bg-emerald-500/40',
  amber: 'bg-amber-300 dark:bg-amber-500/40',
  sky: 'bg-sky-300 dark:bg-sky-500/40',
  rose: 'bg-rose-300 dark:bg-rose-500/40',
  violet: 'bg-violet-300 dark:bg-violet-500/40',
}
