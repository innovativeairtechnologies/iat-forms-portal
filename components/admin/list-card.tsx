'use client'

/* ────────────────────────────────────────────────────────────────────────────
   Shared "one-card" list-view kit — the house pattern for dense /admin lists.
   First proven on the Performance page (app/admin/projected-sales); this file
   generalizes it so every list reads as one system. See docs/list-views.md.

   The whole list module (header · stats · filters · table · pagination) lives in
   ONE card on the warm canvas page. Every band shares one `px-5` gutter so all
   left edges align and all right edges align.

   Gotchas are BAKED IN so callers can't reintroduce them:
   - <Row> is `w-full` (a bare <button> shrink-wraps and drifts the columns).
   - <CardTable> is `overflow-x-auto overflow-y-hidden` (x:auto alone reserves a
     phantom vertical scrollbar that pulls columns off the right gutter).
   - <ListCard> is NOT `overflow-hidden` (that clips filter dropdowns).
   Semantic tokens only; never an opacity modifier on a token (`bg-brand/70`
   compiles to nothing).
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsOf, type Tone } from './list'

// ── Tone system (mirrors list.tsx TONE_CLS: soft-wash bg + colored fg + solid) ─
export const CARD_TONE: Record<Tone, { bg: string; fg: string; solid: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', solid: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',     fg: 'text-amber-600 dark:text-amber-400',     solid: 'bg-amber-500' },
  sky:     { bg: 'bg-sky-50 dark:bg-sky-500/10',         fg: 'text-sky-600 dark:text-sky-400',         solid: 'bg-sky-500' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-500/10',       fg: 'text-rose-500 dark:text-rose-400',       solid: 'bg-rose-500' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',   fg: 'text-violet-600 dark:text-violet-400',   solid: 'bg-violet-500' },
  slate:   { bg: 'bg-zinc-100 dark:bg-zinc-800',         fg: 'text-zinc-500 dark:text-zinc-400',        solid: 'bg-zinc-400' },
}
export const AVATAR_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose']
export const TAG_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose', 'slate']

/** Stable tone from a string, so a given name / category always reads the same color. */
export function toneFor(s: string, pool: Tone[] = TAG_TONES): Tone {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}
export const confBand = (c: number): Tone => (c >= 70 ? 'emerald' : c >= 45 ? 'amber' : 'slate')

// ── Page + card shells ────────────────────────────────────────────────────────

/** Root scroll container: warm canvas + padding. Put a <ListCard> inside. */
export function ListCardPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

/** The one card. Deliberately NOT overflow-hidden (that would clip dropdowns). */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-hairline bg-surface', className)}>{children}</div>
}

/** Card header band: overline · title · count on the left, actions on the right. */
export function CardHead({
  overline, title, count, actions,
}: {
  overline?: string; title: ReactNode; count?: ReactNode; actions?: ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-hairline flex-wrap">
      <div className="min-w-0">
        {overline && <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">{overline}</p>}
        <h1 className="text-[20px] font-semibold text-ink tracking-tight">{title}</h1>
        {count != null && <p className="text-[12.5px] text-ink-muted mt-1">{count}</p>}
      </div>
      {actions != null && <><div className="flex-1" /><div className="flex items-center gap-2 flex-wrap">{actions}</div></>}
    </div>
  )
}

/** Hairline-separated stat strip. Fill with <Stat> cells. */
export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap border-b border-hairline">{children}</div>
}

export function Stat({ tone, label, value, sub }: { tone: Tone; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="flex-1 min-w-[150px] px-5 py-3 border-l border-hairline first:border-l-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', CARD_TONE[tone].solid)} />
        {label}
      </p>
      <p className="mt-1.5 text-[20px] font-semibold text-ink tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[10.5px] text-ink-faint mt-0.5">{sub}</p>}
    </div>
  )
}

/** Filter / control row. Put search + <FilterDropdown>s here; use a <div className="flex-1" /> to push trailing items right. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-5 py-3 border-b border-hairline flex-wrap">{children}</div>
}

// ── Table ───────────────────────────────────────────────────────────────────

/**
 * Table wrapper — bakes in `overflow-x-auto overflow-y-hidden` (the phantom
 * scrollbar fix) and a min-width so wide tables scroll sideways. `cols` is a
 * Tailwind `grid-cols-[…]` class string; pass the SAME string to every <Row>.
 */
export function CardTable({
  cols, head, children, minWidth = 980,
}: {
  cols: string; head: ReactNode; children: ReactNode; minWidth?: number
}) {
  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <div className="sm:min-w-[var(--lc-min)]" style={{ '--lc-min': `${minWidth}px` } as CSSProperties}>
        <div className={cn('grid', cols, 'items-center gap-3 px-5 h-10 bg-surface-soft border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-ink-muted')}>
          {head}
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * A table row. `w-full` is baked in so the grid fills the width and columns land
 * under their headers. Provide `href` (Link), `onClick` (button), or neither
 * (static div). Pass the SAME `cols` string as the header.
 */
export function Row({
  cols, href, onClick, selected, children,
}: {
  cols: string; href?: string; onClick?: () => void; selected?: boolean; children: ReactNode
}) {
  const cls = cn(
    'grid w-full', cols,
    'items-center gap-3 px-5 min-h-[56px] py-2 text-left border-b border-hairline-soft transition-colors group',
    selected ? 'bg-brand-soft' : 'hover:bg-surface-soft',
  )
  if (href) return <Link href={href} className={cls}>{children}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{children}</button>
  return <div className={cls}>{children}</div>
}

/** Sortable column-header cell. Wrap in a `justify-self-end` div for right-aligned columns. */
export function SortHeader({
  label, active, dir, onClick, align = 'left',
}: {
  label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
        align === 'right' && 'justify-end',
        active ? 'text-ink-secondary' : 'text-ink-muted hover:text-ink-secondary',
      )}
    >
      {label}
      {active
        ? <ChevronDown size={12} className={cn('transition-transform', dir === 'asc' && 'rotate-180')} />
        : <ChevronsUpDown size={11} className="opacity-40 group-hover:opacity-80" />}
    </button>
  )
}

/** Empty-state row shown in place of table rows. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="px-5 py-14 text-center border-b border-hairline-soft text-[13px] text-ink-muted">{children}</div>
}

// ── Cells: avatar · tag pill · meter ──────────────────────────────────────────

/** Colored initials avatar (soft-wash tone by name, or an explicit tone). */
export function ToneAvatar({ name, size = 26, tone }: { name: string; size?: number; tone?: Tone }) {
  const t = CARD_TONE[tone ?? toneFor(name || '?', AVATAR_TONES)]
  return (
    <span
      className={cn('rounded-full flex items-center justify-center font-bold flex-shrink-0', t.bg, t.fg)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  )
}

/** Soft-wash category/type pill with a leading dot (normal case, unlike StatusPill). */
export function TagPill({ children, tone }: { children: string; tone?: Tone }) {
  const t = CARD_TONE[tone ?? toneFor(children, TAG_TONES)]
  return (
    <span className={cn('inline-flex items-center gap-1.5 max-w-full text-[10.5px] font-semibold px-2 py-[3px] rounded-md', t.bg, t.fg)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', t.solid)} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Short horizontal meter for a 0–100 value (confidence, % complete, …). */
export function Meter({ value, tone, showValue = true, suffix = '%' }: { value: number; tone?: Tone; showValue?: boolean; suffix?: string }) {
  const t = CARD_TONE[tone ?? confBand(value)]
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-14 h-1 rounded-full bg-surface-strong overflow-hidden">
        <span className={cn('block h-full rounded-full', t.solid)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </span>
      {showValue && <span className="text-[12px] tabular-nums text-ink-secondary w-8 text-right">{value}{suffix}</span>}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

export const PER_PAGE_OPTIONS = [10, 25, 50, 100]

/**
 * Pagination state hook. `length` is the filtered+sorted row count. Pass a
 * `resetKey` (e.g. the active filter/search/sort) to jump back to page 1 when it
 * changes. Slice your rows with `[start, end]`.
 */
export function usePagedList(length: number, opts?: { initialPerPage?: number; resetKey?: unknown }) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(opts?.initialPerPage ?? 10)
  useEffect(() => { setPage(1) }, [opts?.resetKey, perPage])
  const totalPages = Math.max(1, Math.ceil(length / perPage))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * perPage
  return { page: current, setPage, perPage, setPerPage, totalPages, start, end: start + perPage }
}

export function PerPageSelect({ value, onChange, options = PER_PAGE_OPTIONS }: { value: number; onChange: (n: number) => void; options?: number[] }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      Show
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 px-2 rounded-lg bg-surface-soft border border-hairline text-[13px] text-ink-secondary outline-none focus:border-brand cursor-pointer"
      >
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      per page
    </label>
  )
}

/** Windowed page buttons: ‹ 1 … 4 5 6 … 20 › */
export function Pager({ page, totalPages, onGo }: { page: number; totalPages: number; onGo: (n: number) => void }) {
  if (totalPages <= 1) return null
  const win: (number | '…')[] = [1]
  const lo = Math.max(2, page - 1), hi = Math.min(totalPages - 1, page + 1)
  if (lo > 2) win.push('…')
  for (let n = lo; n <= hi; n++) win.push(n)
  if (hi < totalPages - 1) win.push('…')
  if (totalPages > 1) win.push(totalPages)
  const btn = 'min-w-[30px] h-[30px] px-2 inline-flex items-center justify-center text-[12.5px] font-medium rounded-lg tabular-nums transition-colors'
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onGo(page - 1)} disabled={page === 1} className={cn(btn, 'text-ink-secondary hover:bg-surface-strong disabled:opacity-40 disabled:hover:bg-transparent')} aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      {win.map((n, i) => n === '…'
        ? <span key={`d${i}`} className={cn(btn, 'text-ink-faint')}>…</span>
        : <button type="button" key={n} onClick={() => onGo(n)} className={cn(btn, n === page ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-surface-strong')}>{n}</button>,
      )}
      <button type="button" onClick={() => onGo(page + 1)} disabled={page === totalPages} className={cn(btn, 'text-ink-secondary hover:bg-surface-strong disabled:opacity-40 disabled:hover:bg-transparent')} aria-label="Next page">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

/** Full pagination footer: "Showing X–Y of Z" · per-page select · pager. */
export function Pagination({
  page, perPage, total, totalPages, onPage, onPerPage, unit = 'items', options,
}: {
  page: number; perPage: number; total: number; totalPages: number
  onPage: (n: number) => void; onPerPage: (n: number) => void; unit?: string; options?: number[]
}) {
  const start = (page - 1) * perPage
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-t border-hairline flex-wrap">
      <span className="text-[12.5px] text-ink-muted">
        Showing <b className="font-semibold text-ink-secondary tabular-nums">{total === 0 ? '0' : `${start + 1}–${Math.min(start + perPage, total)}`}</b>
        {' '}of <b className="font-semibold text-ink-secondary tabular-nums">{total}</b> {unit}
      </span>
      <div className="flex-1" />
      <PerPageSelect value={perPage} onChange={onPerPage} options={options} />
      <Pager page={page} totalPages={totalPages} onGo={onPage} />
    </div>
  )
}

// ── Filter dropdown (generic) ─────────────────────────────────────────────────

export type FilterOption = { value: string; label: string }

/**
 * Compact filter dropdown. `value === '__all'` means no filter. Renders nothing
 * if there are 0–1 options (nothing to filter). Lives fine inside <ListCard>
 * because the card isn't overflow-hidden.
 */
export function FilterDropdown({
  icon: Icon, allLabel = 'All', value, options, onChange, minOptions = 2,
}: {
  icon?: LucideIcon; allLabel?: string; value: string; options: FilterOption[]
  onChange: (v: string) => void; minOptions?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  if (options.length < minOptions) return null
  const active = value !== '__all'
  const label = active ? (options.find((o) => o.value === value)?.label ?? value) : allLabel
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors',
          active ? 'bg-brand-soft border-transparent text-brand-ink' : 'bg-surface-soft border-hairline text-ink-secondary hover:border-hairline-strong',
        )}
      >
        {Icon && <Icon size={14} className={active ? 'text-brand-ink' : 'text-ink-muted'} />}
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-xl border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 py-1 z-30">
          <FilterItem label={allLabel} active={value === '__all'} onClick={() => { onChange('__all'); setOpen(false) }} />
          {options.map((o) => (
            <FilterItem key={o.value} label={o.label} active={value === o.value} onClick={() => { onChange(o.value); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors', active ? 'text-brand-ink font-medium' : 'text-ink-secondary hover:bg-surface-soft')}
    >
      <span className="flex-1 truncate">{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />}
    </button>
  )
}

/** Search input styled for the toolbar. */
export function ListSearch({ value, onChange, placeholder = 'Search…', width = 240 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <div className="relative" style={{ width }}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-9 pl-9 pr-3 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
      />
    </div>
  )
}
