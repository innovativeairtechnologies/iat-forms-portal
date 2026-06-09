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
    <div className="flex items-center gap-3 mb-4 flex-wrap">

      {/* Status segmented control */}
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
        {STATUS_TABS.map(({ value, label }) => {
          const active = (currentStatus ?? '') === value
          const count  = counts[value === '' ? 'all' : value] ?? 0
          return (
            <button
              key={value}
              onClick={() => navigate({ status: value })}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                active
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {label}
              <span className={`ml-1.5 text-[10px] tabular-nums ${active ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
        <input
          type="text"
          defaultValue={currentSearch ?? ''}
          onChange={e => navigate({ search: e.target.value })}
          placeholder="Search submissions…"
          className="pl-8 pr-8 py-2 text-[12px] w-52 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-zinc-600 transition-all"
        />
        {currentSearch && (
          <button
            onClick={() => navigate({ search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
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
          className="py-2 pl-3 pr-7 text-[12px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-600 dark:text-gray-300 outline-none focus:border-gray-300 dark:focus:border-zinc-600 transition-all appearance-none cursor-pointer"
        >
          <option value="">All Forms</option>
          {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      )}

      {/* Read filter */}
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
        {[['', 'All'], ['false', 'Unread'], ['true', 'Read']].map(([val, label]) => {
          const active = (currentRead ?? '') === val
          return (
            <button
              key={val}
              onClick={() => navigate({ is_read: val })}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg whitespace-nowrap transition-all ${
                active
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <span className="ml-auto text-[12px] text-gray-400 tabular-nums">
        {counts.all ?? 0} {(counts.all ?? 0) === 1 ? 'submission' : 'submissions'}
      </span>
    </div>
  )
}
