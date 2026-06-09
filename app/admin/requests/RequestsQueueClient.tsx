'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TimeOffRequest, Employee } from '@/lib/supabase'

type RequestWithEmployee = TimeOffRequest & { employees: Employee }

const STATUS_STYLES = {
  pending:  { icon: AlertCircle,  cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',  label: 'Pending'  },
  approved: { icon: CheckCircle2, cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',  label: 'Approved' },
  denied:   { icon: XCircle,      cls: 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800',              label: 'Denied'   },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Filter = 'all' | 'pending' | 'approved' | 'denied'

export default function RequestsQueueClient({ requests }: { requests: RequestWithEmployee[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const review = async (id: string, decision: 'approved' | 'denied') => {
    setActionLoading(id + decision)
    setActionError(null)
    const res = await fetch(`/api/requests/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setActionLoading(null)
    if (!res.ok) {
      const d = await res.json()
      setActionError(d.error || 'Action failed')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">HR</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Time Off Requests</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {pendingCount > 0 ? `${pendingCount} pending review` : 'All caught up'}
        </p>
      </div>

      <div className="p-8">

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100 dark:border-zinc-800">
        {(['pending', 'approved', 'denied', 'all'] as Filter[]).map(f => {
          const count = f === 'all' ? requests.length : requests.filter(r => r.status === f).length
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all capitalize ${
                filter === f ? 'border-[#089447] text-[#089447]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
              }`}>
              {f} <span className={`text-[11px] tabular-nums ${filter === f ? 'text-gray-500' : 'text-gray-300'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {actionError && (
        <div className="mb-4 text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{actionError}</div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-12 text-center">
          <Calendar size={32} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-[14px] text-gray-400">No {filter !== 'all' ? filter : ''} requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map(req => {
              const s = STATUS_STYLES[req.status]
              const StatusIcon = s.icon
              const employee = req.employees
              const balance = req.type === 'pto' ? employee?.pto_balance : employee?.sick_balance
              const insufficient = (balance ?? Infinity) < req.hours_requested

              return (
                <motion.div key={req.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className={`bg-white dark:bg-zinc-900 rounded-2xl border p-5 transition-all ${insufficient && req.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : 'border-gray-100 dark:border-zinc-800'}`}>

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Employee avatar */}
                      <div className="w-9 h-9 rounded-full bg-gray-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {employee?.name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-gray-800 dark:text-white">{employee?.name || employee?.email}</p>
                        <p className="text-[12px] text-gray-400">{employee?.job_title || 'Employee'}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
                      <StatusIcon size={11} />{s.label}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Type</p>
                      <div className="flex items-center gap-1.5">
                        {req.type === 'pto' ? <Calendar size={13} className="text-blue-500" /> : <Clock size={13} className="text-amber-500" />}
                        <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{req.type === 'pto' ? 'PTO' : 'Sick Time'}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Hours</p>
                      <p className={`text-[13px] font-semibold ${insufficient ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200'}`}>
                        {req.hours_requested} hrs
                        {insufficient && <span className="text-[10px] ml-1">(⚠️ over)</span>}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Balance</p>
                      <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{balance ?? '—'} hrs</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Dates</p>
                      <p className="text-[12px] font-medium text-gray-700 dark:text-gray-200">{formatDate(req.start_date)}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">→ {formatDate(req.end_date)}</p>
                    </div>
                  </div>

                  {req.notes && (
                    <p className="mt-3 text-[13px] text-gray-400 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-2.5 italic">&ldquo;{req.notes}&rdquo;</p>
                  )}

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => review(req.id, 'approved')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50 shadow-sm">
                        <CheckCircle2 size={14} />
                        {actionLoading === req.id + 'approved' ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => review(req.id, 'denied')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 bg-white hover:bg-red-50 text-red-500 border border-red-200 text-[13px] font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                        <XCircle size={14} />
                        {actionLoading === req.id + 'denied' ? 'Denying…' : 'Deny'}
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      </div>{/* p-8 */}
    </div>
  )
}
