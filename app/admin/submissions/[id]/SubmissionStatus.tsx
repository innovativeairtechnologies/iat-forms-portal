'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Clock, ChevronDown } from 'lucide-react'
import { updateSubmissionStatus } from '../actions'

type Status = 'open' | 'in_progress' | 'resolved'

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ReactNode; chip: string; menu: string }> = {
  open: {
    label: 'Open',
    icon: <Circle size={13} />,
    chip: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300',
    menu: 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock size={13} />,
    chip: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    menu: 'hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle size={13} />,
    chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    menu: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
}

export default function SubmissionStatus({
  submissionId,
  initialStatus,
}: {
  submissionId: string
  initialStatus: Status
}) {
  const [status, setStatus] = useState<Status>(initialStatus || 'open')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const update = async (next: Status) => {
    if (next === status) { setOpen(false); return }
    setSaving(true)
    setOpen(false)
    setStatus(next)
    await updateSubmissionStatus(submissionId, next)
    setSaving(false)
  }

  const cfg = STATUS_CONFIG[status]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`flex items-center gap-2 h-9 px-3 rounded-lg text-[12px] font-semibold transition-all ${cfg.chip} ${saving ? 'opacity-60' : 'hover:opacity-80'}`}
      >
        {cfg.icon}
        {cfg.label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-40 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
            {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => update(key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium transition-colors ${val.menu} ${key === status ? 'opacity-50 cursor-default' : ''}`}
              >
                {val.icon}
                {val.label}
                {key === status && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
