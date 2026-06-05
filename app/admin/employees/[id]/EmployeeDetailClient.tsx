'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Shield } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Employee, TimeOffRequest } from '@/lib/supabase'

const STATUS_STYLES = {
  pending:  { icon: AlertCircle,  cls: 'bg-amber-50 text-amber-600 border-amber-200',  label: 'Pending'  },
  approved: { icon: CheckCircle2, cls: 'bg-green-50 text-green-600 border-green-200',  label: 'Approved' },
  denied:   { icon: XCircle,      cls: 'bg-red-50 text-red-500 border-red-200',        label: 'Denied'   },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EmployeeDetailClient({ employee, requests }: { employee: Employee; requests: TimeOffRequest[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name:               employee.name        || '',
    email:              employee.email       || '',
    job_title:          employee.job_title   || '',
    department:         employee.department  || '',
    phone:              employee.phone       || '',
    bio:                employee.bio         || '',
    pto_balance:        String(employee.pto_balance),
    sick_balance:       String(employee.sick_balance),
    pto_accrual_rate:   String(employee.pto_accrual_rate),
    sick_accrual_rate:  String(employee.sick_accrual_rate),
    hire_date:          employee.hire_date   || '',
    is_admin:           employee.is_admin,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        pto_balance:       parseFloat(form.pto_balance)       || 0,
        sick_balance:      parseFloat(form.sick_balance)      || 0,
        pto_accrual_rate:  parseFloat(form.pto_accrual_rate)  || 4,
        sick_accrual_rate: parseFloat(form.sick_accrual_rate) || 2,
        hire_date: form.hire_date || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 2000)
  }

  const inp = 'w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/admin/employees" className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-700 transition-colors mb-6">
        <ArrowLeft size={14} />Back to Employees
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center text-white text-[18px] font-bold flex-shrink-0">
          {employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-gray-900">{employee.name || employee.email}</h1>
            {employee.is_admin && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                <Shield size={9} />Admin
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400">{employee.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Edit form — 2/3 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-150 p-6">
            <h2 className="text-[14px] font-semibold text-gray-700 mb-5">Edit Employee</h2>
            <form onSubmit={save} className="space-y-4">
              {[
                { key: 'name',        label: 'Full Name',   type: 'text' },
                { key: 'email',       label: 'Email',       type: 'email' },
                { key: 'job_title',   label: 'Job Title',   type: 'text' },
                { key: 'department',  label: 'Department',  type: 'text' },
                { key: 'phone',       label: 'Phone',       type: 'tel'  },
                { key: 'hire_date',   label: 'Hire Date',   type: 'date' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                  <input type={type} value={(form as Record<string, unknown>)[key] as string}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className={inp} />
                </div>
              ))}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3} className={`${inp} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">PTO Balance (hrs)</label>
                  <input type="number" step="0.5" min="0" value={form.pto_balance}
                    onChange={e => setForm(f => ({ ...f, pto_balance: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Sick Balance (hrs)</label>
                  <input type="number" step="0.5" min="0" value={form.sick_balance}
                    onChange={e => setForm(f => ({ ...f, sick_balance: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">PTO Accrual (hrs/period)</label>
                  <input type="number" step="0.5" min="0" value={form.pto_accrual_rate}
                    onChange={e => setForm(f => ({ ...f, pto_accrual_rate: e.target.value }))}
                    className={inp} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Sick Accrual (hrs/period)</label>
                  <input type="number" step="0.5" min="0" value={form.sick_accrual_rate}
                    onChange={e => setForm(f => ({ ...f, sick_accrual_rate: e.target.value }))}
                    className={inp} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input type="checkbox" checked={form.is_admin}
                  onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 accent-[#089447]" />
                <span className="text-[13px] text-gray-600 font-medium">Admin access</span>
              </label>

              {error && <p className="text-[13px] text-red-500">{error}</p>}

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                  <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && (
                  <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className="text-[13px] text-[#089447] font-medium">Saved ✓</motion.span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Request history — 1/3 */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-150 p-5">
            <h2 className="text-[14px] font-semibold text-gray-700 mb-4">Request History</h2>
            {requests.length === 0 ? (
              <p className="text-[13px] text-gray-400">No requests yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => {
                  const s = STATUS_STYLES[req.status]
                  const Icon = s.icon
                  return (
                    <div key={req.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {req.type === 'pto' ? <Calendar size={13} className="text-blue-400" /> : <Clock size={13} className="text-amber-500" />}
                          <span className="text-[13px] font-medium text-gray-700">{req.type === 'pto' ? 'PTO' : 'Sick'} · {req.hours_requested}h</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
                          <Icon size={9} />{s.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">{formatDate(req.start_date)} – {formatDate(req.end_date)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
