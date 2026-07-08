'use client'

import { useState } from 'react'
import {
  ChevronRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown,
  Save, Loader2, CheckCircle2, AlertTriangle, ClipboardCheck, Info,
} from 'lucide-react'
import type { SrvSection } from '@/lib/srv'

const INPUT =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-zinc-700 dark:text-zinc-200 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all'
const LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500'

// Stable, unique key for a newly-added item/reading/photo/group. The key never
// changes once created (only labels do), so submission data stays addressable;
// the random suffix keeps it unique and the save API re-checks uniqueness.
function genKey(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function IconBtn({ onClick, title, disabled, children }: { onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {children}
    </button>
  )
}

export default function SrvEditor({ initialSections }: { initialSections: SrvSection[] }) {
  const [defs, setDefs] = useState<SrvSection[]>(() => structuredClone(initialSections))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mutate = (fn: (draft: SrvSection[]) => void) => {
    setDefs((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
    setDirty(true)
    setSaved(false)
    setError(null)
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/srv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: defs }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to save.')
        return
      }
      setDirty(false)
      setSaved(true)
    } catch {
      setError('Failed to save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">IAT</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">SRV Form</span>
        </div>
        <div className="flex items-center gap-3">
          {saved && !dirty && <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={14} /> Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-9 rounded-lg disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-3xl">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">Start-Up Readiness Verification</h1>
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Edit the checklist items, readings, and photos in each section. Changes go live for customers at
            <span className="font-mono text-[12px]"> /customer/srv</span> as soon as you save.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info size={15} className="mt-0.5 flex-shrink-0" />
          <p>
            The <strong>10 sections</strong> and the 3D unit are fixed — you&apos;re editing the items inside each one.
            Adding an item is safe. <strong>Renaming</strong> an item changes how it&apos;s stored, so answers on past
            submissions for that item won&apos;t show anymore (new submissions are fine).
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[13px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-4 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {defs.map((section, si) => {
            const open = expanded.has(section.key)
            const itemCount = section.groups.reduce((n, g) => n + g.items.length, 0)
            return (
              <div key={section.key} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/70 transition-colors"
                >
                  {open ? <ChevronDown size={16} className="flex-shrink-0 text-zinc-400" /> : <ChevronRight size={16} className="flex-shrink-0 text-zinc-400" />}
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-zinc-100 px-1.5 text-[12px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{section.number}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-zinc-900 dark:text-white truncate">{section.title || 'Untitled section'}</span>
                    <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">
                      {itemCount} item{itemCount === 1 ? '' : 's'}
                      {section.readings?.length ? ` · ${section.readings.length} reading${section.readings.length === 1 ? '' : 's'}` : ''}
                      {section.photos.length ? ` · ${section.photos.length} photo${section.photos.length === 1 ? '' : 's'}` : ''}
                      {section.conditional ? ' · conditional' : ''}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-4 space-y-5">
                    {/* Section meta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={LABEL}>Section title</label>
                        <input className={INPUT} value={section.title} onChange={(e) => mutate((d) => { d[si].title = e.target.value })} />
                      </div>
                      <div>
                        <label className={LABEL}>Short name (3D chip)</label>
                        <input className={INPUT} value={section.shortTitle} onChange={(e) => mutate((d) => { d[si].shortTitle = e.target.value })} />
                      </div>
                      <div>
                        <label className={LABEL}>Location hint</label>
                        <input className={INPUT} value={section.locationHint} onChange={(e) => mutate((d) => { d[si].locationHint = e.target.value })} />
                      </div>
                    </div>
                    {section.conditional && (
                      <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                        Only shown when the customer confirms: <span className="italic">{section.conditional.question}</span> (this condition is fixed)
                      </p>
                    )}

                    {/* Groups + items */}
                    <div className="space-y-4">
                      {section.groups.map((group, gi) => (
                        <div key={gi} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
                          <div className="flex items-center gap-2 mb-2.5">
                            <input
                              className={`${INPUT} text-[12px] font-semibold`}
                              placeholder="Group heading (optional)"
                              value={group.title || ''}
                              onChange={(e) => mutate((d) => { d[si].groups[gi].title = e.target.value || undefined })}
                            />
                            <IconBtn title="Remove group" onClick={() => mutate((d) => { d[si].groups.splice(gi, 1) })} disabled={section.groups.length <= 1}>
                              <Trash2 size={14} />
                            </IconBtn>
                          </div>
                          <div className="space-y-1.5">
                            {group.items.map((item, ii) => (
                              <div key={item.key} className="flex items-center gap-1.5">
                                <input
                                  className={INPUT}
                                  placeholder="Checklist item (Pass / Fail)"
                                  value={item.label}
                                  onChange={(e) => mutate((d) => { d[si].groups[gi].items[ii].label = e.target.value })}
                                />
                                <label className="flex flex-shrink-0 items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400" title="Allow an N/A answer for this item">
                                  <input
                                    type="checkbox"
                                    className="accent-emerald-600"
                                    checked={!!item.naAllowed}
                                    onChange={(e) => mutate((d) => { d[si].groups[gi].items[ii].naAllowed = e.target.checked || undefined })}
                                  />
                                  N/A
                                </label>
                                <IconBtn title="Move up" onClick={() => mutate((d) => { const a = d[si].groups[gi].items; if (ii > 0) [a[ii - 1], a[ii]] = [a[ii], a[ii - 1]] })} disabled={ii === 0}><ArrowUp size={13} /></IconBtn>
                                <IconBtn title="Move down" onClick={() => mutate((d) => { const a = d[si].groups[gi].items; if (ii < a.length - 1) [a[ii + 1], a[ii]] = [a[ii], a[ii + 1]] })} disabled={ii === group.items.length - 1}><ArrowDown size={13} /></IconBtn>
                                <IconBtn title="Remove item" onClick={() => mutate((d) => { d[si].groups[gi].items.splice(ii, 1) })}><Trash2 size={13} /></IconBtn>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => mutate((d) => { d[si].groups[gi].items.push({ key: genKey('item'), label: '' }) })}
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                          >
                            <Plus size={13} /> Add item
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => mutate((d) => { d[si].groups.push({ items: [{ key: genKey('item'), label: '' }] }) })}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400"
                      >
                        <Plus size={13} /> Add group
                      </button>
                    </div>

                    {/* Readings */}
                    <div>
                      <p className={LABEL}>Recorded readings</p>
                      <div className="space-y-1.5">
                        {(section.readings || []).map((reading, ri) => (
                          <div key={reading.key} className="flex items-center gap-1.5">
                            <input className={INPUT} placeholder="Reading name (e.g. L1–L2 voltage)" value={reading.label} onChange={(e) => mutate((d) => { d[si].readings![ri].label = e.target.value })} />
                            <input className={`${INPUT} w-24 flex-shrink-0`} placeholder="unit" value={reading.unit} onChange={(e) => mutate((d) => { d[si].readings![ri].unit = e.target.value })} />
                            <IconBtn title="Remove reading" onClick={() => mutate((d) => { d[si].readings!.splice(ri, 1); if (d[si].readings!.length === 0) delete d[si].readings })}><Trash2 size={13} /></IconBtn>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => mutate((d) => { (d[si].readings ||= []).push({ key: genKey('reading'), label: '', unit: '' }) })}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                      >
                        <Plus size={13} /> Add reading
                      </button>
                    </div>

                    {/* Photos */}
                    <div>
                      <p className={LABEL}>Recommended photos</p>
                      <div className="space-y-1.5">
                        {section.photos.map((photo, pi) => (
                          <div key={photo.key} className="flex items-center gap-1.5">
                            <input className={INPUT} placeholder="Photo name (e.g. Nameplate)" value={photo.label} onChange={(e) => mutate((d) => { d[si].photos[pi].label = e.target.value })} />
                            <IconBtn title="Remove photo" onClick={() => mutate((d) => { d[si].photos.splice(pi, 1) })}><Trash2 size={13} /></IconBtn>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => mutate((d) => { d[si].photos.push({ key: genKey('photo'), label: '' }) })}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                      >
                        <Plus size={13} /> Add photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-1 pb-6">
          Saved changes are recorded in the Audit Log and sync to the SRV form&apos;s fields automatically.
        </p>
      </div>
    </div>
  )
}
