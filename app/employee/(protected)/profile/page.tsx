'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Save, Clock, Calendar, User, Phone, Building2, Briefcase, FileText,
  CheckCircle2, Sparkles, Wrench, Users, ArrowRight, CalendarClock,
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Employee, TimeOffRequest } from '@/lib/supabase'

/* Employee home — mirrors the /admin dashboard structure (KPI row, main column,
   right rail) adapted to the employee's function: balances, profile editing,
   their own time-off requests, and quick links. Same design language:
   zinc surfaces, emerald accent, light + dark. */

const inputCls = 'w-full text-[13.5px] text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'

const REQ_PILL: Record<string, string> = {
  pending:  'border-amber-300/60 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  denied:   'border-rose-300/60 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tenureLabel(hireDate: string): string {
  const start = new Date(hireDate + 'T00:00:00')
  const months = Math.max(0, Math.floor((Date.now() - start.getTime()) / (30.44 * 864e5)))
  if (months < 12) return `${months} mo${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}m` : `${years} yr${years === 1 ? '' : 's'}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [form, setForm] = useState({ name: '', job_title: '', department: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/employees/me').then(r => r.json()).catch(() => ({})),
      fetch('/api/requests').then(r => (r.ok ? r.json() : { requests: [] })).catch(() => ({ requests: [] })),
    ]).then(([{ employee }, { requests }]) => {
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
      setRequests(requests || [])
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
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-[#0a0a0b]">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-700 flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">My Account</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-none truncate">{employee.name || 'Your Profile'}</h1>
            <p className="text-[13px] text-gray-400 mt-0.5 truncate">{employee.job_title || 'Employee'} · {employee.email}</p>
          </div>
          <Link
            href="/employee/requests"
            className="flex-shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[12.5px] sm:text-[13px] font-semibold pl-3.5 pr-4 h-10 rounded-xl transition-colors shadow-sm shadow-emerald-600/20"
          >
            <CalendarClock size={16} className="flex-shrink-0" />
            <span className="whitespace-nowrap">Request Time Off</span>
          </Link>
        </div>
      </div>

      <div className="p-5 sm:p-8 space-y-4">

        {/* ── KPI row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Kpi
            icon={<Calendar size={15} />} color="#10b981"
            label="PTO Balance" value={employee.pto_balance} unit="hrs"
            sub={`+${employee.pto_accrual_rate} hrs / week accrual`}
          />
          <Kpi
            icon={<Clock size={15} />} color="#f59e0b"
            label="Sick Balance" value={employee.sick_balance} unit="hrs"
            sub={`+${employee.sick_accrual_rate} hrs / week accrual`}
          />
          {employee.hire_date ? (
            <Kpi
              icon={<Briefcase size={15} />} color="#8b5cf6"
              label="Tenure" value={tenureLabel(employee.hire_date)} unit=""
              sub={`Since ${new Date(employee.hire_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
            />
          ) : (
            <Kpi
              icon={<Building2 size={15} />} color="#8b5cf6"
              label="Department" value={employee.department || '—'} unit=""
              sub="Set below in your profile"
            />
          )}
          <Kpi
            icon={<CalendarClock size={15} />} color="#0ea5e9"
            label="Pending Requests" value={pendingCount} unit={pendingCount === 1 ? 'request' : 'requests'}
            sub="Awaiting admin review" href="/employee/requests"
          />
        </div>

        {/* ── Main + right rail ────────────────────────────────────── */}
        <div className="flex gap-4 items-start">
          <main className="flex-1 min-w-0">

            {/* Personal information */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-zinc-400 dark:text-zinc-500" />
                  <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Personal Information</h2>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Visible in the directory</span>
              </div>

              <form onSubmit={save} className="p-5 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
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
                        className="w-full text-[13.5px] text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 cursor-not-allowed" />
                    </Field>
                  </div>
                </div>

                {error && <p className="text-[13px] text-rose-500 mt-4">{error}</p>}

                <div className="flex items-center gap-3 mt-6">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[12.5px] font-semibold px-4 h-9 rounded-lg transition-colors disabled:opacity-40">
                    <Save size={14} />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {saved && (
                    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      className="text-[13px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Saved ✓
                    </motion.span>
                  )}
                </div>
              </form>
            </div>
          </main>

          {/* ── Right rail ─────────────────────────────────────────── */}
          <aside className="hidden xl:flex flex-col gap-4 w-[330px] flex-shrink-0">

            {/* Greeting */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none p-5">
              <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle,#10b981,transparent 70%)' }} />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{today}</p>
                <h2 className="mt-1 text-[20px] font-bold text-zinc-900 dark:text-white leading-tight">
                  {greeting()}{employee.name ? `, ${employee.name.split(' ')[0]}` : ''}
                </h2>
                <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {pendingCount > 0
                    ? <>You have <span className="font-semibold text-zinc-700 dark:text-zinc-200">{pendingCount}</span> request{pendingCount === 1 ? '' : 's'} awaiting review.</>
                    : <>You&apos;re all caught up. <Sparkles size={12} className="inline -mt-0.5 text-emerald-500" /></>}
                </p>
              </div>
            </div>

            {/* My time off */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <CalendarClock size={14} className="text-zinc-400 dark:text-zinc-500" />
                  <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">My Time Off</h3>
                </div>
                <Link href="/employee/requests" className="text-[12px] font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors">
                  View all
                </Link>
              </div>
              {recentRequests.length === 0 ? (
                <p className="px-5 py-6 text-[12px] text-zinc-400 dark:text-zinc-600 text-center">No requests yet</p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {recentRequests.map(r => (
                    <Link key={r.id} href="/employee/requests" className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
                          {r.type === 'pto' ? 'PTO' : 'Sick'} · {r.hours_requested} hrs
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                          {fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-[3px] rounded-md border flex-shrink-0 ${REQ_PILL[r.status] || REQ_PILL.pending}`}>
                        {r.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
                <ArrowRight size={14} className="text-zinc-400 dark:text-zinc-500" />
                <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Quick Actions</h3>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                <QuickAction icon={<CalendarClock size={15} />} label="Request Time Off" href="/employee/requests" />
                <QuickAction icon={<FileText size={15} />} label="Employee Forms" href="/employee/resources" />
                <QuickAction icon={<Wrench size={15} />} label="Tools & Apps" href="/employee/resources/tools" />
                <QuickAction icon={<Users size={15} />} label="Directory" href="/employee/directory" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ─── KPI card (matches /admin dashboard chrome; no fabricated sparklines) ─────
function Kpi({ icon, color, label, value, unit, sub, href }: {
  icon: React.ReactNode
  color: string
  label: string
  value: number | string
  unit: string
  sub: string
  href?: string
}) {
  const inner = (
    <div className="h-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md dark:hover:bg-zinc-900/70 transition-all p-4">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color }}>{icon}</span>
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-zinc-900 dark:text-white leading-none tabular-nums tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{unit}</span>}
      </div>
      <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
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
        <Icon size={13} className="text-zinc-400 dark:text-zinc-500" />
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</label>
        {note && <span className="text-[11px] text-zinc-300 dark:text-zinc-600 ml-1 normal-case tracking-normal">· {note}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-start gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors group">
      <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{icon}</span>
      <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
    </Link>
  )
}
