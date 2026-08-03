'use client'

/* ────────────────────────────────────────────────────────────────────────────
   AddRepDialog — put a person on the board.

   A centre modal rather than the Drawer: this is a short, blocking "fill this in
   and come back" task, not a record to sit in. DESIGN.md §6 recipe — bg-black/40
   scrim, rounded-2xl surface panel, Level 3 elevation in light / ring in dark.

   The name field autocompletes from DryWare: `candidates` is every rep name
   already quoting in the deal mirror, busiest first. Picking one instead of
   retyping it is what makes the rep's pipeline figures resolve later — the match
   is on the name string, so a typo here quietly costs them their numbers.
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Contact } from '@/lib/supabase'
import type { PipelineCandidate } from '@/lib/rep-pipeline'
import { REP_STATUSES, fmtMoney } from '@/lib/rep-scorecard'
import type { Firm } from './RepScorecardClient'

const INPUT_CX =
  'w-full h-9 px-2.5 text-[13px] rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand hover:border-hairline-strong transition-colors'
const LABEL_CX = 'block text-[12px] font-medium text-ink-secondary mb-1.5'
const PANEL_SHADOW =
  'shadow-[0_8px_24px_rgba(31,30,27,.10),0_2px_6px_rgba(31,30,27,.05)] dark:shadow-none dark:ring-1 dark:ring-white/10'

export default function AddRepDialog({
  firms, candidates, onClose, onAdded,
}: {
  firms: Firm[]
  candidates: PipelineCandidate[]
  onClose: () => void
  onAdded: (rep: Contact) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [companyId, setCompanyId] = useState(firms[0]?.id ?? '')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [territory, setTerritory] = useState('')
  const [status, setStatus] = useState<string>('Active')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { if (mounted) nameRef.current?.focus() }, [mounted])

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (!q) return candidates.slice(0, 8)
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [candidates, name])

  const matched = useMemo(
    () => candidates.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null,
    [candidates, name],
  )

  const submit = async () => {
    if (!name.trim() || !companyId) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/rep-scorecard/reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          title: title.trim() || null,
          territory: territory.trim() || null,
          rep_status: status || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not add the rep.'); return }
      onAdded(json.rep as Contact)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto" onMouseDown={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-scrim-in motion-reduce:animate-none" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-rep-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full max-w-[460px] mt-[8vh] rounded-2xl border border-hairline bg-surface animate-drawer-in motion-reduce:animate-none',
          PANEL_SHADOW,
        )}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-hairline-soft">
          <div className="min-w-0 flex-1">
            <h2 id="add-rep-title" className="text-[16px] font-semibold text-ink tracking-tight">Add a rep</h2>
            <p className="text-[12px] text-ink-muted mt-0.5">
              Goes on the shared roster — the territory map&apos;s directory sees them too.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink transition-colors flex-shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <label className="block">
            <span className={LABEL_CX}>Firm</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={cn(INPUT_CX, 'cursor-pointer')}
            >
              {firms.length === 0 && <option value="">No rep firms yet — add one on the territory map</option>}
              {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>

          <div className="relative">
            <label className="block">
              <span className={LABEL_CX}>Name</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => { setName(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !showSuggestions) submit() }}
                placeholder="Jane Doe"
                className={INPUT_CX}
                autoComplete="off"
              />
            </label>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-hairline bg-surface py-1 z-10 shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Quoting in DryWare
                </p>
                {suggestions.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setName(c.name); setShowSuggestions(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-soft transition-colors"
                  >
                    <span className="flex-1 min-w-0 truncate text-[13px] text-ink-secondary">{c.name}</span>
                    <span className="text-[11px] tabular-nums text-ink-faint flex-shrink-0">
                      {c.quotes} quote{c.quotes === 1 ? '' : 's'} · {fmtMoney(c.openPipeline, { compact: true })}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {matched && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                <Sparkles size={12} />
                Matches DryWare — {fmtMoney(matched.openPipeline, { compact: true })} open across {matched.quotes} quote{matched.quotes === 1 ? '' : 's'}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL_CX}>Role / title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account Mgr" className={INPUT_CX} />
            </label>
            <label className="block">
              <span className={LABEL_CX}>Territory / region</span>
              <input value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="Ohio Valley" className={INPUT_CX} />
            </label>
          </div>

          <label className="block">
            <span className={LABEL_CX}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(INPUT_CX, 'cursor-pointer')}>
              <option value="">—</option>
              {REP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          {error && <p className="text-[12px] text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-hairline-soft">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim() || !companyId}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Add rep
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
