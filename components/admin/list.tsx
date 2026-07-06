import type { ReactNode } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Shared admin list kit — the single source of truth for the dense table
   language used across Submissions / Tickets / Equipment / Forms / Employees.
   Pure presentational (no hooks) so it imports cleanly into both server and
   client components. Change a token here → every list page changes with it.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Shell + density tokens ────────────────────────────────────────────────────
// A page sets its own `grid-cols-[…]` template (COLS) and applies it to both the
// header box and each row so columns line up. gap-3 + px-4 are baked in here.

export const HEADER_BOX =
  'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none h-10 items-center gap-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600'

// NOTE: no `overflow-hidden` here — the per-row kebab menu is absolutely
// positioned and would be clipped at the box edges (esp. the top rows). Rows
// round their own outer corners (see rowCx) so the box still looks clean.
export const BODY_BOX =
  'mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none'

export const ROW = 'items-center gap-3 px-4 h-[44px] text-[13px] transition-colors'
export const ROW_DIVIDE = 'border-t border-zinc-100 dark:border-zinc-800/60'
export const ROW_HOVER = 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
export const ROW_SELECTED = 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]'

/** Compose a row className: rowCx(COLS, { i, selected }) */
export function rowCx(cols: string, opts?: { i?: number; selected?: boolean }) {
  return [
    'grid', cols, ROW,
    'first:rounded-t-xl last:rounded-b-xl',
    opts?.i ? ROW_DIVIDE : '',
    opts?.selected ? ROW_SELECTED : ROW_HOVER,
  ].join(' ')
}

/** Wraps a HEADER_BOX + BODY_BOX pair so a table with more columns than a
 *  phone screen scrolls horizontally instead of squeezing every column
 *  illegible-thin. The grid columns are fixed-width (COLS), so without a
 *  floor width the row would just shrink past readable; `minWidth` sets that
 *  floor and the wrapper becomes the horizontal-scroll surface once the
 *  viewport is narrower than it. `-mx-4 px-4 sm:mx-0 sm:px-0` lets the scroll
 *  area bleed to the page edge on mobile (matching the page's own gutter)
 *  without adding extra padding back on larger screens. */
export function TableScroll({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div style={{ minWidth }}>{children}</div>
    </div>
  )
}

// ── Status pills (one canonical tone system) ──────────────────────────────────
export type Tone = 'slate' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'

const TONE_CLS: Record<Tone, string> = {
  slate:   'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber:   'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  sky:     'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  rose:    'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400',
  violet:  'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
}

export function StatusPill({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-md whitespace-nowrap ${TONE_CLS[tone]}`}>
      {icon}
      {children}
    </span>
  )
}

// Domain → {label, tone} maps so colors are identical everywhere.
export const SUBMISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  open:        { label: 'Open',        tone: 'sky' },
  in_progress: { label: 'In Progress', tone: 'amber' },
  resolved:    { label: 'Resolved',    tone: 'emerald' },
}

export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  open:        { label: 'Open',        tone: 'sky' },
  in_progress: { label: 'In Progress', tone: 'amber' },
  resolved:    { label: 'Resolved',    tone: 'emerald' },
  closed:      { label: 'Closed',      tone: 'slate' },
}

export const TROUBLESHOOTING_STATUS: Record<string, { label: string; tone: Tone }> = {
  new:      { label: 'New',      tone: 'sky' },
  reviewed: { label: 'Reviewed', tone: 'amber' },
  closed:   { label: 'Closed',   tone: 'emerald' },
}

export const PRIORITY: Record<string, { label: string; dot: string }> = {
  low:      { label: 'Low',      dot: 'bg-sky-400' },
  med:      { label: 'Med',      dot: 'bg-amber-400' },
  high:     { label: 'High',     dot: 'bg-rose-500' },
  critical: { label: 'Critical', dot: 'bg-rose-700' },
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function initialsOf(name: string) {
  if (!name || name === 'Anonymous') return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 font-bold text-zinc-500 dark:text-zinc-300"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(name)}
    </span>
  )
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Uppercase column-header cell with optional alignment + sort affordance. */
export function Th({ children, align = 'left', className = '' }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  const a = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left'
  return <div className={`flex items-center gap-1 ${a} ${className}`}>{children}</div>
}
