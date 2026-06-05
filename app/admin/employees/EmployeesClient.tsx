'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Search, Shield, User, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee } from '@/lib/supabase'
import Link from 'next/link'

export default function EmployeesClient({ employees }: { employees: Employee[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', job_title: '', department: '', is_admin: false })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  const invite = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setInviting(true)
    setInviteError('')
    const res = await fetch('/api/employees/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setInviting(false)
    if (!res.ok) { setInviteError(data.error || 'Failed to invite.'); return }
    setInviteSuccess(`Invite sent to ${form.email}`)
    setForm({ name: '', email: '', job_title: '', department: '', is_admin: false })
    setTimeout(() => { setInviteSuccess(''); setShowInvite(false); router.refresh() }, 2000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Employees</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{employees.length} total</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
          <UserPlus size={15} />Invite Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-gray-800 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300" />
      </div>

      {/* Employee list */}
      <div className="bg-white rounded-2xl border border-gray-150 overflow-hidden">
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
                  {emp.is_admin && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                      <Shield size={9} />Admin
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-gray-400 mt-0.5 truncate">{emp.email} {emp.job_title ? `· ${emp.job_title}` : ''}</p>
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

      {/* Invite modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInvite(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold text-gray-900">Invite Employee</h2>
                <button onClick={() => setShowInvite(false)} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
              </div>

              {inviteSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <UserPlus size={20} className="text-[#089447]" />
                  </div>
                  <p className="text-[15px] font-semibold text-gray-800">{inviteSuccess}</p>
                  <p className="text-[13px] text-gray-400 mt-1">They&apos;ll receive an email to set their password.</p>
                </div>
              ) : (
                <form onSubmit={invite} className="space-y-4">
                  {[
                    { key: 'name',       label: 'Full Name',   placeholder: 'Jane Doe',          required: false },
                    { key: 'email',      label: 'Email',       placeholder: 'jane@iat.com',       required: true  },
                    { key: 'job_title',  label: 'Job Title',   placeholder: 'HVAC Technician',    required: false },
                    { key: 'department', label: 'Department',  placeholder: 'Field Services',     required: false },
                  ].map(({ key, label, placeholder, required }) => (
                    <div key={key}>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                      <input value={(form as Record<string, unknown>)[key] as string} required={required}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder} type={key === 'email' ? 'email' : 'text'}
                        className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300" />
                    </div>
                  ))}

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.is_admin}
                      onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-[#089447] accent-[#089447]" />
                    <span className="text-[13px] text-gray-600 font-medium">Grant admin access</span>
                  </label>

                  {inviteError && <p className="text-[13px] text-red-500">{inviteError}</p>}

                  <button type="submit" disabled={inviting || !form.email}
                    className="w-full bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                    {inviting ? 'Sending invite…' : 'Send Invite'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
