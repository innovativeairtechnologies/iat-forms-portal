'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, ShieldCheck, Truck, BookOpen, LifeBuoy, Search,
  ChevronDown, LogOut, CheckCircle2, Circle, Clock, Sparkles,
  Send, Cpu, MapPin, Image as ImageIcon, X, ChevronLeft, ChevronRight,
  Headphones, Loader2,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { EquipmentMilestone } from '@/lib/supabase'

// ── Prop shapes (built server-side in app/customer/page.tsx) ──────────────────
export type UnitView = {
  id: string
  serial_number: string
  model_number: string | null
  voltage: string | null
  location: string | null
  ship_date: string | null
  install_date: string | null
  photos: string[]
  milestones: EquipmentMilestone[]
  warranty: { state: 'in' | 'out' | 'unknown'; end: string | null; daysLeft: number | null }
  progress: { total: number; completed: number; percent: number; currentStage: string | null }
}
export type RequestView = {
  kind: 'ticket' | 'troubleshooting'
  ref: string
  title: string
  serial: string
  status: string
  created_at: string
}
export type DashboardKb = { title: string; slug: string; excerpt: string | null; category: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function warrantyMeta(w: UnitView['warranty']) {
  if (w.state === 'in') {
    const soon = w.daysLeft !== null && w.daysLeft <= 90
    return {
      label: 'In warranty',
      sub: w.end ? `Through ${fmtDate(w.end)}` : 'Active',
      cls: soon
        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
    }
  }
  if (w.state === 'out') {
    return {
      label: 'Out of warranty',
      sub: w.end ? `Ended ${fmtDate(w.end)}` : 'Expired',
      cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
    }
  }
  return {
    label: 'Warranty —',
    sub: 'No ship date on file',
    cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
  }
}

function statusMeta(kind: RequestView['kind'], status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    open:        { label: 'Open',        cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
    in_progress: { label: 'In progress', cls: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20' },
    resolved:    { label: 'Resolved',    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' },
    closed:      { label: 'Closed',      cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700' },
    new:         { label: 'New',         cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
    reviewed:    { label: 'Reviewed',    cls: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20' },
  }
  return map[status] || { label: status, cls: 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700' }
}

const CARD = 'rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none'

// ── Main ────────────────────────────────────────────────────────────────────
export default function CustomerDashboard({
  companyName, contactName, email, units, requests, kb,
}: {
  companyName: string
  contactName: string
  email: string
  units: UnitView[]
  requests: RequestView[]
  kb: DashboardKb[]
}) {
  const router = useRouter()
  const [activeIdx, setActiveIdx] = useState(0)
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const active = units[activeIdx]

  const filteredRequests = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return requests
    return requests.filter(
      (r) =>
        r.ref.toLowerCase().includes(t) ||
        r.serial.toLowerCase().includes(t) ||
        (r.title || '').toLowerCase().includes(t)
    )
  }, [q, requests])

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 dark:bg-[#0a0a0b] dark:text-zinc-200">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-5">
          <Link href="/customer" className="flex items-center gap-2.5 no-underline">
            <Logo size={26} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">IAT</span>
              <span className="text-[13px] text-zinc-300 dark:text-zinc-600">/</span>
              <span className="max-w-[180px] truncate text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{companyName}</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search requests…"
                className="h-9 w-44 rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                  {(contactName || companyName).charAt(0).toUpperCase()}
                </span>
                <ChevronDown size={14} className="text-zinc-400" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="border-b border-zinc-100 px-3.5 py-3 dark:border-zinc-800">
                      <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">{contactName}</p>
                      <p className="truncate text-[12px] text-zinc-400">{email}</p>
                    </div>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="mx-auto max-w-[1200px] space-y-5 px-5 py-6">

        <PortalHero
          eyebrow="Customer Portal"
          title={`Welcome, ${companyName}`}
          subtitle={
            units.length
              ? `You have ${units.length} unit${units.length === 1 ? '' : 's'} with IAT. Track build & shipping status, warranty, and support all in one place.`
              : 'Your portal is ready. Equipment will appear here once IAT links it to your account.'
          }
          actions={
            <>
              <HeroAction href="/support/equipment-support" icon={LifeBuoy} label="Submit a request" variant="primary" />
              <HeroAction href="/support/status" icon={Search} label="Check status" />
            </>
          }
        />

        <div className="grid gap-5 lg:grid-cols-3">

          {/* ── Left / main column ── */}
          <div className="space-y-5 lg:col-span-2">

            {/* Unit switcher */}
            {units.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {units.map((u, i) => (
                  <button
                    key={u.id}
                    onClick={() => setActiveIdx(i)}
                    className={`rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                      i === activeIdx
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    {u.serial_number}
                  </button>
                ))}
              </div>
            )}

            {active ? (
              <>
                {/* Serial / Model / Warranty */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatCard icon={Package} label="Serial #" value={active.serial_number} />
                  <StatCard icon={Cpu} label="Model #" value={active.model_number || '—'} sub={active.voltage || undefined} />
                  <WarrantyCard w={active.warranty} />
                </div>

                {/* Build / ship tracker */}
                <Tracker unit={active} />

                {/* Unit photos (build & QC) */}
                {active.photos.length > 0 && <UnitPhotos photos={active.photos} />}
              </>
            ) : (
              <div className={`${CARD} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
                <Package size={26} className="text-zinc-300 dark:text-zinc-600" />
                <p className="text-[14px] font-semibold text-zinc-700 dark:text-zinc-200">No equipment on file yet</p>
                <p className="max-w-sm text-[13px] text-zinc-400">
                  Once IAT links your unit to this account, its details and build status will show here.
                </p>
              </div>
            )}

            {/* Support & resources section removed to de-duplicate the page: the single
                support form ("Submit a request") and "Check status" live in the hero, and
                the Knowledge Base lives in the right rail. The Troubleshooting Checklist
                was merged into Equipment Support, so there's one support form now. */}

            {/* My requests */}
            <section className={CARD}>
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">My Requests</h2>
                <span className="text-[12px] font-medium text-zinc-400">{filteredRequests.length} total</span>
              </div>
              {filteredRequests.length ? (
                <ul>
                  {filteredRequests.map((r) => {
                    const s = statusMeta(r.kind, r.status)
                    return (
                      <li
                        key={`${r.kind}-${r.ref}`}
                        className="flex items-center gap-3 border-b border-zinc-50 px-5 py-3 last:border-0 dark:border-zinc-800/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">{r.ref}</span>
                            <span className="text-[11px] text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="text-[11px] text-zinc-400">{r.kind === 'ticket' ? 'Support' : 'Checklist'}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">{r.title}</p>
                        </div>
                        <span className="hidden shrink-0 text-[11px] text-zinc-400 sm:block">{fmtDate(r.created_at)}</span>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${s.cls}`}>{s.label}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="px-5 py-10 text-center">
                  <p className="text-[13px] text-zinc-400">
                    {q ? 'No requests match your search.' : "You haven't submitted any requests yet."}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ── Right rail ── */}
          <aside className="space-y-5">
            <AssistantPanel companyName={companyName} />

            {/* Knowledge base quick links */}
            <section className={CARD}>
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Knowledge Base</h2>
                <Link href="/support/kb" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-500">Browse all</Link>
              </div>
              {kb.length ? (
                <ul>
                  {kb.slice(0, 5).map((a) => (
                    <li key={a.slug} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/60">
                      <Link href={`/support/kb/${a.slug}`} className="group flex items-start gap-2.5 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <BookOpen size={15} className="mt-0.5 shrink-0 text-zinc-300 group-hover:text-emerald-500 dark:text-zinc-600" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-zinc-700 dark:text-zinc-200">{a.title}</p>
                          {a.excerpt && <p className="truncate text-[11px] text-zinc-400">{a.excerpt}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-center text-[13px] text-zinc-400">Guides are coming soon.</p>
              )}
            </section>

            <ContactCard />
          </aside>
        </div>
      </main>
    </div>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Package; label: string; value: string; sub?: string }) {
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <div className="mb-2 flex items-center gap-2 text-zinc-400">
        <Icon size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="truncate font-mono text-[16px] font-bold text-zinc-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{sub}</p>}
    </div>
  )
}

function WarrantyCard({ w }: { w: UnitView['warranty'] }) {
  const m = warrantyMeta(w)
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <div className="mb-2 flex items-center gap-2 text-zinc-400">
        <ShieldCheck size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Warranty</span>
      </div>
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${m.cls}`}>{m.label}</span>
      <p className="mt-1.5 truncate text-[11px] text-zinc-400">{m.sub}</p>
    </div>
  )
}

function Tracker({ unit }: { unit: UnitView }) {
  const ms = unit.milestones
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Build &amp; Shipping</h2>
        </div>
        {ms.length > 0 && (
          <span className="text-[12px] font-medium text-zinc-400">
            {unit.progress.currentStage || 'Not started'}
          </span>
        )}
      </div>

      {ms.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-zinc-400">
          Status updates will appear here once your build kicks off.
        </p>
      ) : (
        <div className="px-5 py-4">
          {/* progress bar */}
          <div className="mb-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${unit.progress.percent}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-400">{unit.progress.percent}%</span>
          </div>

          {/* stepper */}
          <ol className="space-y-0">
            {ms.map((m, i) => {
              const isLast = i === ms.length - 1
              const done = m.status === 'complete'
              const current = m.status === 'in_progress'
              return (
                <li key={m.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : current ? (
                      <Clock size={18} className="text-emerald-500" />
                    ) : (
                      <Circle size={18} className="text-zinc-300 dark:text-zinc-600" />
                    )}
                    {!isLast && <div className={`my-0.5 w-px flex-1 ${done ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-zinc-200 dark:bg-zinc-700'}`} />}
                  </div>
                  <div className={`pb-5 ${isLast ? 'pb-1' : ''}`}>
                    <p className={`text-[13px] font-semibold ${done || current ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{m.stage}</p>
                    <p className="mt-0.5 text-[11.5px] text-zinc-400">
                      {current ? 'In progress' : done ? `Completed ${fmtDate(m.occurred_at)}` : 'Pending'}
                      {m.note ? ` · ${m.note}` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          {(unit.ship_date || unit.location) && (
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-100 pt-3 text-[11.5px] text-zinc-400 dark:border-zinc-800">
              {unit.ship_date && <span className="inline-flex items-center gap-1.5"><Truck size={12} /> Ship date {fmtDate(unit.ship_date)}</span>}
              {unit.location && <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> {unit.location}</span>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ResourceCard removed — customer support entry points now live only in the hero
// ("Submit a request" / "Check status") and the right-rail Knowledge Base card.

// IAT Assistant — read-only chat grounded in this customer's equipment + the KB
// (server route /api/customer/assistant). Phase 3.
type ChatMsg = { role: 'user' | 'assistant'; content: string }
const ASSIST_SUGGESTIONS = ['Where is my unit?', 'Is it under warranty?', 'Start-up steps']

function AssistantPanel({ companyName }: { companyName: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
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
      const res = await fetch('/api/customer/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'The assistant is unavailable right now.')
        return
      }
      setMessages((m) => [...m, { role: 'assistant', content: json.reply }])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const empty = messages.length === 0

  return (
    <section className={`${CARD} flex flex-col overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">IAT Assistant</h2>
      </div>

      <div ref={scrollRef} className="max-h-[300px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {empty ? (
          <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Ask about your unit, warranty, shipping status, or how-tos — grounded in {companyName}&apos;s equipment and IAT&apos;s knowledge base.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5 px-5 pb-4">
        {empty && (
          <div className="flex flex-wrap gap-1.5">
            {ASSIST_SUGGESTIONS.map((s) => (
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
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900/60"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask me something…"
            className="flex-1 bg-transparent text-[13px] text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </form>
        <p className="text-[10.5px] text-zinc-400">IAT Assistant can make mistakes. For service or orders, use Submit a request or Contact Us.</p>
      </div>
    </section>
  )
}

// ── Unit photos (build & QC) with a simple lightbox ──────────────────────────
function UnitPhotos({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const close = () => setOpen(null)
  const at = open ?? 0
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Photos</h2>
        </div>
        <span className="text-[12px] font-medium text-zinc-400">{photos.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4">
        {photos.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className="aspect-square overflow-hidden rounded-lg border border-zinc-200 transition-transform hover:scale-[1.02] dark:border-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Unit photo ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={close}>
          <button className="absolute right-4 top-4 text-white/80 hover:text-white" onClick={close} aria-label="Close">
            <X size={24} />
          </button>
          {at > 0 && (
            <button
              className="absolute left-3 text-white/80 hover:text-white sm:left-6"
              onClick={(e) => { e.stopPropagation(); setOpen(at - 1) }}
              aria-label="Previous"
            >
              <ChevronLeft size={30} />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[at]}
            alt={`Unit photo ${at + 1}`}
            className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {at < photos.length - 1 && (
            <button
              className="absolute right-3 text-white/80 hover:text-white sm:right-6"
              onClick={(e) => { e.stopPropagation(); setOpen(at + 1) }}
              aria-label="Next"
            >
              <ChevronRight size={30} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ── Contact Us (team roster + message form) ──────────────────────────────────
const IAT_TEAM = ['Kacy Orr', 'Crystal Hill', 'Jacob Reagan', 'James Pope']

function ContactCard() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/customer/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not send — please try again.')
        return
      }
      setSent(true)
      setMessage('')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <Headphones size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Contact Us</h2>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {IAT_TEAM.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pl-1 pr-2.5 dark:border-zinc-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                {n.split(' ').map((p) => p[0]).join('')}
              </span>
              <span className="text-[11.5px] font-medium text-zinc-600 dark:text-zinc-300">{n}</span>
            </span>
          ))}
        </div>

        {sent ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Thanks — we&apos;ll be in touch.
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Send us a message…"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
            />
            {error && <p className="text-[12px] text-rose-500">{error}</p>}
            <button
              onClick={send}
              disabled={sending || !message.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send message
            </button>
          </>
        )}
      </div>
    </section>
  )
}
