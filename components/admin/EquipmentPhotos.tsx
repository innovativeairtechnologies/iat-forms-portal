'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Upload, Loader2, Trash2 } from 'lucide-react'
import { Card, CardHead } from '@/components/admin/detail-ui'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

/* Build & QC photos for a unit. Admin uploads here; the same `equipment.photo_urls`
   array renders on the customer portal. Files go straight to Supabase Storage from
   the browser (public `ticket-photos` bucket, `equipment/` prefix) to avoid the
   ~4.5MB function body limit, then we PATCH the URL list onto the equipment row. */
export default function EquipmentPhotos({
  equipmentId,
  serial,
  initial,
}: {
  equipmentId: string
  serial: string
  initial: string[]
}) {
  const router = useRouter()
  const [photos, setPhotos] = useState<string[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const persist = async (next: string[]) => {
    const res = await fetch(`/api/equipment/${equipmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_urls: next.length ? next : null }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not save photos.')
      return false
    }
    return true
  }

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return
    setBusy(true)
    setError('')
    const sb = createSupabaseBrowser()
    const added: string[] = []
    const failed: string[] = []
    const safeSerial = serial.replace(/[^a-zA-Z0-9_-]/g, '') || 'unit'
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        failed.push(file.name)
        continue
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const filename = `equipment/${safeSerial}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error: upErr } = await sb.storage.from('ticket-photos').upload(filename, file, { upsert: false })
      if (upErr || !data) {
        failed.push(file.name)
        continue
      }
      const { data: pub } = sb.storage.from('ticket-photos').getPublicUrl(data.path)
      if (pub?.publicUrl) added.push(pub.publicUrl)
      else failed.push(file.name)
    }
    if (added.length) {
      const next = [...photos, ...added]
      if (await persist(next)) {
        setPhotos(next)
        router.refresh()
      }
    }
    if (failed.length) setError(`Couldn't upload ${failed.length} file${failed.length === 1 ? '' : 's'} — images only.`)
    setBusy(false)
  }

  const remove = async (url: string) => {
    const next = photos.filter((p) => p !== url)
    if (await persist(next)) {
      setPhotos(next)
      router.refresh()
    }
    // The storage object is left in place (cheap; avoids needing delete perms).
  }

  return (
    <Card>
      <CardHead
        title="Photos"
        icon={<ImageIcon size={14} />}
        action={
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {busy ? 'Uploading…' : 'Upload'}
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
        }
      />
      <div className="p-4">
        <p className="mb-3 text-[11.5px] text-zinc-400">Build &amp; QC photos — shown on the customer&apos;s portal.</p>
        {photos.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-700 dark:hover:bg-zinc-800/40">
            <ImageIcon size={20} className="text-zinc-300 dark:text-zinc-600" />
            <span className="text-[12px] text-zinc-400">Add build &amp; QC photos</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => remove(url)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                  title="Remove photo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
      </div>
    </Card>
  )
}
