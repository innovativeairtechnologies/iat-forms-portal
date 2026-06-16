import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getUserLearnStats } from '@/lib/learn'
import { BadgeIcon, TIER_STYLE } from '@/components/learn/BadgeIcon'
import { Flame, BookOpen, Medal, Clock, ArrowRight, Trophy, Lock } from 'lucide-react'

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
        <circle cx="66" cy="66" r={r} fill="none" stroke="currentColor" className="text-gray-200 dark:text-zinc-800" strokeWidth="10" />
        <circle
          cx="66" cy="66" r={r} fill="none" stroke="#089447" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Level</span>
        <span className="text-[34px] font-bold leading-none text-[#0a0a0b] dark:text-white">{level}</span>
      </div>
    </div>
  )
}

function StatTile({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 shadow-card dark:shadow-none">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}14`, color: accent }}>
        {icon}
      </div>
      <p className="text-[22px] font-bold leading-none tracking-tight text-[#0a0a0b] dark:text-white">{value}</p>
      <p className="mt-1 text-[12px] text-gray-500 dark:text-zinc-400">{label}</p>
    </div>
  )
}

export default async function MyLearningPage() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/learn/me')

  const stats = await getUserLearnStats(user.id)
  const earned = stats.badges.filter(b => b.earned)
  const locked = stats.badges
    .filter(b => !b.earned)
    .sort((a, b) => (b.current / b.target) - (a.current / a.target))
  const level = stats.level

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-card dark:shadow-none">
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-7">
          <LevelRing pct={level.progressPct} level={level.level} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-[#089447] dark:text-emerald-400">{level.title}</p>
            <h1 className="mt-0.5 text-[26px] font-bold tracking-tight text-[#0a0a0b] dark:text-white">
              {stats.totalXp.toLocaleString()} XP
            </h1>
            {level.xpForNextLevel != null ? (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">
                {(level.xpForNextLevel - level.xpIntoLevel).toLocaleString()} XP to <span className="font-semibold text-gray-700 dark:text-zinc-300">{level.nextTitle}</span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">Top level reached — you&apos;ve mastered IAT Learn 🎓</p>
            )}
            <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-gradient-to-r from-[#089447] to-[#44c07d]" style={{ width: `${level.progressPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Flame size={17} />} accent="#f97316" value={`${stats.currentStreak}`} label="day streak" />
        <StatTile icon={<BookOpen size={17} />} accent="#089447" value={`${stats.lessonsCompleted}/${stats.totalLessons}`} label={`lessons · ${stats.overallPct}%`} />
        <StatTile icon={<Medal size={17} />} accent="#d97706" value={`${stats.earnedBadgeCount}`} label="badges earned" />
        <StatTile icon={<Clock size={17} />} accent="#0ea5e9" value={fmtMinutes(stats.minutesLearned)} label="time learning" />
      </section>

      {/* Category progress */}
      <section className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 shadow-card dark:shadow-none sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0a0a0b] dark:text-white">Progress by category</h2>
          <Link href="/learn" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#089447] dark:text-emerald-400 hover:underline">
            Browse <ArrowRight size={13} />
          </Link>
        </div>
        <div className="space-y-3.5">
          {stats.categories.map(c => (
            <Link key={c.id} href={`/learn/${c.slug}`} className="group block">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-medium text-gray-700 dark:text-zinc-300 group-hover:text-[#0a0a0b] dark:group-hover:text-white">{c.name}</span>
                <span className="text-[12px] tabular-nums text-gray-400 dark:text-zinc-500">
                  {c.completed}/{c.total} · <span className="font-semibold text-gray-600 dark:text-zinc-300">{c.pct}%</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${c.pct}%`, background: c.pct === 100 ? '#089447' : (c.accent || '#089447') }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 shadow-card dark:shadow-none sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-[#d97706]" />
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0a0a0b] dark:text-white">Achievements</h2>
          <span className="text-[12px] text-gray-400 dark:text-zinc-500">{earned.length}/{stats.badges.length}</span>
        </div>

        {earned.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map(b => {
              const t = TIER_STYLE[b.tier] ?? TIER_STYLE.bronze
              return (
                <div key={b.key} className={`flex items-center gap-3 rounded-xl ${t.bg} p-3 ring-1 ${t.ring}`}>
                  <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-white/70 dark:bg-white/10 ${t.text}`}>
                    <BadgeIcon name={b.icon} size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-gray-800 dark:text-zinc-100">{b.label}</p>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">{t.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {locked.length > 0 && (
          <>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Locked</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {locked.map(b => (
                <div key={b.key} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 p-3" title={b.description}>
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600">
                    <Lock size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-gray-500 dark:text-zinc-400">{b.label}</p>
                    <p className="text-[11px] tabular-nums text-gray-400 dark:text-zinc-500">{b.current}/{b.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
