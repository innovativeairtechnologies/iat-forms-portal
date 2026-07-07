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

// Airier than a plain data grid — the stacked IdentityCell (bold title over a
// muted subtitle) needs the height to breathe. This matches the Forms list, the
// house style every admin list follows. `min-h` not fixed `h` so a row that
// expands (an inline-expanded note) can grow instead of clipping.
export const ROW = 'items-center gap-3 px-4 min-h-[52px] py-1.5 text-[13px] transition-colors'
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

export const DEAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  Won:    { label: 'Won',    tone: 'emerald' },
  Lost:   { label: 'Lost',   tone: 'rose' },
  active: { label: 'Active', tone: 'sky' }, // synthetic key for null status — not a DB value
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

// ── List page header ──────────────────────────────────────────────────────────
/**
 * The standard admin list-page header band: a small-caps overline, a bold page
 * title, a light count/summary line, right-aligned primary actions, and an
 * optional row of tabs/filters below (rendered inside the same white band, so
 * an underline tab's border meets the header's bottom border like the Forms
 * page). This is the house style — every /admin list uses it so they read as
 * one system.
 */
export function ListPageHeader({
  overline, title, count, actions, children,
}: {
  overline: string
  title: string
  count?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-0 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{overline}</p>
          <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
          {count != null && <p className="text-[13px] text-gray-400 mt-0.5">{count}</p>}
        </div>
        {actions != null && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Identity cell ─────────────────────────────────────────────────────────────
/**
 * The signature row-identity element: a bold primary line stacked over a muted
 * secondary line (optionally monospace, e.g. a slug or reference number), with
 * an optional leading icon chip. This is the first column of every list row —
 * it's what makes the lists read as "clean and professional" rather than a
 * dense spreadsheet. Wrap the row in a `group` so the title picks up the
 * emerald hover when the row is a link.
 */
export function IdentityCell({
  icon, leading, title, subtitle, mono = false,
}: {
  icon?: ReactNode        // wrapped in a subtle square chip
  leading?: ReactNode     // rendered as-is (e.g. an <Avatar/>), takes precedence over icon
  title: ReactNode
  subtitle?: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {leading != null ? (
        leading
      ) : icon != null ? (
        <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500 dark:text-zinc-400">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {title}
        </p>
        {subtitle != null && subtitle !== '' && (
          <p className={`text-[11px] text-zinc-400 dark:text-zinc-500 truncate ${mono ? 'font-mono' : ''}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Tabs + filter pills (class helpers) ───────────────────────────────────────
// Class-string helpers rather than components, because callers mix <Link>
// (query-param tabs) and <button> (client-state tabs) — the styling is shared,
// the element isn't. Underline tabs go left, rounded filter pills go right,
// matching the Forms header.

/** Underline tab (left side of the header's tab row). */
export function tabCx(active: boolean) {
  return `flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
    active
      ? 'border-[#089447] text-[#089447]'
      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:border-gray-300 dark:hover:border-zinc-600'
  }`
}

/** The count chip inside an underline tab. */
export function tabCountCx(active: boolean) {
  return `text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
    active ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
  }`
}

/** Rounded status filter pill (right side of the header's tab row). */
export function filterPillCx(active: boolean) {
  return `flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full capitalize transition-all ${
    active
      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
      : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800'
  }`
}
