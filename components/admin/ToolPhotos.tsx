'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X, Loader2, Wrench } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { resizeImage } from '@/lib/image-resize'
import { photoSrc } from '@/lib/tool-crib'

/* Add / remove tool photos. Stores storage PATHS (the crib-photos bucket is
   private); the parent decides when to persist them — AddToolModal includes them
   in the create POST, the detail page PATCHes on change.

   CONTROLLED: this renders straight from the `paths` prop and owns no copy of
   the list. That's deliberate — an earlier version seeded an internal list once
   and drifted from the parent, so a save that failed (and reverted the parent)
   left this grid showing the un-saved state, and the next save silently
   committed it. With the parent as the single source of truth, a revert flows
   straight back into the grid.

   Freshly-uploaded photos preview from a local object URL (instant, and works
   during Add Tool before the row exists), keyed by path in a ref so the preview
   survives re-renders and a failed-save revert. Persisted paths preview through
   photoSrc(). */

const MAX = 4

export default function ToolPhotos({
  paths,
  onChange,
  disabled,
}: {
  paths: string[]
  onChange: (paths: string[]) => void
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  // path → local object URL for fresh uploads. Kept in a ref so it persists
  // across renders (and across a failed-save revert). Revoked only on unmount —
  // NOT on remove, because a removed path can come back if the save fails.
  const freshUrls = useRef<Map<string, string>>(new Map())
  useEffect(() => () => { freshUrls.current.forEach(URL.revokeObjectURL) }, [])

  const previewFor = (path: string) => freshUrls.current.get(path) ?? photoSrc(path)

  const add = async (file: File | undefined) => {
    if (!file) return
    if (paths.length >= MAX) { setError(`Up to ${MAX} photos.`); return }
    setBusy(true); setError('')
    try {
      // Downscale before upload — a 12MB phone original is wasteful for a
      // thumbnail and slow to sign/serve.
      const { blob } = await resizeImage(file, { maxDim: 1600, quality: 0.85 })

      const urlRes = await fetch('/api/admin/tool-crib/photo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'photo.jpg', size: blob.size }),
      })
      const urlJson = await urlRes.json().catch(() => ({}))
      if (!urlRes.ok) { setError(urlJson.error || 'Could not start upload.'); return }

      const sb = createSupabaseBrowser()
      const { error: upErr } = await sb.storage
        .from('crib-photos')
        .uploadToSignedUrl(urlJson.path, urlJson.token, blob, { contentType: 'image/jpeg' })
      if (upErr) { setError(upErr.message || 'Upload failed.'); return }

      freshUrls.current.set(urlJson.path, URL.createObjectURL(blob))
      onChange([...paths, urlJson.path])
    } catch (e) {
      setError(e instanceof Error && e.message === 'decode failed'
        ? 'That image type can’t be read here — try a JPG or PNG.'
        : 'Could not add that photo.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = '' // allow re-picking the same file
    }
  }

  // Dropping the path orphans the storage object (invisible, harmless), same as
  // the equipment photo pattern. No delete call — avoids nuking a blob that might
  // be referenced elsewhere, and lets a failed-save revert bring it back.
  const remove = (path: string) => onChange(paths.filter(p => p !== path))

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {paths.map(path => (
          <div key={path} className="relative w-20 h-20 rounded-lg overflow-hidden border border-hairline bg-surface-soft group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewFor(path)} alt="Tool" className="w-full h-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(path)}
                className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {paths.length < MAX && !disabled && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-20 h-20 rounded-lg border border-dashed border-hairline-strong flex flex-col items-center justify-center gap-1 text-ink-faint hover:text-ink-muted hover:border-ink-faint transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            <span className="text-[10px]">{busy ? 'Adding…' : 'Add photo'}</span>
          </button>
        )}
      </div>

      {paths.length === 0 && !busy && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Wrench size={11} /> No photo yet — the first one becomes the thumbnail.
        </p>
      )}

      {error && <p className="mt-1.5 text-[12px] text-rose-500">{error}</p>}

      {/* capture="environment" opens the rear camera on a phone; drops to a file
          picker on desktop. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => add(e.target.files?.[0])}
      />
    </div>
  )
}
