'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Plus, X } from 'lucide-react'

/* Log a piece of work that has no job behind it.
 *
 * This is the smallest, most important form in the section. The workbook's
 * un-highlighted rows — Sales Support, Testing Support, Training, R&D — are 20%
 * of a mechanical engineer's Monday-to-Wednesday and all of the reason a 60-hour
 * week can produce nothing you can point at. If logging that work is any harder
 * than a job number, nobody logs it, and "where did the week go" goes back to
 * being unanswerable.
 *
 * So: one line, four fields, no job required.
 */

const FIELD =
  'h-9 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-faint ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors disabled:opacity-50'

export default function AddSupportTask({ assignees }: { assignees: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Give it a name.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/engineering/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream: 'support',
          title: title.trim(),
          assignee_id: assignee || null,
          due_date: due || null,
          target_hours: hours === '' ? null : Number(hours),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || `Could not add it (HTTP ${res.status}).`); setSaving(false); return }
      setTitle(''); setAssignee(''); setDue(''); setHours(''); setOpen(false); setSaving(false)
      router.refresh()
    } catch (err) { setError(String(err)); setSaving(false) }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink"
      >
        <Plus size={14} /> Log other work
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        className={`${FIELD} w-56`}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Sales support — DriveWorks model"
        disabled={saving}
        autoFocus
        aria-label="What is it"
      />
      <select className={`${FIELD} w-36`} value={assignee} onChange={e => setAssignee(e.target.value)} disabled={saving} aria-label="Owner">
        <option value="">Unassigned</option>
        {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input type="date" className={`${FIELD} w-36 tabular-nums`} value={due} onChange={e => setDue(e.target.value)} disabled={saving} aria-label="Due" />
      <input
        type="number" step="0.25" min="0"
        className={`${FIELD} w-20 tabular-nums`}
        value={hours} onChange={e => setHours(e.target.value)}
        placeholder="hrs" disabled={saving} aria-label="Target hours"
      />
      <button type="submit" disabled={saving}
        className="h-9 rounded-lg bg-brand px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
        {saving ? 'Adding…' : 'Add'}
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(null) }} disabled={saving}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-ink-faint transition-colors hover:text-ink">
        <X size={15} />
      </button>
      {error && (
        <p className="flex w-full items-center gap-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </form>
  )
}
