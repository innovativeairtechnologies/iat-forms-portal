'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle2, AlertCircle, Calendar, Clock, TrendingUp, AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee, AccrualLog } from '@/lib/supabase'
import type { AccrualRunResult } from '@/lib/accrual'

type AccrualLogWithEmployee = AccrualLog & { employees: Pick<Employee, 'name' | 'email'> }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AccrualClient({
  employees,
  recentLog,
}: {
  employees: Employee[]
  recentLog: AccrualLogWithEmployee[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AccrualRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const nextRunDates = (() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const candidates = [
      new Date(year, month, 1),
      new Date(year, month, 15),
      new Date(year, month + 1, 1),
      new Date(year, month + 1, 15),
    ]
    return candidates.filter(d => d > now).slice(0, 2)
  })()

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">HR</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Accrual</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Biweekly PTO &amp; sick time accrual — runs on the 1st and 15th of each month</p>
      </div>

      <div className="p-8 space-y-6">

        {/* Run card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Run Accrual</h2>
              <p className="text-[13px] text-gray-400 max-w-sm leading-relaxed">
                Adds each employee&apos;s accrual rate to their current balance and records the change in the log.
              </p>
              {nextRunDates.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <Calendar size={13} className="text-gray-300" />
                  <span className="text-[12px] text-gray-400">
                    Next scheduled: {nextRunDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {nextRunDates[1] && ` · ${nextRunDates[1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setConfirming(true)}
              disabled={running || isPending}
              className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] disabled:opacity-50 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm flex-shrink-0"
            >
              <Play size={14} />
              {running ? 'Running…' : 'Run Now'}
            </button>
          </div>

          {/* Result */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-5 flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl px-4 py-3"
              >
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-5 space-y-4"
              >
                {/* Summary row */}
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-[#089447]" />
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                    Accrual complete — {result.processed} employee{result.processed !== 1 ? 's' : ''} updated
                    {result.skipped > 0 && <span className="text-gray-400 font-normal"> · {result.skipped} skipped (zero rates)</span>}
                  </p>
                </div>

                {/* Per-employee table */}
                {result.employees.length > 0 && (
                  <div className="rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Employee</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">PTO Added</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">New PTO Balance</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Sick Added</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">New Sick Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {result.employees.map(e => (
                          <tr key={e.employee_id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{e.name}</td>
                            <td className="px-4 py-2.5 text-right text-[#089447] font-semibold">+{e.pto_delta} hrs</td>
                            <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{e.new_pto_balance} hrs</td>
                            <td className="px-4 py-2.5 text-right text-amber-600 font-semibold">+{e.sick_delta} hrs</td>
                            <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{e.new_sick_balance} hrs</td>
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

        {/* Employee rates table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" />
            <h2 className="text-[14px] font-semibold text-gray-800 dark:text-white">Employee Accrual Rates</h2>
            <span className="ml-auto text-[11px] text-gray-400">Click an employee to edit their rates</span>
          </div>
          {employees.length === 0 ? (
            <p className="text-[13px] text-gray-400 p-6">No employees yet.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                  <th className="text-left px-6 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Employee</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">PTO Balance</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">PTO Rate / period</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Sick Balance</th>
                  <th className="text-right px-6 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Sick Rate / period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {employees.map(emp => (
                  <tr key={emp.id} className="group">
                    <td className="px-6 py-3">
                      <a href={`/admin/employees/${emp.id}`} className="font-medium text-gray-800 dark:text-gray-200 hover:text-[#089447] transition-colors">
                        {emp.name || emp.email}
                      </a>
                      {emp.job_title && <p className="text-[11px] text-gray-400">{emp.job_title}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{emp.pto_balance} hrs</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${emp.pto_accrual_rate > 0 ? 'text-[#089447]' : 'text-gray-300 dark:text-gray-600'}`}>
                        {emp.pto_accrual_rate > 0 ? `+${emp.pto_accrual_rate} hrs` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{emp.sick_balance} hrs</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-semibold ${emp.sick_accrual_rate > 0 ? 'text-amber-600' : 'text-gray-300 dark:text-gray-600'}`}>
                        {emp.sick_accrual_rate > 0 ? `+${emp.sick_accrual_rate} hrs` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent accrual log */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2">
            <Clock size={15} className="text-gray-400" />
            <h2 className="text-[14px] font-semibold text-gray-800 dark:text-white">Recent Accrual Log</h2>
          </div>
          {recentLog.length === 0 ? (
            <p className="text-[13px] text-gray-400 p-6">No accrual history yet. Run the first accrual above.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                  <th className="text-left px-6 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Employee</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Type</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Delta</th>
                  <th className="text-left px-6 py-2.5 font-semibold text-gray-500 dark:text-gray-400">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {recentLog.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">{entry.employees?.name || entry.employees?.email || entry.employee_id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${entry.type === 'pto' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'}`}>
                        {entry.type === 'pto' ? 'PTO' : 'Sick'}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${entry.hours_delta >= 0 ? 'text-[#089447]' : 'text-red-500'}`}>
                      {entry.hours_delta >= 0 ? '+' : ''}{entry.hours_delta} hrs
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`text-[11px] font-medium ${
                        entry.reason === 'scheduled' ? 'text-gray-400' :
                        entry.reason === 'manual_adjustment' ? 'text-violet-600 dark:text-violet-400' :
                        entry.reason === 'request_approved' ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {entry.reason === 'scheduled' ? 'Scheduled' :
                         entry.reason === 'manual_adjustment' ? 'Manual Adjustment' :
                         entry.reason === 'request_approved' ? 'Request Approved' :
                         entry.reason === 'request_denied' ? 'Request Denied' : entry.reason}
                      </span>
                      {entry.note && <p className="text-[11px] text-gray-300 dark:text-gray-600">{entry.note}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
      {/* Confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setConfirming(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                  <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">Run Accrual?</h2>
                </div>
                <button onClick={() => setConfirming(false)} className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                This will permanently add hours to <strong className="text-gray-800 dark:text-gray-200">{eligible.length} employee{eligible.length !== 1 ? 's' : ''}</strong> and write new entries to the accrual log. This cannot be undone automatically.
              </p>

              {eligible.length > 0 && (
                <div className="rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden mb-5">
                  <div className="bg-gray-50 dark:bg-zinc-800/50 px-4 py-2 border-b border-gray-100 dark:border-zinc-800">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Will be updated</p>
                  </div>
                  <ul className="divide-y divide-gray-50 dark:divide-zinc-800 max-h-48 overflow-y-auto">
                    {eligible.map(e => (
                      <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{e.name || e.email}</span>
                        <span className="text-gray-400 tabular-nums">
                          {e.pto_accrual_rate > 0 && <span className="text-[#089447]">+{e.pto_accrual_rate} PTO</span>}
                          {e.pto_accrual_rate > 0 && e.sick_accrual_rate > 0 && <span className="mx-1 text-gray-200 dark:text-gray-700">·</span>}
                          {e.sick_accrual_rate > 0 && <span className="text-amber-600">+{e.sick_accrual_rate} sick</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-zinc-800 hover:bg-gray-150 dark:hover:bg-zinc-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={runAccrual}
                  className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  <Play size={13} />
                  Confirm &amp; Run
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
