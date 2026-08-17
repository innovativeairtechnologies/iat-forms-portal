'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2, Send, UserRound } from 'lucide-react'
import { Card, CardHead } from '@/components/admin/detail-ui'
import { RFQ_STATUSES, RFQ_STATUS_HELP, RFQ_STATUS_LABELS, type RfqStatus } from '@/lib/rfq-status'

/**
 * The only writable part of a survey: who owns it, where it has got to, and an
 * append-only note trail.
 *
 * Notes are NOT a textarea that saves over itself. Each one is posted, stamped
 * and attributed server-side, and nothing here can edit or delete an existing
 * one — a correction is a new note. That is what makes the trail worth reading
 * six months later when someone asks why we quoted what we quoted.
 *
 * router.refresh() after a write so the list behind and the sidebar badge follow.
 */

export type RfqNote = {
  id: string
  body: string
  author_name: string
  created_at: string
  /** 'staff' | 'customer' (migration 089). Optional so a row selected before the
   *  column existed still renders — it falls back to staff, which is what every
   *  pre-089 row was. */
  author_type?: string | null
}

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

function stamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit',
  })
}

export default function TriageCard({
  id, initialStatus, initialAssigneeId, roster, notes: initialNotes,
}: {
  id: string
  initialStatus: RfqStatus
  initialAssigneeId: string | null
  roster: { id: string; name: string }[]
  notes: RfqNote[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState<RfqStatus>(initialStatus)
  const [assignee, setAssignee] = useState<string>(initialAssigneeId ?? '')
  const [notes, setNotes] = useState<RfqNote[]>(initialNotes)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'status' | 'assignee' | 'note' | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/rfq/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save')
    return res.json()
  }

  const pickStatus = async (next: RfqStatus) => {
    if (next === status) return
    const previous = status
    setStatus(next)                 // optimistic — the click should feel instant
    setBusy('status'); setError('')
    try {
      await patch({ status: next })
      flash(); router.refresh()
    } catch (e) {
      setStatus(previous)           // put it back rather than show a lie
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(null) }
  }

  const pickAssignee = async (nextId: string) => {
    const previous = assignee
    setAssignee(nextId)
    setBusy('assignee'); setError('')
    try {
      await patch({ assignee_id: nextId || null })
      flash(); router.refresh()
    } catch (e) {
      setAssignee(previous)
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally { setBusy(null) }
  }

  const addNote = async () => {
    const body = draft.trim()
    if (!body) return
    setBusy('note'); setError('')
    try {
      const res = await fetch(`/api/admin/rfq/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save the note')
      const note = (await res.json()) as RfqNote
      // Newest first, matching the trail's order.
      setNotes(n => [note, ...n])
      setDraft('')
      flash(); router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the note')
    } finally { setBusy(null) }
  }

  return (
    <Card>
      <CardHead
        title="Triage"
        action={
          <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
            {busy ? (
              <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving…</span>
            ) : saved ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check size={12} /> Saved</span>
            ) : null}
          </span>
        }
      />

      <div className="space-y-4 px-5 py-4">
        {/* ── Owner ── */}
        <div>
          <label htmlFor={`assignee-${id}`} className="mb-1.5 block text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
            Assigned to
          </label>
          <div className="relative">
            <UserRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <select
              id={`assignee-${id}`}
              value={assignee}
              disabled={busy === 'assignee'}
              onChange={e => pickAssignee(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-8 text-[13px] text-zinc-800 outline-none transition-colors focus:border-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100"
            >
              <option value="">Nobody yet</option>
              {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          </div>
          {!assignee && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">
              Unassigned requests get chased to the shared desk daily until someone owns them.
            </p>
          )}
        </div>

        {/* ── Stage ── */}
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-400">Stage</p>
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
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${on ? TONE[s].on : `bg-transparent ${TONE[s].off}`}`}
                >
                  {RFQ_STATUS_LABELS[s]}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            {RFQ_STATUS_HELP[status]}
          </p>
        </div>

        {/* ── Note trail ──
            Mixed since migration 089: staff notes and customer messages sit on
            one list. The heading can no longer say "internal" — half the rows
            are not — so the privacy promise moved onto the composer, which is
            the only place it is still true. */}
        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">Notes &amp; messages</p>
          <p className="mb-2 text-[11.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            What you write here is internal — the customer never sees it. Entries are stamped and
            permanent; to correct one, add another.
          </p>

          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }}
            rows={3}
            placeholder="What you did, what you asked them, what the quote turned on…"
            className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-300 outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">⌘↵ to post</span>
            <button
              type="button"
              onClick={addNote}
              disabled={!draft.trim() || busy === 'note'}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'note' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Add note
            </button>
          </div>

          {error && <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}

          {/* Scrolls so a long history never pushes the rest of the rail away.
              The count above it is what tells you the clipped list continues —
              without it a cut-off third note just looks broken. */}
          {notes.length > 0 && (
            <p className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400 dark:text-zinc-500">
              {notes.length} note{notes.length === 1 ? '' : 's'} · newest first
            </p>
          )}
          {notes.length > 0 && (
            <ol className="max-h-[300px] space-y-2.5 overflow-y-auto pr-1">
              {notes.map(n => {
                // A customer message gets its own wash and a badge. Skimming a
                // mixed trail and mistaking their words for a colleague's is the
                // one failure this list must not allow — you would reply around
                // them as if they could not read it.
                const fromCustomer = n.author_type === 'customer'
                return (
                  <li
                    key={n.id}
                    className={`rounded-lg px-3 py-2.5 ${
                      fromCustomer
                        ? 'bg-sky-50/70 ring-1 ring-inset ring-sky-100 dark:bg-sky-500/[0.07] dark:ring-sky-500/20'
                        : 'bg-zinc-50 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-baseline gap-1.5 min-w-0">
                        <span className="truncate text-[11.5px] font-semibold text-zinc-700 dark:text-zinc-200">{n.author_name || 'Unknown'}</span>
                        {fromCustomer && (
                          <span className="flex-shrink-0 rounded-full bg-sky-100 px-1.5 py-px text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                            Customer
                          </span>
                        )}
                      </span>
                      <span className="flex-shrink-0 text-[10.5px] tabular-nums text-zinc-400 dark:text-zinc-500">{stamp(n.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">{n.body}</p>
                  </li>
                )
              })}
            </ol>
          )}
          {notes.length === 0 && (
            <p className="mt-3 text-[12px] text-zinc-400 dark:text-zinc-500">No notes yet.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
