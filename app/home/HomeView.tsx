import Link from 'next/link'
import {
  Newspaper, CalendarDays, Briefcase, Cake, UserPlus, Star, LifeBuoy,
  Compass, Lightbulb, PartyPopper, Gift, Mail, ArrowRight,
} from 'lucide-react'
import { FUN_FACTS, CORE_VALUES, REFERRAL, IT_SUPPORT } from '@/lib/home-content'
import type { HomeData } from '@/lib/home-data'
import { StatusPill, type Tone } from '@/components/admin/list'
import { HomeTopBar } from './HomeTopBar'
import { FunFact } from './FunFact'
import { SuggestionBox } from './SuggestionBox'
import { HomeCard, CardHead, Overline, DateTile, PersonAvatar } from './home-ui'

/* Presentational body of the company home (/home). Data-free: page.tsx fetches
   and passes everything in, which also lets a lightweight preview render it. */

// ── date helpers (Eastern; IAT is US-based) ──────────────────────────────────
function isoTile(iso: string) {
  const day = new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
  const mon = new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short' }).toUpperCase()
  return { day, mon }
}
function ymdTile(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const mon = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return { day: String(d), mon }
}
function fmtRange(startsOn: string, endsOn?: string | null) {
  const one = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return endsOn && endsOn !== startsOn ? `${one(startsOn)} – ${one(endsOn)}` : one(startsOn)
}

const CATEGORY_TONE: Record<string, Tone> = { news: 'slate', safety: 'amber', event: 'sky', it: 'violet' }
const KIND_TONE: Record<string, Tone> = { holiday: 'violet', training: 'sky', visit: 'amber', closure: 'rose', event: 'slate' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function HomeView({
  displayName, launchHref, greeting, dateET, firstName, funIdx, data,
}: {
  displayName: string
  launchHref: string
  greeting: string
  dateET: string
  firstName: string
  funIdx: number
  data: HomeData
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <HomeTopBar name={displayName} launchHref={launchHref} />

      <main className="mx-auto max-w-[1180px] px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        {/* ── Hero greeting band ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface px-6 py-7 sm:px-8">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-[0.14] blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--brand), transparent 70%)' }}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Overline>{dateET}</Overline>
              <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[28px]">
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-ink-secondary">
                Welcome to the Innovative Air Technologies company home — news, people, and everything happening across IAT.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href={launchHref}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Launch IAT Portal <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Fun fact strip ─────────────────────────────────────────────── */}
        <div className="mt-4">
          <FunFact facts={FUN_FACTS} initialIndex={funIdx} />
        </div>

        {/* ── Masonry of intranet cards ──────────────────────────────────── */}
        <div className="mt-6 gap-5 sm:columns-2 xl:columns-3">

          {/* Company News */}
          <HomeCard>
            <CardHead icon={<Newspaper size={15} />} title="Company News" />
            <ul>
              {data.news.map((n, i) => {
                const { day, mon } = isoTile(n.date)
                const tone = n.category ? CATEGORY_TONE[n.category] : undefined
                return (
                  <li key={n.id} className={`flex gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
                    <DateTile day={day} mon={mon} emphasis={n.pinned} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13.5px] font-semibold leading-snug text-ink">{n.title}</p>
                        {tone && <StatusPill tone={tone}>{n.category}</StatusPill>}
                      </div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{n.body}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </HomeCard>

          {/* Company Calendar */}
          <HomeCard>
            <CardHead icon={<CalendarDays size={15} />} title="Company Calendar" />
            {data.nextHoliday && (
              <div className="px-5 pt-3.5">
                <div className="flex items-center gap-3 rounded-lg border border-hairline-soft bg-surface-soft px-3 py-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-strong text-ink-muted">
                    <PartyPopper size={15} />
                  </span>
                  <div className="min-w-0">
                    <Overline>Next holiday</Overline>
                    <p className="text-[13px] font-semibold text-ink">{data.nextHoliday.name}</p>
                    <p className="text-[12px] tabular-nums text-ink-muted">
                      {data.nextHoliday.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-2.5 border-t border-hairline-soft">
              {data.events.map((e, i) => {
                const { day, mon } = ymdTile(e.startsOn)
                return (
                  <li key={e.id} className={`flex gap-3 px-5 py-3 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
                    <DateTile day={day} mon={mon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-snug text-ink">{e.title}</p>
                        <StatusPill tone={KIND_TONE[e.kind] ?? 'slate'}>{cap(e.kind)}</StatusPill>
                      </div>
                      {e.description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{e.description}</p>}
                    </div>
                  </li>
                )
              })}
              {data.events.length === 0 && (
                <li className="px-5 py-4 text-[12.5px] text-ink-muted">No upcoming events on the calendar.</li>
              )}
            </ul>
            <div className="border-t border-hairline-soft px-5 py-3.5">
              <Overline>Out this week</Overline>
              {data.whosOut.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {data.whosOut.map((w, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <PersonAvatar name={w.name} size={24} />
                      <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{w.name}</span>
                      <span className="text-[11.5px] tabular-nums text-ink-muted">{fmtRange(w.startsOn, w.endsOn)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12.5px] text-ink-muted">Everyone’s in — full team this week.</p>
              )}
            </div>
          </HomeCard>

          {/* Open Positions */}
          <HomeCard>
            <CardHead
              icon={<Briefcase size={15} />}
              title="Open Positions"
              action={<span className="text-[11px] tabular-nums text-ink-muted">{data.openings.length} open</span>}
            />
            <div className="px-5 pt-3.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-hairline-soft bg-surface-soft px-3 py-2.5">
                <Gift size={15} className="flex-shrink-0 text-ink-muted" />
                <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                  {REFERRAL.lead} — earn a <span className="font-semibold text-ink">{REFERRAL.bonus}</span> bonus if they’re hired.
                </p>
              </div>
            </div>
            <ul className="mt-1.5">
              {data.openings.map((o, i) => (
                <li key={o.id} className={`px-5 py-2.5 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    {o.applyUrl ? (
                      <a href={o.applyUrl} className="truncate text-[13px] font-medium text-ink transition-colors hover:text-brand-ink">{o.title}</a>
                    ) : (
                      <p className="truncate text-[13px] font-medium text-ink">{o.title}</p>
                    )}
                    <StatusPill tone="sky">Open</StatusPill>
                  </div>
                  {(o.department || o.location || o.employmentType) && (
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {[o.department, o.location, o.employmentType].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </HomeCard>

          {/* Birthdays & Anniversaries */}
          <HomeCard>
            <CardHead icon={<Cake size={15} />} title="Birthdays & Anniversaries" />
            <ul>
              {data.peopleEvents.map((p, i) => (
                <li key={i} className={`flex items-center gap-3 px-5 py-2.5 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
                  <PersonAvatar name={p.name} src={p.avatarUrl} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p.name}</span>
                  <StatusPill tone={p.kind === 'birthday' ? 'sky' : 'emerald'}>
                    {p.kind === 'birthday' ? `Birthday · ${p.label}` : `${p.label} anniversary`}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </HomeCard>

          {/* New Employee */}
          <HomeCard>
            <CardHead icon={<UserPlus size={15} />} title="New Employee" />
            <div className="flex items-start gap-3.5 px-5 py-4">
              <PersonAvatar name={data.newHire.name} src={data.newHire.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold capitalize text-ink">Welcome, {data.newHire.name.split(' ')[0]}!</p>
                <p className="text-[12.5px] text-ink-muted">
                  {[data.newHire.title, data.newHire.department, data.newHire.meta].filter(Boolean).join(' · ')}
                </p>
                {data.newHire.blurb && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">{data.newHire.blurb}</p>}
              </div>
            </div>
          </HomeCard>

          {/* Employee Spotlight */}
          <HomeCard>
            <CardHead icon={<Star size={15} />} title="Employee Spotlight" />
            <div className="flex items-start gap-3.5 px-5 py-4">
              <PersonAvatar name={data.spotlight.name} src={data.spotlight.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{data.spotlight.name}</p>
                <p className="text-[12.5px] text-ink-muted">
                  {[data.spotlight.title, data.spotlight.department, data.spotlight.meta].filter(Boolean).join(' · ')}
                </p>
                {data.spotlight.blurb && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">{data.spotlight.blurb}</p>}
              </div>
            </div>
          </HomeCard>

          {/* IT Support */}
          <HomeCard>
            <CardHead icon={<LifeBuoy size={15} />} title="IT Support" />
            <div className="px-5 py-4">
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">{IT_SUPPORT.blurb}</p>
              <a
                href={`mailto:${IT_SUPPORT.email}`}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Mail size={14} /> Email IT
              </a>
            </div>
          </HomeCard>

          {/* Core Values */}
          <HomeCard>
            <CardHead icon={<Compass size={15} />} title={CORE_VALUES.length > 1 ? 'Core Values' : 'Our Core Value'} />
            <ul className="space-y-3 px-5 py-4">
              {CORE_VALUES.map((v, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-faint" />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{v.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-secondary">{v.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </HomeCard>

          {/* Company Suggestions */}
          <HomeCard>
            <CardHead icon={<Lightbulb size={15} />} title="Company Suggestions" />
            <div className="px-5 pb-1 pt-3.5">
              <p className="text-[12.5px] leading-relaxed text-ink-secondary">
                Have an idea to improve how things run at IAT? Share it below.
              </p>
            </div>
            <SuggestionBox />
          </HomeCard>

        </div>

        <footer className="mt-6 border-t border-hairline pt-6 text-center text-[12px] text-ink-muted">
          Innovative Air Technologies · Company Intranet
        </footer>
      </main>
    </div>
  )
}
