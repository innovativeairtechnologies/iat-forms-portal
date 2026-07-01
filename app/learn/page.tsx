import { getCategoriesWithStats, getUserLearnStats } from '@/lib/learn'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import CategoryGrid from '@/components/learn/CategoryGrid'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import { Sparkles, Trophy } from 'lucide-react'

export const dynamic = 'force-dynamic'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function LearnHomePage() {
  const supabase = await createSupabaseServer()
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
