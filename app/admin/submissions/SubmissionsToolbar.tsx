'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'

type StatusFilter = '' | 'open' | 'in_progress' | 'resolved'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: '',            label: 'All'         },
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved'    },
]

export default function SubmissionsToolbar({
  currentStatus,
  currentSearch,
  currentRead,
  counts,
  forms,
  currentForm,
}: {
  currentStatus?: string
  currentSearch?: string
  currentRead?: string
  counts: Record<string, number>
  forms: { id: string; title: string }[]
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

  return (
    <div className="mb-4">

      {/* Status tabs — underline style */}
      <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 mb-4">
        {STATUS_TABS.map(({ value, label }) => {
          const active = (currentStatus ?? '') === value
          const count  = counts[value === '' ? 'all' : value] ?? 0
          return (
            <button
              key={value}
              onClick={() => navigate({ status: value })}
              className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                active
                  ? 'font-semibold text-zinc-900 dark:text-white'
                  : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {label}
              <span className={`ml-1.5 text-[11px] tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                {count}
              </span>
              {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
            </button>
          )
        })}
      </div>

      {/* Toolbar row */}
      <div className="flex items-center gap-2.5 flex-wrap">

        {/* Search */}
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

        {/* Form filter */}
        {forms.length > 0 && (
          <select
            defaultValue={currentForm ?? ''}
            onChange={e => navigate({ form_id: e.target.value })}
            className="h-9 pl-3 pr-7 text-[12.5px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="">All Forms</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>
        )}

        {/* Read filter */}
        <select
          defaultValue={currentRead ?? ''}
          onChange={e => navigate({ is_read: e.target.value })}
          className="h-9 pl-3 pr-7 text-[12.5px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
        >
          <option value="">Read &amp; Unread</option>
          <option value="false">Unread only</option>
          <option value="true">Read only</option>
        </select>

        <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {counts.all ?? 0} {(counts.all ?? 0) === 1 ? 'submission' : 'submissions'}
        </span>
      </div>
    </div>
  )
}
