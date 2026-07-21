import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  Newspaper, CalendarDays, Users, Briefcase, Cake, Compass,
  ShieldCheck, ArrowRight, Gift, PartyPopper,
  CalendarClock, FileText, Network, Wrench, GraduationCap, Mail,
} from 'lucide-react'
import { FUN_FACTS, REFERRAL, IT_SUPPORT, SAFETY, type CoreValue } from '@/lib/home-content'
import type { HomeData } from '@/lib/home-data'
import { StatusPill, type Tone } from '@/components/admin/list'
import { PersonAvatar } from './home-ui'
import { FunFact } from './FunFact'
import { SuggestionBox } from './SuggestionBox'

/* ════════════════════════════════════════════════════════════════════════════
   COMPANY HOME — "The Lobby"

   This is THE homepage design file. It renders inside both portal shells
   (/admin/home and /employee/home, via app/home/HomePage.tsx). It's built to
   match the shipped dashboard chrome (see /admin + /employee/profile): a warm
   zinc-50 canvas with a soft emerald glow, an emerald→teal gradient greeting,
   white rounded-xl cards with soft shadows, and one emerald accent used warmly.

   TO MAKE SMALL DESIGN CHANGES, edit right here:
     • Colors / spacing / shadows ...... the className strings on Card / Kpi / hero
     • Which cards show + their order .... the JSX in HomeContent() below
     • Editable text (news, values, the
       referral bonus, the safety streak) . lib/home-content.ts
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

// ── shared card chrome (mirrors the /admin + /employee dashboards) ───────────
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none ${className}`}>
      {children}
    </div>
  )
}

function CardHead({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-3.5 dark:border-zinc-800/80">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      {right}
    </div>
  )
}

function Kpi({ icon, label, value, sub, valueClassName = 'text-[26px]' }: {
  icon: ReactNode; label: string; value: ReactNode; sub: ReactNode; valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none dark:hover:border-zinc-700">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-emerald-500 dark:text-emerald-400">{icon}</span>
        <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className={`font-bold leading-none tracking-tight text-zinc-900 tabular-nums dark:text-white ${valueClassName}`}>{value}</div>
      <p className="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  )
}

/** Stacked day/month chip for news + event rows. */
function DateChip({ day, mon, big = false, accent = false }: { day: string; mon: string; big?: boolean; accent?: boolean }) {
  return (
    <div className={`flex flex-shrink-0 flex-col items-center justify-center rounded-lg leading-none ${big ? 'h-11 w-11' : 'h-[38px] w-[38px]'} ${
      accent ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
    }`}>
      <span className={`font-bold ${big ? 'text-[15px]' : 'text-[13px]'}`}>{day}</span>
      <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide">{mon}</span>
    </div>
  )
}

/** Greeting quick-link. Emerald-tinted actions that read on the gradient hero. */
function HeroLink({ href, icon: Icon, label, primary = false, external = false }: {
  href: string; icon: typeof Mail; label: string; primary?: boolean; external?: boolean
}) {
  const cls = `inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
    primary
      ? 'bg-white text-emerald-700 hover:bg-emerald-50'
      : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25'
  }`
  const inner = <><Icon size={15} className="flex-shrink-0" />{label}</>
  return external
    ? <a href={href} className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>
}

const overline = 'text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500'

export function HomeContent({
  greeting, dateET, firstName, funIdx, data,
  coreValue, coreValueIndex, coreValueTotal,
}: {
  greeting: string; dateET: string; firstName: string; funIdx: number; data: HomeData
  /** Kept for caller compatibility; the lobby scrolls naturally so it's unused. */
  heightClass?: string
  coreValue: CoreValue; coreValueIndex: number; coreValueTotal: number
}) {
  const daysIncidentFree = Math.max(0, Math.floor((Date.now() - Date.parse(SAFETY.since + 'T00:00:00')) / 864e5))
  const nh = data.nextHoliday
  const [lead, ...restNews] = data.news
  const outCount = data.whosOut.length

  return (
    <div className="relative isolate flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-zinc-50 text-zinc-700 dark:bg-[#0a0a0b] dark:text-zinc-300">

      {/* Ambient emerald/sky glow — same soft orbs as the /admin dashboard. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute -top-40 right-[-120px] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-emerald-400/25 via-emerald-500/10 to-transparent blur-3xl dark:from-emerald-500/18 dark:via-emerald-600/8" />
        <div className="absolute top-10 left-[-140px] h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-sky-400/14 via-teal-400/8 to-transparent blur-3xl dark:from-sky-500/12 dark:via-teal-500/6" />
      </div>

      <div className="mx-auto max-w-[1180px] space-y-5 p-5 sm:p-6">

        {/* ── Greeting hero — emerald→teal gradient ─────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 shadow-sm dark:from-emerald-700 dark:to-teal-900 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-140px] left-[24%] h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">{dateET}</p>
            <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[28px]">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-emerald-50/90">
              Here&apos;s what&apos;s happening around IAT today
              {outCount > 0 ? <> — <span className="font-semibold text-white">{outCount}</span> teammate{outCount === 1 ? '' : 's'} out this week</> : null}
              {nh ? <>, and {nh.name} is {daysUntil(nh.date)}</> : null}.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <HeroLink href="/employee/requests" icon={CalendarClock} label="Request time off" primary />
              <HeroLink href="/employee/resources" icon={FileText} label="Submit a form" />
              <HeroLink href="/employee/directory" icon={Network} label="Team directory" />
              <HeroLink href="/employee/resources/tools" icon={Wrench} label="Tools & apps" />
              <HeroLink href="/learn" icon={GraduationCap} label="Browse training" />
            </div>
          </div>
        </section>

        {/* ── Company at a glance ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi icon={<Users size={15} />} label="Teammates" value={data.headcount} sub="Active on the team" />
          <Kpi icon={<ShieldCheck size={15} />} label="Days incident-free" value={daysIncidentFree}
            sub={<span className="font-medium text-emerald-600 dark:text-emerald-400">Shop-floor safety streak</span>} />
          <Kpi icon={<Briefcase size={15} />} label="Open roles" value={data.openings.length} sub="Hiring now" />
          <Kpi icon={<CalendarDays size={15} />} label="Next holiday" valueClassName="text-[18px]"
            value={nh ? nh.name : '—'}
            sub={nh ? `${nh.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${daysUntil(nh.date)}` : 'None scheduled'} />
        </div>

        {/* ── Company News + This Week ──────────────────────────────────── */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">

          <Card className="lg:col-span-2">
            <CardHead icon={<Newspaper size={14} />} title="Company News" />
            {lead && (
              <article className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800/50">
                <div className="mb-2.5 flex items-center gap-2.5">
                  {lead.category && <StatusPill tone={CATEGORY_TONE[lead.category] ?? 'slate'}>{lead.category}</StatusPill>}
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {new Date(lead.date).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <h2 className="text-[17px] font-bold leading-snug tracking-tight text-zinc-900 dark:text-white">{lead.title}</h2>
                {lead.body && <p className="mt-1.5 max-w-[64ch] text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{lead.body}</p>}
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Read the full update <ArrowRight size={13} />
                </span>
              </article>
            )}
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {restNews.map((n) => {
                const { day, mon } = isoTile(n.date)
                return (
                  <li key={n.id} className="flex items-start gap-3 px-5 py-3">
                    <DateChip day={day} mon={mon} accent={n.pinned} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{n.title}</p>
                        {n.category && <StatusPill tone={CATEGORY_TONE[n.category] ?? 'slate'}>{n.category}</StatusPill>}
                      </div>
                      {n.body && <p className="mt-0.5 truncate text-[11.5px] text-zinc-400 dark:text-zinc-500">{n.body}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHead icon={<CalendarDays size={14} />} title="This Week" />
            {nh && (
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <PartyPopper size={16} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-zinc-900 dark:text-white">{nh.name}</p>
                  <p className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {nh.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {daysUntil(nh.date)}
                  </p>
                </div>
              </div>
            )}
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {data.events.map((e) => {
                const { day, mon } = ymdTile(e.startsOn)
                return (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                    <DateChip day={day} mon={mon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{e.title}</p>
                        <StatusPill tone={KIND_TONE[e.kind] ?? 'slate'}>{cap(e.kind)}</StatusPill>
                      </div>
                      {e.description && <p className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">{e.description}</p>}
                    </div>
                  </li>
                )
              })}
              {data.events.length === 0 && <li className="px-4 py-3 text-[11.5px] text-zinc-400 dark:text-zinc-500">No upcoming events.</li>}
            </ul>
            <div className="mt-auto border-t border-zinc-100 px-4 py-3.5 dark:border-zinc-800/50">
              <p className={overline}>Out this week</p>
              {outCount > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {data.whosOut.map((w, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <PersonAvatar name={w.name} size={24} />
                      <span className="flex-1 truncate text-[12.5px] font-medium text-zinc-700 dark:text-zinc-200">{w.name}</span>
                      <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{fmtRange(w.startsOn, w.endsOn)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11.5px] text-zinc-400 dark:text-zinc-500">Everyone&apos;s in this week.</p>
              )}
            </div>
          </Card>
        </div>

        {/* ── Our People + Milestones ───────────────────────────────────── */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">

          <Card>
            <CardHead icon={<Users size={14} />} title="Our People" />
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              <div className="flex items-start gap-3 px-5 py-4">
                <PersonAvatar name={data.newHire.name} src={data.newHire.avatarUrl} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-bold capitalize text-zinc-900 dark:text-white">{data.newHire.name}</p>
                    <StatusPill tone="emerald">New hire</StatusPill>
                  </div>
                  <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">{[data.newHire.title, data.newHire.department].filter(Boolean).join(' · ')}</p>
                  {data.newHire.blurb && <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">{data.newHire.blurb}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3 px-5 py-4">
                <PersonAvatar name={data.spotlight.name} src={data.spotlight.avatarUrl} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-bold text-zinc-900 dark:text-white">{data.spotlight.name}</p>
                    <StatusPill tone="violet">Spotlight</StatusPill>
                  </div>
                  <p className="truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">{[data.spotlight.title, data.spotlight.meta].filter(Boolean).join(' · ')}</p>
                  {data.spotlight.blurb && <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">{data.spotlight.blurb}</p>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead icon={<Cake size={14} />} title="Milestones & Celebrations" />
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {data.peopleEvents.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <PersonAvatar name={p.name} src={p.avatarUrl} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100">{p.name}</span>
                  <StatusPill tone={p.kind === 'birthday' ? 'sky' : 'emerald'}>
                    {p.kind === 'birthday' ? `Birthday · ${p.label}` : p.label}
                  </StatusPill>
                </li>
              ))}
              {data.peopleEvents.length === 0 && <li className="px-5 py-4 text-[11.5px] text-zinc-400 dark:text-zinc-500">No upcoming milestones.</li>}
            </ul>
          </Card>
        </div>

        {/* ── Open Positions + Core Value ───────────────────────────────── */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">

          <Card>
            <CardHead icon={<Briefcase size={14} />} title="Open Positions"
              right={<span className="text-[11.5px] tabular-nums text-zinc-400 dark:text-zinc-500">{data.openings.length} open</span>} />
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {data.openings.slice(0, 4).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    {o.applyUrl ? (
                      <a href={o.applyUrl} className="truncate text-[12.5px] font-semibold text-zinc-800 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400">{o.title}</a>
                    ) : (
                      <p className="truncate text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-100">{o.title}</p>
                    )}
                    {(o.department || o.employmentType) && (
                      <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{[o.department, o.location, o.employmentType].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <StatusPill tone="sky">Open</StatusPill>
                </li>
              ))}
            </ul>
            <div className="mx-4 mb-4 mt-auto flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <Gift size={17} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[12px] leading-snug text-zinc-600 dark:text-zinc-300">
                {REFERRAL.lead} — earn <span className="font-bold text-zinc-900 dark:text-white">{REFERRAL.bonus}</span> if they&apos;re hired.
              </p>
            </div>
          </Card>

          <Card className="relative justify-center overflow-hidden">
            <div className="pointer-events-none absolute -left-10 -top-10 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative px-6 py-6">
              <div className="flex items-center gap-2">
                <Compass size={15} className="text-emerald-500 dark:text-emerald-400" />
                <p className={overline}>Core value · This week</p>
                <span className="ml-auto text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{coreValueIndex + 1} of {coreValueTotal}</span>
              </div>
              <h2 className="mt-3.5 text-[21px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-white">{coreValue.title}</h2>
              <p className="mt-2.5 max-w-[58ch] text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">{coreValue.body}</p>
              <p className="mt-4 text-[12px] italic text-zinc-400 dark:text-zinc-500">Rotates weekly · one of the nine IAT core values.</p>
            </div>
          </Card>
        </div>

        {/* ── Suggestion box ────────────────────────────────────────────── */}
        <Card>
          <CardHead icon={<Compass size={14} />} title="Have an idea?" />
          <div className="px-5 pb-2 pt-3">
            <p className="mb-2 text-[12px] text-zinc-500 dark:text-zinc-400">
              Something that would make IAT run better? It goes straight to leadership.
            </p>
          </div>
          <div className="h-[150px] px-2 pb-2">
            <SuggestionBox />
          </div>
        </Card>

        {/* ── Footer — Email IT + the day's fun fact ────────────────────── */}
        <div className="flex flex-col items-start justify-between gap-3 pt-1 sm:flex-row sm:items-center">
          <FunFact facts={FUN_FACTS} initialIndex={funIdx} />
          <a
            href={`mailto:${IT_SUPPORT.email}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
          >
            <Mail size={13} /> Email IT support
          </a>
        </div>

      </div>
    </div>
  )
}
