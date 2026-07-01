'use client'

import { useState } from 'react'
import { ShieldCheck, X, Loader2, CheckCircle2 } from 'lucide-react'

const RESOLUTIONS = [
  { value: 'repair', label: 'Repair' },
  { value: 'replace', label: 'Replace' },
  { value: 'credit', label: 'Credit' },
] as const
type Resolution = (typeof RESOLUTIONS)[number]['value']

const inp = 'w-full text-[13px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1'

/**
 * "File a claim" modal opened from WarrantyCard on /customer for an in-warranty
 * unit. POSTs to /api/customer/warranty-requests; the request lands pending at
 * /admin/customers (Warranty tab) for an admin to approve/deny. Shell mirrors
 * NewCustomerWizard's modal pattern (fixed overlay, rounded-2xl card).
 */
export default function WarrantySubmitModal({
  unit,
  onClose,
  onSuccess,
}: {
  unit: { equipment_id: string; serial_number: string; model_number: string | null }
  onClose: () => void
  onSuccess: () => void
}) {
  const [description, setDescription] = useState('')
  const [problemStarted, setProblemStarted] = useState('')
  const [resolution, setResolution] = useState<Resolution>('repair')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/customer/warranty-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: unit.equipment_id,
          description: description.trim(),
          problem_started: problemStarted.trim() || undefined,
          resolution,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not submit your claim. Please try again.')
        return
      }
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">File a warranty claim</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* Unit (read-only) */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Serial #</span>
              <span className="truncate font-mono text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">{unit.serial_number}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Model #</span>
              <span className="truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-200">{unit.model_number || '—'}</span>
            </div>
          </div>

          <div>
            <label htmlFor="wc-description" className={lbl}>Describe the issue</label>
            <textarea
              id="wc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What's happening with the unit?"
              className={`${inp} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="wc-started" className={lbl}>When did this start? (optional)</label>
            <input
              id="wc-started"
              value={problemStarted}
              onChange={(e) => setProblemStarted(e.target.value)}
              placeholder="e.g. Last week, after a power outage"
              className={inp}
            />
          </div>

          <div>
            <span className={lbl}>Requested resolution</span>
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setResolution(r.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
                    resolution === r.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[12px] text-rose-500">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !description.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {submitting ? 'Submitting…' : 'Submit claim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
