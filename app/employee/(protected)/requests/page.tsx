'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { Plus, Calendar, Clock, ChevronDown, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TimeOffRequest, Employee } from '@/lib/supabase'

type RequestWithEmployee = TimeOffRequest & { employees: Employee }

const STATUS_STYLES = {
  pending:  { label: 'Pending',  icon: AlertCircle,   cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2,  cls: 'bg-green-50 text-green-600 border-green-200' },
  denied:   { label: 'Denied',   icon: XCircle,       cls: 'bg-red-50 text-red-500 border-red-200' },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RequestsPage() {
  const supabase = createSupabaseBrowser()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: emp }, { data: reqs }] = await Promise.all([
      supabase.from('employees').select('*').eq('id', user.id).single(),
      supabase.from('time_off_requests').select('*, employees(*)').eq('employee_id', user.id).order('created_at', { ascending: false }),
    ])
    if (emp) setEmployee(emp)
    if (reqs) setRequests(reqs as RequestWithEmployee[])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-gray-900">Time Off Requests</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">Submit and track your PTO & sick time</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
          <Plus size={15} />New Request
        </button>
      </div>

      {/* Balance summary */}
      {employee && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-150 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0"><Calendar size={15} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">PTO</p>
              <p className="text-[18px] font-bold text-gray-900 leading-none">{employee.pto_balance}<span className="text-[12px] font-normal text-gray-400 ml-1">hrs</span></p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-150 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0"><Clock size={15} /></div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Sick</p>
              <p className="text-[18px] font-bold text-gray-900 leading-none">{employee.sick_balance}<span className="text-[12px] font-normal text-gray-400 ml-1">hrs</span></p>
            </div>
          </div>
        </div>
      )}

      {/* New request form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold text-gray-900">New Time Off Request</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {/* Type toggle */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pto', 'sick'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${form.type === t ? 'bg-[#089447] text-white border-[#089447]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                        {t === 'pto' ? 'PTO' : 'Sick Time'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hours */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Hours Requested</label>
                    <span className="text-[11px] text-gray-400">{balance} hrs available</span>
                  </div>
                  <input type="number" min="0.5" step="0.5" value={form.hours_requested}
                    onChange={e => setForm(f => ({ ...f, hours_requested: e.target.value }))}
                    placeholder="8"
                    className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all" />
                  {willOverdraw && form.hours_requested && (
                    <p className="text-[12px] text-amber-600 mt-1.5 flex items-center gap-1.5">
                      <AlertCircle size={12} />You&apos;re requesting more than your available balance.
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Start Date</label>
                    <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">End Date</label>
                    <input type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all" />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Any additional context…"
                    className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all resize-none" />
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
        <div className="bg-white rounded-2xl border border-gray-150 p-10 text-center">
          <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] text-gray-400">No requests yet. Click &ldquo;New Request&rdquo; to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const s = STATUS_STYLES[req.status]
            const Icon = s.icon
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-150 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${req.type === 'pto' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
                      {req.type === 'pto' ? <Calendar size={16} /> : <Clock size={16} />}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-800">
                        {req.type === 'pto' ? 'PTO' : 'Sick Time'} · {req.hours_requested} hrs
                      </p>
                      <p className="text-[12px] text-gray-400 mt-0.5">
                        {formatDate(req.start_date)} – {formatDate(req.end_date)}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
                    <Icon size={11} />{s.label}
                  </span>
                </div>
                {req.notes && <p className="text-[13px] text-gray-400 mt-3 pl-12">{req.notes}</p>}
                <p className="text-[11px] text-gray-300 mt-3 pl-12">
                  Submitted {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
