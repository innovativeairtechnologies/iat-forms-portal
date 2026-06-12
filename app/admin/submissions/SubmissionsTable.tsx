'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, MoreHorizontal, CheckCheck, Clock, CheckCircle2, ExternalLink } from 'lucide-react'
import { markSubmissionRead, updateSubmissionStatus } from './actions'

/* Conceptzilla-style table for /admin/submissions: checkbox selection,
   uppercase headers, outlined status pills, kebab quick-actions, and a
   floating bulk-action bar wired to the existing server actions. */

export type SubmissionRow = {
  id: string
  form_title: string | null
  submitted_at: string
  is_read: boolean
  status?: string
  data: Record<string, unknown>
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400' },
  in_progress: { label: 'In Progress', cls: 'border-amber-300/60 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400' },
  resolved:    { label: 'Resolved',    cls: 'border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400' },
}

const COL = 'grid-cols-[44px_1fr_200px_120px_80px_44px]'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function SubmissionsTable({ submissions, emptyHint }: { submissions: SubmissionRow[]; emptyHint?: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the kebab menu on outside click
  useEffect(() => {
    if (!menuFor) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuFor])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = submissions.length > 0 && submissions.every(s => selected.has(s.id))
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(submissions.map(s => s.id)))

  const runBulk = (fn: (id: string) => Promise<void>) => {
    const ids = Array.from(selected)
    startTransition(async () => {
      await Promise.all(ids.map(fn))
      setSelected(new Set())
      router.refresh()
    })
  }

  const runOne = (id: string, fn: (id: string) => Promise<void>) => {
    setMenuFor(null)
    startTransition(async () => {
      await fn(id)
      router.refresh()
    })
  }

  return (
    <>
      <div className="bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden">

        {/* Column headers */}
        <div className={`grid ${COL} items-center border-b border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60`}>
          <div className="flex items-center justify-center py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer"
            />
          </div>
          {['Submitter', 'Form', 'Status', 'Created'].map(h => (
            <div key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
              {h}
            </div>
          ))}
          <div />
        </div>

        {/* Rows */}
        {submissions.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{emptyHint || 'No submissions found'}</p>
            <p className="text-[11px] text-zinc-300 dark:text-zinc-600 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          submissions.map((sub, i) => {
            const name  = String(sub.data?.['Employee Name'] || sub.data?.['Full Name'] || sub.data?.['Name'] || 'Anonymous')
            const emailRaw = sub.data?.['Employee Email'] || sub.data?.['Email'] || sub.data?.['Email Address']
            const email = emailRaw ? String(emailRaw) : null
            const pill  = STATUS_PILL[sub.status || 'open'] ?? STATUS_PILL.open
            const isSel = selected.has(sub.id)

            return (
              <div
                key={sub.id}
                onClick={() => router.push(`/admin/submissions/${sub.id}`)}
                className={`grid ${COL} items-center cursor-pointer transition-colors group relative ${
                  i !== 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''
                } ${isSel ? 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center py-3.5" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(sub.id)}
                    className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Submitter */}
                <div className="px-3 py-3.5 min-w-0 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-zinc-500 dark:text-zinc-300">
                    {name === 'Anonymous' ? '?' : initials(name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {name}
                      </p>
                      {!sub.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Unread" />}
                    </div>
                    {email && <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 truncate">{email}</p>}
                  </div>
                </div>

                {/* Form */}
                <div className="px-3 py-3.5 min-w-0">
                  <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 truncate">{sub.form_title || '—'}</p>
                </div>

                {/* Status */}
                <div className="px-3 py-3.5">
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-[3px] rounded-md border ${pill.cls}`}>
                    {pill.label}
                  </span>
                </div>

                {/* Created */}
                <div className="px-3 py-3.5">
                  <span className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">{timeAgo(sub.submitted_at)}</span>
                </div>

                {/* Kebab */}
                <div className="flex justify-center relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setMenuFor(menuFor === sub.id ? null : sub.id)}
                    className="p-1.5 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {menuFor === sub.id && (
                    <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1">
                      <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/submissions/${sub.id}`) }} />
                      {!sub.is_read && (
                        <MenuItem icon={<CheckCheck size={13} />} label="Mark as read" onClick={() => runOne(sub.id, markSubmissionRead)} />
                      )}
                      {sub.status !== 'in_progress' && (
                        <MenuItem icon={<Clock size={13} />} label="Mark In Progress" onClick={() => runOne(sub.id, (id) => updateSubmissionStatus(id, 'in_progress'))} />
                      )}
                      {sub.status !== 'resolved' && (
                        <MenuItem icon={<CheckCircle2 size={13} />} label="Resolve" onClick={() => runOne(sub.id, (id) => updateSubmissionStatus(id, 'resolved'))} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl pl-4 pr-2 py-1.5">
          <span className="text-[12px] font-semibold text-white mr-2 whitespace-nowrap">
            Selected: {selected.size}
          </span>
          <BulkButton icon={<CheckCheck size={13} />} label="Mark read" disabled={pending} onClick={() => runBulk(markSubmissionRead)} />
          <BulkButton icon={<Clock size={13} />} label="In Progress" disabled={pending} onClick={() => runBulk((id) => updateSubmissionStatus(id, 'in_progress'))} />
          <BulkButton icon={<CheckCircle2 size={13} />} label="Resolve" disabled={pending} onClick={() => runBulk((id) => updateSubmissionStatus(id, 'resolved'))} />
          <button
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="ml-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors text-left"
    >
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      {label}
    </button>
  )
}

function BulkButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}
