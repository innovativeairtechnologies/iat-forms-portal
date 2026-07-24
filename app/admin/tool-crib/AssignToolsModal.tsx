'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, UserPlus, Check } from 'lucide-react'
import type { EmployeeOption } from './page'

/* Bulk "assign tools to a person" — for when someone takes tools and doesn't
   scan them out, so the crib shows them available when they aren't. Assigns every
   available tool to the chosen person; optionally also sweeps up tools currently
   checked out to other people. */

const selectCx =
  'w-full h-10 px-3 text-[16px] sm:text-[14px] bg-canvas border border-hairline rounded-lg text-ink outline-none transition-all focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export default function AssignToolsModal({
  employees,
  availableCount,
  onClose,
}: {
  employees: EmployeeOption[]
  availableCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [to, setTo] = useState('')
  const [includeHeld, setIncludeHeld] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const submit = async () => {
    if (!to) { setError('Pick who to assign to.'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/admin/tool-crib/assign-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, include_held: includeHeld }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Could not assign the tools.'); return }
    setDone(data.assigned ?? 0)
    router.refresh()
  }

  const who = employees.find(e => e.id === to)?.name

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-surface border border-hairline rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-ink-faint" />
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>Assign tools</h2>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-secondary p-1 transition-colors">
            <X size={16} />
          </button>
        </div>

        {done !== null ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-3">
              <Check size={22} className="text-brand" />
            </div>
            <p className="text-[15px] text-ink" style={{ fontWeight: 600 }}>
              {done === 0 ? 'Nothing to assign' : `Assigned ${done} ${done === 1 ? 'tool' : 'tools'}`}
            </p>
            {done > 0 && who && <p className="text-[13px] text-ink-muted mt-1">to {who}</p>}
            <button onClick={onClose}
              className="mt-5 px-4 py-2 text-[13px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1.5">Assign to</span>
              <select value={to} onChange={e => { setTo(e.target.value); setError('') }} className={selectCx} autoFocus>
                <option value="">Pick a person…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeld}
                onChange={e => setIncludeHeld(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[color:var(--brand)]"
              />
              <span className="text-[12.5px] text-ink-secondary leading-snug">
                Also reassign tools currently checked out to <strong style={{ fontWeight: 600 }}>other people</strong>
                <span className="block text-[11px] text-ink-faint mt-0.5">
                  Off by default — leaves everyone else’s checked-out tools alone.
                </span>
              </span>
            </label>

            <div className="rounded-lg bg-canvas border border-hairline px-3 py-2.5 text-[12.5px] text-ink-muted">
              {availableCount === 0 && !includeHeld
                ? 'No tools are currently available to assign.'
                : includeHeld
                  ? `Assigns every available tool plus any checked out to others${who ? ` to ${who}` : ''}. Maintenance, lost, and retired tools are skipped.`
                  : `Assigns the ${availableCount} available ${availableCount === 1 ? 'tool' : 'tools'}${who ? ` to ${who}` : ''}. Maintenance, lost, and retired tools are skipped.`}
            </div>

            {error && <p className="text-[12.5px] text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose}
                className="px-4 py-2 text-[13px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
                Cancel
              </button>
              <button onClick={submit} disabled={busy || !to}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors disabled:opacity-60">
                {busy && <Loader2 size={13} className="animate-spin" />}
                {busy ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
