'use client'

import { useRouter } from 'next/navigation'
import { LayoutGrid, Ticket, Inbox } from 'lucide-react'
import { DASH_PRESET_COOKIE, type Preset } from './dashboard-presets'

/* Per-admin dashboard layout preset. The constants live in ./dashboard-presets
   (a non-client module) so the server component can import them as real values. */

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
