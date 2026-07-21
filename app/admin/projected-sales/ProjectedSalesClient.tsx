'use client'

import { Fragment, useMemo, useState } from 'react'
import { RefreshCw, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ListPageHeader, IdentityCell, Th, TableScroll,
  HEADER_BOX, BODY_BOX, ROW, ROW_DIVIDE, ROW_HOVER,
  filterPillCx, timeAgo,
} from '@/components/admin/list'

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

// Project | Salesperson | Type | Conf. | Est. close | Quote | Weighted
const COLS = 'grid-cols-[minmax(200px,1fr)_136px_120px_84px_108px_124px_124px]'

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
  const [filterUser, setFilterUser] = useState<string>('__all')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const reps = useMemo(
    () => Array.from(new Set(projects.map((p) => p.user_name).filter(Boolean) as string[])).sort(),
    [projects],
  )

  const filtered = useMemo(
    () => (filterUser === '__all' ? projects : projects.filter((p) => p.user_name === filterUser)),
    [projects, filterUser],
  )

  const stats = useMemo(() => {
    const count = filtered.length
    const totalQuote = filtered.reduce((a, p) => a + num(p.quote_total), 0)
    const weighted = filtered.reduce((a, p) => a + num(p.weighted_total), 0)
    const avgConf = count ? Math.round(filtered.reduce((a, p) => a + num(p.confidence_level), 0) / count) : 0
    return { count, totalQuote, weighted, avgConf }
  }, [filtered])

  const [dealNote, setDealNote] = useState<string | null>(null)

  async function doSync() {
    setSyncing(true)
    setError(null)
    setDealNote(null)
    try {
      const res = await fetch('/api/admin/projected-sales/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `Sync failed (HTTP ${res.status}).`)
      setProjects((json.projects ?? []) as ProjectedSale[])
      setSync((json.sync ?? null) as SyncMeta)
      setExpandedId(null)
      // The sync also refreshed the CRM Board — tell the user so they know the
      // two surfaces are in step.
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

  const syncButton = (
    <button
      onClick={doSync}
      disabled={syncing}
      className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#089447] hover:bg-[#07803d] text-white text-[13px] font-medium disabled:opacity-60 transition-colors"
    >
      <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
      {syncing ? 'Syncing…' : 'Sync now'}
    </button>
  )

  const deduped =
    sync?.source_count != null && sync?.unique_count != null && sync.source_count !== sync.unique_count

  return (
    <div>
      <ListPageHeader
        overline="Sales"
        title="Performance"
        count={
          sync?.last_synced_at
            ? `${projects.length} projects · ${fmtUsd(sumAll(projects))} quoted`
            : 'Not synced yet'
        }
        actions={syncButton}
      >
        {reps.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap pb-3">
            <button onClick={() => setFilterUser('__all')} className={filterPillCx(filterUser === '__all')}>
              All reps
            </button>
            {reps.map((r) => (
              <button key={r} onClick={() => setFilterUser(r)} className={filterPillCx(filterUser === r)}>
                {r}
              </button>
            ))}
          </div>
        )}
      </ListPageHeader>

      <div className="px-4 sm:px-8 py-6 space-y-5">
        {/* Freshness + de-dup transparency, or a failure banner */}
        {(error || sync?.status === 'error') && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>
              Last sync failed: {error || sync?.error}
              {sync?.last_synced_at && ` — showing the last good data from ${timeAgo(sync.last_synced_at)} ago.`}
            </span>
          </div>
        )}
        {sync?.last_synced_at && (
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
            Synced {timeAgo(sync.last_synced_at)} ago
            {sync.synced_by ? ` by ${sync.synced_by}` : ''}
            {sync.duration_ms != null ? ` · ${(sync.duration_ms / 1000).toFixed(1)}s` : ''}
            {deduped && ` · ${sync.unique_count} of ${sync.source_count} source rows (duplicates removed)`}
          </p>
        )}
        {dealNote && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700 dark:text-emerald-300">
            {dealNote}
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState onSync={doSync} syncing={syncing} />
        ) : (
          <>
            {/* Summary tiles — reflect the current rep filter */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile label="Projects" value={stats.count.toLocaleString()} />
              <Tile label="Total quoted" value={fmtUsd(stats.totalQuote)} />
              <Tile label="Weighted pipeline" value={fmtUsd(stats.weighted)} sub="quote × confidence" />
              <Tile label="Avg. confidence" value={`${stats.avgConf}%`} />
            </div>

            {/* Project table */}
            <TableScroll minWidth={980}>
              <div className={cn('grid', COLS, HEADER_BOX)}>
                <Th>Project</Th>
                <Th>Salesperson</Th>
                <Th>Type</Th>
                <Th align="right">Conf.</Th>
                <Th>Est. close</Th>
                <Th align="right">Quote total</Th>
                <Th align="right">Weighted</Th>
              </div>
              <div className={cn(BODY_BOX, 'overflow-hidden')}>
                {filtered.map((p, i) => {
                  const expanded = expandedId === p.id
                  const units = p.units ?? []
                  return (
                    <Fragment key={p.id}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                        className={cn('grid', COLS, ROW, i > 0 && ROW_DIVIDE, ROW_HOVER, 'w-full text-left group')}
                      >
                        <IdentityCell
                          leading={
                            <ChevronRight
                              size={14}
                              className={cn('flex-shrink-0 text-zinc-400 transition-transform', expanded && 'rotate-90')}
                            />
                          }
                          title={p.project_name || '—'}
                          subtitle={
                            [p.project_customer, p.unit_count > 1 ? `${p.unit_count} units` : null]
                              .filter(Boolean)
                              .join(' · ') || undefined
                          }
                        />
                        <div className="text-[13px] text-zinc-600 dark:text-zinc-300 truncate self-center">
                          {p.user_name || '—'}
                        </div>
                        <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate self-center">
                          {p.project_types || '—'}
                        </div>
                        <div className="text-right tabular-nums text-[13px] text-zinc-600 dark:text-zinc-300 self-center">
                          {p.confidence_level ?? 0}%
                        </div>
                        <div className="text-[12.5px] text-zinc-500 dark:text-zinc-400 truncate self-center">
                          {fmtDate(p.estimated_closing_date)}
                        </div>
                        <div className="text-right tabular-nums text-[13px] font-medium text-zinc-900 dark:text-white self-center">
                          {fmtUsd(p.quote_total)}
                        </div>
                        <div className="text-right tabular-nums text-[13px] text-zinc-500 dark:text-zinc-400 self-center">
                          {fmtUsd(p.weighted_total)}
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-4 py-3.5 bg-zinc-50/70 dark:bg-zinc-800/20 border-t border-zinc-100 dark:border-zinc-800/60">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mb-3">
                            <Meta label="Company" value={p.company} />
                            <Meta label="Created" value={fmtDate(p.date_created)} />
                            <Meta label="Contact" value={p.contact} />
                            <Meta label="Est. close" value={fmtDate(p.estimated_closing_date)} />
                          </div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                            Units ({units.length})
                          </p>
                          <div className="space-y-1">
                            {units.map((u, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-3 text-[12.5px] border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 py-1"
                              >
                                <span className="text-zinc-600 dark:text-zinc-300 truncate">
                                  {u.unitName || '—'}
                                  {u.modelNumber ? <span className="text-zinc-400 dark:text-zinc-500"> · {u.modelNumber}</span> : null}
                                </span>
                                <span className="tabular-nums text-zinc-900 dark:text-white flex-shrink-0">
                                  {fmtUsd(u.quoteTotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Fragment>
                  )
                })}
              </div>
            </TableScroll>
          </>
        )}
      </div>
    </div>
  )
}

// Total quoted across ALL projects (the header count is dataset-wide, not filtered).
function sumAll(projects: ProjectedSale[]) {
  return projects.reduce((a, p) => a + num(p.quote_total), 0)
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold text-zinc-900 dark:text-white tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className="text-[12.5px] text-zinc-700 dark:text-zinc-300 truncate">{value || '—'}</p>
    </div>
  )
}

function EmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-6 py-16 flex flex-col items-center text-center">
      <span className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
        <TrendingUp size={20} />
      </span>
      <p className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">No projected sales yet</p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4 max-w-sm">
        Pull the latest projected-sales snapshot from Dryware. It takes a couple of seconds.
      </p>
      <button
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#089447] hover:bg-[#07803d] text-white text-[13px] font-medium disabled:opacity-60 transition-colors"
      >
        <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}
