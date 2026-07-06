'use client'

/**
 * Reviewer disposition card for SRV submissions — rendered in the right rail of
 * the admin submission detail when the submission is an SRV. Approve schedules;
 * Return requires notes and emails the customer a fix-and-resubmit link.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Undo2, Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react'

type Review = { decision: 'approve' | 'return'; notes: string; at: string; by: string; superseded_by?: string }

export default function SrvReviewCard({
  submissionId, flagged, review,
}: {
  submissionId: string
  flagged: string[]
  review: Review | null
}) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<'approve' | 'return' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (decision: 'approve' | 'return') => {
    if (decision === 'return' && !notes.trim()) {
      setError('Add notes first — the customer needs to know what to fix.')
      return
    }
    setBusy(decision)
    setError(null)
    try {
      const res = await fetch('/api/admin/srv-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, decision, notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Review failed')
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <ClipboardCheck size={14} className="text-emerald-600" />
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">SRV review</h3>
      </div>

      <div className="p-4 space-y-3">
        {review?.superseded_by ? (
          <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Returned {new Date(review.at).toLocaleDateString()} and since <strong>superseded by a newer revision</strong> — review that one instead.
          </p>
        ) : review ? (
          <div
            className={`rounded-lg px-3 py-2.5 text-[12px] leading-relaxed ${
              review.decision === 'approve'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <p className="font-bold">
              {review.decision === 'approve' ? 'Approved' : 'Returned to customer'}
              <span className="font-normal opacity-70"> · {review.by} · {new Date(review.at).toLocaleDateString()}</span>
            </p>
            {review.notes && <p className="mt-1 whitespace-pre-wrap">{review.notes}</p>}
            {review.decision === 'return' && (
              <p className="mt-1.5 opacity-70">Waiting on the customer&apos;s revision — it will arrive as a new submission.</p>
            )}
          </div>
        ) : (
          <>
            {flagged.length > 0 && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-400">
                  <AlertTriangle size={12} /> {flagged.length} failed item{flagged.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {flagged.map((f, i) => (
                    <li key={i} className="text-[11px] leading-snug text-red-600/90 dark:text-red-400/80">{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={flagged.length ? 'What the customer must resolve before start-up (goes in their email)…' : 'Optional notes for the customer…'}
              className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-[12px] text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            />
            {error && <p className="text-[12px] font-medium text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act('approve')}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-[12px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Approve
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act('return')}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/60 text-[12px] font-bold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950/30"
              >
                {busy === 'return' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                Return to customer
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Approve = ready to schedule. Return emails the customer your notes with a link that reopens their SRV prefilled for a revision.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
