'use client'

/**
 * SRV section panel — opens when a hotspot on the 3D unit is tapped.
 * Bottom sheet on mobile, right slide-over on desktop. One tap per checklist
 * item (Pass / Fail / N/A), reading inputs with unit suffixes, and photo tiles
 * that open the camera on mobile and upload straight to storage.
 */

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Camera, Loader2, RotateCcw, AlertTriangle } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  type SrvSection, type SrvSectionAnswers, type SrvItemAnswer,
  sectionProgress,
} from '@/lib/srv'

const ANSWER_BUTTONS: Array<{ value: SrvItemAnswer; label: string; active: string }> = [
  { value: 'pass', label: 'Pass', active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'fail', label: 'Fail', active: 'bg-red-600 text-white border-red-600' },
  { value: 'na', label: 'N/A', active: 'bg-zinc-500 text-white border-zinc-500' },
]

function PhotoTile({
  label, url, onUploaded,
}: {
  label: string
  url: string | undefined
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      // Signed-URL flow: tiny JSON request to the server, then the photo bytes
      // go straight to storage (Vercel's ~4.5MB function body limit never sees them).
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const sb = createSupabaseBrowser()
      const { error: upErr } = await sb.storage
        .from('form-uploads')
        .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined })
      if (upErr) throw new Error(upErr.message || 'Upload failed')
      onUploaded(data.url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 transition-colors ${
          url
            ? 'border-emerald-500/60'
            : 'border-dashed border-zinc-300 hover:border-emerald-500 dark:border-zinc-700'
        }`}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              <RotateCcw size={10} /> Retake
            </span>
          </>
        ) : uploading ? (
          <Loader2 size={20} className="animate-spin text-emerald-600" />
        ) : (
          <Camera size={20} className="text-zinc-400" />
        )}
      </button>
      <p className="mt-1 text-center text-[11px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">{label}</p>
      {error && <p className="mt-0.5 text-center text-[10px] text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function SectionPanel({
  section, answers, onChange, onClose,
}: {
  section: SrvSection
  answers: SrvSectionAnswers
  // Functional updates: photo uploads finish asynchronously and taps can land
  // inside one React batch — building `next` from the rendered prop would drop
  // whichever update ran second.
  onChange: (update: (prev: SrvSectionAnswers) => SrvSectionAnswers) => void
  onClose: () => void
}) {
  const prog = sectionProgress(section, answers)

  const setItem = (key: string, value: SrvItemAnswer) => {
    onChange((a) => ({ ...a, items: { ...a.items, [key]: value } }))
  }
  const setReading = (key: string, value: string) => {
    onChange((a) => ({ ...a, readings: { ...(a.readings || {}), [key]: value } }))
  }
  const setPhoto = (key: string, url: string) => {
    onChange((a) => ({ ...a, photos: { ...a.photos, [key]: url } }))
  }

  return (
    <>
      {/* Scrim (mobile only — desktop keeps the unit visible beside the panel) */}
      <div className="fixed inset-0 z-40 bg-black/25 md:hidden" onClick={onClose} />

      <motion.div
        initial={{ y: '100%', x: 0 }}
        animate={{ y: 0, x: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 text-[13px] font-bold text-emerald-600">
            {section.number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold leading-tight text-zinc-900 dark:text-white">{section.title}</h2>
            <p className="mt-0.5 text-[12px] text-zinc-400">{section.locationHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            aria-label="Close section"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {section.groups.map((group, gi) => (
            <div key={gi} className="pt-4">
              {group.title && (
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const current = answers.items[item.key]
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <p className="flex-1 text-[13px] leading-snug text-zinc-700 dark:text-zinc-200">{item.label}</p>
                      <div className="flex flex-shrink-0 gap-1">
                        {ANSWER_BUTTONS.filter((b) => b.value !== 'na' || item.naAllowed).map((b) => (
                          <button
                            key={b.value}
                            type="button"
                            onClick={() => setItem(item.key, b.value)}
                            className={`h-7 rounded-md border px-2 text-[11px] font-bold transition-colors ${
                              current === b.value
                                ? b.active
                                : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {section.readings && section.readings.length > 0 && (
            <div className="pt-4">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Recorded readings
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {section.readings.map((r) => (
                  <label key={r.key} className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{r.label}</span>
                    <div className="relative">
                      <input
                        inputMode="decimal"
                        value={answers.readings?.[r.key] ?? ''}
                        onChange={(e) => setReading(r.key, e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-3 pr-9 text-[14px] font-semibold tabular-nums text-zinc-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-zinc-400">
                        {r.unit}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {section.photos.length > 0 && (
            <div className="pt-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Required photos <span className="ml-1 normal-case tracking-normal text-zinc-300 dark:text-zinc-600">{prog.photosDone}/{prog.photosTotal}</span>
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                {section.photos.map((p) => (
                  <PhotoTile key={p.key} label={p.label} url={answers.photos[p.key]} onUploaded={(u) => setPhoto(p.key, u)} />
                ))}
              </div>
            </div>
          )}

          {prog.failures > 0 && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-400">
                <AlertTriangle size={13} /> {prog.failures} failed item{prog.failures === 1 ? '' : 's'}
              </p>
              <textarea
                value={answers.notes || ''}
                onChange={(e) => onChange((a) => ({ ...a, notes: e.target.value }))}
                placeholder="Briefly describe what's outstanding — this is what we'll help you resolve before start-up."
                rows={2}
                className="w-full rounded-lg border border-red-200 bg-white p-2.5 text-[13px] text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-red-400 dark:border-red-900/50 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className={`h-11 w-full rounded-xl text-[14px] font-bold transition-colors ${
              prog.complete
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {prog.complete
              ? 'Section complete — back to unit'
              : `${prog.answered + prog.photosDone + prog.readingsDone}/${prog.total + prog.photosTotal + prog.readingsTotal} done — back to unit`}
          </button>
        </div>
      </motion.div>
    </>
  )
}
