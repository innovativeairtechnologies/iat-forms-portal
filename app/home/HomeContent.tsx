import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Newspaper, CalendarDays, Users, Briefcase, Cake, Compass,
  ShieldCheck, ArrowRight, Gift, PartyPopper,
  CalendarClock, FileText, Network, Wrench, GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FUN_FACTS, REFERRAL, SAFETY, type CoreValue } from '@/lib/home-content'
import type { HomeData } from '@/lib/home-data'
import { StatusPill, type Tone } from '@/components/admin/list'
import { PersonAvatar } from './home-ui'
import { FunFact } from './FunFact'
import { HomeTopBar } from './HomeTopBar'

/* ════════════════════════════════════════════════════════════════════════════
   COMPANY HOME — "The Lobby" (compact dashboard)

   THE homepage design file. Renders inside both portal shells (/admin/home and
   /employee/home, via app/home/HomePage.tsx). Matches the shipped dashboard
   chrome: a stone-50 canvas with an emerald glow, an emerald→teal gradient
   greeting, white rounded-xl cards, one emerald accent used warmly. Laid out to
   fit close to one screen on desktop (minimal scroll).

   TO MAKE SMALL DESIGN CHANGES, edit here:
     • Colors / spacing / shadows ...... the className strings below
     • Which cards show + their order .... the JSX in HomeContent()
     • Top-bar items (Email IT, idea) .. app/home/HomeTopBar.tsx
     • Editable text (news, values, the
       referral, the safety streak) ..... lib/home-content.ts
   ════════════════════════════════════════════════════════════════════════════ */

// ── date helpers (Eastern; IAT is US-based) ──────────────────────────────────
function isoTile(iso: string) {
  const day = new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
  const mon = new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short' }).toUpperCase()
  return { day, mon }
}
function ymdTile(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { day: String(d), mon: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() }
}
function fmtRange(startsOn: string, endsOn?: string | null) {
  const one = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return endsOn && endsOn !== startsOn ? `${one(startsOn)} – ${one(endsOn)}` : one(startsOn)
}
function daysUntil(date: Date): string {
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const n = Math.round((b - a) / 864e5)
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`
}

const CATEGORY_TONE: Record<string, Tone> = { news: 'slate', safety: 'amber', event: 'sky', it: 'violet' }
const KIND_TONE: Record<string, Tone> = { holiday: 'violet', training: 'sky', visit: 'amber', closure: 'rose', event: 'slate' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Floating white IAT logos in the hero background — different sizes, low opacity,
// so they read as "just there" rather than placed. Gentle drift (reduced-motion off).
// Five distinct drift paths (2-D travel + a little rotation) so the logos each
// move differently — scattered across the whole hero, small and low-opacity.
// Bump the px values in the keyframes if you want them to travel even more.
const PARTICLE_CSS = `
@keyframes iatFloat1{0%,100%{transform:translate(0,0) rotate(0deg)}33%{transform:translate(14px,-22px) rotate(7deg)}66%{transform:translate(-10px,-12px) rotate(-5deg)}}
@keyframes iatFloat2{0%,100%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(-16px,-14px) rotate(-9deg)}60%{transform:translate(12px,-26px) rotate(6deg)}}
@keyframes iatFloat3{0%,100%{transform:translate(0,0) rotate(0deg)}40%{transform:translate(20px,-10px) rotate(10deg)}75%{transform:translate(-9px,-20px) rotate(-7deg)}}
@keyframes iatFloat4{0%,100%{transform:translate(0,0) rotate(0deg)}30%{transform:translate(-13px,-24px) rotate(5deg)}70%{transform:translate(17px,-9px) rotate(-10deg)}}
@keyframes iatFloat5{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(9px,-28px) rotate(9deg)}}
@keyframes iatFloat6{0%,100%{transform:translate(0,0)}33%{transform:translate(-26px,-30px)}66%{transform:translate(22px,-14px)}}
.iat-particle{animation-timing-function:ease-in-out;animation-iteration-count:infinite;will-change:transform}
@media (prefers-reduced-motion:reduce){.iat-particle{animation:none!important}}
`
const PARTICLES = [
  { left: '6%',  top: '14%', w: 22, o: 0.08, a: 1, d: '12s', dl: '0s' },
  { left: '17%', top: '60%', w: 18, o: 0.06, a: 3, d: '15s', dl: '1.2s' },
  { left: '29%', top: '26%', w: 24, o: 0.07, a: 2, d: '13s', dl: '0.5s' },
  { left: '41%', top: '72%', w: 16, o: 0.05, a: 4, d: '16s', dl: '2s' },
  { left: '53%', top: '18%', w: 20, o: 0.07, a: 5, d: '11s', dl: '0.8s' },
  { left: '65%', top: '54%', w: 26, o: 0.08, a: 1, d: '14s', dl: '1.6s' },
  { left: '77%', top: '30%', w: 18, o: 0.06, a: 3, d: '12s', dl: '0.3s' },
  { left: '88%', top: '66%', w: 22, o: 0.07, a: 2, d: '15s', dl: '1s' },
  { left: '11%', top: '84%', w: 16, o: 0.05, a: 5, d: '13s', dl: '2.4s' },
  { left: '47%', top: '44%', w: 20, o: 0.06, a: 4, d: '17s', dl: '0.6s' },
  { left: '72%', top: '10%', w: 18, o: 0.06, a: 1, d: '12s', dl: '1.9s' },
  { left: '24%', top: '46%', w: 22, o: 0.07, a: 2, d: '14s', dl: '1.1s' },
  { left: '84%', top: '44%', w: 16, o: 0.05, a: 3, d: '16s', dl: '0.4s' },
  { left: '60%', top: '82%', w: 20, o: 0.06, a: 4, d: '13s', dl: '2.1s' },
]

// Soft light orbs drifting with the logos — bigger, slower, blurrier, about half
// as many. `s` is the diameter; `a` picks a drift path (6 travels the farthest).
const ORBS = [
  { left: '10%', top: '28%', s: 64, o: 0.16, a: 6, d: '19s', dl: '0s' },
  { left: '30%', top: '70%', s: 44, o: 0.14, a: 4, d: '22s', dl: '1.5s' },
  { left: '50%', top: '22%', s: 80, o: 0.12, a: 1, d: '24s', dl: '0.7s' },
  { left: '68%', top: '64%', s: 52, o: 0.15, a: 6, d: '18s', dl: '2.2s' },
  { left: '83%', top: '14%', s: 40, o: 0.14, a: 5, d: '20s', dl: '1s' },
  { left: '90%', top: '55%', s: 68, o: 0.12, a: 2, d: '23s', dl: '0.4s' },
  { left: '20%', top: '10%', s: 48, o: 0.13, a: 3, d: '21s', dl: '1.8s' },
]

// ── shared card chrome (mirrors the /admin + /employee dashboards) ───────────
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900/40 dark:shadow-none ${className}`}>
      {children}
    </div>
  )
}

function CardHead({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200/70 px-4 py-3 dark:border-stone-800/80">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-stone-400 dark:text-stone-500">{icon}</span>
        <h3 className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
      </div>
      {right}
    </div>
  )
}

function Kpi({ icon, label, value, sub, valueClassName = 'text-[24px]' }: {
  icon: ReactNode; label: string; value: ReactNode; sub: ReactNode; valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/40 dark:shadow-none dark:hover:border-stone-700">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-emerald-500 dark:text-emerald-400">{icon}</span>
        <span className="text-[12px] font-medium text-stone-500 dark:text-stone-400">{label}</span>
      </div>
      <div className={`font-bold leading-none tracking-tight text-stone-900 tabular-nums dark:text-white ${valueClassName}`}>{value}</div>
      <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">{sub}</p>
    </div>
  )
}

function DateChip({ day, mon, accent = false }: { day: string; mon: string; accent?: boolean }) {
  return (
    <div className={`flex h-[38px] w-[38px] flex-shrink-0 flex-col items-center justify-center rounded-lg leading-none ${
      accent ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
    }`}>
      <span className="text-[13px] font-bold">{day}</span>
      <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide">{mon}</span>
    </div>
  )
}

function HeroLink({ href, icon: Icon, label, primary = false }: {
  href: string; icon: LucideIcon; label: string; primary?: boolean
}) {
  const cls = `inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
    primary ? 'bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25'
  }`
  return <Link href={href} className={cls}><Icon size={15} className="flex-shrink-0" />{label}</Link>
}

const overline = 'text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500'

export function HomeContent({
  greeting, dateET, firstName, funIdx, data, name, profileHref,
  unreadCount = 0, ticketCount = 0,
  coreValue, coreValueIndex, coreValueTotal,
}: {
  greeting: string; dateET: string; firstName: string; funIdx: number; data: HomeData
  name: string; profileHref: string; unreadCount?: number; ticketCount?: number
  coreValue: CoreValue; coreValueIndex: number; coreValueTotal: number
}) {
  const daysIncidentFree = Math.max(0, Math.floor((Date.now() - Date.parse(SAFETY.since + 'T00:00:00')) / 864e5))
  const nh = data.nextHoliday
  const [lead, ...restNews] = data.news
  const outCount = data.whosOut.length

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#FAF6EF] text-stone-700 dark:bg-[#0c0b0a] dark:text-stone-300">

      <HomeTopBar name={name} profileHref={profileHref} unreadCount={unreadCount} ticketCount={ticketCount} />

      <div className="relative isolate min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <style>{PARTICLE_CSS}</style>

        {/* Ambient emerald/sky glow — same soft orbs as the /admin dashboard. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
          <div className="absolute -top-44 right-[-100px] h-[540px] w-[540px] rounded-full bg-gradient-to-br from-amber-300/25 via-amber-400/10 to-transparent blur-3xl dark:from-amber-500/14 dark:via-amber-600/6" />
          <div className="absolute -top-24 right-[26%] h-[380px] w-[380px] rounded-full bg-gradient-to-br from-emerald-400/22 via-emerald-500/10 to-transparent blur-3xl dark:from-emerald-500/16 dark:via-emerald-600/7" />
          <div className="absolute top-16 left-[-150px] h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-orange-300/16 via-rose-300/8 to-transparent blur-3xl dark:from-orange-500/12 dark:via-rose-500/6" />
        </div>

        <div className="mx-auto max-w-[1180px] space-y-4 p-4 sm:p-5">

          {/* ── Greeting hero — gradient + floating IAT logos ─────────────── */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 shadow-sm dark:from-emerald-700 dark:to-emerald-950 sm:p-7">
            <div className="pointer-events-none absolute -right-10 -top-20 h-60 w-60 rounded-full bg-amber-300/30 blur-3xl" />
            <div className="pointer-events-none absolute right-24 -top-14 h-40 w-40 rounded-full bg-amber-100/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-orange-400/15 blur-3xl" />
            {/* floating white-logo particles (right side, low opacity) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              {PARTICLES.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src="/iat-logo-transparent.png"
                  alt=""
                  className="iat-particle absolute select-none"
                  style={{
                    left: p.left, top: p.top, width: p.w, height: 'auto', opacity: p.o,
                    filter: 'brightness(0) invert(1)',
                    animationName: `iatFloat${p.a}`, animationDuration: p.d, animationDelay: p.dl,
                  }}
                />
              ))}
              {ORBS.map((p, i) => (
                <span
                  key={`orb-${i}`}
                  className="iat-particle absolute rounded-full"
                  style={{
                    left: p.left, top: p.top, width: p.s, height: p.s, opacity: p.o,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)',
                    filter: 'blur(6px)',
                    animationName: `iatFloat${p.a}`, animationDuration: p.d, animationDelay: p.dl,
                  }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">{dateET}</p>
              <h1 className="mt-1.5 text-[25px] font-bold leading-tight tracking-tight text-white sm:text-[27px]">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-emerald-50/90">
                Here&apos;s what&apos;s happening around IAT today
                {outCount > 0 ? <> — <span className="font-semibold text-white">{outCount}</span> teammate{outCount === 1 ? '' : 's'} out this week</> : null}
                {nh ? <>, and {nh.name} is {daysUntil(nh.date)}</> : null}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <HeroLink href="/employee/requests" icon={CalendarClock} label="Request time off" primary />
                <HeroLink href="/employee/resources" icon={FileText} label="Submit a form" />
                <HeroLink href="/employee/directory" icon={Network} label="Team directory" />
                <HeroLink href="/employee/resources/tools" icon={Wrench} label="Tools & apps" />
                <HeroLink href="/learn" icon={GraduationCap} label="Browse training" />
              </div>
              <div className="mt-4">
                <FunFact facts={FUN_FACTS} initialIndex={funIdx} />
              </div>
            </div>
          </section>

          {/* ── Company at a glance ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi icon={<Users size={15} />} label="Teammates" value={data.headcount} sub="Active on the team" />
            <Kpi icon={<ShieldCheck size={15} />} label="Days incident-free" value={daysIncidentFree}
              sub={<span className="font-medium text-emerald-600 dark:text-emerald-400">Shop-floor safety streak</span>} />
            <Kpi icon={<Briefcase size={15} />} label="Open roles" value={data.openings.length} sub="Hiring now" />
            <Kpi icon={<CalendarDays size={15} />} label="Next holiday" valueClassName="text-[17px]"
              value={nh ? nh.name : '—'}
              sub={nh ? `${nh.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${daysUntil(nh.date)}` : 'None scheduled'} />
          </div>

          {/* ── Company News + This Week ──────────────────────────────────── */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">

            <Card className="lg:col-span-2">
              <CardHead icon={<Newspaper size={14} />} title="Company News" />
              {lead && (
                <article className="border-b border-stone-100 px-4 py-3.5 dark:border-stone-800/50">
                  <div className="mb-2 flex items-center gap-2.5">
                    {lead.category && <StatusPill tone={CATEGORY_TONE[lead.category] ?? 'slate'}>{lead.category}</StatusPill>}
                    <span className="text-[11px] text-stone-400 dark:text-stone-500">
                      {new Date(lead.date).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <h2 className="text-[16px] font-bold leading-snug tracking-tight text-stone-900 dark:text-white">{lead.title}</h2>
                  {lead.body && <p className="mt-1 line-clamp-2 max-w-[64ch] text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">{lead.body}</p>}
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Read the full update <ArrowRight size={13} />
                  </span>
                </article>
              )}
              <ul className="divide-y divide-stone-100 dark:divide-stone-800/50">
                {restNews.slice(0, 2).map((n) => {
                  const { day, mon } = isoTile(n.date)
                  return (
                    <li key={n.id} className="flex items-start gap-3 px-4 py-2.5">
                      <DateChip day={day} mon={mon} accent={n.pinned} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-semibold leading-snug text-stone-800 dark:text-stone-100">{n.title}</p>
                          {n.category && <StatusPill tone={CATEGORY_TONE[n.category] ?? 'slate'}>{n.category}</StatusPill>}
                        </div>
                        {n.body && <p className="mt-0.5 truncate text-[11.5px] text-stone-400 dark:text-stone-500">{n.body}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card>
              <CardHead icon={<CalendarDays size={14} />} title="This Week" />
              {nh && (
                <div className="mx-3.5 mt-3 flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <PartyPopper size={16} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-stone-900 dark:text-white">{nh.name}</p>
                    <p className="text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                      {nh.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {daysUntil(nh.date)}
                    </p>
                  </div>
                </div>
              )}
              <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800/50">
                {data.events.slice(0, 3).map((e) => {
                  const { day, mon } = ymdTile(e.startsOn)
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-3.5 py-2">
                      <DateChip day={day} mon={mon} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12.5px] font-semibold leading-snug text-stone-800 dark:text-stone-100">{e.title}</p>
                          <StatusPill tone={KIND_TONE[e.kind] ?? 'slate'}>{cap(e.kind)}</StatusPill>
                        </div>
                      </div>
                    </li>
                  )
                })}
                {data.events.length === 0 && <li className="px-3.5 py-3 text-[11.5px] text-stone-400 dark:text-stone-500">No upcoming events.</li>}
              </ul>
              <div className="mt-auto border-t border-stone-100 px-3.5 py-3 dark:border-stone-800/50">
                <p className={overline}>Out this week</p>
                {outCount > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {data.whosOut.slice(0, 3).map((w, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <PersonAvatar name={w.name} size={22} />
                        <span className="flex-1 truncate text-[12.5px] font-medium text-stone-700 dark:text-stone-200">{w.name}</span>
                        <span className="text-[11px] tabular-nums text-stone-400 dark:text-stone-500">{fmtRange(w.startsOn, w.endsOn)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11.5px] text-stone-400 dark:text-stone-500">Everyone&apos;s in this week.</p>
                )}
              </div>
            </Card>
          </div>

          {/* ── Our People + Milestones + Open Positions ──────────────────── */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">

            <Card>
              <CardHead icon={<Users size={14} />} title="Our People" />
              <div className="divide-y divide-stone-100 dark:divide-stone-800/50">
                <div className="flex items-start gap-3 px-4 py-3">
                  <PersonAvatar name={data.newHire.name} src={data.newHire.avatarUrl} size={38} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-bold capitalize text-stone-900 dark:text-white">{data.newHire.name}</p>
                      <StatusPill tone="emerald">New hire</StatusPill>
                    </div>
                    <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">{[data.newHire.title, data.newHire.department].filter(Boolean).join(' · ')}</p>
                    {data.newHire.blurb && <p className="mt-1 line-clamp-1 text-[11.5px] leading-relaxed text-stone-600 dark:text-stone-300">{data.newHire.blurb}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <PersonAvatar name={data.spotlight.name} src={data.spotlight.avatarUrl} size={38} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-bold text-stone-900 dark:text-white">{data.spotlight.name}</p>
                      <StatusPill tone="violet">Spotlight</StatusPill>
                    </div>
                    <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">{[data.spotlight.title, data.spotlight.meta].filter(Boolean).join(' · ')}</p>
                    {data.spotlight.blurb && <p className="mt-1 line-clamp-1 text-[11.5px] leading-relaxed text-stone-600 dark:text-stone-300">{data.spotlight.blurb}</p>}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHead icon={<Cake size={14} />} title="Milestones" />
              <ul className="divide-y divide-stone-100 dark:divide-stone-800/50">
                {data.peopleEvents.slice(0, 4).map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2">
                    <PersonAvatar name={p.name} src={p.avatarUrl} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-stone-800 dark:text-stone-100">{p.name}</span>
                    <StatusPill tone={p.kind === 'birthday' ? 'sky' : 'emerald'}>
                      {p.kind === 'birthday' ? `Birthday · ${p.label}` : p.label}
                    </StatusPill>
                  </li>
                ))}
                {data.peopleEvents.length === 0 && <li className="px-4 py-4 text-[11.5px] text-stone-400 dark:text-stone-500">No upcoming milestones.</li>}
              </ul>
            </Card>

            <Card>
              <CardHead icon={<Briefcase size={14} />} title="Open Positions"
                right={<span className="text-[11.5px] tabular-nums text-stone-400 dark:text-stone-500">{data.openings.length} open</span>} />
              <ul className="divide-y divide-stone-100 dark:divide-stone-800/50">
                {data.openings.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      {o.applyUrl ? (
                        <a href={o.applyUrl} className="truncate text-[12.5px] font-semibold text-stone-800 hover:text-emerald-600 dark:text-stone-100 dark:hover:text-emerald-400">{o.title}</a>
                      ) : (
                        <p className="truncate text-[12.5px] font-semibold text-stone-800 dark:text-stone-100">{o.title}</p>
                      )}
                      {(o.department || o.employmentType) && (
                        <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">{[o.department, o.employmentType].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <StatusPill tone="sky">Open</StatusPill>
                  </li>
                ))}
              </ul>
              <div className="mx-3.5 mb-3.5 mt-auto flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3.5 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <Gift size={16} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-[11.5px] leading-snug text-stone-600 dark:text-stone-300">
                  {REFERRAL.lead} — earn <span className="font-bold text-stone-900 dark:text-white">{REFERRAL.bonus}</span> if hired.
                </p>
              </div>
            </Card>
          </div>

          {/* ── Core value of the week — slim band ────────────────────────── */}
          <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-5 py-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-shrink-0 items-center gap-2">
                <Compass size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Core value · this week</span>
              </div>
              <p className="min-w-0 text-[13px] leading-relaxed text-stone-700 dark:text-stone-200">
                <span className="font-bold text-stone-900 dark:text-white">{coreValue.title}</span> — {coreValue.body}
              </p>
              <span className="ml-auto hidden flex-shrink-0 text-[11px] tabular-nums text-emerald-700/70 dark:text-emerald-400/70 sm:block">
                {coreValueIndex + 1} of {coreValueTotal}
              </span>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
