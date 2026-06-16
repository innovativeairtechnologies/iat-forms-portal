'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

/* Header quick-jump search — self-contained (no backend): filters a provided
   list of destinations and navigates on select. Replaces the old left-nav
   filter box, moved into the dashboard top bar to match /admin. Desktop only. */

export type SearchItem = { label: string; href: string; hint?: string }

export function PortalSearch({ items, placeholder = 'Search…' }: { items: SearchItem[]; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return items
      .filter(i => i.label.toLowerCase().includes(t) || (i.hint ?? '').toLowerCase().includes(t))
      .slice(0, 8)
  }, [q, items])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  return (
    <div className="relative hidden w-60 md:block" ref={ref}>
      <form onSubmit={e => { e.preventDefault(); if (results[0]) go(results[0].href) }}>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-[13px] text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500"
        />
      </form>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          {results.length ? (
            results.map(r => (
              <button
                key={r.href}
                onClick={() => go(r.href)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <span className="truncate text-[13px] text-zinc-700 dark:text-zinc-200">{r.label}</span>
                {r.hint && <span className="flex-shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">{r.hint}</span>}
              </button>
            ))
          ) : (
            <p className="px-3.5 py-3 text-[12px] text-zinc-400 dark:text-zinc-500">No matches</p>
          )}
        </div>
      )}
    </div>
  )
}
