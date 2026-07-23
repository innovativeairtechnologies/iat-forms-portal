'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle2, AlertCircle, Calendar, Clock, TrendingUp, AlertTriangle, X, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Employee, AccrualLog, AccrualTier, AccrualConfig } from '@/lib/supabase'
import type { AccrualRunResult } from '@/lib/accrual'
import { StatusPill } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  SortHeader, EmptyRow, Pagination, usePagedList, ListSearch, ToneAvatar,
} from '@/components/admin/list-card'

// Employee | PTO Balance | PTO Rate/wk | Sick Balance | Sick Rate/wk
const COLS = 'grid-cols-[minmax(200px,2fr)_130px_150px_130px_150px]'
type SortKey = 'name' | 'pto_balance' | 'pto_rate' | 'sick_balance' | 'sick_rate'
const NUMERIC_KEYS: SortKey[] = ['pto_balance', 'pto_rate', 'sick_balance', 'sick_rate']

// Tenure derived from hire_date (the accrual tier is a tenure band), with the
// job title appended when both are known — falls back to whichever exists.
function tenureText(emp: Employee): string | undefined {
  if (emp.hire_date) {
    const yrs = Math.floor((Date.now() - new Date(emp.hire_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    const tenure = yrs >= 1
      ? `${yrs} yr${yrs === 1 ? '' : 's'}`
      : `${Math.max(0, Math.floor((Date.now() - new Date(emp.hire_date).getTime()) / (30.44 * 24 * 3600 * 1000)))} mo`
    return emp.job_title ? `${tenure} · ${emp.job_title}` : tenure
  }
  return emp.job_title || undefined
}

type AccrualLogWithEmployee = AccrualLog & { employees: Pick<Employee, 'name' | 'email'> }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function nextMonday(): Date {
  const now = new Date()
  const daysUntil = ((1 - now.getDay() + 7) % 7) || 7
  const d = new Date(now)
  d.setDate(now.getDate() + daysUntil)
  return d
}

export default function AccrualClient({
  employees,
  recentLog,
  tiers,
  config,
}: {
  employees: Employee[]
  recentLog: AccrualLogWithEmployee[]
  tiers: AccrualTier[]
  config: AccrualConfig | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AccrualRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // List view controls
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const eligible = employees.filter(e => e.pto_accrual_rate > 0 || e.sick_accrual_rate > 0)

  const runAccrual = async () => {
    setConfirming(false)
    setRunning(true)
    setError(null)
    setResult(null)
    const res = await fetch('/api/admin/run-accrual', { method: 'POST' })
    const data = await res.json()
    setRunning(false)
    if (!res.ok) { setError(data.error || 'Accrual failed'); return }
    setResult(data)
    startTransition(() => router.refresh())
  }

  const nextRun = nextMonday()

  // search + sort → the working view (before pagination)
  const view = useMemo(() => {
    let r = employees
    const q = query.trim().toLowerCase()
    if (q) {
      r = r.filter(e =>
        [e.name, e.email, e.job_title, e.department].filter(Boolean).join(' ').toLowerCase().includes(q),
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (e: Employee): number | string =>
      sortKey === 'name' ? (e.name || e.email || '').toLowerCase()
      : sortKey === 'pto_balance' ? e.pto_balance
      : sortKey === 'pto_rate' ? e.pto_accrual_rate
      : sortKey === 'sick_balance' ? e.sick_balance
      : e.sick_accrual_rate
    return [...r].sort((a, b) => {
      const av = val(a), bv = val(b)
      return av < bv ? -1 * dir : av > bv ? dir : 0
    })
  }, [employees, query, sortKey, sortDir])

  const stats = useMemo(() => {
    const count = view.length
    const accruing = view.filter(e => e.pto_accrual_rate > 0 || e.sick_accrual_rate > 0).length
    const ptoTotal = view.reduce((a, e) => a + (e.pto_balance || 0), 0)
    const sickTotal = view.reduce((a, e) => a + (e.sick_balance || 0), 0)
    return { count, accruing, ptoTotal, sickTotal }
  }, [view])

  const paged = usePagedList(view.length, { initialPerPage: 10, resetKey: `${query}|${sortKey}|${sortDir}` })
  const pageRows = view.slice(paged.start, paged.end)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(NUMERIC_KEYS.includes(k) ? 'desc' : 'asc') }
  }

  return (
    <>
      <ListCardPage>
        <div className="space-y-6">

          {/* ── Run accrual (page header + primary action) ── */}
          <ListCard>
            <CardHead
              overline="Time Off"
              title="Accrual"
              count="Weekly PTO & sick time accrual — runs every Monday at 8 AM"
              actions={
                <button
                  onClick={() => setConfirming(true)}
                  disabled={running || isPending}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium disabled:opacity-60 transition-colors flex-shrink-0"
                >
                  <Play size={14} />
                  {running ? 'Running…' : 'Run Now'}
                </button>
              }
            />
            <div className="px-5 py-4">
              <p className="text-[13px] text-ink-muted max-w-xl leading-relaxed">
                Adds each employee&apos;s accrual rate to their current balance and records the change in the log. Balances stop accruing once they hit their cap.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Calendar size={13} className="text-ink-faint" />
                <span className="text-[12px] text-ink-muted">
                  Next scheduled: {nextRun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Result */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-5 flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3"
                  >
                    <AlertCircle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-5 space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-brand" />
                      <p className="text-[13px] font-semibold text-ink-secondary">
                        Accrual complete — {result.processed} employee{result.processed !== 1 ? 's' : ''} updated
                        {result.skipped > 0 && <span className="text-ink-muted font-normal"> · {result.skipped} skipped (at cap or zero rate)</span>}
                      </p>
                    </div>

                    {result.employees.length > 0 && (
                      <div className="rounded-xl border border-hairline overflow-hidden">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-hairline bg-surface-soft">
                              <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Employee</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">PTO Added</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">New PTO Balance</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Sick Added</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">New Sick Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline-soft">
                            {result.employees.map(e => (
                              <tr key={e.employee_id} className="hover:bg-surface-soft transition-colors">
                                <td className="px-4 py-2.5 font-medium text-ink-secondary">{e.name}</td>
                                <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">+{e.pto_delta} hrs</td>
                                <td className="px-4 py-2.5 text-right text-ink-secondary tabular-nums">{e.new_pto_balance} hrs</td>
                                <td className="px-4 py-2.5 text-right text-amber-600 dark:text-amber-400 font-semibold tabular-nums">+{e.sick_delta} hrs</td>
                                <td className="px-4 py-2.5 text-right text-ink-secondary tabular-nums">{e.new_sick_balance} hrs</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ListCard>

          {/* ── Accrual policy ── */}
          {(tiers.length > 0 || config) && (
            <ListCard>
              <CardHead
                title={<span className="inline-flex items-center gap-2"><Shield size={16} className="text-ink-muted" />Accrual Policy</span>}
                actions={<span className="text-[11px] text-ink-muted">Source: HR rate sheet</span>}
              />
              <div className="p-5 space-y-5">

                {/* PTO tiers */}
                {tiers.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-2">PTO — Tenure Bands</p>
                    <div className="rounded-xl border border-hairline overflow-hidden">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-hairline bg-surface-soft">
                            <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Tenure</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Rate / wk</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">≈ Hrs / yr</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">≈ Days / yr</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline-soft">
                          {tiers.map(tier => {
                            const hrsPerYr = Number(tier.pto_weekly_rate) * 52
                            const daysPerYr = (hrsPerYr / 8).toFixed(1)
                            return (
                              <tr key={tier.id}>
                                <td className="px-4 py-2.5 font-medium text-ink-secondary">{tier.label}</td>
                                <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{Number(tier.pto_weekly_rate).toFixed(2)} hrs</td>
                                <td className="px-4 py-2.5 text-right text-ink-muted tabular-nums">{Math.round(hrsPerYr)} hrs</td>
                                <td className="px-4 py-2.5 text-right text-ink-muted tabular-nums">{daysPerYr} days</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sick + caps row */}
                {config && (
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[160px] rounded-xl border border-hairline px-4 py-3">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Sick Time Rate</p>
                      <p className="text-[15px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        {Number(config.sick_weekly_rate).toFixed(2)} hrs<span className="text-[12px] font-normal text-ink-muted"> / wk</span>
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Flat rate — all tenures</p>
                    </div>
                    <div className="flex-1 min-w-[160px] rounded-xl border border-hairline px-4 py-3">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">PTO Cap</p>
                      <p className="text-[15px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {Number(config.pto_cap_hours)} hrs
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Accrual stops at cap</p>
                    </div>
                    <div className="flex-1 min-w-[160px] rounded-xl border border-hairline px-4 py-3">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Sick Cap</p>
                      <p className="text-[15px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        {Number(config.sick_cap_hours)} hrs
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Accrual stops at cap</p>
                    </div>
                  </div>
                )}

              </div>
            </ListCard>
          )}

          {/* ── Employee accrual rates (the one-card list) ── */}
          <ListCard>
            <CardHead
              title={<span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-ink-muted" />Employee Accrual Rates</span>}
              count={<><span className="tabular-nums">{employees.length}</span> employee{employees.length === 1 ? '' : 's'} · rates update automatically on anniversary</>}
            />

            {employees.length > 0 && (
              <StatStrip>
                <Stat tone="sky"     label="Employees"         value={stats.count.toLocaleString()} />
                <Stat tone="emerald" label="Accruing"          value={stats.accruing.toLocaleString()} sub="active rate" />
                <Stat tone="violet"  label="PTO on the books"  value={`${Math.round(stats.ptoTotal).toLocaleString()} hrs`} />
                <Stat tone="amber"   label="Sick on the books" value={`${Math.round(stats.sickTotal).toLocaleString()} hrs`} />
              </StatStrip>
            )}

            {employees.length > 0 && (
              <Toolbar>
                <ListSearch value={query} onChange={setQuery} placeholder="Search employees…" />
                <div className="flex-1" />
                {query && <span className="text-[12px] text-ink-muted tabular-nums">{view.length} match{view.length === 1 ? '' : 'es'}</span>}
              </Toolbar>
            )}

            <CardTable
              cols={COLS}
              minWidth={820}
              head={
                <>
                  <SortHeader label="Employee" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                  <div className="justify-self-end"><SortHeader label="PTO Balance" active={sortKey === 'pto_balance'} dir={sortDir} onClick={() => toggleSort('pto_balance')} align="right" /></div>
                  <div className="justify-self-end"><SortHeader label="PTO Rate / wk" active={sortKey === 'pto_rate'} dir={sortDir} onClick={() => toggleSort('pto_rate')} align="right" /></div>
                  <div className="justify-self-end"><SortHeader label="Sick Balance" active={sortKey === 'sick_balance'} dir={sortDir} onClick={() => toggleSort('sick_balance')} align="right" /></div>
                  <div className="justify-self-end"><SortHeader label="Sick Rate / wk" active={sortKey === 'sick_rate'} dir={sortDir} onClick={() => toggleSort('sick_rate')} align="right" /></div>
                </>
              }
            >
              {employees.length === 0 ? (
                <EmptyRow>
                  <span className="inline-flex flex-col items-center gap-3 py-6">
                    <TrendingUp size={28} className="text-ink-faint" />
                    No employees yet.
                  </span>
                </EmptyRow>
              ) : pageRows.length === 0 ? (
                <EmptyRow>No employees match your search.</EmptyRow>
              ) : (
                pageRows.map(emp => {
                  const name = emp.name || emp.email
                  const tenure = tenureText(emp)
                  return (
                    <Row key={emp.id} cols={COLS} href={`/admin/employees/${emp.id}`}>
                      {/* Identity — name over tenure / title */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ToneAvatar name={name} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{name}</p>
                          {tenure && <p className="text-[11.5px] text-ink-muted truncate">{tenure}</p>}
                        </div>
                      </div>
                      {/* PTO balance */}
                      <div className="justify-self-end text-right tabular-nums text-[13px] font-medium text-ink-secondary">{emp.pto_balance} hrs</div>
                      {/* PTO rate */}
                      <div className={cn('justify-self-end text-right tabular-nums text-[13px] font-semibold', emp.pto_accrual_rate > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-faint')}>
                        {emp.pto_accrual_rate > 0 ? `+${emp.pto_accrual_rate} hrs` : '—'}
                      </div>
                      {/* Sick balance */}
                      <div className="justify-self-end text-right tabular-nums text-[13px] font-medium text-ink-secondary">{emp.sick_balance} hrs</div>
                      {/* Sick rate */}
                      <div className={cn('justify-self-end text-right tabular-nums text-[13px] font-semibold', emp.sick_accrual_rate > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-faint')}>
                        {emp.sick_accrual_rate > 0 ? `+${emp.sick_accrual_rate} hrs` : '—'}
                      </div>
                    </Row>
                  )
                })
              )}
            </CardTable>

            {employees.length > 0 && (
              <Pagination
                page={paged.page}
                perPage={paged.perPage}
                total={view.length}
                totalPages={paged.totalPages}
                onPage={paged.setPage}
                onPerPage={paged.setPerPage}
                unit="employees"
              />
            )}
          </ListCard>

          {/* ── Recent accrual log ── */}
          <ListCard>
            <CardHead title={<span className="inline-flex items-center gap-2"><Clock size={16} className="text-ink-muted" />Recent Accrual Log</span>} />
            {recentLog.length === 0 ? (
              <p className="text-[13px] text-ink-muted px-5 py-6">No accrual history yet. Run the first accrual above.</p>
            ) : (
              <div className="overflow-x-auto overflow-y-hidden">
                <table className="w-full text-[12px] min-w-[640px]">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-soft">
                      <th className="text-left px-5 py-2.5 font-semibold text-ink-muted">Date</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Employee</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Type</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Delta</th>
                      <th className="text-left px-5 py-2.5 font-semibold text-ink-muted">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-soft">
                    {recentLog.map(entry => (
                      <tr key={entry.id} className="hover:bg-surface-soft transition-colors">
                        <td className="px-5 py-2.5 text-ink-muted whitespace-nowrap">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-2.5 font-medium text-ink-secondary">{entry.employees?.name || entry.employees?.email || entry.employee_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5">
                          <StatusPill tone={entry.type === 'pto' ? 'sky' : 'amber'}>{entry.type === 'pto' ? 'PTO' : 'Sick'}</StatusPill>
                        </td>
                        <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', entry.hours_delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}>
                          {entry.hours_delta >= 0 ? '+' : ''}{entry.hours_delta} hrs
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={cn('text-[11px] font-medium',
                            entry.reason === 'manual_adjustment' ? 'text-violet-600 dark:text-violet-400' :
                            entry.reason === 'request_approved'  ? 'text-rose-500 dark:text-rose-400' : 'text-ink-muted',
                          )}>
                            {entry.reason === 'scheduled'         ? 'Scheduled' :
                             entry.reason === 'manual_adjustment' ? 'Manual Adjustment' :
                             entry.reason === 'request_approved'  ? 'Request Approved' :
                             entry.reason === 'request_denied'    ? 'Request Denied' : entry.reason}
                          </span>
                          {entry.note && <p className="text-[11px] text-ink-faint">{entry.note}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ListCard>

        </div>
      </ListCardPage>

      {/* ── Confirmation modal ── */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setConfirming(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface rounded-2xl border border-hairline-strong shadow-xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-ink">Run Accrual?</h2>
                </div>
                <button onClick={() => setConfirming(false)} className="text-ink-faint hover:text-ink-secondary transition-colors p-1">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[13px] text-ink-muted mb-4 leading-relaxed">
                This will permanently add hours to <strong className="text-ink-secondary font-semibold">{eligible.length} employee{eligible.length !== 1 ? 's' : ''}</strong> and write new entries to the accrual log. This cannot be undone automatically.
              </p>

              {eligible.length > 0 && (
                <div className="rounded-xl border border-hairline overflow-hidden mb-5">
                  <div className="bg-surface-soft px-4 py-2 border-b border-hairline">
                    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Will be updated</p>
                  </div>
                  <ul className="divide-y divide-hairline-soft max-h-48 overflow-y-auto">
                    {eligible.map(e => (
                      <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                        <span className="font-medium text-ink-secondary">{e.name || e.email}</span>
                        <span className="text-ink-muted tabular-nums">
                          {e.pto_accrual_rate > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{e.pto_accrual_rate} PTO</span>}
                          {e.pto_accrual_rate > 0 && e.sick_accrual_rate > 0 && <span className="mx-1 text-ink-faint">·</span>}
                          {e.sick_accrual_rate > 0 && <span className="text-amber-600 dark:text-amber-400">+{e.sick_accrual_rate} sick</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-ink-secondary hover:text-ink bg-surface-soft hover:bg-surface-strong rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={runAccrual}
                  className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <Play size={13} />
                  Confirm &amp; Run
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
