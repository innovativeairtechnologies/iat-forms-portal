'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Shield, User, Check } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Employee, TimeOffRequest } from '@/lib/supabase'

const STATUS_STYLES = {
  pending:  { icon: AlertCircle,  cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',  label: 'Pending'  },
  approved: { icon: CheckCircle2, cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',  label: 'Approved' },
  denied:   { icon: XCircle,      cls: 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800',              label: 'Denied'   },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inp = 'w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600'

export default function EmployeeDetailClient({
  employee,
  requests,
  currentRole,
}: {
  employee: Employee
  requests: TimeOffRequest[]
  currentRole: 'admin' | 'employee'
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name:        employee.name       || '',
    email:       employee.email      || '',
    job_title:   employee.job_title  || '',
    department:  employee.department || '',
    phone:       employee.phone      || '',
    bio:         employee.bio        || '',
    pto_balance: String(employee.pto_balance),
    sick_balance: String(employee.sick_balance),
    hire_date:   employee.hire_date  || '',
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  // Role state — managed separately from the main form
  const [role, setRole]           = useState<'admin' | 'employee'>(currentRole)
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleSaved, setRoleSaved]   = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        pto_balance:  parseFloat(form.pto_balance)  || 0,
        sick_balance: parseFloat(form.sick_balance) || 0,
        hire_date:    form.hire_date || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 2000)
  }

  const changeRole = async (newRole: 'admin' | 'employee') => {
    if (newRole === role || roleLoading) return
    setRoleLoading(true)
    const res = await fetch(`/api/admin/users/${employee.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setRoleLoading(false)
    if (res.ok) {
      setRole(newRole)
      setRoleSaved(true)
      setTimeout(() => setRoleSaved(false), 2500)
      router.refresh()
    }
  }

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Link href="/admin/employees"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5">
          <ArrowLeft size={13} />Employees
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                {employee.name || employee.email}
              </h1>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${
                role === 'admin'
                  ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                  : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
              }`}>
                {role === 'admin' ? <Shield size={9} /> : <User size={9} />}
                {role === 'admin' ? 'Admin' : 'Employee'}
              </span>
            </div>
            <p className="text-[13px] text-gray-400 mt-0.5">{employee.email}{employee.job_title ? ` · ${employee.job_title}` : ''}</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Edit form — 2/3 */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Employee Details</h2>
              </div>
              <form onSubmit={save} className="p-6 space-y-4">
                {[
                  { key: 'name',        label: 'Full Name',   type: 'text'  },
                  { key: 'email',       label: 'Email',       type: 'email' },
                  { key: 'job_title',   label: 'Job Title',   type: 'text'  },
                  { key: 'department',  label: 'Department',  type: 'text'  },
                  { key: 'phone',       label: 'Phone',       type: 'tel'   },
                  { key: 'hire_date',   label: 'Hire Date',   type: 'date'  },
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
                  {[
                    { key: 'pto_balance',  label: 'PTO Balance (hrs)'  },
                    { key: 'sick_balance', label: 'Sick Balance (hrs)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                      <input type="number" step="0.01" min="0"
                        value={(form as Record<string, unknown>)[key] as string}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className={inp} />
                    </div>
                  ))}
                </div>

                {/* Read-only accrual rates — managed automatically by the weekly cron */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'PTO Rate (auto)',  value: employee.pto_accrual_rate,  color: 'text-[#089447]' },
                    { label: 'Sick Rate (auto)', value: employee.sick_accrual_rate, color: 'text-amber-600'  },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                      <div className={`${inp} flex items-center justify-between cursor-default select-none bg-gray-100 dark:bg-zinc-800/60 border-dashed`}>
                        <span className={`font-semibold ${color}`}>{value > 0 ? `${value} hrs / wk` : '—'}</span>
                        <span className="text-[10px] text-gray-300 dark:text-gray-600">auto</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-[13px] text-red-500">{error}</p>}

                <div className="flex items-center gap-3 pt-1">
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

          {/* Right column — 1/3 */}
          <div className="space-y-5">

            {/* ── Role & Access card ── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Role & Access</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Controls which portal this user sees after login</p>
              </div>
              <div className="p-5 space-y-3">

                {/* Toggle buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {(['employee', 'admin'] as const).map((r) => {
                    const isActive = role === r
                    const isAdmin  = r === 'admin'
                    return (
                      <button
                        key={r}
                        onClick={() => changeRole(r)}
                        disabled={roleLoading}
                        className={`relative flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border text-[12px] font-semibold transition-all disabled:opacity-60 ${
                          isActive
                            ? isAdmin
                              ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                              : 'bg-[#f0faf4] dark:bg-[#089447]/20 border-[#089447]/40 text-[#089447]'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5">
                            <Check size={10} className={isAdmin ? 'text-violet-500' : 'text-[#089447]'} />
                          </span>
                        )}
                        {isAdmin ? <Shield size={16} /> : <User size={16} />}
                        {r === 'admin' ? 'Admin' : 'Employee'}
                      </button>
                    )
                  })}
                </div>

                {/* Description of current role */}
                <div className={`rounded-xl px-3.5 py-3 text-[11px] leading-relaxed ${
                  role === 'admin'
                    ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400'
                    : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {role === 'admin'
                    ? 'Full access to submissions, forms, employees, time off queue, and all admin settings.'
                    : 'Access to their own time off requests, profile, and the team directory.'}
                </div>

                {roleLoading && (
                  <p className="text-[11px] text-gray-400 text-center animate-pulse">Updating…</p>
                )}
                {roleSaved && !roleLoading && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-[#089447] text-center font-medium">
                    Role updated ✓
                  </motion.p>
                )}
              </div>
            </div>

            {/* ── Time Off History card ── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Request History</h2>
              </div>
              <div className="p-5">
                {requests.length === 0 ? (
                  <p className="text-[13px] text-gray-400">No requests yet.</p>
                ) : (
                  <div className="space-y-3">
                    {requests.map(req => {
                      const s = STATUS_STYLES[req.status]
                      const Icon = s.icon
                      return (
                        <div key={req.id} className="border border-gray-100 dark:border-zinc-800 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {req.type === 'pto'
                                ? <Calendar size={13} className="text-blue-400" />
                                : <Clock size={13} className="text-amber-500" />}
                              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                                {req.type === 'pto' ? 'PTO' : 'Sick'} · {req.hours_requested}h
                              </span>
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
      </div>
    </div>
  )
}
