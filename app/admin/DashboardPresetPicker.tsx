'use client'

import { useRouter } from 'next/navigation'
import { LayoutGrid, Ticket, Inbox } from 'lucide-react'
import { DASH_PRESET_COOKIE, type Preset } from './dashboard-presets'

/* Per-admin dashboard layout preset. The constants live in ./dashboard-presets
   (a non-client module) so the server component can import them as real values. */

const OPTIONS: { id: Preset; label: string; icon: React.ReactNode }[] = [
  { id: 'balanced',    label: 'Balanced',    icon: <LayoutGrid size={14} /> },
  { id: 'tickets',     label: 'Tickets',     icon: <Ticket size={14} /> },
  { id: 'submissions', label: 'Submissions', icon: <Inbox size={14} /> },
]

// Icon-only segmented control (labels live in the tooltips).
export default function DashboardPresetPicker({ current }: { current: Preset }) {
  const router = useRouter()

  const set = (id: Preset) => {
    if (id === current) return
    document.cookie = `${DASH_PRESET_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg border border-hairline bg-surface" role="group" aria-label="Dashboard layout">
      {OPTIONS.map(({ id, label, icon }) => {
        const active = current === id
        return (
          <button
            key={id}
            onClick={() => set(id)}
            title={`${label} layout`}
            aria-label={`${label} layout`}
            aria-pressed={active}
            className={`flex items-center justify-center w-8 h-7 rounded-md transition-colors ${
              active
                ? 'bg-surface-strong text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}
