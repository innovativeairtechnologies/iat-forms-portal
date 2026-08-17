'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { Card, CardHead } from '@/components/admin/detail-ui'
import { RFQ_STATUSES, RFQ_STATUS_HELP, RFQ_STATUS_LABELS, type RfqStatus } from '@/lib/rfq-status'

/**
 * The only writable part of a survey. Status saves on click; notes save on a
 * pause in typing, because a desk note is written in fits and starts and a Save
 * button people forget to press is the same as no notes at all.
 *
 * router.refresh() after a status change so the list behind (and the sidebar's
 * unread badge) reflect it without a manual reload.
 */

const TONE: Record<RfqStatus, { on: string; off: string }> = {
  new: {
    on: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30',
    off: 'text-zinc-500 hover:text-sky-700 dark:text-zinc-400 dark:hover:text-sky-400',
  },
  reviewing: {
    on: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
    off: 'text-zinc-500 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-400',
  },
  quoted: {
    on: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
    off: 'text-zinc-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400',
  },
  closed: {
    on: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-600',
    off: 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
  },
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function TriageCard({
  id, initialStatus, initialNotes,
}: {
  id: string
  initialStatus: RfqStatus
  initialNotes: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<RfqStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes)
  const [statusState, setStatusState] = useState<SaveState>('idle')
  const [notesState, setNotesState] = useState<SaveState>('idle')
  const [error, setError] = useState('')

  // The last value we successfully stored, so an unchanged blur doesn't re-POST
  // and the "Saved" tick reflects the server rather than the keystroke.
  const savedNotes = useRef(initialNotes)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = async (patch: { status?: RfqStatus; internal_notes?: string }) => {
    const res = await fetch(`/api/admin/rfq/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || 'Could not save')
    }
    return res.json()
  }

  const pickStatus = async (next: RfqStatus) => {
    if (next === status) return
    const previous = status
    setStatus(next)              // optimistic — the click should feel instant
    setStatusState('saving')
    setError('')
    try {
      await save({ status: next })
      setStatusState('saved')
      router.refresh()           // list + sidebar badge follow along
      setTimeout(() => setStatusState('idle'), 1600)
    } catch (e) {
      setStatus(previous)        // put it back rather than show a lie
      setStatusState('error')
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  const queueNotes = (value: string) => {
    setNotes(value)
    setNotesState('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (value === savedNotes.current) return
      setNotesState('saving')
      setError('')
      try {
        await save({ internal_notes: value })
        savedNotes.current = value
        setNotesState('saved')
        setTimeout(() => setNotesState('idle'), 1600)
      } catch (e) {
        setNotesState('error')
        setError(e instanceof Error ? e.message : 'Could not save')
      }
    }, 900)
  }

  // A pending debounce must not outlive the page, or a note is silently dropped.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const unsaved = notes !== savedNotes.current

  return (
    <Card>
      <CardHead
        title="Triage"
        action={
          <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
            {statusState === 'saving' || notesState === 'saving' ? (
              <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving…</span>
            ) : statusState === 'saved' || notesState === 'saved' ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check size={12} /> Saved</span>
            ) : unsaved ? 'Unsaved changes' : null}
          </span>
        }
      />
      <div className="px-5 py-4">
        {/* A deliberate 2×2 rather than a wrapping row: four labels do not fit
            across the 300px detail rail, and 3-then-1 reads like a bug. */}
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Status">
          {RFQ_STATUSES.map(s => {
            const on = s === status
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                  on ? TONE[s].on : `bg-transparent ${TONE[s].off}`
                }`}
              >
                {RFQ_STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {RFQ_STATUS_HELP[status]}
        </p>

        <label htmlFor={`notes-${id}`} className="mt-4 block text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
          Internal notes
        </label>
        <p className="mb-1.5 text-[11.5px] text-zinc-400 dark:text-zinc-500">
          Not visible to the customer. Saves as you type.
        </p>
        <textarea
          id={`notes-${id}`}
          value={notes}
          onChange={e => queueNotes(e.target.value)}
          rows={5}
          placeholder="Who is working it, what you asked them, what the quote turned on…"
          className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-300 outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />

        {error && (
          <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>
    </Card>
  )
}
