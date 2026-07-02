'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Ticket, Boxes, Building2, Calendar, Clock, Users,
  Trash2, X, AlertTriangle, ShieldAlert,
} from 'lucide-react'
import type { ResetTarget } from '@/lib/reset-targets'

type Counts = Record<ResetTarget, number>

const DATASETS: {
  key: ResetTarget
  label: string
  desc: string
  icon: React.ElementType
  warn?: string
}[] = [
  { key: 'submissions', label: 'Submissions',        desc: 'Every form submission.',                      icon: Inbox },
  { key: 'tickets',     label: 'Tickets',            desc: 'Every support ticket and its notes.',          icon: Ticket },
  { key: 'equipment',   label: 'Equipment',          desc: 'Every equipment unit and build/ship milestone.', icon: Boxes },
  { key: 'customers',   label: 'Customers',          desc: 'Every customer company.',                      icon: Building2, warn: 'Also deletes their portal logins, freeing those emails for reuse.' },
  { key: 'pto',         label: 'PTO Requests',       desc: 'Every paid-time-off request.',                 icon: Calendar },
  { key: 'sick',        label: 'Sick Time Requests', desc: 'Every sick-time request.',                     icon: Clock },
  { key: 'employees',   label: 'Employees',          desc: 'Every non-admin employee account.',            icon: Users, warn: 'Admin accounts (including yours) are preserved. Deleted accounts free their emails for reuse.' },
]

const CONFIRM_WORD = 'DELETE'

export default function ResetClient({ counts }: { counts: Counts }) {
  const router = useRouter()
  const [target, setTarget]   = useState<ResetTarget | null>(null)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState<string | null>(null)

  const active = DATASETS.find(d => d.key === target) || null

  const open = (t: ResetTarget) => {
    setTarget(t); setConfirm(''); setError(''); setResult(null)
  }
  const close = () => {
    if (busy) return
    setTarget(null)
    if (result) router.refresh()
  }

  const run = async () => {
    if (!target || confirm !== CONFIRM_WORD) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Delete failed.'); setBusy(false); return }
      const failedNote = data.failed > 0
        ? ` ${data.failed} account${data.failed === 1 ? '' : 's'} could not be removed (a database reference is blocking them — check the audit log).`
        : ''
      setResult(`Deleted ${data.deleted} record${data.deleted === 1 ? '' : 's'}.${failedNote}`)
    } catch {
      setError('Delete failed. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">System</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Data Reset</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Permanently delete a dataset. Built for clearing test data before go-live.</p>
      </div>

      <div className="p-8 max-w-3xl">
        {/* Danger banner */}
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 mb-6">
          <ShieldAlert size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-rose-700 dark:text-rose-300 leading-relaxed">
            <strong>These deletions are permanent and cannot be undone.</strong> Each removes every row in
            that dataset across the portal and Supabase. Account deletions also remove the login, so the
            email becomes available again.
          </div>
        </div>

        {/* Dataset list */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {DATASETS.map(({ key, label, desc, icon: Icon, warn }) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Icon size={17} className="text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
                  <span className="text-[11px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                    {counts[key]}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">{desc}</p>
                {warn && <p className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-1">{warn}</p>}
              </div>
              <button
                onClick={() => open(key)}
                disabled={counts[key] === 0}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent flex-shrink-0"
              >
                <Trash2 size={14} /> Delete all
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={close}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose-500" /> Delete all {active.label}?
                </h2>
                <button onClick={close} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {result ? (
                <div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
                    {result}
                  </div>
                  <button onClick={close}
                    className="w-full mt-5 bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 text-[14px] font-semibold py-3 rounded-xl transition-all">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-1">
                    This permanently deletes <strong className="text-gray-800 dark:text-gray-200">{counts[active.key]}</strong> {active.label.toLowerCase()} record{counts[active.key] === 1 ? '' : 's'}. This cannot be undone.
                  </p>
                  {active.warn && (
                    <p className="text-[12px] text-amber-600 dark:text-amber-400 mb-3">{active.warn}</p>
                  )}

                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5 mt-4">
                    Type <span className="text-rose-500 font-mono">{CONFIRM_WORD}</span> to confirm
                  </label>
                  <input
                    value={confirm}
                    autoFocus
                    onChange={e => setConfirm(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    className="w-full text-[14px] font-mono text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 transition-all"
                  />

                  {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}

                  <div className="flex gap-2 mt-5">
                    <button onClick={close} disabled={busy}
                      className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 text-[14px] font-semibold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={run} disabled={busy || confirm !== CONFIRM_WORD}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {busy ? 'Deleting…' : 'Delete permanently'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
