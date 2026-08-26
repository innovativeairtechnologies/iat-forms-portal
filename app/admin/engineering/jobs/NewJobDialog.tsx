'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, X } from 'lucide-react'
import { COMPLEXITIES, COMPLEXITY_LABELS, addDays, type Complexity } from '@/lib/engineering'

/* Open a job.
 *
 * Four fields carry weight and the rest are optional, which is the point: the
 * meeting's complaint was that starting a job meant a round of manual task
 * creation, and a form long enough to put people off is the same problem wearing
 * a different hat.
 *
 * ── The PO date is the anchor, and the form says so out loud ────────────────
 * Every generated due date is the PO date plus the playbook's cycle days. Leave
 * it blank and the plan still generates — but with NO dates, because a job
 * back-entered three weeks after its PO would otherwise arrive with a fortnight
 * of runway starting today and sit on the board looking comfortable while it is
 * already late. The preview line under the field is there so nobody discovers
 * that on the job detail page.
 */

const LABEL = 'block text-[11px] font-semibold uppercase tracking-[0.055em] text-ink-muted mb-1.5'
const INPUT =
  'w-full h-9 px-3 rounded-lg border border-hairline bg-surface text-[13px] text-ink placeholder:text-ink-faint ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand transition-colors'

export default function NewJobDialog({
  onClose, onCreated, preview,
}: {
  onClose: () => void
  onCreated: (id: string, generated: number, generateError: string | null) => void
  /** Cycle days read from the LIVE playbook, never hardcoded here. The whole
   *  point of the playbook is that James edits it; a preview quoting a baked-in
   *  "two weeks" would go on saying that after he changed it to ten days, and a
   *  form that lies about what it is about to do is worse than one that says
   *  nothing. A step with no cycle time set is dropped from the list rather than
   *  shown with a date the generator will not actually produce. */
  preview: { label: string; cycleDays: number | null }[]
}) {
  const [form, setForm] = useState({
    job_number: '', customer_name: '', project_name: '', model_number: '',
    complexity: 'std_minor' as Complexity,
    po_date: new Date().toISOString().slice(0, 10),
    ship_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const dated = preview.filter(p => p.cycleDays != null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.job_number.trim()) { setError('A job number is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/engineering/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || `Could not create the job (HTTP ${res.status}).`); setSaving(false); return }
      onCreated(data.job.id, data.generated ?? 0, data.generateError ?? null)
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_8px_24px_rgba(31,30,27,.10),0_2px_6px_rgba(31,30,27,.05)] dark:shadow-none dark:ring-1 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">Open a job</h2>
          <button type="button" onClick={onClose} disabled={saving} className="text-ink-faint hover:text-ink transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="job_number">Job number *</label>
              <input id="job_number" className={`${INPUT} tabular-nums`} value={form.job_number} onChange={set('job_number')} placeholder="4153" autoFocus required />
            </div>
            <div>
              <label className={LABEL} htmlFor="complexity">Complexity</label>
              <select id="complexity" className={INPUT} value={form.complexity} onChange={set('complexity')}>
                {COMPLEXITIES.map(c => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="customer_name">Customer</label>
            <input id="customer_name" className={INPUT} value={form.customer_name} onChange={set('customer_name')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="project_name">Project</label>
              <input id="project_name" className={INPUT} value={form.project_name} onChange={set('project_name')} />
            </div>
            <div>
              <label className={LABEL} htmlFor="model_number">Model</label>
              <input id="model_number" className={`${INPUT} tabular-nums`} value={form.model_number} onChange={set('model_number')} placeholder="3000RGHC-IDP" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="po_date">PO date</label>
              <input id="po_date" type="date" className={`${INPUT} tabular-nums`} value={form.po_date} onChange={set('po_date')} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ship_date">Target ship</label>
              <input id="ship_date" type="date" className={`${INPUT} tabular-nums`} value={form.ship_date} onChange={set('ship_date')} />
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-soft px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.055em] text-ink-muted">
              <CalendarDays size={12} /> What happens when you save
            </p>
            {form.po_date ? (
              <div className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-ink-secondary">
                <p>
                  The full plan generates from the scheduling rules — submittals, long-lead items, BOM, production and
                  electrical — with every date counted forward from the PO date.
                </p>
                {dated.length > 0 && (
                  <ul className="space-y-1 pt-0.5">
                    {dated.map(p => (
                      <li key={p.label} className="flex items-baseline gap-2">
                        <span className="flex-shrink-0 text-ink-muted">{p.label}</span>
                        <span className="flex-1 border-b border-dashed border-hairline" />
                        <span className="flex-shrink-0 font-medium tabular-nums text-ink">
                          {new Date(`${addDays(form.po_date, p.cycleDays as number)}T12:00:00`)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                Without a PO date the tasks are still created, but with <strong className="font-semibold">no due dates</strong> —
                there is nothing to count from. Add the date later and use “Re-date from PO” on the job.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 dark:bg-rose-500/10">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving}
            className="h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="h-8 px-3.5 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover transition-colors disabled:opacity-50">
            {saving ? 'Opening…' : 'Open job & generate plan'}
          </button>
        </div>
      </form>
    </div>
  )
}
