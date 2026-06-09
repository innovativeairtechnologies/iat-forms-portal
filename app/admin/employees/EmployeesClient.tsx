'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Search, Shield, User, ChevronRight, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee } from '@/lib/supabase'
import Link from 'next/link'

const EMPTY_FORM = { name: '', email: '', job_title: '', department: '', is_admin: false, temp_password: '' }

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

export default function EmployeesClient({ employees }: { employees: (Employee & { role?: 'admin' | 'employee' })[] }) {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [showPw, setShowPw]     = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated]   = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied]     = useState(false)

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

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
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">People</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Employees</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{employees.length} {employees.length === 1 ? 'employee' : 'employees'}</p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <UserPlus size={15} />Add Employee
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-gray-800 dark:text-gray-200 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 shadow-card" />
        </div>

      {/* Employee list */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <User size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[14px] text-gray-400">No employees found.</p>
          </div>
        ) : (
          filtered.map((emp, i) => (
            <Link key={emp.id} href={`/admin/employees/${emp.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                {emp.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-gray-800 group-hover:text-[#089447] transition-colors">{emp.name || '—'}</p>
                  {emp.role === 'admin' && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                      <Shield size={9} />Admin
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-gray-400 mt-0.5 truncate">{emp.email}{emp.job_title ? ` · ${emp.job_title}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-[12px] font-semibold text-gray-600">{emp.pto_balance} <span className="font-normal text-gray-400">PTO hrs</span></p>
                <p className="text-[12px] font-semibold text-gray-600 mt-0.5">{emp.sick_balance} <span className="font-normal text-gray-400">sick hrs</span></p>
              </div>
              <ChevronRight size={15} className="text-gray-300 group-hover:text-[#089447] transition-colors flex-shrink-0" />
            </Link>
          ))
        )}
      </div>
      </div>{/* p-8 */}

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

                <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                  <input type="checkbox" checked={form.is_admin}
                    onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 accent-[#089447]" />
                  <span className="text-[13px] text-gray-600 font-medium">Grant admin access</span>
                </label>

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
    </div>{/* flex-1 */}
    </>
  )
}
