'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Phone, Building2, Briefcase, FileText, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Employee } from '@/lib/supabase'

// ── Color palette assigned deterministically per employee ─────────────────────
const PALETTE = [
  { avatar: 'bg-blue-500',    hover: 'hover:border-blue-200 dark:hover:border-blue-800',    glow: 'rgba(59,130,246,0.08)',   strip: 'from-blue-500'    },
  { avatar: 'bg-violet-500',  hover: 'hover:border-violet-200 dark:hover:border-violet-800', glow: 'rgba(139,92,246,0.08)',  strip: 'from-violet-500'  },
  { avatar: 'bg-amber-500',   hover: 'hover:border-amber-200 dark:hover:border-amber-800',   glow: 'rgba(245,158,11,0.08)',  strip: 'from-amber-500'   },
  { avatar: 'bg-emerald-500', hover: 'hover:border-emerald-200 dark:hover:border-emerald-800',glow: 'rgba(16,185,129,0.08)', strip: 'from-emerald-500' },
  { avatar: 'bg-rose-500',    hover: 'hover:border-rose-200 dark:hover:border-rose-800',     glow: 'rgba(244,63,94,0.08)',   strip: 'from-rose-500'    },
  { avatar: 'bg-sky-500',     hover: 'hover:border-sky-200 dark:hover:border-sky-800',       glow: 'rgba(14,165,233,0.08)',  strip: 'from-sky-500'     },
  { avatar: 'bg-orange-500',  hover: 'hover:border-orange-200 dark:hover:border-orange-800', glow: 'rgba(249,115,22,0.08)', strip: 'from-orange-500'  },
  { avatar: 'bg-teal-500',    hover: 'hover:border-teal-200 dark:hover:border-teal-800',     glow: 'rgba(20,184,166,0.08)',  strip: 'from-teal-500'    },
]

function getColor(employee: Employee) {
  const hash = employee.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length]
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

type BentoSize = 'featured' | 'wide' | 'default'

function getBentoSize(index: number): BentoSize {
  if (index === 0) return 'featured'
  if (index % 5 === 0) return 'wide'
  return 'default'
}

export default function DirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Employee | null>(null)

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(({ employees }) => { setEmployees(employees || []); setLoading(false) })
  }, [])

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Team</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Directory</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {loading ? 'Loading…' : `${employees.length} ${employees.length === 1 ? 'person' : 'people'} at IAT`}
        </p>
      </div>

      {/* Content */}
      <div className="p-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-60">
            <div className="w-5 h-5 border-2 border-[#089447] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && employees.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card flex flex-col items-center justify-center py-20 text-center">
            <Users size={28} className="text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">No employees yet.</p>
          </div>
        )}

        {/* Bento grid */}
        {!loading && employees.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-[170px] gap-3 [grid-auto-flow:dense]">
            {employees.map((emp, i) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                size={getBentoSize(i)}
                onClick={() => setSelected(emp)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Profile modal */}
      <AnimatePresence>
        {selected && (
          <ProfileModal employee={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Employee Bento Card ───────────────────────────────────────── */

function EmployeeCard({ employee, size, onClick }: {
  employee: Employee
  size: BentoSize
  onClick: () => void
}) {
  const color    = getColor(employee)
  const initials = getInitials(employee.name)

  const spanClass =
    size === 'featured' ? 'col-span-2 row-span-2' :
    size === 'wide'     ? 'col-span-2 row-span-1' :
                          'col-span-1 row-span-1'

  const base = `group relative w-full h-full text-left bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg dark:hover:shadow-black/30 hover:-translate-y-0.5 ${color.hover} ${spanClass}`

  /* Featured 2×2 */
  if (size === 'featured') {
    return (
      <button onClick={onClick} className={base}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 80% 20%, ${color.glow} 0%, transparent 65%)` }} />

        <div className="relative flex flex-col h-full p-6">
          {/* Large avatar */}
          <div className={`w-16 h-16 rounded-2xl ${color.avatar} flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0 shadow-lg`}>
            {initials}
          </div>

          <div className="mt-auto">
            <p className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight group-hover:text-[#089447] transition-colors">
              {employee.name || employee.email.split('@')[0]}
            </p>
            {employee.job_title && (
              <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">{employee.job_title}</p>
            )}
            {employee.department && (
              <span className="inline-block mt-2 text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {employee.department}
              </span>
            )}
            {employee.bio && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                {employee.bio}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  /* Wide 2×1 */
  if (size === 'wide') {
    return (
      <button onClick={onClick} className={base}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 95% 50%, ${color.glow} 0%, transparent 55%)` }} />

        <div className="relative flex items-center gap-4 h-full px-6">
          <div className={`w-12 h-12 rounded-xl ${color.avatar} flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0 shadow-md`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 dark:text-white group-hover:text-[#089447] transition-colors leading-snug">
              {employee.name || employee.email.split('@')[0]}
            </p>
            {employee.job_title && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">{employee.job_title}</p>
            )}
          </div>
          {employee.department && (
            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">
              {employee.department}
            </span>
          )}
        </div>
      </button>
    )
  }

  /* Default 1×1 */
  return (
    <button onClick={onClick} className={base}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 90% 10%, ${color.glow} 0%, transparent 60%)` }} />

      <div className="relative flex flex-col h-full p-4">
        <div className={`w-10 h-10 rounded-xl ${color.avatar} flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 shadow-sm mb-3`}>
          {initials}
        </div>
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white group-hover:text-[#089447] transition-colors leading-snug">
          {employee.name || employee.email.split('@')[0]}
        </p>
        {employee.job_title && (
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{employee.job_title}</p>
        )}
        {employee.department && (
          <span className="inline-block mt-auto text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full self-start">
            {employee.department}
          </span>
        )}
      </div>
    </button>
  )
}

/* ─── Profile Modal ─────────────────────────────────────────────── */

function ProfileModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const color    = getColor(employee)
  const initials = getInitials(employee.name)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header strip */}
        <div className={`relative bg-gradient-to-br ${color.strip} to-transparent h-32 flex-shrink-0`}
          style={{ background: `linear-gradient(135deg, ${color.glow.replace('0.08', '0.6')} 0%, transparent 100%)` }}>
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${color.glow.replace('0.08', '1').replace('rgba', 'rgba').replace(', 0', ', 0')} 0%, transparent 80%)`,
          }} />
          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors">
            <X size={15} className="text-white" />
          </button>
          {/* Avatar */}
          <div className="absolute -bottom-8 left-6">
            <div className={`w-16 h-16 rounded-2xl ${color.avatar} flex items-center justify-center text-white text-[22px] font-bold shadow-xl ring-4 ring-white dark:ring-zinc-900`}>
              {initials}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-12 pb-8 px-6 overflow-y-auto max-h-[60vh]">
          {/* Name + title */}
          <div className="mb-6">
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {employee.name || employee.email.split('@')[0]}
            </h2>
            {employee.job_title && (
              <p className="text-[14px] text-gray-400 dark:text-gray-500 mt-0.5">{employee.job_title}</p>
            )}
            {employee.department && (
              <span className="inline-block mt-2 text-[11px] font-semibold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full uppercase tracking-wide">
                {employee.department}
              </span>
            )}
          </div>

          {/* Info grid */}
          <div className="space-y-3 mb-6">
            <InfoRow icon={Mail} label="Email" value={employee.email} />
            {employee.phone && <InfoRow icon={Phone} label="Phone" value={employee.phone} />}
            {employee.department && <InfoRow icon={Building2} label="Department" value={employee.department} />}
            {employee.job_title && <InfoRow icon={Briefcase} label="Title" value={employee.job_title} />}
            {employee.hire_date && (
              <InfoRow icon={Briefcase} label="Joined"
                value={new Date(employee.hire_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              />
            )}
          </div>

          {/* Bio */}
          {employee.bio && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} className="text-gray-400" />
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">About</span>
              </div>
              <p className="text-[13.5px] text-gray-600 dark:text-gray-300 leading-relaxed">{employee.bio}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">{label}</p>
        <p className="text-[13px] text-gray-700 dark:text-gray-200 truncate">{value}</p>
      </div>
    </div>
  )
}
