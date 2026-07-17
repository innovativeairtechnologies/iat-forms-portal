'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, ScanLine, Check, AlertCircle } from 'lucide-react'
import { CRIB_CATEGORIES } from '@/lib/tool-crib'
import { resizeImage } from '@/lib/image-resize'
import ToolPhotos from '@/components/admin/ToolPhotos'

const EMPTY = {
  name: '',
  short_label: '',
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

type ScanState = 'idle' | 'scanning' | 'done' | 'error'

export default function AddToolModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scanMsg, setScanMsg] = useState('')
  const scanRef = useRef<HTMLInputElement | null>(null)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Photograph the label → Claude reads it → prefill. Never blocks: it only ever
  // fills fields the scan actually returned (scanned || prev), so a blank read
  // can't wipe something already typed, and everything stays editable after.
  const onScan = async (file: File | undefined) => {
    if (!file) return
    setScanState('scanning'); setScanMsg(''); setError('')
    try {
      const { dataUrl } = await resizeImage(file, { maxDim: 1600, quality: 0.8 })
      const res = await fetch('/api/admin/tool-crib/scan-nameplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setScanState('error')
        setScanMsg(d.error || 'Couldn’t read that label. Enter the details manually.')
        return
      }
      const filled = ['name', 'make', 'model', 'serial_number', 'category'].filter(k => d[k]).length
      if (filled === 0) {
        setScanState('error')
        setScanMsg('Couldn’t make out the details — enter them manually.')
        return
      }
      setForm(prev => ({
        ...prev,
        name: d.name || prev.name,
        make: d.make || prev.make,
        model: d.model || prev.model,
        serial_number: d.serial_number || prev.serial_number,
        category: d.category || prev.category,
      }))
      setScanState('done')
      setScanMsg(`Filled in ${filled} ${filled === 1 ? 'field' : 'fields'} — double-check them below.`)
    } catch (e) {
      setScanState('error')
      setScanMsg(e instanceof Error && e.message === 'decode failed'
        ? 'That image type can’t be read here — try a JPG or PNG.'
        : 'Label scan failed. Enter the details manually.')
    } finally {
      if (scanRef.current) scanRef.current.value = ''
    }
  }

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
        photo_urls: photos,
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
        <div className="flex items-start justify-between px-5 py-4 border-b border-hairline sticky top-0 bg-surface z-10">
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
          {/* Scan-the-label shortcut. Photograph a nameplate → prefill. */}
          <div>
            <button
              type="button"
              onClick={() => scanRef.current?.click()}
              disabled={scanState === 'scanning'}
              /* Solid border-brand, NOT border-brand/60 — an opacity modifier on
                 a semantic token compiles to nothing (§2.5 trap), which would drop
                 the border-color to inherited currentColor. */
              className="w-full flex items-center justify-center gap-2 h-11 text-[13px] font-semibold border border-dashed border-brand text-brand rounded-lg hover:bg-brand-soft transition-colors disabled:opacity-60"
            >
              {scanState === 'scanning'
                ? <><Loader2 size={15} className="animate-spin" /> Reading the label…</>
                : <><ScanLine size={15} /> Scan the tool’s label to fill this in</>}
            </button>
            {scanState === 'done' && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-brand">
                <Check size={12} /> {scanMsg}
              </p>
            )}
            {scanState === 'error' && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
                <AlertCircle size={12} /> {scanMsg}
              </p>
            )}
            <input
              ref={scanRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => onScan(e.target.files?.[0])}
            />
          </div>

          <Field label="Name">
            <input autoFocus value={form.name} onChange={set('name')} placeholder="Milwaukee 1/2in hammer drill" className={inputCx} />
          </Field>

          <Field label="Label descriptor" hint="2–3 words for the printed sticker, e.g. “Meter kit”. Falls back to the name if blank.">
            <input value={form.short_label} onChange={set('short_label')} maxLength={40} placeholder="Meter kit" className={inputCx} />
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

          <Field label="Photos" hint="The first one becomes the thumbnail in the list.">
            <ToolPhotos paths={photos} onChange={setPhotos} />
          </Field>

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
