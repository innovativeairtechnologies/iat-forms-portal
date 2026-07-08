'use client'

// Jerry — IAT's AI assistant. A living "presence" (animated orb) that answers
// from grounded context (equipment + IAT's documentation, RAG) and cites the
// source (document + page). Shared shell used by both the customer dashboard
// (/api/customer/assistant) and the admin ticket detail page
// (/api/admin/tickets/[id]/assistant) — each caller supplies its own endpoint,
// suggestion chips, idle subtitle, and footer note. Deliberately not a
// chat-bubble bot: a breathing orb, typeset answers, and cited "receipts".
//
// Attachments (internal Jerry only): when `allowAttachments` is set, a staff
// member can attach a photo or PDF (paperclip, drag-drop, or paste) for Jerry to
// look at and help diagnose — the "like ChatGPT" flow. Images are downscaled in
// the browser (long edge ≤ 1568px, re-encoded JPEG) so payloads stay well under
// Vercel's ~4.5MB function-body limit and cost less; PDFs pass through as-is up
// to a size cap. The route turns them into vision content blocks.

import { useEffect, useRef, useState } from 'react'
import { Sparkles, FileText, Loader2, ArrowUp, ArrowLeft, Paperclip, X } from 'lucide-react'
import type { KbSource } from '@/lib/kb-rag'

const CARD = 'rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none'

// One staged/sent file. `data` is base64 WITHOUT the data-URL prefix (what the
// Anthropic content block wants); `mediaType` is the block's media_type.
type Attachment = { kind: 'image' | 'pdf'; mediaType: string; data: string; name: string }

type ChatMsg = { role: 'user' | 'assistant'; content: string; sources?: KbSource[]; attachments?: Attachment[] }

export type JerryWidgetProps = {
  apiEndpoint: string
  suggestions: string[]
  idleSubtitle: string
  footerNote: string
  /** Stretch to fill the parent's height instead of the fixed card sizing —
   *  used by the standalone /admin/jerry page so it reads as a full chat
   *  surface (composer pinned at the bottom) rather than a sidebar widget. */
  fullHeight?: boolean
  /** Enable photo/PDF attachments (internal Jerry only). Off for the customer
   *  assistant, whose route doesn't accept them. */
  allowAttachments?: boolean
}

// ── attachment limits (client-side; the route re-validates) ───────────────────
const MAX_ATTACHMENTS = 4
const IMG_MAX_EDGE = 1568 // Claude's vision sweet spot (Sonnet 4.6 long-edge)
const IMG_QUALITY = 0.82
const MAX_PDF_BYTES = 4 * 1024 * 1024 // 4MB per PDF
const MAX_TOTAL_BYTES = 3.8 * 1024 * 1024 // keep the whole request under Vercel's ~4.5MB cap
const ACCEPTED = 'image/*,application/pdf'

const b64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4)
const dataUrl = (a: Attachment) => `data:${a.mediaType};base64,${a.data}`

/** Read a File to base64 (no data-URL prefix). Used for PDFs (kept as-is). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

/** Downscale an image to a JPEG whose long edge is ≤ IMG_MAX_EDGE, returned as
 *  base64. Keeps phone photos small and predictable for the API. */
function downscaleImage(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, IMG_MAX_EDGE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, w, h)
      const data = canvas.toDataURL('image/jpeg', IMG_QUALITY).split(',')[1] || ''
      resolve({ kind: 'image', mediaType: 'image/jpeg', data, name: file.name || 'photo.jpg' })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    img.src = url
  })
}

// Jerry's small "presence" — the abstract emerald orb (halo + spinning ring + glowing
// core + orbiting sparks). Scales with `px`; speeds up while `thinking`. Used in the
// header and beside each answer. The big idle hero uses <JerryFigure/> (the bobblehead).
function Orb({ px, thinking = false, className = '' }: { px: number; thinking?: boolean; className?: string }) {
  return (
    <span
      className={`jerry-orb ${thinking ? 'is-thinking' : ''} ${className}`}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      <span className="jerry-halo" />
      <span className="jerry-ring" />
      <span className="jerry-core" />
      <span className="jerry-head-thumb" />
      <span className="jerry-orbit"><i /></span>
      <span className="jerry-orbit jerry-orbit2"><i /></span>
      <span className="jerry-spark"><Sparkles size={Math.max(8, Math.round(px * 0.26))} strokeWidth={2.2} /></span>
    </span>
  )
}

// Jerry's full bobblehead — the founder he's named for — standing with a soft emerald
// aura + ground shadow, gently bobbing and floating. The idle hero "presence."
function JerryFigure() {
  return (
    <div className="jerry-figure" aria-hidden="true">
      <span className="jerry-figure-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="jerry-figure-img" src="/jerry-bobble.webp" alt="" />
      <span className="jerry-figure-shadow" />
    </div>
  )
}

// A row of attachment thumbnails — used both for staged files (with a remove
// button) and for the files shown inside a sent user message (read-only).
function AttachmentThumbs({ items, onRemove }: { items: Attachment[]; onRemove?: (i: number) => void }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((a, i) => (
        <span
          key={i}
          className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-zinc-200 bg-white pr-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          title={a.name}
        >
          {a.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl(a)} alt={a.name} className="h-9 w-9 flex-shrink-0 object-cover" />
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-rose-50 text-rose-500 dark:bg-rose-500/10">
              <FileText size={15} />
            </span>
          )}
          <span className="max-w-[120px] truncate py-1">{a.name}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove ${a.name}`}
              className="ml-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 transition-colors hover:bg-rose-500 hover:text-white dark:bg-zinc-700 dark:text-zinc-300"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

export default function JerryWidget({
  apiEndpoint,
  suggestions,
  idleSubtitle,
  footerNote,
  fullHeight = false,
  allowAttachments = false,
}: JerryWidgetProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // While Jerry is thinking, keep the "reading…" row in view (scroll to bottom).
  // When his answer lands, jump to the TOP of that answer so a long reply reads
  // from the beginning instead of dropping the reader at the very end.
  useEffect(() => {
    const c = scrollRef.current
    if (!c) return
    const last = messages[messages.length - 1]
    if (!loading && last?.role === 'assistant' && answerRef.current) {
      c.scrollTo({ top: Math.max(0, answerRef.current.offsetTop - 8), behavior: 'smooth' })
    } else {
      c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, loading])

  // Stage dropped/selected/pasted files: downscale images, keep PDFs as-is, and
  // enforce the count / size caps with a friendly message.
  const addFiles = async (files: File[]) => {
    if (!allowAttachments || !files.length) return
    setError('')
    const room = MAX_ATTACHMENTS - pending.length
    if (room <= 0) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`)
      return
    }
    const next: Attachment[] = []
    for (const file of files.slice(0, room)) {
      try {
        if (file.type === 'application/pdf') {
          if (file.size > MAX_PDF_BYTES) {
            setError(`"${file.name}" is too large (PDFs must be under 4MB).`)
            continue
          }
          next.push({ kind: 'pdf', mediaType: 'application/pdf', data: await fileToBase64(file), name: file.name })
        } else if (file.type.startsWith('image/')) {
          next.push(await downscaleImage(file))
        } else {
          setError('Only images and PDFs can be attached.')
        }
      } catch {
        setError(`Couldn't read "${file.name}".`)
      }
    }
    if (next.length) setPending((p) => [...p, ...next])
  }

  const removePending = (i: number) => setPending((p) => p.filter((_, j) => j !== i))

  const send = async (text: string, atts: Attachment[]) => {
    const q = text.trim()
    if (loading || (!q && atts.length === 0)) return
    // Guard the total request size (all resent history + this turn) against Vercel's body cap.
    const total =
      [...messages, { attachments: atts } as ChatMsg]
        .flatMap((m) => m.attachments || [])
        .reduce((sum, a) => sum + b64Bytes(a.data), 0)
    if (total > MAX_TOTAL_BYTES) {
      setError('That’s a lot of attachments for one conversation — start a fresh chat or remove one.')
      return
    }
    setError('')
    setInput('')
    setPending([])
    const userMsg: ChatMsg = { role: 'user', content: q, ...(atts.length ? { attachments: atts } : {}) }
    const next: ChatMsg[] = [...messages, userMsg]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'The assistant is unavailable right now.')
        return
      }
      setMessages((m) => [...m, { role: 'assistant', content: json.reply, sources: Array.isArray(json.sources) ? json.sources : undefined }])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const idle = messages.length === 0
  const canSend = !loading && (input.trim().length > 0 || pending.length > 0)

  // Clears the conversation and returns to the idle "home screen" (the
  // JerryFigure hero + suggestion chips) — doesn't touch loading/error state
  // beyond what a fresh idle screen implies.
  const goHome = () => {
    setMessages([])
    setInput('')
    setPending([])
    setError('')
  }

  return (
    <section
      className={`${CARD} relative flex flex-col overflow-hidden ${fullHeight ? 'h-full' : ''}`}
      onDragOver={allowAttachments ? (e) => { e.preventDefault(); setDragOver(true) } : undefined}
      onDragLeave={allowAttachments ? (e) => { e.preventDefault(); setDragOver(false) } : undefined}
      onDrop={allowAttachments ? (e) => {
        e.preventDefault()
        setDragOver(false)
        addFiles(Array.from(e.dataTransfer.files || []))
      } : undefined}
    >
      {/* Drag-and-drop overlay */}
      {allowAttachments && dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Paperclip size={15} /> Drop a photo or PDF for Jerry to look at
          </span>
        </div>
      )}

      {/* Header — Jerry's presence + status */}
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        {!idle && (
          <button
            type="button"
            onClick={goHome}
            aria-label="Back to Jerry's home screen"
            title="Back to Jerry's home screen"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
          >
            <ArrowLeft size={15} />
          </button>
        )}
        <Orb px={26} thinking={loading} />
        <div className="leading-tight">
          <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Jerry</h2>
          <p className="text-[11px] text-zinc-400">{loading ? 'Looking through the manuals…' : 'Here to help'}</p>
        </div>
        <span className="ml-auto jerry-status-dot" aria-hidden="true" />
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className={`relative flex-1 overflow-y-auto px-5 py-4 ${fullHeight ? 'min-h-0' : 'max-h-[460px] min-h-[340px]'}`}
      >
        {idle ? (
          <div className="flex h-full flex-col items-center justify-center py-3 text-center">
            <JerryFigure />
            <p className="mt-4 text-[16px] font-bold text-zinc-900 dark:text-white">Hi, I&apos;m Jerry.</p>
            <p className="mt-1.5 max-w-[262px] text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {idleSubtitle}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex animate-fade-up flex-col items-end gap-1.5">
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="max-w-[85%]"><AttachmentThumbs items={m.attachments} /></div>
                  )}
                  {m.content && (
                    <p className="max-w-[85%] rounded-full border border-zinc-200 px-3.5 py-1.5 text-[12.5px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                      {m.content}
                    </p>
                  )}
                </div>
              ) : (
                <div key={i} ref={i === messages.length - 1 ? answerRef : undefined} className="flex animate-fade-up gap-2.5">
                  <Orb px={20} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Sources</span>
                        {m.sources.map((s, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            title={`${s.documentTitle}, page ${s.pageNumber}`}
                          >
                            <FileText size={10} className="shrink-0" /> {s.documentTitle} · p.{s.pageNumber}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {loading && (
              <div className="flex animate-fade-up items-center gap-2.5">
                <Orb px={20} thinking />
                <span className="text-[12.5px] text-zinc-400">{pending.length || messages.some((m) => m.attachments?.length) ? 'Taking a look…' : 'Reading IAT’s documentation…'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="space-y-2.5 px-5 pb-4 pt-1">
        {idle && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s, [])}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-[12px] text-rose-500">{error}</p>}
        {allowAttachments && pending.length > 0 && <AttachmentThumbs items={pending} onRemove={removePending} />}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input, pending)
          }}
          className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 py-1.5 pl-2 pr-1.5 transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-within:bg-zinc-900"
        >
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []))
                  e.target.value = '' // allow re-selecting the same file
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Attach a photo or PDF"
                title="Attach a photo or PDF"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-emerald-600 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
              >
                <Paperclip size={16} />
              </button>
            </>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={allowAttachments ? (e) => {
              const files = Array.from(e.clipboardData.files || [])
              if (files.length) { e.preventDefault(); addFiles(files) }
            } : undefined}
            disabled={loading}
            placeholder={allowAttachments ? 'Ask Jerry, or attach a photo…' : 'Ask Jerry…'}
            className="flex-1 bg-transparent pl-2 text-[13px] text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white transition-all hover:bg-emerald-700 disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
          </button>
        </form>
        <p className="text-[10.5px] text-zinc-400">{footerNote}</p>
      </div>
    </section>
  )
}
