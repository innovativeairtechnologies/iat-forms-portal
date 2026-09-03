'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, ChevronRight, ChevronLeft, ChevronDown, ChevronsUpDown,
  AlertTriangle, Trophy, Search, Users, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { drywareKey } from '@/lib/dryware-key'
import { timeAgo, type Tone } from '@/components/admin/list'

// ─── Types (shape of the closed_projects / closed_projects_sync rows) ────────

export type ClosedProjectUnit = { unitId: number | null; unitName: string | null; modelNumber: string | null; quoteTotal: number | null; closedTotal: number | null }

export type ClosedProject = {
  project_id: number
  user_name: string | null
  company: string | null
  project_customer: string | null
  project_name: string | null
  date_created: string | null
  contact: string | null
  project_types: string | null
  confidence_level: number | null
  estimated_closing_date: string | null
  actual_closing_date: string | null
  units: ClosedProjectUnit[] | null
  unit_count: number
  quote_total: number | string // numeric arrives from PostgREST as a string
  closed_total: number | string
  imported_at: string
}

export type SyncMeta = {
  id: boolean
  last_synced_at: string | null
  fetched_count: number | null
  new_count: number | null
  total_closed: number | string | null
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
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const TONE: Record<Tone, { bg: string; fg: string; solid: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', solid: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',     fg: 'text-amber-600 dark:text-amber-400',     solid: 'bg-amber-500' },
  sky:     { bg: 'bg-sky-50 dark:bg-sky-500/10',         fg: 'text-sky-600 dark:text-sky-400',         solid: 'bg-sky-500' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-500/10',       fg: 'text-rose-500 dark:text-rose-400',       solid: 'bg-rose-500' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',   fg: 'text-violet-600 dark:text-violet-400',   solid: 'bg-violet-500' },
  slate:   { bg: 'bg-zinc-100 dark:bg-zinc-800',         fg: 'text-zinc-500 dark:text-zinc-400',        solid: 'bg-zinc-400' },
}

function toneFor(s: string, pool: Tone[]): Tone {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}
const AVATAR_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose']
const TYPE_TONES: Tone[] = ['sky', 'violet', 'amber', 'emerald', 'rose', 'slate']
const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

// Project | Salesperson | Type | Actual close | Closed total
const COLS = 'grid-cols-[minmax(220px,1.9fr)_168px_148px_140px_150px]'
const PER_PAGE_OPTIONS = [10, 25, 50, 100]
type SortKey = 'project' | 'close' | 'total'
const NUMERIC_KEYS: SortKey[] = ['total']

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClosedProjectsClient({
  initialProjects, initialSync, dealIdByKey,
}: {
  initialProjects: ClosedProject[]
  initialSync: SyncMeta
  /** dryware_key (customer|project) → deals.id. Same cross-link contract as the
   *  Performance page — see app/admin/projected-sales/ProjectedSalesClient.tsx. */
  dealIdByKey: Record<string, string>
}) {
  const router = useRouter()
  const [projects, setProjects] = useState<ClosedProject[]>(initialProjects)
  const [sync, setSync] = useState<SyncMeta>(initialSync)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wonNote, setWonNote] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [filterUser, setFilterUser] = useState<string>('__all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('close')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const reps = useMemo(
    () => Array.from(new Set(projects.map((p) => p.user_name).filter(Boolean) as string[])).sort(),
    [projects],
  )

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
    const val = (p: ClosedProject): number | string =>
      sortKey === 'project' ? (p.project_name || '').toLowerCase()
      : sortKey === 'close' ? (p.actual_closing_date || '')
      : num(p.closed_total)
    return [...r].sort((a, b) => {
      const av = val(a), bv = val(b)
      return av < bv ? -1 * dir : av > bv ? dir : 0
    })
  }, [projects, filterUser, query, sortKey, sortDir])

  const stats = useMemo(() => {
    const count = view.length
    const totalClosed = view.reduce((a, p) => a + num(p.closed_total), 0)
    const avg = count ? totalClosed / count : 0
    return { count, totalClosed, avg }
  }, [view])

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
    setSyncing(true); setError(null); setWonNote(null)
    try {
      const res = await fetch('/api/admin/closed-projects/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `Sync failed (HTTP ${res.status}).`)
      setProjects((json.projects ?? []) as ClosedProject[])
      setSync((json.sync ?? null) as SyncMeta)
      setExpandedId(null)
      // The sync also transitions matching deals to stage='won'; re-run the
      // server component so dealIdByKey (captured at page render) picks up
      // anything newly created or newly linked. `projects` is local state, so
      // this can't clobber the rows we just set.
      router.refresh()
      const ws = json.wonStats as { transitioned: number; created: number; alreadyWon: number } | null
      if (ws) {
        const bits = [
          ws.transitioned && `${ws.transitioned} marked won`,
          ws.created && `${ws.created} added directly`,
        ].filter(Boolean)
        setWonNote(`CRM Board updated — ${bits.length ? bits.join(', ') : 'no changes'}.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

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
    <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
      <div className="p-4 sm:p-6">
        <div className="rounded-xl border border-hairline bg-surface">

          {/* ── Card header ── */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-hairline flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Sales</p>
              <h1 className="text-[20px] font-semibold text-ink tracking-tight">Closed Projects</h1>
              <p className="text-[12.5px] text-ink-muted mt-1">
                {sync?.last_synced_at
                  ? <>
                      <span className="tabular-nums">{projects.length}</span> won ·{' '}
                      <span className="tabular-nums">{fmtUsd(sumAll(projects))}</span> total ·{' '}
                      synced {timeAgo(sync.last_synced_at)} ago{sync.synced_by ? ` by ${sync.synced_by}` : ''}
                      {!!sync.new_count && ` · ${sync.new_count} new`}
                    </>
                  : 'Not synced yet'}
              </p>
            </div>
            <div className="flex-1" />
            {syncButton}
          </div>

          {projects.length === 0 ? (
            <EmptyState onSync={doSync} syncing={syncing} />
          ) : (
            <>
              {/* ── Stat strip ── */}
              <div className="flex flex-wrap border-b border-hairline">
                <Stat tone="emerald" label="Won projects" value={stats.count.toLocaleString()} />
                <Stat tone="sky"     label="Total closed"  value={fmtUsd(stats.totalClosed)} />
                <Stat tone="violet"  label="Avg. deal size" value={fmtUsd(stats.avg)} />
              </div>

              {/* ── Filters ── */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-hairline flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects, customers…"
                    aria-label="Search projects"
                    className="w-[240px] h-9 pl-9 pr-3 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
                  />
                </div>
                <RepFilter reps={reps} value={filterUser} onChange={setFilterUser} />
                <div className="flex-1" />
                {(query || filterUser !== '__all') && (
                  <span className="text-[12px] text-ink-muted tabular-nums">{view.length} match{view.length === 1 ? '' : 'es'}</span>
                )}
              </div>

              {/* ── Alerts (only when present) ── */}
              {(error || sync?.status === 'error' || wonNote) && (
                <div className="px-5 py-3 border-b border-hairline space-y-2">
                  {(error || sync?.status === 'error') && (
                    <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>
                        Last sync failed: {error || sync?.error}
                        {sync?.last_synced_at && ` — showing the last good data from ${timeAgo(sync.last_synced_at)} ago.`}
                      </span>
                    </div>
                  )}
                  {wonNote && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-300">
                      {wonNote}
                    </div>
                  )}
                </div>
              )}

              {/* ── Table ── */}
              <div className="overflow-x-auto overflow-y-hidden">
                <div className="min-w-[860px]">
                  <div className={cn('grid', COLS, 'items-center gap-3 px-5 h-10 bg-surface-soft border-b border-hairline')}>
                    <SortHead label="Project" k="project" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Salesperson</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Type</span>
                    <SortHead label="Closed" k="close" />
                    <div className="justify-self-end"><SortHead label="Total" k="total" align="right" /></div>
                  </div>

                  {pageRows.map((p) => {
                    const expanded = expandedId === p.project_id
                    const units = p.units ?? []
                    const key = drywareKey(p.project_customer, p.project_name)
                    const dealId = key ? dealIdByKey[key] : undefined
                    const repTone = TONE[toneFor(p.user_name || '—', AVATAR_TONES)]
                    const typeTone = p.project_types ? TONE[toneFor(p.project_types, TYPE_TONES)] : null
                    const diverges = num(p.quote_total) !== num(p.closed_total)
                    return (
                      <Fragment key={p.project_id}>
                        <button
                          onClick={() => setExpandedId(expanded ? null : p.project_id)}
                          className={cn('grid w-full', COLS, 'items-center gap-3 px-5 min-h-[56px] py-2 text-left border-b border-hairline-soft hover:bg-surface-soft transition-colors group')}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ChevronRight size={14} className={cn('flex-shrink-0 text-ink-faint transition-transform', expanded && 'rotate-90')} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{p.project_name || '—'}</p>
                              <p className="text-[11.5px] text-ink-muted truncate">
                                {[p.project_customer, p.unit_count > 1 ? `${p.unit_count} units` : null].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                          </div>

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

                          <div className="min-w-0">
                            {typeTone ? (
                              <span className={cn('inline-flex items-center gap-1.5 max-w-full text-[10.5px] font-semibold px-2 py-[3px] rounded-md', typeTone.bg, typeTone.fg)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', typeTone.solid)} />
                                <span className="truncate">{p.project_types}</span>
                              </span>
                            ) : <span className="text-[12px] text-ink-faint">—</span>}
                          </div>

                          <div className="text-[12.5px] text-ink-muted truncate">{fmtDate(p.actual_closing_date)}</div>

                          <div className="justify-self-end text-right">
                            <div className="tabular-nums text-[13px] font-semibold text-ink">{fmtUsd(p.closed_total)}</div>
                            {diverges && (
                              <div className="tabular-nums text-[11px] text-ink-faint">quoted {fmtUsd(p.quote_total)}</div>
                            )}
                          </div>
                        </button>

                        {expanded && (
                          <div className="px-5 py-4 bg-surface-soft border-b border-hairline">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mb-3">
                              <Meta label="Company" value={p.company} />
                              <Meta label="Created" value={fmtDate(p.date_created)} />
                              <Meta label="Contact" value={p.contact} />
                              <Meta label="Est. close" value={fmtDate(p.estimated_closing_date)} />
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Units ({units.length})</p>
                            <div className="space-y-1">
                              {units.map((u, idx) => {
                                const unitDiverges = num(u.quoteTotal) !== num(u.closedTotal)
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-3 text-[12.5px] border-b border-hairline-soft last:border-0 py-1">
                                    <span className="text-ink-secondary truncate">
                                      {u.unitName || '—'}
                                      {u.modelNumber ? <span className="text-ink-faint"> · {u.modelNumber}</span> : null}
                                    </span>
                                    <span className="tabular-nums text-ink flex-shrink-0">
                                      {unitDiverges
                                        ? <>{fmtUsd(u.quoteTotal)} → <span className="font-semibold">{fmtUsd(u.closedTotal)}</span></>
                                        : fmtUsd(u.closedTotal)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Cross-link to the CRM Board — same contract as Performance. */}
                            <div className="mt-3 pt-3 border-t border-hairline">
                              {dealId ? (
                                <Link
                                  href={`/admin/deals?deal=${dealId}`}
                                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-secondary hover:text-brand-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded"
                                >
                                  Open in CRM Board <ArrowRight size={13} />
                                </Link>
                              ) : (
                                <p className="text-[12px] text-ink-faint">
                                  Not on the CRM Board yet — it appears after the next sync.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    )
                  })}

                  {pageRows.length === 0 && (
                    <div className="px-5 py-14 text-center border-b border-hairline-soft">
                      <p className="text-[13px] text-ink-muted">No projects match your search.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Pagination ── */}
              <div className="flex items-center gap-4 px-5 py-3.5 border-t border-hairline flex-wrap">
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
                    className="h-9 px-2 rounded-lg bg-surface-soft border border-hairline text-[13px] text-ink-secondary outline-none focus:border-brand cursor-pointer"
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
      </div>
    </div>
  )
}

function sumAll(projects: ClosedProject[]) {
  return projects.reduce((a, p) => a + num(p.closed_total), 0)
}

// ─── Sub-components (mirror app/admin/projected-sales/ProjectedSalesClient.tsx) ─

function Stat({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <div className="flex-1 min-w-[150px] px-5 py-3 border-l border-hairline first:border-l-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', TONE[tone].solid)} />
        {label}
      </p>
      <p className="mt-1.5 text-[20px] font-semibold text-ink tabular-nums tracking-tight">{value}</p>
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
            ? 'bg-surface-soft border-hairline text-ink-secondary hover:border-hairline-strong'
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
    <div className="px-6 py-16 flex flex-col items-center text-center">
      <span className="w-11 h-11 rounded-xl bg-surface-strong flex items-center justify-center text-ink-muted mb-3">
        <Trophy size={20} />
      </span>
      <p className="text-[15px] font-semibold text-ink">No closed projects yet</p>
      <p className="text-[13px] text-ink-muted mt-1 mb-4 max-w-sm">
        Pull the latest won-projects snapshot from Dryware. It takes a couple of seconds.
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
