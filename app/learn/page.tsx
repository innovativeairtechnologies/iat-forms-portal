import { getCategoriesWithStats, getUserLearnStats } from '@/lib/learn'
import { createSupabaseServer } from '@/lib/supabase-server'
import CategoryGrid from '@/components/learn/CategoryGrid'
import { Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LearnHomePage() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const [categories, stats] = await Promise.all([
    getCategoriesWithStats(),
    user ? getUserLearnStats(user.id) : Promise.resolve(null),
  ])

  const progress: Record<string, { completed: number; total: number; pct: number }> = {}
  if (stats) for (const c of stats.categories) progress[c.id] = { completed: c.completed, total: c.total, pct: c.pct }

  const totals = categories.reduce(
    (acc, c) => ({
      modules: acc.modules + c.moduleCount,
      lessons: acc.lessons + c.lessonCount,
    }),
    { modules: 0, lessons: 0 },
  )

  return (
    <div>
      <section className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#dcf5e6] bg-[#f0faf4] px-3 py-1 text-[12px] font-semibold text-[#077a3c]">
          <Sparkles size={13} /> Training Library
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#0a0a0b]">
          Everything you need to do great work here.
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-gray-500">
          Step-by-step training paths for every part of Innovative Air Technologies — from
          your first day to mastering the technical side. Pick a category to get started.
        </p>

        <div className="mt-5 flex items-center gap-6 text-[13px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-[#089447]">{categories.length}</span>
            <span className="text-gray-500">categories</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-[#089447]">{totals.modules}</span>
            <span className="text-gray-500">subjects</span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-[#089447]">{totals.lessons}</span>
            <span className="text-gray-500">lessons</span>
          </div>
        </div>
      </section>

      {stats && stats.lessonsCompleted > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#089447] to-[#44c07d]" style={{ width: `${stats.overallPct}%` }} />
          </div>
          <span className="text-[12.5px] font-medium text-gray-500">
            <span className="font-bold text-[#089447]">{stats.overallPct}%</span> complete
          </span>
        </div>
      )}

      <CategoryGrid categories={categories} progress={progress} />
    </div>
  )
}
