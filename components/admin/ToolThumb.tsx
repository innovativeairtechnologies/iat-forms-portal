'use client'

import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { photoSrc } from '@/lib/tool-crib'

/* Read-only tool thumbnail for lists, detail headers and the scan page. Falls
   back to a wrench chip when the tool has no photo or the image fails to load.

   Split out from ToolPhotos (the editor) so the list — the most-loaded page —
   doesn't pull the uploader, supabase-browser and the resize canvas into its
   bundle just to show a thumbnail. */
export function ToolThumb({
  path, size = 28, rounded = 'rounded-lg',
}: {
  path: string | null
  size?: number
  rounded?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!path || failed) {
    return (
      <span
        className={`${rounded} bg-surface-soft border border-hairline flex items-center justify-center flex-shrink-0 text-ink-faint`}
        style={{ width: size, height: size }}
      >
        <Wrench size={Math.round(size * 0.5)} strokeWidth={1.8} />
      </span>
    )
  }

  return (
    <span className={`${rounded} overflow-hidden border border-hairline flex-shrink-0 bg-surface-soft`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoSrc(path)} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </span>
  )
}
