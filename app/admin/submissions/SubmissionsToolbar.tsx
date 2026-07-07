'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { tabCx, tabCountCx, filterPillCx } from '@/components/admin/list'

type StatusFilter = '' | 'open' | 'in_progress' | 'resolved'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '',            label: 'All'         },
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
]

const READ_PILLS: { value: string; label: string }[] = [
  { value: '',      label: 'All'    },
  { value: 'false', label: 'Unread' },
  { value: 'true',  label: 'Read'   },
]

/**
 * Submissions filters. Two render modes so the primary status tabs + read-state
 * pills live inside the page header band (matching Forms/Customers/Tickets),
 * while search + the form dropdown stay in the content toolbar. Both instances
 * are stateless — they read the URL and navigate — so rendering the component
 * twice is safe.
 */
export default function SubmissionsToolbar({
  variant,
  currentStatus,
  currentSearch,
  currentRead,
  counts,
  forms,
  currentForm,
}: {
  variant: 'header' | 'toolbar'
  currentStatus?: string
  currentSearch?: string
  currentRead?: string
  counts?: Record<string, number>
  forms?: { id: string; title: string }[]
  currentForm?: string
}) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const navigate = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val)
      else params.delete(key)
    }
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [router, pathname, searchParams])

  // ── Header band: status tabs (left) + read-state pills (right) ──────────────
  if (variant === 'header') {
    return (
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(({ value, label }) => {
            const active = (currentStatus ?? '') === value
            const count  = counts?.[value === '' ? 'all' : value] ?? 0
            return (
              <button key={value} onClick={() => navigate({ status: value })} className={tabCx(active)}>
                {label}
                <span className={tabCountCx(active)}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 pb-1 flex-shrink-0">
          {READ_PILLS.map(({ value, label }) => {
            const active = (currentRead ?? '') === value
            return (
              <button key={value} onClick={() => navigate({ is_read: value })} className={filterPillCx(active)}>
                {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Content toolbar: search + form dropdown ─────────────────────────────────
  return (
    <div className="flex items-center gap-2.5 mb-4 flex-wrap">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <input
          type="text"
          defaultValue={currentSearch ?? ''}
          onChange={e => navigate({ search: e.target.value })}
          placeholder="Search…"
          className="pl-8 pr-8 h-9 text-[12.5px] w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
        />
        {currentSearch && (
          <button
            onClick={() => navigate({ search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {forms && forms.length > 0 && (
        <select
          defaultValue={currentForm ?? ''}
          onChange={e => navigate({ form_id: e.target.value })}
          className="h-9 pl-3 pr-7 text-[12.5px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
        >
          <option value="">All Forms</option>
          {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      )}
    </div>
  )
}
