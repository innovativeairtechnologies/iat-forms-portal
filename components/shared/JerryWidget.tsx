'use client'

// Jerry — IAT's AI assistant. A living "presence" (animated orb) that answers
// from grounded context (equipment + IAT's documentation, RAG) and cites the
// source (document + page). Shared shell used by both the customer dashboard
// (/api/customer/assistant) and the admin ticket detail page
// (/api/admin/tickets/[id]/assistant) — each caller supplies its own endpoint,
// suggestion chips, idle subtitle, and footer note. Deliberately not a
// chat-bubble bot: a breathing orb, typeset answers, and cited "receipts".

import { useEffect, useRef, useState } from 'react'
import { Sparkles, FileText, Loader2, ArrowUp, ArrowLeft } from 'lucide-react'
import type { KbSource } from '@/lib/kb-rag'

const CARD = 'rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none'

type ChatMsg = { role: 'user' | 'assistant'; content: string; sources?: KbSource[] }

export type JerryWidgetProps = {
  apiEndpoint: string
  suggestions: string[]
  idleSubtitle: string
  footerNote: string
  /** Stretch to fill the parent's height instead of the fixed card sizing —
   *  used by the standalone /admin/jerry page so it reads as a full chat
   *  surface (composer pinned at the bottom) rather than a sidebar widget. */
  fullHeight?: boolean
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

export default function JerryWidget({ apiEndpoint, suggestions, idleSubtitle, footerNote, fullHeight = false }: JerryWidgetProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)

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

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return
    setError('')
    setInput('')
    const next: ChatMsg[] = [...messages, { role: 'user', content: q }]
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

  // Clears the conversation and returns to the idle "home screen" (the
  // JerryFigure hero + suggestion chips) — doesn't touch loading/error state
  // beyond what a fresh idle screen implies.
  const goHome = () => {
    setMessages([])
    setInput('')
    setError('')
  }

  return (
    <section className={`${CARD} flex flex-col overflow-hidden ${fullHeight ? 'h-full' : ''}`}>
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
                <div key={i} className="flex animate-fade-up justify-end">
                  <p className="max-w-[85%] rounded-full border border-zinc-200 px-3.5 py-1.5 text-[12.5px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                    {m.content}
                  </p>
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
                <span className="text-[12.5px] text-zinc-400">Reading IAT&apos;s documentation…</span>
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
                onClick={() => ask(s)}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-[12px] text-rose-500">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(input)
          }}
          className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 py-1.5 pl-4 pr-1.5 transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-within:bg-zinc-900"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask Jerry…"
            className="flex-1 bg-transparent text-[13px] text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
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
