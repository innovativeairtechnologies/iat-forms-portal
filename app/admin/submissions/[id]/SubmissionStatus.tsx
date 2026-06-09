'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Clock, ChevronDown } from 'lucide-react'
import { updateSubmissionStatus } from '../actions'

type Status = 'open' | 'in_progress' | 'resolved'

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ReactNode; chip: string; menu: string }> = {
  open: {
    label: 'Open',
    icon: <Circle size={13} />,
    chip: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    menu: 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock size={13} />,
    chip: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
    menu: 'hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle size={13} />,
    chip: 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]',
    menu: 'hover:bg-[#f0faf4] dark:hover:bg-[#089447]/20 text-[#089447]',
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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${cfg.chip} ${saving ? 'opacity-60' : 'hover:opacity-80'}`}
      >
        {cfg.icon}
        {cfg.label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-40 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-card-hover overflow-hidden">
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
