'use client'

import { useState, useEffect } from 'react'
import { Save, Clock, Calendar, User, Phone, Building2, Briefcase, FileText, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Employee } from '@/lib/supabase'

const inputCls = 'w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600'

export default function ProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState({ name: '', job_title: '', department: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees/me')
      .then(r => r.json())
      .then(({ employee }) => {
        if (!employee) return
        setEmployee(employee)
        setForm({
          name:       employee.name       || '',
          job_title:  employee.job_title  || '',
          department: employee.department || '',
          phone:      employee.phone      || '',
          bio:        employee.bio        || '',
        })
      })
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/employees/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save changes.'); return }
    setEmployee(prev => prev ? { ...prev, ...form } : prev)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#089447] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gray-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">My Account</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-none">{employee.name || 'Your Profile'}</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{employee.job_title || 'Employee'} · {employee.email}</p>
          </div>
        </div>

        {/* Balance + stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <BalanceCard icon={<Calendar size={15} />} label="PTO Balance" value={employee.pto_balance} accrual={employee.pto_accrual_rate} accent="blue" />
          <BalanceCard icon={<Clock size={15} />} label="Sick Balance" value={employee.sick_balance} accrual={employee.sick_accrual_rate} accent="amber" />
          {employee.department && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-l-[3px] border-l-violet-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800 shadow-card px-4 py-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
                <Building2 size={15} className="text-violet-500 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-violet-600 dark:text-violet-400 truncate">{employee.department}</p>
                <p className="text-[11px] font-medium text-gray-400 mt-0.5">Department</p>
              </div>
            </div>
          )}
          {employee.hire_date && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-l-[3px] border-l-emerald-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800 shadow-card px-4 py-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={15} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                  {new Date(employee.hire_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[11px] font-medium text-gray-400 mt-0.5">Hire Date</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="p-8">
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
              <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Personal Information</h2>
              <p className="text-[12px] text-gray-400 mt-0.5">Update your profile details</p>
            </div>

            <form onSubmit={save} className="p-6 space-y-5">
              <Field icon={User} label="Full Name">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe" className={inputCls} />
              </Field>

              <Field icon={Briefcase} label="Job Title">
                <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                  placeholder="HVAC Technician" className={inputCls} />
              </Field>

              <Field icon={Building2} label="Department">
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="Field Services" className={inputCls} />
              </Field>

              <Field icon={Phone} label="Phone">
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000" type="tel" className={inputCls} />
              </Field>

              <Field icon={FileText} label="Bio / Hobbies">
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3} placeholder="Tell your team a bit about yourself…"
                  className={`${inputCls} resize-none`} />
              </Field>

              <Field icon={User} label="Email" note="Managed by admin">
                <input value={employee.email} disabled
                  className="w-full text-[14px] text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700 rounded-xl px-4 py-2.5 cursor-not-allowed" />
              </Field>

              {error && <p className="text-[13px] text-red-500">{error}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && (
                  <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className="text-[13px] text-[#089447] font-medium">
                    Saved ✓
                  </motion.span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Balance Card ─────────────────────────────────────────────────────────────

function BalanceCard({ icon, label, value, accrual, accent }: {
  icon: React.ReactNode
  label: string
  value: number
  accrual: number
  accent: 'blue' | 'amber'
}) {
  const styles = {
    blue:  { border: 'border-l-blue-500',  bg: 'bg-blue-50 dark:bg-blue-950/50',   icon: 'text-blue-500 dark:text-blue-400',  val: 'text-blue-600 dark:text-blue-400'  },
    amber: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/50', icon: 'text-amber-500 dark:text-amber-400',val: 'text-amber-600 dark:text-amber-400' },
  }
  const s = styles[accent]
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-l-[3px] ${s.border} border-t-gray-100 border-r-gray-100 border-b-gray-100 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800 shadow-card px-4 py-3.5 flex items-center gap-3`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
        <span className={s.icon}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <p className={`text-[22px] font-bold tracking-tight leading-none ${s.val}`}>{value}</p>
          <span className="text-[11px] text-gray-400">hrs</span>
        </div>
        <p className="text-[11px] font-medium text-gray-400 mt-0.5">{label}</p>
        <p className="text-[10px] text-gray-300 dark:text-gray-600">+{accrual} / period</p>
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ icon: Icon, label, note, children }: {
  icon: React.ElementType
  label: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={13} className="text-gray-400" />
        <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{label}</label>
        {note && <span className="text-[11px] text-gray-300 dark:text-gray-600 ml-1">· {note}</span>}
      </div>
      {children}
    </div>
  )
}
