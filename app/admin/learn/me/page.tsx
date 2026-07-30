import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getUserLearnStats } from '@/lib/learn'
import { BadgeIcon, TIER_STYLE } from '@/components/learn/BadgeIcon'
import { Flame, BookOpen, Medal, Clock, ArrowRight, Trophy, Lock } from 'lucide-react'
import LearnPageShell from '../LearnPageShell'

export const dynamic = 'force-dynamic'

function fmtMinutes(min: number): string {
  if (!min) return '0m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// Circular level-progress ring.
function LevelRing({ pct, level }: { pct: number; level: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div className="relative h-[132px] w-[132px] flex-shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" className="text-surface-strong" strokeWidth="10" />
        <circle
          cx="66" cy="66" r={r} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Level</span>
        <span className="text-[34px] font-[650] leading-none text-ink">{level}</span>
      </div>
    </div>
  )
}

// Icon chip is deliberately NEUTRAL. It used to be four identical brand-green
// tiles side by side — decorative repetition of the accent, which DESIGN §2.3
// calls out ("if green appears twice in one viewport for decoration, it's
// wrong") and §8 bans for icons. The numbers carry the information.
function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-strong text-ink-muted">
        {icon}
      </div>
      <p className="text-[22px] font-[650] leading-none tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-[12px] text-ink-secondary">{label}</p>
    </div>
  )
}

// How many locked badges to show before the "show all" toggle.
const LOCKED_PREVIEW = 4

function LockedBadge({ badge: b }: { badge: { label: string; description: string; current: number; target: number } }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-soft p-3" title={b.description}>
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-surface-strong text-ink-faint">
        <Lock size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-ink-secondary">{b.label}</p>
        <p className="text-[11px] tabular-nums text-ink-muted">{b.current}/{b.target}</p>
      </div>
    </div>
  )
}

export default async function MyLearningPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/learn/me')

  const stats = await getUserLearnStats(user.id)
  const earned = stats.badges.filter(b => b.earned)
  const locked = stats.badges
    .filter(b => !b.earned)
    .sort((a, b) => (b.current / b.target) - (a.current / a.target))
  const level = stats.level

  return (
    <LearnPageShell>
      <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-7">
          <LevelRing pct={level.progressPct} level={level.level} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">{level.title}</p>
            <h1 className="mt-0.5 text-[26px] font-[650] tracking-tight text-ink">
              {stats.totalXp.toLocaleString()} XP
            </h1>
            {level.xpForNextLevel != null ? (
              <p className="mt-1 text-[13px] text-ink-secondary">
                {(level.xpForNextLevel - level.xpIntoLevel).toLocaleString()} XP to <span className="font-semibold text-ink-secondary">{level.nextTitle}</span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-ink-secondary">Top level reached — you&apos;ve mastered IAT Learn 🎓</p>
            )}
            <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-strong">
              <div className="h-full rounded-full bg-brand" style={{ width: `${level.progressPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Flame size={17} />} value={`${stats.currentStreak}`} label="day streak" />
        <StatTile icon={<BookOpen size={17} />} value={`${stats.lessonsCompleted}/${stats.totalLessons}`} label={`lessons · ${stats.overallPct}%`} />
        <StatTile icon={<Medal size={17} />} value={`${stats.earnedBadgeCount}`} label="badges earned" />
        <StatTile icon={<Clock size={17} />} value={fmtMinutes(stats.minutesLearned)} label="time learning" />
      </section>

      {/* Category progress */}
      <section className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Progress by category</h2>
          <Link href="/admin/learn" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
            Browse <ArrowRight size={13} />
          </Link>
        </div>
        <div className="space-y-3.5">
          {stats.categories.map(c => (
            <Link key={c.id} href={`/admin/learn/${c.slug}`} className="group block">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium text-ink-secondary group-hover:text-ink">{c.name}</span>
                <span className="text-[12px] tabular-nums text-ink-muted">
                  {c.completed}/{c.total} · <span className="font-semibold text-ink-secondary">{c.pct}%</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
                {/* learn_categories.accent stores a raw per-category hex in the
                    DB and used to be painted inline here. Progress is a single
                    meaning, so it takes the one brand accent — no migration
                    needed, the column is simply no longer read for color. */}
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${c.pct}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-ink-muted" />
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Achievements</h2>
          <span className="text-[12px] text-ink-muted">{earned.length}/{stats.badges.length}</span>
        </div>

        {earned.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map(b => {
              const t = TIER_STYLE[b.tier] ?? TIER_STYLE.bronze
              return (
                <div key={b.key} className={`flex items-center gap-3 rounded-xl ${t.bg} p-3 ring-1 ${t.ring}`}>
                  <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-surface ${t.text}`}>
                    <BadgeIcon name={b.icon} size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-[650] text-ink">{b.label}</p>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">{t.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {locked.length > 0 && (
          <>
            <p className="mb-2.5 text-[11px] font-[650] uppercase tracking-widest text-ink-muted">Locked</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {locked.slice(0, LOCKED_PREVIEW).map(b => (
                <LockedBadge key={b.key} badge={b} />
              ))}
            </div>
            {locked.length > LOCKED_PREVIEW && (
              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                  <span className="group-open:hidden">Show all {locked.length} locked</span>
                  <span className="hidden group-open:inline">Show fewer</span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {locked.slice(LOCKED_PREVIEW).map(b => (
                    <LockedBadge key={b.key} badge={b} />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </section>
      </div>
    </LearnPageShell>
  )
}
