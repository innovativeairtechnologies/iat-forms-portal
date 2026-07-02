'use client'

// Reusable "delete this one record" control for admin detail pages and list rows.
// Two-step inline confirm, calls a DELETE endpoint, then either redirects (detail
// pages → back to the list) or refreshes in place (list/queue rows). Admin-gating
// + audit logging live in the endpoint.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X } from 'lucide-react'

interface Props {
  /** DELETE target, e.g. `/api/submissions/${id}` */
  endpoint: string
  /** lowercase noun shown in the prompt, e.g. "submission" */
  entityLabel: string
  /** where to go after a successful delete (detail pages). Omit to refresh in place. */
  redirectTo?: string
  /** optional extra warning line (e.g. "This frees the email for reuse.") */
  warn?: string
  /** trigger button label (default "Delete") */
  label?: string
  /** icon-only trigger for compact list/queue rows */
  compact?: boolean
}

export default function DeleteRecordButton({
  endpoint, entityLabel, redirectTo, warn, label = 'Delete', compact = false,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const del = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Delete failed.')
        setLoading(false)
        return
      }
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      } else {
        router.refresh()
      }
    } catch {
      setError('Delete failed. Please try again.')
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="text-right leading-tight">
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
            Delete this {entityLabel}?
          </p>
          {(warn || error) && (
            <p className={`text-[10px] whitespace-nowrap ${error ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}>
              {error || warn}
            </p>
          )}
        </div>
        <button
          onClick={del}
          disabled={loading}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {loading ? 'Deleting…' : 'Delete'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError('') }}
          disabled={loading}
          className="inline-flex items-center h-8 px-2.5 rounded-lg text-[12px] font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  if (compact) {
    return (
      <button
        onClick={() => setConfirming(true)}
        title={`Delete ${entityLabel}`}
        className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
      >
        <Trash2 size={14} />
      </button>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
    >
      <Trash2 size={13} /> {label}
    </button>
  )
}
