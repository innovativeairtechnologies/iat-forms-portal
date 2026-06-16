import { getCategoriesWithStats, getUserLearnStats } from '@/lib/learn'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CategoryGrid from '@/components/learn/CategoryGrid'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import { Sparkles, Trophy, Flame, BookOpen, Clock, Medal } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtMinutes(min: number): string {
  if (!min) return '0m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatTile({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card dark:border-zinc-800 dark:bg-zinc-900/40 dark:shadow-none">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}14`, color: accent }}>
        {icon}
      </div>
      <p className="text-[22px] font-bold leading-none tracking-tight text-[#0a0a0b] dark:text-white">{value}</p>
      <p className="mt-1 text-[12px] text-gray-500 dark:text-zinc-400">{label}</p>
    </div>
  )
}

export default async function LearnHomePage() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const [categories, stats, profileRes] = await Promise.all([
    getCategoriesWithStats(),
    user ? getUserLearnStats(user.id) : Promise.resolve(null),
    user
      ? supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single()
      : Promise.resolve({ data: null as { display_name: string | null } | null }),
  ])

  const progress: Record<string, { completed: number; total: number; pct: number }> = {}
  if (stats) for (const c of stats.categories) progress[c.id] = { completed: c.completed, total: c.total, pct: c.pct }

  const totals = categories.reduce(
    (acc, c) => ({ modules: acc.modules + c.moduleCount, lessons: acc.lessons + c.lessonCount }),
    { modules: 0, lessons: 0 },
  )

  const displayName = profileRes?.data?.display_name || user?.email?.split('@')[0] || ''
  const firstName = displayName.split(' ')[0]
  const hourET = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10,
  )
  const dateET = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })
  const hasProgress = !!stats && stats.lessonsCompleted > 0

  return (
    <div className="space-y-6">

      {/* ── Greeting band ──────────────────────────────────────────── */}
      <PortalHero
        eyebrow={dateET}
        title={`${greeting(hourET)}${firstName ? `, ${firstName}` : ''}`}
        subtitle={
          hasProgress
            ? <>You&apos;ve completed <span className="font-semibold text-zinc-700 dark:text-zinc-200">{stats!.overallPct}%</span> of the library — {stats!.lessonsCompleted} of {stats!.totalLessons} lessons. Keep it up.</>
            : <>Welcome to IAT Learn — {totals.lessons} lessons across {categories.length} categories. Pick one to begin.</>
        }
        actions={
          <>
            <HeroAction href="/learn/me" icon={Sparkles} label="My learning" variant="primary" />
            <HeroAction href="/learn/leaderboard" icon={Trophy} label="Leaderboard" />
          </>
        }
      />

      {/* ── Stats strip ────────────────────────────────────────────── */}
      {stats && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Flame size={17} />} accent="#f97316" value={`${stats.currentStreak}`} label="day streak" />
          <StatTile icon={<BookOpen size={17} />} accent="#089447" value={`${stats.lessonsCompleted}/${stats.totalLessons}`} label={`lessons · ${stats.overallPct}%`} />
          <StatTile icon={<Medal size={17} />} accent="#d97706" value={`${stats.earnedBadgeCount}`} label="badges earned" />
          <StatTile icon={<Clock size={17} />} accent="#0ea5e9" value={fmtMinutes(stats.minutesLearned)} label="time learning" />
        </section>
      )}

      {/* ── Browse ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-tight text-[#0a0a0b] dark:text-white">Browse the library</h2>
          <div className="hidden items-center gap-5 text-[12.5px] text-gray-500 dark:text-zinc-400 sm:flex">
            <span><span className="font-semibold text-[#089447] dark:text-emerald-400">{categories.length}</span> categories</span>
            <span><span className="font-semibold text-[#089447] dark:text-emerald-400">{totals.modules}</span> subjects</span>
            <span><span className="font-semibold text-[#089447] dark:text-emerald-400">{totals.lessons}</span> lessons</span>
          </div>
        </div>
        <CategoryGrid categories={categories} progress={progress} />
      </section>
    </div>
  )
}
