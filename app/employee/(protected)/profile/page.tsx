'use client'

import { useState, useEffect } from 'react'
import { Save, Clock, Calendar, User, Phone, Building2, Briefcase, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Employee } from '@/lib/supabase'

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
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight">{employee.name || 'Your Profile'}</h1>
          <p className="text-[14px] text-gray-400 mt-0.5">{employee.email}</p>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
              <Calendar size={15} />
            </div>
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">PTO Balance</span>
          </div>
          <p className="text-[32px] font-bold text-gray-900 dark:text-white leading-none">{employee.pto_balance}<span className="text-[16px] font-medium text-gray-400 ml-1">hrs</span></p>
          <p className="text-[12px] text-gray-400 mt-1">+{employee.pto_accrual_rate} hrs / pay period</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
              <Clock size={15} />
            </div>
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Sick Balance</span>
          </div>
          <p className="text-[32px] font-bold text-gray-900 dark:text-white leading-none">{employee.sick_balance}<span className="text-[16px] font-medium text-gray-400 ml-1">hrs</span></p>
          <p className="text-[12px] text-gray-400 mt-1">+{employee.sick_accrual_rate} hrs / pay period</p>
        </div>
      </div>

      {/* Editable profile form */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white mb-5">Personal Information</h2>

        <form onSubmit={save} className="space-y-5">
          <Field icon={User} label="Full Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Jane Doe"
              className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600" />
          </Field>

          <Field icon={Briefcase} label="Job Title">
            <input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
              placeholder="HVAC Technician"
              className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600" />
          </Field>

          <Field icon={Building2} label="Department">
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="Field Services"
              className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600" />
          </Field>

          <Field icon={Phone} label="Phone">
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="(555) 000-0000" type="tel"
              className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600" />
          </Field>

          <Field icon={FileText} label="Bio / Hobbies">
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              rows={3} placeholder="Tell your team a bit about yourself…"
              className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 resize-none" />
          </Field>

          {/* Read-only email */}
          <Field icon={User} label="Email" note="Managed by admin">
            <input value={employee.email} disabled
              className="w-full text-[14px] text-gray-400 bg-gray-50 border border-gray-150 rounded-xl px-4 py-2.5 cursor-not-allowed" />
          </Field>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
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
  )
}

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
        <label className="text-[12px] font-semibold text-gray-500">{label}</label>
        {note && <span className="text-[11px] text-gray-300 ml-1">· {note}</span>}
      </div>
      {children}
    </div>
  )
}
