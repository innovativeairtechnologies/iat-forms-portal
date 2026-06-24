'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Package, ShieldCheck, Truck, BookOpen, LifeBuoy, Stethoscope, Search,
  ChevronDown, LogOut, CheckCircle2, Circle, Clock, ArrowRight, Sparkles,
  Send, Cpu, MapPin,
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
      <main className="mx-auto max-w-[1200px] space-y-6 px-5 py-6">

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

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Left / main column ── */}
          <div className="space-y-6 lg:col-span-2">

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

            {/* Resources & support */}
            <section>
              <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-zinc-400">Support &amp; resources</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ResourceCard
                  href="/support/equipment-support"
                  icon={LifeBuoy}
                  title="Equipment Support Ticket"
                  desc="Report an issue — pre-screened before the call."
                  primary
                />
                <ResourceCard
                  href="/support/troubleshooting"
                  icon={Stethoscope}
                  title="Troubleshooting Checklist"
                  desc="Walk the key diagnostic checks step by step."
                />
                <ResourceCard
                  href="/support/kb"
                  icon={BookOpen}
                  title="Knowledge Base & Start-up Guide"
                  desc="Setup, operation, and troubleshooting guides."
                />
                <ResourceCard
                  href="/support/status"
                  icon={Search}
                  title="Check Request Status"
                  desc="Look up any ticket you've submitted."
                />
              </div>
            </section>

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
          <aside className="space-y-6">
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

function ResourceCard({
  href, icon: Icon, title, desc, primary,
}: { href: string; icon: typeof Package; title: string; desc: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        primary
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-zinc-900'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13.5px] font-semibold text-zinc-900 dark:text-white">{title}</p>
          <ArrowRight size={13} className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{desc}</p>
      </div>
    </Link>
  )
}

// Phase-3 placeholder. Styled to match the sketch's "IAT Assistant / Ask me
// something" panel; wired to a real conversational endpoint in a later phase.
function AssistantPanel({ companyName }: { companyName: string }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">IAT Assistant</h2>
        <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">Soon</span>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Ask about your unit, warranty, shipping status, or how-tos — grounded in {companyName}&apos;s equipment and IAT&apos;s knowledge base.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Where is my unit?', 'Is it under warranty?', 'Start-up steps'].map((s) => (
            <span key={s} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-400 dark:border-zinc-700">{s}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
          <input
            disabled
            placeholder="Ask me something…"
            className="flex-1 bg-transparent text-[13px] text-zinc-500 outline-none placeholder:text-zinc-400"
          />
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200 text-zinc-400 dark:bg-zinc-700">
            <Send size={13} />
          </span>
        </div>
      </div>
    </section>
  )
}
