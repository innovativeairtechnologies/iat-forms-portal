'use client'

import { useRouter } from 'next/navigation'
import { LayoutGrid, Ticket, Inbox } from 'lucide-react'

/* Per-admin dashboard layout preset. Stored in a cookie so the server can read
   it and render the right arrangement immediately (no flash, no DB). Each admin
   on their own machine gets their own layout. */

export const DASH_PRESET_COOKIE = 'iat_dash_preset'
export const PRESETS = ['balanced', 'tickets', 'submissions'] as const
export type Preset = (typeof PRESETS)[number]

const OPTIONS: { id: Preset; label: string; icon: React.ReactNode }[] = [
  { id: 'balanced',    label: 'Balanced',    icon: <LayoutGrid size={13} /> },
  { id: 'tickets',     label: 'Tickets',     icon: <Ticket size={13} /> },
  { id: 'submissions', label: 'Submissions', icon: <Inbox size={13} /> },
]

export default function DashboardPresetPicker({ current }: { current: Preset }) {
  const router = useRouter()

  const set = (id: Preset) => {
    if (id === current) return
    document.cookie = `${DASH_PRESET_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800" role="group" aria-label="Dashboard layout">
      {OPTIONS.map(({ id, label, icon }) => {
        const active = current === id
        return (
          <button
            key={id}
            onClick={() => set(id)}
            title={`${label} layout`}
            aria-pressed={active}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
              active
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {icon}
            <span className="hidden xl:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
