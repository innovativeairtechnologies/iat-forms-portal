'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Shield, User, Check, Power, UserRound, History } from 'lucide-react'
import type { Employee, TimeOffRequest } from '@/lib/supabase'
import { DetailShell, DetailTopBar, Card, CardHead } from '@/components/admin/detail-ui'

const STATUS_STYLES = {
  pending:  { icon: AlertCircle,  cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',  label: 'Pending'  },
  approved: { icon: CheckCircle2, cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',  label: 'Approved' },
  denied:   { icon: XCircle,      cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 border-rose-200 dark:border-rose-800',              label: 'Denied'   },
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inp = 'w-full text-[14px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3.5 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1.5'

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

  // Account status (offboarding)
  const [active, setActive]             = useState(employee.is_active !== false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError]   = useState('')

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

  const toggleActive = async () => {
    const next = !active
    if (!next && !window.confirm('Deactivate this employee? They will be blocked from logging in, removed from the directory, and skipped by PTO accrual. You can reactivate them later.')) return
    setStatusLoading(true)
    setStatusError('')
    const res = await fetch(`/api/employees/${employee.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    })
    setStatusLoading(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setStatusError(d.error || 'Failed to update status'); return }
    setActive(next)
    router.refresh()
  }

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'Employees', href: '/admin/employees' },
          { label: employee.name || employee.email },
        ]}
      >
        {saved && <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">Saved ✓</span>}
        <button
          type="submit"
          form="emp-form"
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg transition-all disabled:opacity-40"
        >
          <Save size={13} />{saving ? 'Saving…' : 'Save'}
        </button>
      </DetailTopBar>

      <div className="p-5 space-y-4">
        {/* Hero */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight leading-none truncate">
                {employee.name || employee.email}
              </h1>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${
                role === 'admin'
                  ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}>
                {role === 'admin' ? <Shield size={9} /> : <User size={9} />}
                {role === 'admin' ? 'Admin' : 'Employee'}
              </span>
              {!active && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">{employee.email}{employee.job_title ? ` · ${employee.job_title}` : ''}</p>
          </div>
        </div>

        {/* Two-column */}
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* Main — edit form */}
          <main className="flex-1 min-w-0 w-full">
            <Card>
              <CardHead title="Employee Details" icon={<UserRound size={14} />} />
              <form id="emp-form" onSubmit={save} className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'name',        label: 'Full Name',   type: 'text'  },
                    { key: 'email',       label: 'Email',       type: 'email' },
                    { key: 'job_title',   label: 'Job Title',   type: 'text'  },
                    { key: 'department',  label: 'Department',  type: 'text'  },
                    { key: 'phone',       label: 'Phone',       type: 'tel'   },
                    { key: 'hire_date',   label: 'Hire Date',   type: 'date'  },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label className={lbl}>{label}</label>
                      <input type={type} value={(form as Record<string, unknown>)[key] as string}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className={inp} />
                    </div>
                  ))}
                </div>

                <div>
                  <label className={lbl}>Bio</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    rows={3} className={`${inp} resize-none`} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'pto_balance',  label: 'PTO Balance (hrs)'  },
                    { key: 'sick_balance', label: 'Sick Balance (hrs)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className={lbl}>{label}</label>
                      <input type="number" step="0.01" min="0"
                        value={(form as Record<string, unknown>)[key] as string}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className={inp} />
                    </div>
                  ))}
                </div>

                {/* Read-only accrual rates — managed automatically by the weekly cron */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'PTO Rate (auto)',  value: employee.pto_accrual_rate,  color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Sick Rate (auto)', value: employee.sick_accrual_rate, color: 'text-amber-600 dark:text-amber-400'  },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <label className={lbl}>{label}</label>
                      <div className={`${inp} flex items-center justify-between cursor-default select-none bg-zinc-100 dark:bg-zinc-800/60 border-dashed`}>
                        <span className={`font-semibold ${color}`}>{value > 0 ? `${value} hrs / wk` : '—'}</span>
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600">auto</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-[13px] text-rose-500">{error}</p>}
              </form>
            </Card>
          </main>

          {/* Right rail */}
          <aside className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[72px] space-y-4">
            {/* ── Role & Access ── */}
            <Card>
              <CardHead title="Role & Access" icon={<Shield size={14} />} />
              <div className="p-5 space-y-3">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 -mt-1">Controls which portal this user sees after login</p>

                {/* Toggle buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {(['employee', 'admin'] as const).map((r) => {
                    const isSel   = role === r
                    const isAdmin = r === 'admin'
                    return (
                      <button
                        key={r}
                        onClick={() => changeRole(r)}
                        disabled={roleLoading}
                        className={`relative flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border text-[12px] font-semibold transition-all disabled:opacity-60 ${
                          isSel
                            ? isAdmin
                              ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300'
                              : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400/50 dark:border-emerald-600/50 text-emerald-700 dark:text-emerald-400'
                            : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300'
                        }`}
                      >
                        {isSel && (
                          <span className="absolute top-1.5 right-1.5">
                            <Check size={10} className={isAdmin ? 'text-violet-500' : 'text-emerald-500'} />
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
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {role === 'admin'
                    ? 'Full access to submissions, forms, employees, time off queue, and all admin settings.'
                    : 'Access to their own time off requests, profile, and the team directory.'}
                </div>

                {roleLoading && (
                  <p className="text-[11px] text-zinc-400 text-center animate-pulse">Updating…</p>
                )}
                {roleSaved && !roleLoading && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center font-medium">
                    Role updated ✓
                  </p>
                )}
              </div>
            </Card>

            {/* ── Account Status ── */}
            <Card>
              <CardHead title="Account Status" icon={<Power size={14} />} />
              <div className="p-5 space-y-3">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 -mt-1">Deactivating blocks login and removes them from the directory &amp; accrual</p>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-zinc-600 dark:text-zinc-300">Current</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}>
                    {active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={toggleActive}
                  disabled={statusLoading}
                  className={`w-full flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 border ${
                    active
                      ? 'bg-white dark:bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 border-rose-200 dark:border-rose-900'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                  }`}>
                  <Power size={14} />
                  {statusLoading ? 'Updating…' : active ? 'Deactivate Employee' : 'Reactivate Employee'}
                </button>
                {statusError && <p className="text-[11px] text-rose-500">{statusError}</p>}
              </div>
            </Card>

            {/* ── Request History ── */}
            <Card>
              <CardHead
                title="Request History"
                icon={<History size={14} />}
                action={requests.length > 0 ? <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{requests.length}</span> : undefined}
              />
              <div className="p-5">
                {requests.length === 0 ? (
                  <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No requests yet.</p>
                ) : (
                  <div className="space-y-3">
                    {requests.map(req => {
                      const s = STATUS_STYLES[req.status]
                      const Icon = s.icon
                      return (
                        <div key={req.id} className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {req.type === 'pto'
                                ? <Calendar size={13} className="text-blue-400" />
                                : <Clock size={13} className="text-amber-500" />}
                              <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
                                {req.type === 'pto' ? 'PTO' : 'Sick'} · {req.hours_requested}h
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
                              <Icon size={9} />{s.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{formatDate(req.start_date)} – {formatDate(req.end_date)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </DetailShell>
  )
}
