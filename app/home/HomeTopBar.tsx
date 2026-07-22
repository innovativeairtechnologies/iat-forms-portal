'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Lightbulb, Mail, Send, Check, X } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { TopBarBell } from '@/app/admin/TopBarActions'
import { IT_SUPPORT } from '@/lib/home-content'
import { submitSuggestion } from './actions'

/* The company-home top bar. Rendered by HomeContent inside both portal shells
   (the employee shell's own top bar is suppressed on /home so there's just one).
   Desktop only (md+); the shells keep their mobile bars. Items: Have an idea
   (opens a modal), Email IT, theme toggle, notifications bell, profile. */

function initialsOf(name: string) {
  const t = (name || '').trim()
  if (!t) return '?'
  return t.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function HomeTopBar({ name, profileHref, unreadCount = 0, ticketCount = 0 }: {
  name: string; profileHref: string; unreadCount?: number; ticketCount?: number
}) {
  const [ideaOpen, setIdeaOpen] = useState(false)

  return (
    <>
      <div className="hidden md:flex flex-shrink-0 items-center gap-1.5 px-5 h-14 border-b border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-[#0a0a0b]/90">
        <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Company Home</span>
        <div className="flex-1" />

        <button
          onClick={() => setIdeaOpen(true)}
          title="Share an idea with leadership"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Lightbulb size={15} /> <span className="hidden lg:inline">Have an idea?</span>
        </button>

        <a
          href={`mailto:${IT_SUPPORT.email}`}
          title="Email IT support"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Mail size={16} />
        </a>

        <ThemeToggle />
        <TopBarBell unreadCount={unreadCount} ticketCount={ticketCount} />

        <Link
          href={profileHref}
          title="Your profile"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[12px] font-semibold text-white transition-opacity hover:opacity-85 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {initialsOf(name)}
        </Link>
      </div>

      {ideaOpen && <IdeaModal onClose={() => setIdeaOpen(false)} />}
    </>
  )
}

// ── "Have an idea?" modal (reuses the suggestion server action) ───────────────
function IdeaModal({ onClose }: { onClose: () => void }) {
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    setError('')
    startTransition(async () => {
      const res = await submitSuggestion(body)
      if (res.ok) { setDone(true); setBody('') }
      else setError(res.error || 'Something went wrong.')
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200">
          <X size={16} />
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Check size={18} />
            </span>
            <p className="text-[14px] font-semibold text-zinc-900 dark:text-white">Thanks — sent to leadership.</p>
            <button onClick={onClose} className="mt-1 text-[12.5px] font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <Lightbulb size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white">Have an idea?</h2>
            </div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Something that would make IAT run better? It goes straight to leadership.
            </p>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setError('') }}
              autoFocus
              placeholder="Have an idea to improve how things run at IAT?"
              className="h-32 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-100"
            />
            {error && <p className="mt-1.5 text-[12px] text-rose-500">{error}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400">Shared with leadership · your name attached</span>
              <button
                onClick={submit}
                disabled={pending || !body.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} /> {pending ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
