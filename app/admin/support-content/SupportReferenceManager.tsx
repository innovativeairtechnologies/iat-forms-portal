'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Upload, Loader2, Trash2, ExternalLink } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  SUPPORT_REFERENCE_SLOTS,
  type SupportReferenceKey,
  type SupportReferencePhotos,
  type SupportReferenceSlot,
} from '@/lib/support-reference'
import { setSupportReferencePhoto } from './actions'

/* Reference-photo manager for the public support form's Wheel & Seals step.

   Files go straight from the browser to Supabase Storage (public `ticket-photos`
   bucket, `support-reference/` prefix) — the ~4.5MB Vercel function body limit
   makes a phone photo a real risk on any route-handler upload. Only the resulting
   URL travels through the server action. */

const BUCKET = 'ticket-photos'
const MAX_BYTES = 10 * 1024 * 1024

export function SupportReferenceManager({ initial }: { initial: SupportReferencePhotos }) {
  const router = useRouter()
  const [photos, setPhotos] = useState<SupportReferencePhotos>(initial)

  const apply = (slot: SupportReferenceSlot, url: string | undefined) => {
    setPhotos((p) => ({ ...p, [slot]: url }))
    router.refresh()
  }

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Operations</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">Support form</h1>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
            Reference photos shown to customers on the{' '}
            <a
              href="/support/equipment-support"
              target="_blank"
              rel="noreferrer"
              className="text-ink-secondary underline-offset-2 hover:text-brand-ink hover:underline"
            >
              equipment support form
              <ExternalLink size={11} className="ml-0.5 inline align-[-1px]" />
            </a>
            . A slot left empty shows a &ldquo;Photo coming soon&rdquo; placeholder, so you can add these
            whenever the images arrive.
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface">
          <div className="border-b border-hairline px-4 py-3 sm:px-5">
            <h2 className="text-[13px] font-semibold text-ink">Wheel &amp; Seals step</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              These sit side by side under &ldquo;What to look for&rdquo;. Landscape crops read best — they render at 4:3.
            </p>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {SUPPORT_REFERENCE_SLOTS.map((s) => (
              <SlotCard
                key={s.key}
                slotKey={s.key}
                slot={s.slot}
                caption={s.caption}
                help={s.help}
                url={photos[s.slot]}
                onChange={apply}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function SlotCard({
  slotKey,
  slot,
  caption,
  help,
  url,
  onChange,
}: {
  slotKey: SupportReferenceKey
  slot: SupportReferenceSlot
  caption: string
  help: string
  url?: string
  onChange: (slot: SupportReferenceSlot, url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const working = busy || pending

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    // Reset immediately so re-picking the same file still fires onChange.
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) return setError('That file isn’t an image.')
    if (file.size > MAX_BYTES) return setError('That image is over 10MB — please resize it first.')

    setError('')
    setBusy(true)
    void (async () => {
      try {
        const sb = createSupabaseBrowser()
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `support-reference/${slot}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { data, error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false })
        if (upErr || !data) throw new Error(upErr?.message || 'Upload failed.')

        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(data.path)
        const publicUrl = pub?.publicUrl
        if (!publicUrl) throw new Error('Could not resolve the uploaded image URL.')

        startTransition(async () => {
          try {
            await setSupportReferencePhoto(slotKey, publicUrl)
            onChange(slot, publicUrl)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save the photo.')
          }
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not upload that image.')
      } finally {
        setBusy(false)
      }
    })()
  }

  const clear = () => {
    setError('')
    startTransition(async () => {
      try {
        await setSupportReferencePhoto(slotKey, null)
        onChange(slot, undefined)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove the photo.')
      }
    })
    // The Storage object is left in place — cheap, and avoids needing delete perms.
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-ink">{caption}</p>
        {url && (
          <button
            type="button"
            onClick={clear}
            disabled={working}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
          >
            <Trash2 size={11} /> Remove
          </button>
        )}
      </div>

      {url ? (
        <div className="overflow-hidden rounded-xl border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption} className="aspect-[4/3] w-full bg-surface-strong object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline-strong bg-surface-strong text-ink-faint transition-colors hover:border-brand hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {working ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
          <span className="text-[11.5px] font-medium">{working ? 'Uploading…' : 'Add photo'}</span>
        </button>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {working ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {working ? 'Working…' : url ? 'Replace' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={working}
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{help}</p>
      {error && <p className="mt-1.5 text-[11.5px] text-rose-500">{error}</p>}
    </div>
  )
}
