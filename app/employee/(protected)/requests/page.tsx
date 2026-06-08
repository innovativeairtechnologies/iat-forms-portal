'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Clock, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TimeOffRequest, Employee } from '@/lib/supabase'

type RequestWithEmployee = TimeOffRequest & { employees: Employee }

const STATUS_STYLES = {
  pending:  { label: 'Pending',  icon: AlertCircle,   cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Approved', icon: CheckCircle2,  cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' },
  denied:   { label: 'Denied',   icon: XCircle,       cls: 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800' },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inputCls = 'w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600'

export default function RequestsPage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [requests, setRequests] = useState<RequestWithEmployee[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [form, setForm] = useState({
    type: 'pto' as 'pto' | 'sick',
    hours_requested: '',
    start_date: '',
    end_date: '',
    notes: '',
  })

  const load = useCallback(async () => {
    const [empRes, reqRes] = await Promise.all([
      fetch('/api/employees/me'),
      fetch('/api/requests'),
    ])
    if (empRes.ok) { const { employee } = await empRes.json(); setEmployee(employee) }
    if (reqRes.ok) { const { requests } = await reqRes.json(); setRequests(requests) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return
    setSubmitting(true)
    setFormError('')
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hours_requested: parseFloat(form.hours_requested) }),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error || 'Failed to submit request.'); setSubmitting(false); return }
    setShowForm(false)
    setForm({ type: 'pto', hours_requested: '', start_date: '', end_date: '', notes: '' })
    await load()
    setSubmitting(false)
  }

  const balance = employee ? (form.type === 'pto' ? employee.pto_balance : employee.sick_balance) : 0
  const requested = parseFloat(form.hours_requested) || 0
  const willOverdraw = requested > balance

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">HR</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Time Off</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Submit and track your PTO & sick time requests</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={14} />New Request
          </button>
        </div>

        {/* Balance stat cards — inline in header */}
        {employee && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatCard
              icon={<Calendar size={15} />}
              label="PTO Balance"
              value={`${employee.pto_balance}`}
              unit="hrs"
              accrual={`+${employee.pto_accrual_rate} / period`}
              accent="blue"
            />
            <StatCard
              icon={<Clock size={15} />}
              label="Sick Balance"
              value={`${employee.sick_balance}`}
              unit="hrs"
              accrual={`+${employee.sick_accrual_rate} / period`}
              accent="amber"
            />
            <StatCard
              icon={<CheckCircle2 size={15} />}
              label="Approved"
              value={String(requests.filter(r => r.status === 'approved').length)}
              unit="requests"
              accent="green"
            />
            <StatCard
              icon={<AlertCircle size={15} />}
              label="Pending"
              value={String(requests.filter(r => r.status === 'pending').length)}
              unit="requests"
              accent="amber"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-8">

        {/* New request modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowForm(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">New Time Off Request</h2>
                  <button onClick={() => setShowForm(false)} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['pto', 'sick'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                          className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${form.type === t ? 'bg-[#089447] text-white border-[#089447]' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                          {t === 'pto' ? 'PTO' : 'Sick Time'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Hours Requested</label>
                      <span className="text-[11px] text-gray-400">{balance} hrs available</span>
                    </div>
                    <input type="number" min="0.5" step="0.5" value={form.hours_requested}
                      onChange={e => setForm(f => ({ ...f, hours_requested: e.target.value }))}
                      placeholder="8" className={inputCls} />
                    {willOverdraw && form.hours_requested && (
                      <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1.5">
                        <AlertCircle size={12} />Over available balance.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Start Date</label>
                      <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">End Date</label>
                      <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Notes <span className="normal-case font-normal">(optional)</span></label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2} placeholder="Any additional context…"
                      className={`${inputCls} resize-none`} />
                  </div>

                  {formError && <p className="text-[13px] text-red-500">{formError}</p>}

                  <button type="submit" disabled={submitting || !form.hours_requested || !form.start_date || !form.end_date}
                    className="w-full bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Request history */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[#089447] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-12 text-center">
            <Calendar size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">No requests yet</p>
            <p className="text-[12px] text-gray-400 mt-1 mb-4">Click &ldquo;New Request&rdquo; above to get started.</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-all shadow-sm">
              <Plus size={13} />New Request
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {requests.map(req => {
                const s = STATUS_STYLES[req.status]
                const Icon = s.icon
                return (
                  <li key={req.id} className="flex items-center gap-5 px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors">
                    {/* Type icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${req.type === 'pto' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400'}`}>
                      {req.type === 'pto' ? <Calendar size={16} /> : <Clock size={16} />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                        {req.type === 'pto' ? 'PTO' : 'Sick Time'} · {req.hours_requested} hrs
                      </p>
                      <p className="text-[12px] text-gray-400 mt-0.5">
                        {formatDate(req.start_date)} – {formatDate(req.end_date)}
                      </p>
                      {req.notes && <p className="text-[12px] text-gray-400 italic mt-0.5 truncate">&ldquo;{req.notes}&rdquo;</p>}
                    </div>

                    {/* Submitted date */}
                    <span className="text-[12px] text-gray-400 tabular-nums hidden sm:block flex-shrink-0">
                      {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${s.cls}`}>
                      <Icon size={11} />{s.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

type Accent = 'blue' | 'amber' | 'green' | 'emerald'

const ACCENT: Record<Accent, { border: string; bg: string; icon: string; value: string }> = {
  blue:    { border: 'border-l-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/50',    icon: 'text-blue-500 dark:text-blue-400',    value: 'text-blue-600 dark:text-blue-400'    },
  amber:   { border: 'border-l-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/50',  icon: 'text-amber-500 dark:text-amber-400',  value: 'text-amber-600 dark:text-amber-400'  },
  green:   { border: 'border-l-[#089447]',   bg: 'bg-[#f0faf4] dark:bg-[#089447]/20', icon: 'text-[#089447]',                      value: 'text-[#089447]'                      },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/50', icon: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400' },
}

function StatCard({ icon, label, value, unit, accrual, accent = 'green' }: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  accrual?: string
  accent?: Accent
}) {
  const a = ACCENT[accent]
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-l-[3px] ${a.border} border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-gray-800 dark:border-r-gray-800 dark:border-b-gray-800 shadow-card px-4 py-3.5 flex items-center gap-3`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.bg}`}>
        <span className={a.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <p className={`text-[22px] font-bold tracking-tight leading-none ${a.value}`}>{value}</p>
          {unit && <span className="text-[11px] text-gray-400">{unit}</span>}
        </div>
        <p className="text-[11px] font-medium text-gray-400 mt-0.5 truncate">{label}</p>
        {accrual && <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">{accrual}</p>}
      </div>
    </div>
  )
}
