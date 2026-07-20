import type { ReactNode } from 'react'
import {
  Newspaper, CalendarDays, Briefcase, Cake, Users, Compass, Lightbulb,
  PartyPopper, Gift, Mail,
} from 'lucide-react'
import { FUN_FACTS, CORE_VALUES_INTRO, REFERRAL, IT_SUPPORT, type CoreValue } from '@/lib/home-content'
import type { HomeData } from '@/lib/home-data'
import { StatusPill, type Tone } from '@/components/admin/list'
import { PersonAvatar } from './home-ui'
import { FunFact } from './FunFact'
import { SuggestionBox } from './SuggestionBox'

/* Company-home content — a single-screen BENTO dashboard. On desktop it fills the
   shell's content area exactly and never scrolls the page; list-heavy tiles scroll
   inside their own cell. Below lg it relaxes into a normal stacked, scrollable
   column. Color comes from the portal's own tone palette (soft-wash icon chips +
   accents), so it's lively but stays coherent with the rest of the app. */

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

// Soft-wash icon-chip colors per tile (raw tone palettes — sanctioned by §2.4;
// `brand` uses the brand tokens). Raw palettes may take /opacity; tokens may not.
type ChipTone = 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'brand'
const CHIP: Record<ChipTone, string> = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  brand: 'bg-brand-soft text-brand-ink',
}

function Tile({
  tone, icon, title, count, span, delay, children,
}: {
  tone: ChipTone; icon: ReactNode; title: string; count?: ReactNode; span: string; delay: number; children: ReactNode
}) {
  return (
    <section
      className={`group flex min-h-0 animate-fade-up flex-col overflow-hidden rounded-xl border border-hairline bg-surface transition-colors duration-150 hover:border-hairline-strong motion-reduce:animate-none ${span}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-hairline-soft px-3.5 py-2.5">
        <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${CHIP[tone]}`}>{icon}</span>
        <h2 className="flex-1 truncate text-[12.5px] font-semibold tracking-[-0.006em] text-ink">{title}</h2>
        {count != null && <span className="flex-shrink-0 text-[11px] font-medium tabular-nums text-ink-muted">{count}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

function MiniDate({ day, mon, emphasis = false }: { day: string; mon: string; emphasis?: boolean }) {
  return (
    <div className={`flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-md ${emphasis ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-secondary'}`}>
      <span className="text-[12px] font-semibold leading-none tabular-nums">{day}</span>
      <span className="mt-px text-[8px] font-semibold uppercase leading-none tracking-wide">{mon}</span>
    </div>
  )
}

function Overline({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{children}</p>
}

export function HomeContent({
  greeting, dateET, firstName, funIdx, data, heightClass = 'lg:h-[calc(100dvh-12px)]',
  coreValue, coreValueIndex, coreValueTotal,
}: {
  greeting: string; dateET: string; firstName: string; funIdx: number; data: HomeData
  /** lg-only fixed height that pins the bento to the viewport. Differs by shell
   *  because the employee shell has a 56px top bar above the content, the admin
   *  shell doesn't — the calling page passes the right one. Below lg the grid
   *  flows naturally and the page scrolls. */
  heightClass?: string
  /** The single core value featured this week (weekly rotation). */
  coreValue: CoreValue; coreValueIndex: number; coreValueTotal: number
}) {
  const emoji = greeting.includes('morning') ? '☀️' : greeting.includes('afternoon') ? '🌤️' : '🌙'

  return (
    <div className={`grid grid-cols-1 gap-3 bg-canvas p-3 sm:gap-3.5 sm:p-4 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden ${heightClass}`}>

      {/* ── Header band ────────────────────────────────────────────────── */}
      <header
        className="hero-gradient relative flex animate-fade-up flex-col gap-3 overflow-hidden rounded-xl border border-hairline px-5 py-3 motion-reduce:animate-none sm:flex-row sm:items-center sm:justify-between lg:col-span-12"
        style={{ animationFillMode: 'both' }}
      >
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink sm:text-[21px]">
            {greeting}{firstName ? `, ${firstName}` : ''} <span aria-hidden>{emoji}</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-ink-muted">{dateET}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <FunFact facts={FUN_FACTS} initialIndex={funIdx} />
          <a
            href={`mailto:${IT_SUPPORT.email}`}
            title="Email IT support"
            className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-white/70 px-2.5 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-white hover:text-ink dark:bg-white/10 dark:hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Mail size={13} /> <span className="hidden md:inline">Email IT</span>
          </a>
        </div>
      </header>

      {/* ── Row 1: the substantial feeds ───────────────────────────────── */}

      {/* Company News */}
      <Tile tone="sky" icon={<Newspaper size={15} />} title="Company News" span="lg:col-span-4" delay={40}>
        <ul className="divide-y divide-hairline-soft">
          {data.news.map((n) => {
            const { day, mon } = isoTile(n.date)
            const tone = n.category ? CATEGORY_TONE[n.category] : undefined
            return (
              <li key={n.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                <MiniDate day={day} mon={mon} emphasis={n.pinned} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-semibold leading-snug text-ink">{n.title}</p>
                    {tone && <StatusPill tone={tone}>{n.category}</StatusPill>}
                  </div>
                  {n.body && <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-muted">{n.body}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </Tile>

      {/* Company Calendar */}
      <Tile tone="violet" icon={<CalendarDays size={15} />} title="Company Calendar" span="lg:col-span-4" delay={80}>
        {data.nextHoliday && (
          <div className="m-3 mb-2 flex items-center gap-2.5 rounded-lg bg-violet-50 px-3 py-2 dark:bg-violet-500/10">
            <PartyPopper size={15} className="flex-shrink-0 text-violet-600 dark:text-violet-400" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-ink">{data.nextHoliday.name}</p>
              <p className="text-[11px] tabular-nums text-ink-muted">
                {data.nextHoliday.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {daysUntil(data.nextHoliday.date)}
              </p>
            </div>
          </div>
        )}
        <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
          {data.events.map((e) => {
            const { day, mon } = ymdTile(e.startsOn)
            return (
              <li key={e.id} className="flex items-start gap-2.5 px-3.5 py-2">
                <MiniDate day={day} mon={mon} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold leading-snug text-ink">{e.title}</p>
                    <StatusPill tone={KIND_TONE[e.kind] ?? 'slate'}>{cap(e.kind)}</StatusPill>
                  </div>
                  {e.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">{e.description}</p>}
                </div>
              </li>
            )
          })}
          {data.events.length === 0 && <li className="px-3.5 py-3 text-[11.5px] text-ink-muted">No upcoming events.</li>}
        </ul>
        <div className="border-t border-hairline-soft px-3.5 py-2.5">
          <Overline>Out this week</Overline>
          {data.whosOut.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {data.whosOut.map((w, i) => (
                <li key={i} className="flex items-center gap-2">
                  <PersonAvatar name={w.name} size={22} />
                  <span className="flex-1 truncate text-[12px] font-medium text-ink">{w.name}</span>
                  <span className="text-[11px] tabular-nums text-ink-muted">{fmtRange(w.startsOn, w.endsOn)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11.5px] text-ink-muted">Everyone’s in this week.</p>
          )}
        </div>
      </Tile>

      {/* Open Positions */}
      <Tile
        tone="emerald" icon={<Briefcase size={15} />} title="Open Positions" span="lg:col-span-4" delay={120}
        count={`${data.openings.length} open`}
      >
        <div className="m-3 mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
          <Gift size={14} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11.5px] leading-snug text-ink-secondary">
            {REFERRAL.lead} — earn <span className="font-semibold text-ink">{REFERRAL.bonus}</span> if they’re hired.
          </p>
        </div>
        <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
          {data.openings.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 px-3.5 py-2">
              <div className="min-w-0">
                {o.applyUrl ? (
                  <a href={o.applyUrl} className="truncate text-[12.5px] font-medium text-ink hover:text-brand-ink">{o.title}</a>
                ) : (
                  <p className="truncate text-[12.5px] font-medium text-ink">{o.title}</p>
                )}
                {(o.department || o.employmentType) && (
                  <p className="truncate text-[11px] text-ink-muted">{[o.department, o.location, o.employmentType].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <StatusPill tone="sky">Open</StatusPill>
            </li>
          ))}
        </ul>
      </Tile>

      {/* ── Row 2: people + culture ────────────────────────────────────── */}

      {/* Birthdays & Anniversaries */}
      <Tile tone="amber" icon={<Cake size={15} />} title="Birthdays & Anniversaries" span="lg:col-span-3" delay={160}>
        <ul className="divide-y divide-hairline-soft">
          {data.peopleEvents.map((p, i) => (
            <li key={i} className="flex items-center gap-2.5 px-3.5 py-2">
              <PersonAvatar name={p.name} src={p.avatarUrl} size={26} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{p.name}</span>
              <StatusPill tone={p.kind === 'birthday' ? 'sky' : 'emerald'}>
                {p.kind === 'birthday' ? p.label : `${p.label}`}
              </StatusPill>
            </li>
          ))}
        </ul>
      </Tile>

      {/* Our People — new hire + spotlight */}
      <Tile tone="brand" icon={<Users size={15} />} title="Our People" span="lg:col-span-3" delay={200}>
        <div className="divide-y divide-hairline-soft">
          <div className="flex items-start gap-2.5 px-3.5 py-2.5">
            <PersonAvatar name={data.newHire.name} src={data.newHire.avatarUrl} size={34} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[12.5px] font-semibold capitalize text-ink">{data.newHire.name}</p>
                <StatusPill tone="emerald">New</StatusPill>
              </div>
              <p className="truncate text-[11px] text-ink-muted">{[data.newHire.title, data.newHire.department].filter(Boolean).join(' · ')}</p>
              {data.newHire.blurb && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary">{data.newHire.blurb}</p>}
            </div>
          </div>
          <div className="flex items-start gap-2.5 px-3.5 py-2.5">
            <PersonAvatar name={data.spotlight.name} src={data.spotlight.avatarUrl} size={34} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[12.5px] font-semibold text-ink">{data.spotlight.name}</p>
                <StatusPill tone="violet">Spotlight</StatusPill>
              </div>
              <p className="truncate text-[11px] text-ink-muted">{[data.spotlight.title, data.spotlight.meta].filter(Boolean).join(' · ')}</p>
              {data.spotlight.blurb && <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-secondary">{data.spotlight.blurb}</p>}
            </div>
          </div>
        </div>
      </Tile>

      {/* Core Value of the Week — one value, rotates weekly */}
      <Tile tone="rose" icon={<Compass size={15} />} title="Core Value of the Week" span="lg:col-span-3" delay={240}>
        <div className="px-3.5 py-3">
          <p className="text-[11px] italic leading-relaxed text-ink-muted">“{CORE_VALUES_INTRO}”</p>
          <div className="mt-2.5 border-l-2 border-rose-300 pl-3 dark:border-rose-500/40">
            <p className="text-[14px] font-semibold text-ink">{coreValue.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">{coreValue.body}</p>
          </div>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
            Rotates weekly · {coreValueIndex + 1} of {coreValueTotal}
          </p>
        </div>
      </Tile>

      {/* Company Suggestions */}
      <Tile tone="violet" icon={<Lightbulb size={15} />} title="Suggestion Box" span="lg:col-span-3" delay={280}>
        <SuggestionBox />
      </Tile>

    </div>
  )
}
