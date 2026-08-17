'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import Link from 'next/link'
import Script from 'next/script'
import {
  Search, Loader2, CheckCircle, Clock, Wrench, Lightbulb,
  ArrowRight, BookOpen, AlertCircle, Ticket as TicketIcon,
} from 'lucide-react'
import type { StatusCustomerContext } from '@/lib/support-context'
import RequestAccountCta from '@/components/support/RequestAccountCta'

// Invisible reCAPTCHA v3 for the "add a message" write path. Absent in env →
// no script, no token, and lib/recaptcha.ts skips verification entirely.
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

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
  customer_id_linked?: boolean
  has_pending_request?: boolean
}

type RelatedArticle = { title: string; slug: string; excerpt: string | null; category: string | null }

// ─── Reference routing ────────────────────────────────────────────────────────
// Three different intakes hand a customer a reference, each in its own table, and
// each linked here from its own confirmation email:
//
//   IAT-YYYY-NNNN  support ticket          → tickets
//   TSC-…          troubleshooting intake  → troubleshooting_intakes
//   RFQ-YYYY-NNNN  quote / moisture survey → rfq_requests
//
// Anything unrecognised falls through to the ticket resolver, which is what the
// overwhelming majority of references are.

type RefKind = 'ticket' | 'checklist' | 'rfq'

function refKind(ref: string): RefKind {
  const u = ref.trim().toUpperCase()
  if (u.startsWith('TSC-')) return 'checklist'
  if (u.startsWith('RFQ-')) return 'rfq'
  return 'ticket'
}

const ENDPOINT: Record<RefKind, string> = {
  ticket: '/api/tickets/status',
  checklist: '/api/troubleshooting/status',
  rfq: '/api/rfq/status',
}

// ─── Status presentation ───────────────────────────────────────────────────────

type StatusMeta = { label: string; blurb: string; step: number }

const TICKET_STATUS_META: Record<StatusKey, StatusMeta> = {
  open:        { label: 'Received',     blurb: "We've received your ticket and it's in the queue.", step: 0 },
  in_progress: { label: 'In Progress',  blurb: 'An IAT engineer is actively working on your ticket.', step: 1 },
  resolved:    { label: 'Resolved',     blurb: 'This ticket has been resolved.', step: 2 },
  closed:      { label: 'Closed',       blurb: 'This ticket is closed.', step: 2 },
}

// A quote request moves through a different lifecycle than a repair, so it gets
// its own wording rather than being told an engineer is "working on your ticket".
const RFQ_STATUS_META: Record<StatusKey, StatusMeta> = {
  open:        { label: 'Received',  blurb: "We've received your request and it's with our sales engineering team.", step: 0 },
  in_progress: { label: 'In Review', blurb: 'Our team is sizing equipment for your application.', step: 1 },
  resolved:    { label: 'Quoted',    blurb: 'A quote has been prepared — check your email, or contact us if it has not arrived.', step: 2 },
  closed:      { label: 'Closed',    blurb: 'This request is closed.', step: 2 },
}

const TICKET_STEPS = [
  { key: 'received', label: 'Received', icon: TicketIcon },
  { key: 'progress', label: 'In Progress', icon: Wrench },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle },
]

const RFQ_STEPS = [
  { key: 'received', label: 'Received', icon: TicketIcon },
  { key: 'progress', label: 'In Review', icon: Wrench },
  { key: 'resolved', label: 'Quoted', icon: CheckCircle },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    open: 'Received', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
    new: 'New', reviewed: 'Reviewed',
  }
  return map[s] || s
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatusClient({ customerContext = null }: { customerContext?: StatusCustomerContext | null }) {
  const [ticketNumber, setTicketNumber] = useState('')
  const [email, setEmail] = useState(customerContext?.email || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TicketResult | null>(null)
  // The kind of the reference that produced `result` — not of whatever is
  // currently in the input box, so the card's wording can't change under the
  // customer while they type a different reference.
  const [resultKind, setResultKind] = useState<RefKind>('ticket')
  const [articles, setArticles] = useState<RelatedArticle[]>([])

  // "Add a message" — the write path that lets the confirmation emails tell
  // customers not to reply. Reset whenever a different ticket is looked up.
  const [message, setMessage] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)

  const sendMessage = async () => {
    const text = message.trim()
    if (!text) return
    setMsgSending(true)
    setMsgError(null)
    try {
      // Same best-effort reCAPTCHA pattern as the ticket form: a grecaptcha
      // hiccup must never stop a real customer from reaching us.
      // A quote request and a support ticket each have their own write endpoint
      // and their own reCAPTCHA action; both are keyed off the RESOLVED kind, so
      // a message can never be aimed at the wrong table by retyping the box.
      const isRfqMsg = resultKind === 'rfq'
      const action = isRfqMsg ? 'rfq_message' : 'ticket_message'
      let recaptcha_token: string | undefined
      if (RECAPTCHA_SITE_KEY) {
        try {
          await new Promise<void>(resolve => window.grecaptcha?.ready(resolve) ?? resolve())
          recaptcha_token = await window.grecaptcha?.execute(RECAPTCHA_SITE_KEY, { action })
        } catch (e) {
          console.error('[status] reCAPTCHA token fetch failed:', e)
        }
      }
      const res = await fetch(isRfqMsg ? '/api/rfq/status/message' : '/api/tickets/status/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_number: ticketNumber.trim(),
          email: email.trim(),
          message: text,
          ...(recaptcha_token ? { recaptcha_token } : {}),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'We could not send your message. Please try again.')
      setMsgSent(true)
      setMessage('')
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setMsgSending(false)
    }
  }

  // Prefill the ticket number from ?ticket= (e.g. the link on the success screen).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('ticket')
    if (t) setTicketNumber(t)
  }, [])

  const runLookup = async (rawRef: string, rawEmail: string) => {
    const ref = rawRef.trim()
    const mail = rawEmail.trim()
    if (!ref || !mail) return
    setLoading(true)
    setError(null)
    setResult(null)
    // Looking up a different ticket must not inherit the previous one's
    // "message sent" confirmation, or the customer sees a success state for a
    // message they never wrote on this ticket.
    setMessage('')
    setMsgSent(false)
    setMsgError(null)
    try {
      // Route by reference prefix — every resolver returns the same shape.
      const kind = refKind(ref)
      const res = await fetch(ENDPOINT[kind], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_number: ref, email: mail }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Lookup failed.')
      setResult(json.ticket)
      setResultKind(kind)
      setArticles(json.related_articles ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const lookup = (e: React.FormEvent) => {
    e.preventDefault()
    runLookup(ticketNumber, email)
  }

  // One-click from the customer's own request list: fill the reference + their
  // account email and look it up immediately.
  const pick = (ref: string) => {
    const mail = customerContext?.email || email
    setTicketNumber(ref)
    setEmail(mail)
    runLookup(ref, mail)
  }

  const isRfq = resultKind === 'rfq'
  const meta = result ? (isRfq ? RFQ_STATUS_META : TICKET_STATUS_META)[result.status] : null
  const steps = isRfq ? RFQ_STEPS : TICKET_STEPS
  const activeStep = meta?.step ?? -1
  // Only support tickets have a portal account behind them, so only they get the
  // "see all your equipment in one place" invitation.
  const isTicket = resultKind === 'ticket'
  // Tickets and quote requests both have a note trail a customer message can
  // land on. TSC- checklist intakes do not — there is no write endpoint that
  // resolves that table, so offering the box would promise a reply that could
  // never arrive.
  const canWriteBack = resultKind === 'ticket' || resultKind === 'rfq'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
      {/* reCAPTCHA v3 (invisible) — gates the "add a message" POST. Only loads
          once a site key is configured; see lib/recaptcha.ts for the server side. */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
        <Link href="/support" className="flex items-center gap-3 no-underline">
          <Logo size={28} className="flex-shrink-0" />
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        </Link>
        <span className="text-gray-200 dark:text-gray-700 mx-1">/</span>
        <span className="text-[14px] text-gray-400">Request Status</span>
        <ThemeToggle className="ml-auto" />
      </header>

      <div className="flex-1 flex flex-col items-center py-10 px-4">

        {/* Lookup card */}
        <div className="w-full max-w-xl">
          <div className="text-center mb-7">
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight mb-1.5">Check your request status</h1>
            <p className="text-[14px] text-gray-400 leading-relaxed">
              Enter the reference number from your confirmation email — a support ticket
              (IAT-…) or a quote request (RFQ-…) — along with the email you submitted
              with, to see the latest update.
            </p>
          </div>

          {customerContext && customerContext.requests.length > 0 && (
            <div className="mb-6 rounded-2xl border border-[#089447]/25 bg-[#089447]/[0.06] dark:bg-[#089447]/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TicketIcon size={15} className="text-[#089447] flex-shrink-0" />
                <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">Your requests</p>
                <span className="ml-auto max-w-[45%] truncate text-[11px] text-gray-400">{customerContext.email}</span>
              </div>
              <p className="text-[11.5px] text-gray-400 mb-3">Tap one to see its latest status — or look up any reference below.</p>
              <div className="flex flex-col gap-1.5">
                {customerContext.requests.map((r) => (
                  <button
                    key={r.ref}
                    type="button"
                    onClick={() => pick(r.ref)}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/40 px-3 py-2 text-left transition-all hover:border-[#089447]/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-gray-800 dark:text-gray-100">{r.ref}</span>
                        <span className="text-[10px] text-gray-400">{r.kind === 'ticket' ? 'Support' : 'Checklist'}</span>
                      </div>
                      {r.title && <p className="truncate text-[11px] text-gray-400">{r.title}</p>}
                    </div>
                    <span className="flex-shrink-0 text-[11px] font-semibold text-gray-400">{statusLabel(r.status)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  placeholder="e.g. IAT-2026-0148 or RFQ-2026-0007"
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
                    {steps.map((s, i) => {
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
                          {i < steps.length - 1 && (
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
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    {isRfq ? 'What you asked us to quote' : 'Your reported issue'}
                  </p>
                  <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{result.problem_description}</p>
                </div>

                {/* Write back — the reason confirmation emails can say "don't reply".
                    Ownership is already proven by the number + email used above.

                    Tickets and quote requests each have their own write endpoint and
                    their own note trail. TSC- checklist intakes have neither, so the
                    box is hidden for them rather than offering a reply that could
                    never land. */}
                {canWriteBack && (
                <div className="px-6 pb-6">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Add a message</p>
                  {msgSent ? (
                    <div className="bg-[#089447]/5 border border-[#089447]/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-[#089447] mt-0.5 flex-shrink-0" />
                      <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                        Thanks — your message is on your {isRfq ? 'request' : 'ticket'} and our team has been notified.
                      </p>
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                        maxLength={4000}
                        placeholder={isRfq
                          ? 'Anything changed, or a question about your quote?'
                          : 'Anything to add, or a question for the team?'}
                        className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-[13px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#089447]/30 focus:border-[#089447] resize-y"
                      />
                      {msgError && (
                        <p className="mt-2 text-[12px] text-rose-500">{msgError}</p>
                      )}
                      <button
                        onClick={sendMessage}
                        disabled={msgSending || !message.trim()}
                        className="mt-2.5 inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors"
                      >
                        {msgSending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <>Send to the team <ArrowRight size={14} /></>}
                      </button>
                      <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                        This goes straight onto your {isRfq ? 'request' : 'ticket'}, so everything stays in one place.
                      </p>
                    </>
                  )}
                </div>
                )}

                {/* Request portal access — support tickets only, not checklist or RFQ refs */}
                {isTicket && (
                  <div className="px-6 pb-6">
                    <RequestAccountCta
                      ticketNumber={result.ticket_number}
                      email={email}
                      suppress={!!customerContext}
                      initialStatus={
                        result.customer_id_linked ? 'already_linked'
                        : result.has_pending_request ? 'already_pending'
                        : 'idle'
                      }
                    />
                  </div>
                )}
              </div>

              {/* AI recommendations */}
              {result.ai_recommendations.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 px-6 py-5 shadow-sm">
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
                  they exist and fall back to a "coming soon" stub otherwise. Skipped
                  entirely for RFQs — troubleshooting guides answer a question a quote
                  request never asked. */}
              {(!isRfq || articles.length > 0) && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 px-6 py-5 shadow-sm">
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
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <p className="text-[12px] text-gray-400">Need more help? Your IAT engineer will reach out directly.</p>
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
