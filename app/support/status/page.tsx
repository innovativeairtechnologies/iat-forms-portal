'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import Link from 'next/link'
import {
  Search, Loader2, CheckCircle, Clock, Wrench, Lightbulb,
  ArrowRight, BookOpen, AlertCircle, Ticket as TicketIcon,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusKey = 'open' | 'in_progress' | 'resolved' | 'closed'

type TicketResult = {
  ticket_number: string
  status: StatusKey
  problem_description: string
  customer_name: string
  ai_recommendations: string[]
  resolved_reason: string | null
  created_at: string
}

type RelatedArticle = { title: string; slug: string; excerpt: string | null; category: string | null }

// ─── Status presentation ───────────────────────────────────────────────────────

const STATUS_META: Record<StatusKey, { label: string; blurb: string; step: number }> = {
  open:        { label: 'Received',     blurb: "We've received your ticket and it's in the queue.", step: 0 },
  in_progress: { label: 'In Progress',  blurb: 'An IAT engineer is actively working on your ticket.', step: 1 },
  resolved:    { label: 'Resolved',     blurb: 'This ticket has been resolved.', step: 2 },
  closed:      { label: 'Closed',       blurb: 'This ticket is closed.', step: 2 },
}

const STEPS = [
  { key: 'received', label: 'Received', icon: TicketIcon },
  { key: 'progress', label: 'In Progress', icon: Wrench },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [ticketNumber, setTicketNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TicketResult | null>(null)
  const [articles, setArticles] = useState<RelatedArticle[]>([])

  // Prefill the ticket number from ?ticket= (e.g. the link on the success screen).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('ticket')
    if (t) setTicketNumber(t)
  }, [])

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketNumber.trim() || !email.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // TSC- references are troubleshooting-checklist intakes; everything else
      // (TKT-…) is a support ticket. Both endpoints return the same shape.
      const ref = ticketNumber.trim()
      const endpoint = ref.toUpperCase().startsWith('TSC-')
        ? '/api/troubleshooting/status'
        : '/api/tickets/status'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_number: ref, email: email.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lookup failed.')
      setResult(json.ticket)
      setArticles(json.related_articles ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const meta = result ? STATUS_META[result.status] : null
  const activeStep = meta?.step ?? -1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
        <Link href="/support" className="flex items-center gap-3 no-underline">
          <Logo size={28} className="flex-shrink-0" />
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        </Link>
        <span className="text-gray-200 dark:text-gray-700 mx-1">/</span>
        <span className="text-[14px] text-gray-400">Request Status</span>
      </header>

      <div className="flex-1 flex flex-col items-center py-10 px-4">

        {/* Lookup card */}
        <div className="w-full max-w-xl">
          <div className="text-center mb-7">
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight mb-1.5">Check your request status</h1>
            <p className="text-[14px] text-gray-400 leading-relaxed">
              Enter your ticket or reference number and the email you submitted with to see the latest update.
            </p>
          </div>

          <form
            onSubmit={lookup}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 mb-6"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Ticket / Reference Number</label>
                <input
                  value={ticketNumber}
                  onChange={e => setTicketNumber(e.target.value)}
                  placeholder="e.g. TKT-123456-789 or TSC-123456-789"
                  className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="The email you used on your ticket"
                  className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !ticketNumber.trim() || !email.trim()}
              className="mt-5 w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-40 px-5 py-2.5 rounded-xl transition-all"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {loading ? 'Looking up…' : 'Check status'}
            </button>
          </form>

          {/* Result */}
          {result && meta && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {/* Status card */}
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
              >
                <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-0.5">Reference</p>
                      <p className="text-[18px] font-bold font-mono text-[#089447] tracking-wider">{result.ticket_number}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[#089447]/10 text-[#089447]">
                      <Clock size={12} />{meta.label}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{meta.blurb}</p>
                  <p className="text-[12px] text-gray-400 mt-1">Submitted {formatDate(result.created_at)}</p>
                </div>

                {/* Progress tracker */}
                <div className="px-6 py-6">
                  <div className="flex items-center">
                    {STEPS.map((s, i) => {
                      const done = i < activeStep
                      const active = i === activeStep
                      const Icon = s.icon
                      return (
                        <div key={s.key} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                              done || active
                                ? 'bg-[#089447] text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-gray-600'
                            }`}>
                              <Icon size={16} strokeWidth={2.4} />
                            </div>
                            <span className={`text-[11px] font-medium ${
                              done || active ? 'text-[#089447]' : 'text-gray-300 dark:text-gray-600'
                            }`}>{s.label}</span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 -mt-5 rounded-full ${
                              i < activeStep ? 'bg-[#089447]' : 'bg-gray-100 dark:bg-zinc-800'
                            }`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Resolution note */}
                {result.resolved_reason && (result.status === 'resolved' || result.status === 'closed') && (
                  <div className="px-6 pb-5">
                    <div className="bg-[#089447]/5 border border-[#089447]/15 rounded-xl px-4 py-3">
                      <p className="text-[11px] font-semibold text-[#089447] uppercase tracking-wide mb-1">Resolution</p>
                      <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">{result.resolved_reason}</p>
                    </div>
                  </div>
                )}

                {/* Submitted problem */}
                <div className="px-6 pb-6">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Your reported issue</p>
                  <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{result.problem_description}</p>
                </div>
              </div>

              {/* AI recommendations */}
              {result.ai_recommendations.length > 0 && (
                <div
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 px-6 py-5"
                  style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                      <Lightbulb size={14} className="text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">While you wait, try these steps</p>
                      <p className="text-[11px] text-gray-400">Based on the information you provided</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {result.ai_recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900/30">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-3">
                    These are AI-generated suggestions. If unsure, wait for your service technician.
                  </p>
                </div>
              )}

              {/* Related knowledge base articles.
                  Backend matching is live (see /api/tickets/status + lib/kb.ts); the
                  KB itself has no published content yet, so we render real matches when
                  they exist and fall back to a "coming soon" stub otherwise. */}
              <div
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 px-6 py-5"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={14} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Related guides</p>
                </div>

                {articles.length > 0 ? (
                  <div className="space-y-2">
                    {articles.map(a => (
                      <div
                        key={a.slug}
                        className="block rounded-xl border border-gray-100 dark:border-zinc-800 px-4 py-3 hover:border-gray-200 dark:hover:border-zinc-700 transition-all"
                      >
                        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{a.title}</p>
                        {a.excerpt && <p className="text-[12px] text-gray-400 mt-0.5 leading-relaxed">{a.excerpt}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-400 leading-relaxed">
                    A searchable knowledge base of troubleshooting guides is coming soon. In the
                    meantime, your IAT engineer will share the most relevant resources directly.
                  </p>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <p className="text-[12px] text-gray-400">Need more help? Reply to your confirmation email.</p>
                <Link href="/support" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors">
                  Back to support <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
