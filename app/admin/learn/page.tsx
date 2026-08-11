import Link from 'next/link'
import { Sparkles, Trophy, Flame, ArrowRight } from 'lucide-react'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getLearnDashboard } from '@/lib/learn'
import SubjectLibrary from '@/components/learn/SubjectLibrary'
import WeekChart from '@/components/learn/WeekChart'
import UpNextList from '@/components/learn/UpNextList'
import LearnPageShell from './LearnPageShell'

export const dynamic = 'force-dynamic'

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/* The Learn library landing.

   Deliberately more playful than the rest of /admin: per-category Tone washes on
   the subject tiles, a level ring, an activity strip. That is the DESIGN.md §2.4
   dashboard exception, not a departure from the system — every colour is a Tone
   from the sanctioned table, and the wash means "this part of the library"
   rather than decoration.

   The library is grouped into one vertical shelf per category (SubjectLibrary).
   It was a single sideways deck of every subject until the HVAC/R course took
   the count from 14 to 32 — see that file for why the deck stopped working.

   Everything on this page comes from data that exists — and more of it exists
   now than when this was first built. Due dates and the Required filter are real
   (assignments, migration 076); quiz scores are real (074). Still absent from the
   schema: any "recommended" signal, and measured study time — the week chart
   plots the estimated_minutes of lessons COMPLETED, never a tracked duration.
   See docs/learn.md. */

export default async function LearnHomePage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [data, profileRes] = await Promise.all([
    getLearnDashboard(user.id),
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
  ])
  const { stats } = data

  const firstName = (profileRes?.data?.display_name || user.email?.split('@')[0] || '').split(' ')[0]
  const hourET = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10,
  )
  const started = stats.lessonsCompleted > 0
  const ring = 2 * Math.PI * 26

  return (
    <LearnPageShell>
      <div className="space-y-4">

        {/* ── Level band ─────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
            {/* Level ring */}
            <div className="relative h-[68px] w-[68px] flex-shrink-0">
              <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
                <circle cx="34" cy="34" r="26" fill="none" stroke="currentColor" className="text-surface-strong" strokeWidth="7" />
                <circle
                  cx="34" cy="34" r="26" fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={ring} strokeDashoffset={ring * (1 - stats.levelProgressPct / 100)}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-[20px] font-[650] tabular-nums text-ink">
                {stats.level}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">{stats.levelTitle}</p>
              <h1 className="mt-0.5 text-[22px] font-[650] leading-tight tracking-tight text-ink">
                {greeting(hourET)}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                {started ? (
                  <>
                    <span className="font-semibold text-ink">{stats.totalXp.toLocaleString()} XP</span>
                    {stats.xpToNext != null
                      ? <> · {stats.xpToNext.toLocaleString()} to {stats.nextLevelTitle}</>
                      : <> · top level reached 🎓</>}
                    {' · '}{stats.lessonsCompleted} of {stats.totalLessons} lessons done
                  </>
                ) : (
                  <>{stats.totalLessons} lessons across {stats.totalSubjects} subjects. Finish one to start earning XP.</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {stats.streak > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  <Flame size={13} /> {stats.streak}
                </span>
              )}
              <Link
                href="/admin/learn/leaderboard"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Trophy size={14} /> Leaderboard
              </Link>
              <Link
                href="/admin/learn/me"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Sparkles size={14} /> My learning <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── The library ────────────────────────────────────────────── */}
        <SubjectLibrary subjects={data.subjects} />

        {/* ── Activity + what's next ─────────────────────────────────── */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <WeekChart data={data} />
          <UpNextList data={data} />
        </div>
      </div>
    </LearnPageShell>
  )
}
