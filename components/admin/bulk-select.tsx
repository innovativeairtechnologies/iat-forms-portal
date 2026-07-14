'use client'

// Reusable multi-select kit for admin list views: a selection hook, checkboxes
// that don't trigger row navigation, a floating action bar, and a bulk-delete
// button wired to /api/admin/bulk-delete. Pair with the list kit in ./list.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X } from 'lucide-react'
import type { BulkEntity } from '@/lib/bulk-delete'

export function useBulkSelect() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected(on ? new Set(ids) : new Set())
  }, [])
  const clear = useCallback(() => setSelected(new Set()), [])
  return {
    selected,
    has: (id: string) => selected.has(id),
    toggle,
    setAll,
    clear,
    count: selected.size,
    ids: Array.from(selected),
  }
}

/** Checkbox that stops the click from bubbling to a row link/nav.
 *  `className` replaces the display class so lists can hide the select column
 *  on phones (pass "hidden sm:flex") — the mobile row grids drop bulk-select. */
export function SelectBox({ checked, onChange, className = 'flex' }: { checked: boolean; onChange: () => void; className?: string }) {
  return (
    <div
      className={`${className} items-center justify-center`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer"
      />
    </div>
  )
}

/** Floating bottom action bar, shown while any row is selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children?: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl pl-4 pr-2 py-1.5">
      <span className="text-[12px] font-semibold text-white mr-2 whitespace-nowrap">Selected: {count}</span>
      {children}
      <button
        onClick={onClear}
        className="ml-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
      >
        Clear
      </button>
    </div>
  )
}

/** A plain (non-delete) action button styled for the dark BulkBar. */
export function BulkActionButton({ icon, label, onClick, disabled }: {
  icon?: React.ReactNode; label: string; onClick: () => void; disabled?: boolean
}) {
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

/** Bulk delete for the BulkBar: two-step confirm → POST /api/admin/bulk-delete. */
export function BulkDeleteButton({ entity, ids, onDone }: {
  entity: BulkEntity; ids: string[]; onDone: () => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Surface partial outcomes (e.g. employees self-skip, or FK failures).
        if (data.failed > 0 || data.skipped > 0) {
          const parts = [`Deleted ${data.deleted}`]
          if (data.failed > 0) parts.push(`${data.failed} failed`)
          if (data.skipped > 0) parts.push(`${data.skipped} skipped (your own account can't be deleted)`)
          alert(parts.join(' · '))
        }
        onDone()
        router.refresh()
      } else {
        alert(data.error || 'Delete failed.')
      }
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Delete {ids.length}?
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="px-2 py-1.5 rounded-full text-[12px] text-zinc-300 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-rose-400 hover:text-rose-300 hover:bg-white/5 transition-colors whitespace-nowrap"
    >
      <Trash2 size={13} /> Delete
    </button>
  )
}
