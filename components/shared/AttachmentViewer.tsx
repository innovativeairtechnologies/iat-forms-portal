'use client'

import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

// Which note attachments can be shown inline in-browser (image or PDF). Office
// docs / zip / saved emails are NOT inlined — they keep forcing a download.
// Matches the safe set the /attachments/download route serves with an inline
// Content-Disposition. svg/html aren't accepted uploads, so this can never
// render active content.
const INLINE_VIEWABLE = /\.(png|jpe?g|gif|webp|pdf)$/i

export function isInlineViewable(name: string): boolean {
  return INLINE_VIEWABLE.test(name)
}

function attachmentHref(ticketId: string, path: string, name: string, inline: boolean): string {
  const base = `/api/tickets/${ticketId}/attachments/download?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`
  return inline ? `${base}&disposition=inline` : base
}

// In-app lightbox for image/PDF note attachments. Mirrors the email-preview
// modal pattern: fixed overlay, click-backdrop / Escape to close, and a Download
// affordance that still saves the original file. The media loads from the
// dual-auth-gated download route (with ?disposition=inline), so the private
// signed-URL + ownership gate are unchanged — nothing is made public.
export function AttachmentViewerModal({
  ticketId,
  att,
  onClose,
}: {
  ticketId: string
  att: { path: string; name: string }
  onClose: () => void
}) {
  const isPdf = /\.pdf$/i.test(att.name)
  const inlineHref = attachmentHref(ticketId, att.path, att.name, true)
  const downloadHref = attachmentHref(ticketId, att.path, att.name, false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-3">
          <span className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">{att.name}</span>
          <div className="flex flex-shrink-0 items-center gap-3">
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Download size={13} /> Download
            </a>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-950">
          {isPdf ? (
            <iframe src={inlineHref} title={att.name} className="h-[80vh] w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inlineHref} alt={att.name} className="mx-auto max-h-[85vh] w-auto object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}
