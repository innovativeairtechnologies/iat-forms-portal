'use client'

import type { LucideIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Save, User, Phone, Building2, Briefcase, FileText, ArrowLeft,
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Employee } from '@/lib/supabase'

/* Editable personal info — split out of the employee home so the landing can be
   a non-scroll dashboard. Same form + design language as before. */

const inputCls = 'w-full text-[13.5px] text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'

export default function EditProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState({ name: '', job_title: '', department: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/employees/me').then(r => r.json()).catch(() => ({})).then(({ employee }) => {
      if (employee) {
        setEmployee(employee)
        setForm({
          name:       employee.name       || '',
          job_title:  employee.job_title  || '',
          department: employee.department || '',
          phone:      employee.phone      || '',
          bio:        employee.bio        || '',
        })
      }
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
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-[#0a0a0b]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <div className="border-b border-gray-100 bg-white px-8 pb-6 pt-8 dark:border-zinc-800 dark:bg-zinc-900">
        <Link href="/employee/profile" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-[20px] font-bold text-white dark:bg-zinc-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-widest text-gray-400">Edit Profile</p>
            <h1 className="truncate text-[26px] font-bold leading-none tracking-tight text-gray-900 dark:text-white">{employee.name || 'Your Profile'}</h1>
            <p className="mt-0.5 truncate text-[13px] text-gray-400">{employee.job_title || 'Employee'} · {employee.email}</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
          <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-3.5 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <User size={14} className="text-zinc-400 dark:text-zinc-500" />
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Personal Information</h2>
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Visible in the directory</span>
          </div>

          <form onSubmit={save} className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
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

              <div className="sm:col-span-2">
                <Field icon={FileText} label="Bio / Hobbies">
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    rows={3} placeholder="Tell your team a bit about yourself…"
                    className={`${inputCls} resize-none`} />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field icon={User} label="Email" note="Managed by admin">
                  <input value={employee.email} disabled
                    className="w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13.5px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-600" />
                </Field>
              </div>
            </div>

            {error && <p className="mt-4 text-[13px] text-rose-500">{error}</p>}

            <div className="mt-6 flex items-center gap-3">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 h-9 text-[12.5px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && (
                <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  Saved ✓
                </motion.span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, note, children }: {
  icon: LucideIcon
  label: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={13} className="text-zinc-400 dark:text-zinc-500" />
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</label>
        {note && <span className="ml-1 text-[11px] normal-case tracking-normal text-zinc-300 dark:text-zinc-600">· {note}</span>}
      </div>
      {children}
    </div>
  )
}
