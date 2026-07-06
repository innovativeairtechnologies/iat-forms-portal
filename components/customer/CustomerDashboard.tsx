'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Package, ShieldCheck, Truck, BookOpen, LifeBuoy, Search,
  ChevronDown, LogOut, CheckCircle2, ClipboardCheck,
  Send, Cpu, MapPin, Image as ImageIcon, X, ChevronLeft, ChevronRight,
  Headphones, Loader2,
} from 'lucide-react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { EquipmentMilestone } from '@/lib/supabase'
import WarrantySubmitModal from '@/components/customer/WarrantySubmitModal'
import JerryWidget from '@/components/shared/JerryWidget'

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
  // The ticket's UUID — only meaningful for kind==='ticket' (links to
  // /customer/tickets/[id]). Troubleshooting-intake rows have no detail page,
  // so this stays undefined for them and those rows render non-clickable.
  id?: string
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
  const { setTheme } = useTheme()
  const [activeIdx, setActiveIdx] = useState(0)
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [claimUnit, setClaimUnit] = useState<UnitView | null>(null)
  const [claimSent, setClaimSent] = useState(false)

  // Customer portal is light-first: if this browser has never picked a theme,
  // default it to light here (scoped to the customer portal — admin/employee keep
  // the global 'system' default). A customer who toggles to dark is respected
  // (next-themes persists their choice in localStorage).
  useEffect(() => {
    try {
      if (!localStorage.getItem('theme')) setTheme('light')
    } catch {
      /* localStorage blocked — leave the global default */
    }
  }, [setTheme])

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

            <ThemeToggle />

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
              <HeroAction href="/customer/srv" icon={ClipboardCheck} label="Start-up readiness" />
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
                  <WarrantyCard w={active.warranty} onFileClaim={() => { setClaimSent(false); setClaimUnit(active) }} />
                </div>

                {claimSent && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <CheckCircle2 size={14} className="shrink-0" />
                    Your warranty claim has been submitted. Our team will review it and follow up by email.
                  </div>
                )}

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
              </div>
              {filteredRequests.length ? (
                <ul>
                  {filteredRequests.map((r) => {
                    const s = statusMeta(r.kind, r.status)
                    const rowContent = (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">{r.ref}</span>
                            <span className="text-[11px] text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="text-[11px] text-zinc-400">{r.kind === 'ticket' ? 'Support' : 'Checklist'}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">{r.title}</p>
                        </div>
                        <span className="hidden shrink-0 text-[11px] text-zinc-400 sm:block">{fmtDate(r.created_at)}</span>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{s.label}</span>
                      </>
                    )
                    return (
                      <li
                        key={`${r.kind}-${r.ref}`}
                        className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/60"
                      >
                        {r.kind === 'ticket' && r.id ? (
                          <Link
                            href={`/customer/tickets/${r.id}`}
                            className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                          >
                            {rowContent}
                            <ChevronRight size={14} className="shrink-0 text-zinc-300 transition-colors group-hover:text-emerald-500 dark:text-zinc-600" />
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-5 py-3">
                            {rowContent}
                          </div>
                        )}
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
            <JerryWidget
              apiEndpoint="/api/customer/assistant"
              suggestions={['Where is my unit?', 'How do I set the humidistat?', 'Is it under warranty?']}
              idleSubtitle={`Ask about ${companyName}'s equipment or IAT's documentation — I answer from the manuals and show you the page.`}
              footerNote="Jerry can make mistakes. For service or orders, use Submit a request or Contact Us."
            />

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

      {claimUnit && (
        <WarrantySubmitModal
          unit={{
            equipment_id: claimUnit.id,
            serial_number: claimUnit.serial_number,
            model_number: claimUnit.model_number,
          }}
          onClose={() => setClaimUnit(null)}
          onSuccess={() => {
            setClaimUnit(null)
            setClaimSent(true)
          }}
        />
      )}
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

function WarrantyCard({ w, onFileClaim }: { w: UnitView['warranty']; onFileClaim: () => void }) {
  const m = warrantyMeta(w)
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <div className="mb-2 flex items-center gap-2 text-zinc-400">
        <ShieldCheck size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Warranty</span>
      </div>
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ${m.cls}`}>{m.label}</span>
      <p className="mt-1.5 truncate text-[11px] text-zinc-400">{m.sub}</p>
      {w.state === 'in' && (
        <button
          onClick={onFileClaim}
          className="mt-2 text-[11.5px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          File a claim
        </button>
      )}
    </div>
  )
}

// Card header — shared by the empty + populated tracker states.
function TrackerHead({ stage, hasMs }: { stage: string | null; hasMs: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <Truck size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Build &amp; Shipping</h2>
      </div>
      {hasMs && <span className="text-[12px] font-medium text-zinc-400">{stage || 'Not started'}</span>}
    </div>
  )
}

// Build → ship progress drawn as a gently winding road: each milestone is a "stop"
// along a smooth meandering road (Catmull-Rom curve; stops dip and rise), with dashed
// center-line markings and a truck at the current stop. Tapping a stop opens its panel.
// The road + nodes are SVG (scale with the card width); labels, truck, and hit areas are
// HTML positioned by percentage over the SVG so text stays crisp at any size.
function Tracker({ unit }: { unit: UnitView }) {
  const ms = unit.milestones
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  if (ms.length === 0) {
    return (
      <section className={CARD}>
        <TrackerHead stage={null} hasMs={false} />
        <p className="px-5 py-8 text-center text-[13px] text-zinc-400">
          Status updates will appear here once your build kicks off.
        </p>
      </section>
    )
  }

  // The "you are here" stop: the in-progress one, else the next not-yet-complete, else the last.
  const currentIndex = (() => {
    const ip = ms.findIndex((m) => m.status === 'in_progress')
    if (ip !== -1) return ip
    const np = ms.findIndex((m) => m.status !== 'complete')
    return np !== -1 ? np : ms.length - 1
  })()
  const allDone = ms.every((m) => m.status === 'complete')

  // ── Winding-road geometry (viewBox units) ──
  // Up to 5 stops per row (kept on a single row when possible for one flowing curve);
  // along the route alternate stops dip and rise so the road gently meanders, drawn as
  // one smooth Catmull-Rom curve with dashed center-line markings.
  const VBW = 600
  const MX = 64
  const TOP = 64
  const ROW = 122
  const BOT = 80
  const AMP = 24 // vertical "wind" amplitude
  const rowsCount = Math.ceil(ms.length / 5)
  const COLS = Math.ceil(ms.length / rowsCount)
  const VBH = TOP + (rowsCount - 1) * ROW + BOT
  const colX = (c: number) => (COLS === 1 ? VBW / 2 : MX + c * ((VBW - 2 * MX) / (COLS - 1)))
  const pos = ms.map((_, i) => {
    const r = Math.floor(i / COLS)
    const k = i % COLS
    const c = r % 2 === 0 ? k : COLS - 1 - k // odd rows run right→left
    const wind = i % 2 === 0 ? -AMP : AMP // alternate rise/dip along the route
    return { x: colX(c), y: TOP + r * ROW + wind }
  })

  // Smooth curve through the stops (Catmull-Rom). `upto` truncates at the current stop.
  const smoothPath = (pts: { x: number; y: number }[], upto = pts.length - 1) => {
    if (!pts.length) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < upto; i++) {
      const p0 = pts[i - 1] ?? pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] ?? p2
      const c1x = p1.x + (p2.x - p0.x) / 6
      const c1y = p1.y + (p2.y - p0.y) / 6
      const c2x = p2.x - (p3.x - p1.x) / 6
      const c2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x} ${p2.y}`
    }
    return d
  }
  const roadFull = smoothPath(pos)
  const roadDone = smoothPath(pos, currentIndex) // emerald portion ends at the current stop

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const openMs = openIdx !== null ? ms[openIdx] : null

  return (
    <section className={`${CARD} relative`}>
      <TrackerHead stage={unit.progress.currentStage} hasMs />
      <div className="px-4 pb-5 pt-3">
        <div className="relative">
          <svg viewBox={`0 0 ${VBW} ${VBH}`} className="block h-auto w-full" role="img" aria-label="Build and shipping progress">
            {/* road base (asphalt) */}
            <path d={roadFull} fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            {/* completed portion */}
            <path d={roadDone} fill="none" className="stroke-emerald-500" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            {/* center-line lane markings */}
            <path d={roadFull} fill="none" className="stroke-white" strokeOpacity={0.85} strokeWidth={1.8} strokeDasharray="5 11" strokeLinecap="round" />
            {/* checkpoints */}
            {ms.map((m, i) => {
              const p = pos[i]
              const isDone = m.status === 'complete'
              const isCurrent = i === currentIndex && !isDone
              if (isDone) {
                return (
                  <g key={m.id}>
                    <circle cx={p.x} cy={p.y} r={15} className="fill-emerald-500" />
                    <path d={`M ${p.x - 6} ${p.y} l 4 4 l 8 -8`} fill="none" className="stroke-white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )
              }
              if (isCurrent) {
                return <circle key={m.id} cx={p.x} cy={p.y} r={17} className="fill-white stroke-emerald-500 dark:fill-zinc-900" strokeWidth={3} />
              }
              return (
                <g key={m.id}>
                  <circle cx={p.x} cy={p.y} r={14} className="fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600" strokeWidth={2.5} />
                  <circle cx={p.x} cy={p.y} r={3.5} className="fill-zinc-300 dark:fill-zinc-600" />
                </g>
              )
            })}
          </svg>

          {/* clickable hit area over each stop → opens its detail panel */}
          {ms.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpenIdx(i)}
              aria-label={`${m.stage} — view details`}
              className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              style={{ left: pct(pos[i].x, VBW), top: pct(pos[i].y, VBH) }}
            />
          ))}

          {/* crisp HTML labels, centered under each stop (also clickable) */}
          {ms.map((m, i) => {
            const p = pos[i]
            const isDone = m.status === 'complete'
            const isCurrent = i === currentIndex && !isDone
            const sub = isCurrent ? 'In progress' : isDone ? `Done ${fmtDate(m.occurred_at)}` : 'Pending'
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpenIdx(i)}
                className="absolute -translate-x-1/2 px-1 text-center"
                style={{ left: pct(p.x, VBW), top: pct(p.y + 23, VBH), width: `${100 / COLS}%` }}
              >
                <span className={`block truncate text-[11.5px] font-semibold leading-tight ${isDone || isCurrent ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{m.stage}</span>
                <span className="mt-0.5 block truncate text-[10px] text-zinc-400">{sub}</span>
              </button>
            )
          })}

          {/* truck parked at the current stop (hidden once everything's delivered) */}
          {!allDone && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-emerald-500"
              style={{ left: pct(pos[currentIndex].x, VBW), top: pct(pos[currentIndex].y, VBH) }}
            >
              <Truck size={16} strokeWidth={2.4} />
            </div>
          )}
        </div>

        {(unit.ship_date || unit.location) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-100 pt-3 text-[11.5px] text-zinc-400 dark:border-zinc-800">
            {unit.ship_date && <span className="inline-flex items-center gap-1.5"><Truck size={12} /> Ship date {fmtDate(unit.ship_date)}</span>}
            {unit.location && <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> {unit.location}</span>}
          </div>
        )}
      </div>

      {/* Milestone detail panel (opens on tapping a stop) */}
      {openMs && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={() => setOpenIdx(null)} className="absolute inset-0 bg-zinc-900/45" />
          <div className="relative w-full max-w-[330px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div>
                <p className="text-[14px] font-bold text-zinc-900 dark:text-white">{openMs.stage}</p>
                <p className="mt-0.5 text-[11.5px] text-zinc-400">
                  {openMs.status === 'complete'
                    ? `Completed ${fmtDate(openMs.occurred_at)}`
                    : openMs.status === 'in_progress'
                      ? 'In progress'
                      : 'Pending'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenIdx(null)}
                aria-label="Close"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3">
              {openMs.note && <p className="mb-3 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">{openMs.note}</p>}
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Documents</p>
              <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">Documents for this stage will appear here once they&apos;re available.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ResourceCard removed — customer support entry points now live only in the hero
// ("Submit a request" / "Check status") and the right-rail Knowledge Base card.

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
// Departments a customer can direct a message to (routing is server-side).
const DEPARTMENTS = ['Sales', 'Customer Service', 'Engineering', 'Billing'] as const
type Department = (typeof DEPARTMENTS)[number]

function ContactCard() {
  const [message, setMessage] = useState('')
  const [department, setDepartment] = useState<Department>('Customer Service')
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
        body: JSON.stringify({ message, department }),
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
        {sent ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Thanks — your message is on its way to our {department} team.
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="cu-dept" className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Who can we connect you with?
              </label>
              <select
                id="cu-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
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
