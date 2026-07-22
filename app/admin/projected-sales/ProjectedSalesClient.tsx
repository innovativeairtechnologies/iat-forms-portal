'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshCw, ChevronRight, ChevronLeft, ChevronDown, ChevronsUpDown,
  AlertTriangle, TrendingUp, Search, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo, type Tone } from '@/components/admin/list'

// ─── Types (shape of the projected_sales / projected_sales_sync rows) ─────────

export type ProjectedSalesUnit = { unitName: string | null; modelNumber: string | null; quoteTotal: number | null }

export type ProjectedSale = {
  id: number
  user_name: string | null
  company: string | null
  project_customer: string | null
  project_name: string | null
  date_created: string | null
  contact: string | null
  project_types: string | null
  confidence_level: number | null
  estimated_closing_date: string | null
  units: ProjectedSalesUnit[] | null
  unit_count: number
  quote_total: number | string // numeric arrives from PostgREST as a string
  weighted_total: number | string
  synced_at: string
}

export type SyncMeta = {
  id: boolean
  last_synced_at: string | null
  source_count: number | null
  unique_count: number | null
  total_quote: number | string | null
  weighted_total: number | string | null
  duration_ms: number | null
  status: string | null
  error: string | null
  synced_by: string | null
} | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const fmtUsd = (v: unknown) => '$' + Math.round(num(v)).toLocaleString('en-US')

function fmtDate(s: string | null): string {
  if (!s) return '—'
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  // Build in local time from the parts so a UTC-midnight string doesn't slip a day.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Whole days from today to the close date (negative = overdue). Null-safe.
function daysToClose(s: string | null): number | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

// ── Tone system (mirrors components/admin/list.tsx TONE_CLS) ──────────────────
const TONE: Record<Tone, { bg: string; fg: string; solid: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', solid: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',     fg: 'text-amber-600 dark:text-amber-400',     solid: 'bg-amber-500' },
  sky:     { bg: 'bg-sky-50 dark:bg-sky-500/10',         fg: 'text-sky-600 dark:text-sky-400',         solid: 'bg-sky-500' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-500/10',       fg: 'text-rose-500 dark:text-rose-400',       solid: 'bg-rose-500' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',   fg: 'text-violet-600 dark:text-violet-400',   solid: 'bg-violet-500' },
  slate:   { bg: 'bg-zinc-100 dark:bg-zinc-800',         fg: 'text-zinc-500 dark:text-zinc-400',        solid: 'bg-zinc-400' },
}

// Stable tone from a string so a given rep / project type always reads the same color.
function toneFor(s: string, pool: Tone[]): Tone {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}
const AVATAR_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose']
const TYPE_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose', 'slate']
const confBand = (c: number): Tone => (c >= 70 ? 'emerald' : c >= 45 ? 'amber' : 'slate')
const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

// Project | Salesperson | Type | Confidence | Est. close | Quote | Weighted
const COLS = 'grid-cols-[minmax(210px,1.7fr)_168px_148px_152px_128px_120px_128px]'
const PER_PAGE_OPTIONS = [10, 25, 50, 100]
type SortKey = 'project' | 'confidence' | 'close' | 'quote' | 'weighted'
const NUMERIC_KEYS: SortKey[] = ['confidence', 'quote', 'weighted']

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectedSalesClient({
  initialProjects, initialSync,
}: {
  initialProjects: ProjectedSale[]
  initialSync: SyncMeta
}) {
  const [projects, setProjects] = useState<ProjectedSale[]>(initialProjects)
  const [sync, setSync] = useState<SyncMeta>(initialSync)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dealNote, setDealNote] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // View controls
  const [filterUser, setFilterUser] = useState<string>('__all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('quote')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)

  const reps = useMemo(
    () => Array.from(new Set(projects.map((p) => p.user_name).filter(Boolean) as string[])).sort(),
    [projects],
  )

  // rep filter + search + sort → the working view (before pagination)
  const view = useMemo(() => {
    let r = projects
    if (filterUser !== '__all') r = r.filter((p) => p.user_name === filterUser)
    const q = query.trim().toLowerCase()
    if (q) {
      r = r.filter((p) =>
        [p.project_name, p.project_customer, p.user_name, p.project_types, p.company, p.contact]
          .filter(Boolean).join(' ').toLowerCase().includes(q),
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (p: ProjectedSale): number | string =>
      sortKey === 'project' ? (p.project_name || '').toLowerCase()
      : sortKey === 'confidence' ? num(p.confidence_level)
      : sortKey === 'close' ? (p.estimated_closing_date || '')
      : sortKey === 'quote' ? num(p.quote_total)
      : num(p.weighted_total)
    return [...r].sort((a, b) => {
      const av = val(a), bv = val(b)
      return av < bv ? -1 * dir : av > bv ? dir : 0
    })
  }, [projects, filterUser, query, sortKey, sortDir])

  const stats = useMemo(() => {
    const count = view.length
    const totalQuote = view.reduce((a, p) => a + num(p.quote_total), 0)
    const weighted = view.reduce((a, p) => a + num(p.weighted_total), 0)
    const avgConf = count ? Math.round(view.reduce((a, p) => a + num(p.confidence_level), 0) / count) : 0
    return { count, totalQuote, weighted, avgConf }
  }, [view])

  const maxWeighted = useMemo(() => Math.max(1, ...projects.map((p) => num(p.weighted_total))), [projects])

  // Reset to page 1 whenever the result set or page size changes.
  useEffect(() => { setPage(1) }, [filterUser, query, sortKey, sortDir, perPage])

  const totalPages = Math.max(1, Math.ceil(view.length / perPage))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * perPage
  const pageRows = view.slice(start, start + perPage)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(NUMERIC_KEYS.includes(k) ? 'desc' : 'asc') }
  }

  async function doSync() {
    setSyncing(true); setError(null); setDealNote(null)
    try {
      const res = await fetch('/api/admin/projected-sales/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `Sync failed (HTTP ${res.status}).`)
      setProjects((json.projects ?? []) as ProjectedSale[])
      setSync((json.sync ?? null) as SyncMeta)
      setExpandedId(null)
      const ds = json.dealStats as { inserted: number; updated: number; pruned: number } | null
      if (ds) {
        const bits = [
          ds.inserted && `${ds.inserted} new`,
          ds.updated && `${ds.updated} updated`,
          ds.pruned && `${ds.pruned} closed out`,
        ].filter(Boolean)
        setDealNote(`CRM Board refreshed — ${bits.length ? bits.join(', ') : 'no changes'}.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const deduped =
    sync?.source_count != null && sync?.unique_count != null && sync.source_count !== sync.unique_count

  const syncButton = (
    <button
      onClick={doSync}
      disabled={syncing}
      className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium disabled:opacity-60 transition-colors"
    >
      <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
      {syncing ? 'Syncing…' : 'Sync now'}
    </button>
  )

  // Sortable column header cell.
  const SortHead = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => {
    const active = sortKey === k
    return (
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          'group inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
          align === 'right' && 'justify-end',
          active ? 'text-ink-secondary' : 'text-ink-muted hover:text-ink-secondary',
        )}
      >
        {label}
        {active
          ? <ChevronDown size={12} className={cn('transition-transform', sortDir === 'asc' && 'rotate-180')} />
          : <ChevronsUpDown size={11} className="opacity-40 group-hover:opacity-80" />}
      </button>
    )
  }

  return (
    // One unified white sheet — everything below the top bar lives on it and
    // scrolls together. bg-surface (light: white / dark: the raised surface).
    <div className="flex-1 min-h-0 overflow-y-auto bg-surface">

      {/* Header band */}
      <div className="flex items-start gap-4 px-4 sm:px-8 pt-7 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Sales</p>
          <h1 className="text-[26px] font-semibold text-ink tracking-tight">Performance</h1>
          <p className="text-[13px] text-ink-muted mt-1">
            {sync?.last_synced_at
              ? <><span className="tabular-nums">{projects.length}</span> projects · <span className="tabular-nums">{fmtUsd(sumAll(projects))}</span> quoted</>
              : 'Not synced yet'}
          </p>
        </div>
        <div className="flex-1" />
        {syncButton}
      </div>

      {projects.length === 0 ? (
        <div className="px-4 sm:px-8 pb-8">
          <EmptyState onSync={doSync} syncing={syncing} />
        </div>
      ) : (
        <>
          {/* Stat strip — hairline-separated, not cards */}
          <div className="flex flex-wrap border-y border-hairline">
            <Stat tone="sky"     label="Projects"          value={stats.count.toLocaleString()} />
            <Stat tone="emerald" label="Total quoted"      value={fmtUsd(stats.totalQuote)} />
            <Stat tone="violet"  label="Weighted pipeline" value={fmtUsd(stats.weighted)} sub="quote × confidence" />
            <Stat tone="amber"   label="Avg. confidence"   value={`${stats.avgConf}%`} />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 sm:px-8 py-3 border-b border-hairline flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, customers…"
                aria-label="Search projects"
                className="w-[240px] h-9 pl-9 pr-3 text-[13px] rounded-lg bg-canvas border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
              />
            </div>
            <RepFilter reps={reps} value={filterUser} onChange={setFilterUser} />
            <div className="flex-1" />
            {(query || filterUser !== '__all') && (
              <span className="text-[12px] text-ink-muted tabular-nums">{view.length} match{view.length === 1 ? '' : 'es'}</span>
            )}
          </div>

          {/* Freshness + de-dup transparency, or a failure banner */}
          <div className="px-4 sm:px-8 pt-4 space-y-3">
            {(error || sync?.status === 'error') && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <span>
                  Last sync failed: {error || sync?.error}
                  {sync?.last_synced_at && ` — showing the last good data from ${timeAgo(sync.last_synced_at)} ago.`}
                </span>
              </div>
            )}
            {dealNote && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-300">
                {dealNote}
              </div>
            )}
            {sync?.last_synced_at && (
              <p className="text-[12px] text-ink-faint">
                Synced {timeAgo(sync.last_synced_at)} ago
                {sync.synced_by ? ` by ${sync.synced_by}` : ''}
                {sync.duration_ms != null ? ` · ${(sync.duration_ms / 1000).toFixed(1)}s` : ''}
                {deduped && ` · ${sync.unique_count} of ${sync.source_count} source rows (duplicates removed)`}
              </p>
            )}
          </div>

          {/* List — rows sit directly on the sheet */}
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[980px]">
              {/* Column header row */}
              <div className={cn('grid', COLS, 'items-center gap-3 px-4 sm:px-8 h-10 bg-surface-soft border-y border-hairline')}>
                <SortHead label="Project" k="project" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Salesperson</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Type</span>
                <SortHead label="Confidence" k="confidence" />
                <SortHead label="Est. close" k="close" />
                <div className="justify-self-end"><SortHead label="Quote" k="quote" align="right" /></div>
                <div className="justify-self-end"><SortHead label="Weighted" k="weighted" align="right" /></div>
              </div>

              {/* Rows */}
              {pageRows.map((p) => {
                const expanded = expandedId === p.id
                const units = p.units ?? []
                const conf = num(p.confidence_level)
                const band = confBand(conf)
                const repTone = TONE[toneFor(p.user_name || '—', AVATAR_TONES)]
                const typeTone = p.project_types ? TONE[toneFor(p.project_types, TYPE_TONES)] : null
                const dtc = daysToClose(p.estimated_closing_date)
                const dateCls = dtc == null ? 'text-ink-muted'
                  : dtc < 0 ? 'text-rose-500 dark:text-rose-400'
                  : dtc <= 30 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-ink-muted'
                const wPct = Math.max(3, Math.round((num(p.weighted_total) / maxWeighted) * 100))
                return (
                  <Fragment key={p.id}>
                    <button
                      onClick={() => setExpandedId(expanded ? null : p.id)}
                      className={cn('grid', COLS, 'items-center gap-3 px-4 sm:px-8 min-h-[56px] py-2 text-left border-b border-hairline-soft hover:bg-surface-soft transition-colors group')}
                    >
                      {/* Project */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChevronRight size={14} className={cn('flex-shrink-0 text-ink-faint transition-transform', expanded && 'rotate-90')} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{p.project_name || '—'}</p>
                          <p className="text-[11.5px] text-ink-muted truncate">
                            {[p.project_customer, p.unit_count > 1 ? `${p.unit_count} units` : null].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Salesperson */}
                      <div className="flex items-center gap-2 min-w-0">
                        {p.user_name ? (
                          <>
                            <span className={cn('w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0', repTone.bg, repTone.fg)}>
                              {initialsOf(p.user_name)}
                            </span>
                            <span className="text-[12.5px] text-ink-secondary truncate">{p.user_name}</span>
                          </>
                        ) : <span className="text-[12.5px] text-ink-faint">—</span>}
                      </div>

                      {/* Type */}
                      <div className="min-w-0">
                        {typeTone ? (
                          <span className={cn('inline-flex items-center gap-1.5 max-w-full text-[10.5px] font-semibold px-2 py-[3px] rounded-md', typeTone.bg, typeTone.fg)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', typeTone.solid)} />
                            <span className="truncate">{p.project_types}</span>
                          </span>
                        ) : <span className="text-[12px] text-ink-faint">—</span>}
                      </div>

                      {/* Confidence meter */}
                      <div className="flex items-center gap-2.5">
                        <span className="flex-1 h-1.5 min-w-[44px] rounded-full bg-surface-strong overflow-hidden">
                          <span className={cn('block h-full rounded-full', TONE[band].solid)} style={{ width: `${Math.max(2, conf)}%` }} />
                        </span>
                        <span className="text-[12px] tabular-nums text-ink-secondary w-8 text-right">{conf}%</span>
                      </div>

                      {/* Est. close */}
                      <div className={cn('text-[12.5px] truncate flex items-center gap-1.5', dateCls)}>
                        {dtc != null && (dtc < 0 || dtc <= 30) && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dtc < 0 ? 'bg-rose-500' : 'bg-amber-500')} />}
                        {fmtDate(p.estimated_closing_date)}
                      </div>

                      {/* Quote */}
                      <div className="justify-self-end text-right tabular-nums text-[13px] font-semibold text-ink">{fmtUsd(p.quote_total)}</div>

                      {/* Weighted + magnitude bar */}
                      <div className="justify-self-end text-right w-full min-w-0">
                        <div className="tabular-nums text-[12.5px] text-ink-secondary">{fmtUsd(p.weighted_total)}</div>
                        <div className="h-1 mt-1 rounded-full bg-surface-strong overflow-hidden">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${wPct}%` }} />
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 sm:px-8 py-4 bg-surface-soft border-b border-hairline">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mb-3">
                          <Meta label="Company" value={p.company} />
                          <Meta label="Created" value={fmtDate(p.date_created)} />
                          <Meta label="Contact" value={p.contact} />
                          <Meta label="Est. close" value={fmtDate(p.estimated_closing_date)} />
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Units ({units.length})</p>
                        <div className="space-y-1">
                          {units.map((u, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-[12.5px] border-b border-hairline-soft last:border-0 py-1">
                              <span className="text-ink-secondary truncate">
                                {u.unitName || '—'}
                                {u.modelNumber ? <span className="text-ink-faint"> · {u.modelNumber}</span> : null}
                              </span>
                              <span className="tabular-nums text-ink flex-shrink-0">{fmtUsd(u.quoteTotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Fragment>
                )
              })}

              {pageRows.length === 0 && (
                <div className="px-4 sm:px-8 py-14 text-center border-b border-hairline-soft">
                  <p className="text-[13px] text-ink-muted">No projects match your search.</p>
                </div>
              )}
            </div>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center gap-4 px-4 sm:px-8 py-4 flex-wrap">
            <span className="text-[12.5px] text-ink-muted">
              Showing <b className="font-semibold text-ink-secondary tabular-nums">{view.length === 0 ? '0' : `${start + 1}–${Math.min(start + perPage, view.length)}`}</b>
              {' '}of <b className="font-semibold text-ink-secondary tabular-nums">{view.length}</b> projects
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
              Show
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="h-9 px-2 rounded-lg bg-canvas border border-hairline text-[13px] text-ink-secondary outline-none focus:border-brand cursor-pointer"
              >
                {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              per page
            </label>
            <Pager page={current} totalPages={totalPages} onGo={setPage} />
          </div>
        </>
      )}
    </div>
  )
}

// Total quoted across ALL projects (the header count is dataset-wide, not filtered).
function sumAll(projects: ProjectedSale[]) {
  return projects.reduce((a, p) => a + num(p.quote_total), 0)
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Stat({ tone, label, value, sub }: { tone: Tone; label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-[150px] px-5 py-3.5 border-l border-hairline first:border-l-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
        <span className={cn('w-1.5 h-1.5 rounded-full', TONE[tone].solid)} />
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold text-ink tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-ink-faint mt-0.5">{sub}</p>}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="text-[12.5px] text-ink-secondary truncate">{value || '—'}</p>
    </div>
  )
}

// Rep filter — compact dropdown (avoids a long wrapping row of pills).
function RepFilter({ reps, value, onChange }: { reps: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  if (reps.length <= 1) return null
  const label = value === '__all' ? 'All reps' : value
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors',
          value === '__all'
            ? 'bg-canvas border-hairline text-ink-secondary hover:border-hairline-strong'
            : 'bg-brand-soft border-transparent text-brand-ink',
        )}
      >
        <Users size={14} className={value === '__all' ? 'text-ink-muted' : 'text-brand-ink'} />
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-xl border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 py-1 z-30">
          <RepOption label="All reps" active={value === '__all'} onClick={() => { onChange('__all'); setOpen(false) }} />
          {reps.map((r) => (
            <RepOption key={r} label={r} active={value === r} onClick={() => { onChange(r); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function RepOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors',
        active ? 'text-brand-ink font-medium' : 'text-ink-secondary hover:bg-surface-soft',
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />}
    </button>
  )
}

// Windowed pager: ‹ 1 … 4 5 6 … 20 ›
function Pager({ page, totalPages, onGo }: { page: number; totalPages: number; onGo: (n: number) => void }) {
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
      <button onClick={() => onGo(page - 1)} disabled={page === 1} className={cn(btn, 'text-ink-secondary hover:bg-surface-strong disabled:opacity-40 disabled:hover:bg-transparent')} aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      {win.map((n, i) => n === '…'
        ? <span key={`d${i}`} className={cn(btn, 'text-ink-faint')}>…</span>
        : <button key={n} onClick={() => onGo(n)} className={cn(btn, n === page ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-surface-strong')}>{n}</button>,
      )}
      <button onClick={() => onGo(page + 1)} disabled={page === totalPages} className={cn(btn, 'text-ink-secondary hover:bg-surface-strong disabled:opacity-40 disabled:hover:bg-transparent')} aria-label="Next page">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function EmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-soft px-6 py-16 flex flex-col items-center text-center">
      <span className="w-11 h-11 rounded-xl bg-surface-strong flex items-center justify-center text-ink-muted mb-3">
        <TrendingUp size={20} />
      </span>
      <p className="text-[15px] font-semibold text-ink">No projected sales yet</p>
      <p className="text-[13px] text-ink-muted mt-1 mb-4 max-w-sm">
        Pull the latest projected-sales snapshot from Dryware. It takes a couple of seconds.
      </p>
      <button
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium disabled:opacity-60 transition-colors"
      >
        <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}
