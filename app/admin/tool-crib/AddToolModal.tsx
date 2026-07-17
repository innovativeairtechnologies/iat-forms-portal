'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { CRIB_CATEGORIES } from '@/lib/tool-crib'

const EMPTY = {
  name: '',
  category: '' as string,
  make: '',
  model: '',
  serial_number: '',
  home_location: '',
  purchase_cost: '',
  purchase_date: '',
  notes: '',
}

const inputCx =
  // Focus is an outline, per DESIGN.md §5. Not a ring: an opacity modifier on a
  // semantic token compiles to nothing, so a ring kept its width and fell back to
  // Tailwind's default colour — these rings rendered blue for months. See §2.5.
  'w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none transition-all focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}

export default function AddToolModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.name.trim()) { setError('Give it a name.'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/tool-crib', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        purchase_date: form.purchase_date || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Could not add that tool.'); return }
    onClose()
    router.push(`/admin/tool-crib/${data.id}`)
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-hairline rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-hairline sticky top-0 bg-surface">
          <div>
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>Add a tool</h2>
            {/* The code is minted by the DB, not typed here — say so, or people
                will hunt for the field. */}
            <p className="text-[12px] text-ink-muted mt-0.5">
              Its label code is assigned automatically. Print the label next.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-secondary p-1 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Name">
            <input autoFocus value={form.name} onChange={set('name')} placeholder="Milwaukee 1/2in hammer drill" className={inputCx} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={set('category')} className={inputCx}>
                <option value="">—</option>
                {CRIB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Home location">
              <input value={form.home_location} onChange={set('home_location')} placeholder="Cage A · Shelf 3" className={inputCx} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Make"><input value={form.make} onChange={set('make')} placeholder="Milwaukee" className={inputCx} /></Field>
            <Field label="Model"><input value={form.model} onChange={set('model')} placeholder="2904-20" className={inputCx} /></Field>
          </div>

          <Field label="Serial number" hint="The manufacturer's serial — not the label code we assign.">
            <input value={form.serial_number} onChange={set('serial_number')} className={inputCx} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase cost" hint="Drives the $-on-the-floor total.">
              <input value={form.purchase_cost} onChange={set('purchase_cost')} type="number" min="0" step="0.01" placeholder="249.00" className={inputCx} />
            </Field>
            <Field label="Purchase date">
              <input value={form.purchase_date} onChange={set('purchase_date')} type="date" className={inputCx} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className={`${inputCx} h-auto py-2 resize-none`} />
          </Field>

          {error && <p className="text-[12.5px] text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-brand hover:bg-brand-hover text-brand-ink rounded-lg transition-colors disabled:opacity-60">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Adding…' : 'Add tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
