'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Search, Shield, ChevronRight, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { StatusPill, tabCx, tabCountCx } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, Toolbar, CardTable, Row, EmptyRow,
  Pagination, usePagedList, ToneAvatar,
} from '@/components/admin/list-card'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type StaffRole } from '@/lib/roles'

// Mobile keeps identity + status; select/role/balances/chevron return at sm+.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[34px_2fr_1.5fr_104px_70px_70px_28px]'

const EMPTY_FORM = { name: '', email: '', job_title: '', department: '', role: 'production' as StaffRole, temp_password: '' }

function generatePassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%&'
  const all     = upper + lower + digits + special
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  const core = pick(upper) + pick(lower) + pick(digits) + pick(special)
  const rest = Array.from({ length: 6 }, () => pick(all)).join('')
  return (core + rest).split('').sort(() => Math.random() - 0.5).join('')
}

type Tab = 'all' | 'admins' | 'active' | 'inactive'

const TABS: { value: Tab; label: string }[] = [
  { value: 'all',      label: 'All'      },
  { value: 'admins',   label: 'Admins'   },
  { value: 'active',   label: 'Active'   },
  { value: 'inactive', label: 'Inactive' },
]

type EmployeeWithRole = Employee & { role?: StaffRole }

export default function EmployeesClient({ employees }: { employees: EmployeeWithRole[] }) {
  const router = useRouter()
  const sel = useBulkSelect()
  const [search, setSearch]     = useState('')
  const [tab, setTab]           = useState<Tab>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [showPw, setShowPw]     = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated]   = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied]     = useState(false)

  const matchesTab = (e: EmployeeWithRole) =>
    tab === 'all'      ? true :
    tab === 'admins'   ? e.role === 'admin' :
    tab === 'active'   ? e.is_active !== false :
    e.is_active === false

  const tabCount = (t: Tab) =>
    employees.filter(e =>
      t === 'all'      ? true :
      t === 'admins'   ? e.role === 'admin' :
      t === 'active'   ? e.is_active !== false :
      e.is_active === false
    ).length

  const filtered = employees.filter(e =>
    matchesTab(e) && (
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
    )
  )

  const allSelected = filtered.length > 0 && filtered.every(e => sel.has(e.id))

  // Clear the selection when the visible set changes so a bulk delete can never
  // touch rows outside the current tab/search.
  useEffect(() => { sel.clear() }, [tab, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side pagination over the filtered set (default 10). Resets to page 1
  // whenever the tab/search changes or the page size changes.
  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(filtered.length, { initialPerPage: 10, resetKey: `${tab}|${search}` })
  const pageRows = filtered.slice(start, end)

  const openModal = () => {
    setForm({ ...EMPTY_FORM, temp_password: generatePassword() })
    setFormError('')
    setCreated(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    if (created) router.refresh()
  }

  const copyPassword = async () => {
    if (!created) return
    await navigator.clipboard.writeText(created.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setCreating(true)
    setFormError('')
    const res = await fetch('/api/employees/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error || 'Failed to create employee.'); return }
    setCreated({ email: form.email, password: form.temp_password })
  }

  return (
    <>
      <ListCardPage>
        <ListCard>
          <CardHead
            overline="People"
            title="Employees"
            count={`${employees.length} ${employees.length === 1 ? 'employee' : 'employees'}`}
            actions={
              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors"
              >
                <UserPlus size={15} />
                Add Employee
              </button>
            }
          />

          {/* ── Status tabs ── */}
          <div className="flex items-center gap-1 px-1 border-b border-hairline overflow-x-auto scrollbar-hide">
            {TABS.map(({ value, label }) => {
              const active = tab === value
              return (
                <button key={value} onClick={() => setTab(value)} className={tabCx(active)}>
                  {label}
                  <span className={tabCountCx(active)}>{tabCount(value)}</span>
                </button>
              )
            })}
          </div>

          {/* ── Filters ── */}
          <Toolbar>
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search employees"
                className="w-full h-9 pl-9 pr-8 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink-secondary placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-secondary transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex-1" />
            <span className="text-[12px] text-ink-muted tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'employee' : 'employees'}
            </span>
          </Toolbar>

          {/* ── Table ── */}
          <CardTable
            minWidth={760}
            cols={COLS}
            head={
              <>
                <SelectBox className="hidden sm:flex" checked={allSelected} onChange={() => sel.setAll(filtered.map(e => e.id), !allSelected)} />
                <span>Employee</span>
                <span className="hidden sm:block">Role / Dept</span>
                <span>Status</span>
                <span className="hidden sm:block text-right">PTO</span>
                <span className="hidden sm:block text-right">Sick</span>
                <span className="hidden sm:block" aria-hidden />
              </>
            }
          >
            {pageRows.length === 0 ? (
              <EmptyRow>No employees found.</EmptyRow>
            ) : (
              pageRows.map((emp) => {
                const dim = emp.is_active === false ? 'opacity-60' : ''
                return (
                  <Row key={emp.id} cols={COLS} href={`/admin/employees/${emp.id}`} selected={sel.has(emp.id)}>
                    {/* Select */}
                    <SelectBox className={cn('hidden sm:flex', dim)} checked={sel.has(emp.id)} onChange={() => sel.toggle(emp.id)} />
                    {/* Identity — name over job title / email */}
                    <div className={cn('flex items-center gap-2.5 min-w-0', dim)}>
                      <ToneAvatar name={emp.name || '—'} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{emp.name || '—'}</p>
                        <p className="text-[11.5px] text-ink-muted truncate">{emp.job_title || emp.email}</p>
                      </div>
                    </div>
                    {/* Role / Dept */}
                    <div className={cn('hidden sm:block min-w-0 truncate text-[12.5px] text-ink-secondary', dim)}>
                      {emp.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-violet-600 dark:text-violet-400">
                          <Shield size={11} />Admin
                        </span>
                      ) : (
                        emp.role ? ROLE_LABELS[emp.role] : '—'
                      )}
                      {emp.department ? <span className="text-ink-muted"> · {emp.department}</span> : ''}
                    </div>
                    {/* Status */}
                    <div className={dim}>
                      {emp.is_active === false
                        ? <StatusPill tone="slate">Inactive</StatusPill>
                        : <StatusPill tone="emerald">Active</StatusPill>}
                    </div>
                    {/* PTO */}
                    <div className={cn('hidden sm:block text-right tabular-nums font-medium text-ink-secondary', dim)}>{emp.pto_balance}</div>
                    {/* Sick */}
                    <div className={cn('hidden sm:block text-right tabular-nums font-medium text-ink-secondary', dim)}>{emp.sick_balance}</div>
                    {/* Chevron */}
                    <div className={cn('hidden sm:flex justify-center', dim)}>
                      <ChevronRight size={14} className="text-ink-faint group-hover:text-brand-ink transition-colors" />
                    </div>
                  </Row>
                )
              })
            )}
          </CardTable>

          {/* ── Pagination ── */}
          <Pagination
            page={page}
            perPage={perPage}
            total={filtered.length}
            totalPages={totalPages}
            onPage={setPage}
            onPerPage={setPerPage}
            unit="employees"
          />
        </ListCard>
      </ListCardPage>

      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkDeleteButton entity="employees" ids={sel.ids} onDone={sel.clear} />
      </BulkBar>

      {/* Create employee modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold text-gray-900">
                  {created ? 'Employee Created' : 'Add Employee'}
                </h2>
                <button onClick={closeModal} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* ── Success state: show credentials ── */}
              {created ? (
                <div>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <UserPlus size={20} className="text-[#089447]" />
                  </div>
                  <p className="text-center text-[15px] font-semibold text-gray-800 mb-1">Account created!</p>
                  <p className="text-center text-[13px] text-gray-400 mb-6">
                    Share these credentials with <strong>{created.email}</strong>. They&apos;ll be prompted to set their own password and complete their profile on first login.
                  </p>

                  <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Email</p>
                      <p className="text-[14px] font-medium text-gray-800">{created.email}</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Temporary Password</p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-mono font-semibold text-gray-800 tracking-wide">{created.password}</p>
                        <button onClick={copyPassword}
                          className="flex items-center gap-1.5 text-[12px] font-medium text-[#089447] hover:text-[#077a3c] transition-colors flex-shrink-0">
                          {copied ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-4">
                    ⚠️ This password won&apos;t be shown again. Copy it before closing.
                  </p>

                  <button onClick={closeModal}
                    className="w-full mt-5 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all shadow-sm">
                    Done
                  </button>
                </div>
              ) : (

              /* ── Create form ── */
              <form onSubmit={submit} className="space-y-4">
                {[
                  { key: 'name',        label: 'Full Name',   placeholder: 'Jane Doe',         required: false, type: 'text'  },
                  { key: 'email',       label: 'Email',       placeholder: 'jane@iat.com',      required: true,  type: 'email' },
                  { key: 'job_title',   label: 'Job Title',   placeholder: 'HVAC Technician',   required: false, type: 'text'  },
                  { key: 'department',  label: 'Department',  placeholder: 'Field Services',    required: false, type: 'text'  },
                ].map(({ key, label, placeholder, required, type }) => (
                  <div key={key}>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                    <input
                      value={(form as Record<string, unknown>)[key] as string}
                      required={required}
                      type={type}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300"
                    />
                  </div>
                ))}

                {/* Temp password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Temporary Password</label>
                    <button type="button" onClick={() => setForm(f => ({ ...f, temp_password: generatePassword() }))}
                      className="text-[11px] text-[#089447] hover:underline font-medium">
                      Regenerate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      value={form.temp_password}
                      type={showPw ? 'text' : 'password'}
                      required
                      onChange={e => setForm(f => ({ ...f, temp_password: e.target.value }))}
                      className="w-full text-[14px] font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-11 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">Share this with the employee — they&apos;ll be asked to change it on first login.</p>
                </div>

                {/* Role — determines which portal & tabs the account can access */}
                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))}
                    className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1.5">{ROLE_DESCRIPTIONS[form.role]}</p>
                </div>

                {formError && <p className="text-[13px] text-red-500">{formError}</p>}

                <button type="submit" disabled={creating || !form.email || !form.temp_password}
                  className="w-full bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                  {creating ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
