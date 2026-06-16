// ─────────────────────────────────────────────────────────────────────────────
// IAT Learn — gamification logic (Phase 2)
//
// Everything here is PURE and DERIVED from completed-lesson data — there is no
// points/badge/streak table to keep in sync. XP, levels, streaks and badges are
// computed on read from `learn_progress` (completed_at) + `learn_lessons`
// (estimated_minutes). The data-fetching wrappers live in lib/learn.ts.
// ─────────────────────────────────────────────────────────────────────────────

// XP awarded per completed lesson: a flat base plus a bonus scaled to how long
// the lesson takes, so finishing longer material is worth more.
export const XP_BASE = 50
export const XP_PER_MINUTE = 10

export function lessonXp(estimatedMinutes: number | null | undefined): number {
  return XP_BASE + XP_PER_MINUTE * Math.max(0, estimatedMinutes ?? 0)
}

// Streak timezone — IAT is US-based; anchoring "a day" to one zone keeps streaks
// consistent regardless of where/when the row was written.
const STREAK_TZ = 'America/New_York'

// ── Levels ───────────────────────────────────────────────────────────────────
// Named tiers by cumulative XP. Tunable — the whole library is ~40k XP, so this
// spans a new hire (Newcomer) to someone who's finished everything (IAT Scholar).
export const LEVELS = [
  { level: 1, minXp: 0, title: 'Newcomer' },
  { level: 2, minXp: 400, title: 'Trainee' },
  { level: 3, minXp: 1200, title: 'Apprentice' },
  { level: 4, minXp: 2500, title: 'Practitioner' },
  { level: 5, minXp: 4500, title: 'Technician' },
  { level: 6, minXp: 7500, title: 'Specialist' },
  { level: 7, minXp: 11500, title: 'Senior Specialist' },
  { level: 8, minXp: 17000, title: 'Expert' },
  { level: 9, minXp: 24000, title: 'Master' },
  { level: 10, minXp: 33000, title: 'IAT Scholar' },
] as const

export type LevelInfo = {
  level: number
  title: string
  minXp: number
  xpIntoLevel: number
  xpForNextLevel: number | null // null at max level
  nextTitle: string | null
  progressPct: number // 0–100 toward the next level (100 at max)
}

export function levelInfo(totalXp: number): LevelInfo {
  let current: (typeof LEVELS)[number] = LEVELS[0]
  for (const l of LEVELS) if (totalXp >= l.minXp) current = l
  const next = LEVELS.find(l => l.minXp > current.minXp) ?? null
  const xpIntoLevel = totalXp - current.minXp
  const span = next ? next.minXp - current.minXp : 0
  return {
    level: current.level,
    title: current.title,
    minXp: current.minXp,
    xpIntoLevel,
    xpForNextLevel: next ? span : null,
    nextTitle: next ? next.title : null,
    progressPct: next ? Math.min(100, Math.round((xpIntoLevel / span) * 100)) : 100,
  }
}

// ── Streaks ──────────────────────────────────────────────────────────────────
function dateKey(d: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD; with a timeZone this gives the local calendar day.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

function keyToDayNum(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export type StreakResult = { current: number; longest: number; lastActive: string | null }

/** Current + longest run of consecutive calendar days (STREAK_TZ) with activity. */
export function computeStreak(completedAtIso: string[]): StreakResult {
  if (!completedAtIso.length) return { current: 0, longest: 0, lastActive: null }

  const days = Array.from(new Set(completedAtIso.map(iso => dateKey(new Date(iso), STREAK_TZ))))
    .map(keyToDayNum)
    .sort((a, b) => b - a) // newest first

  const today = keyToDayNum(dateKey(new Date(), STREAK_TZ))
  const lastActive = days[0]

  // Current streak only counts if the most recent active day is today or yesterday.
  let current = 0
  if (lastActive === today || lastActive === today - 1) {
    current = 1
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] - 1) current++
      else break
    }
  }

  // Longest run anywhere in the history.
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] - 1) run++
    else run = 1
    if (run > longest) longest = run
  }

  return {
    current,
    longest: Math.max(longest, current),
    lastActive: `${new Date(lastActive * 86_400_000).toISOString().slice(0, 10)}`,
  }
}

// ── Badges ───────────────────────────────────────────────────────────────────
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'special'

export type ComputedBadge = {
  key: string
  label: string
  description: string // how to earn it
  icon: string // one of the keys in the badge-icon map (components/learn)
  tier: BadgeTier
  earned: boolean
  current: number
  target: number
}

export type BadgeContext = {
  lessonsCompleted: number
  totalLessons: number
  currentStreak: number
  longestStreak: number
  categories: { id: string; name: string; completed: number; total: number }[]
}

const LESSON_MILESTONES: { key: string; label: string; icon: string; tier: BadgeTier; target: number }[] = [
  { key: 'lessons-1', label: 'Getting Started', icon: 'Footprints', tier: 'bronze', target: 1 },
  { key: 'lessons-10', label: 'Quick Study', icon: 'Zap', tier: 'bronze', target: 10 },
  { key: 'lessons-25', label: 'Committed', icon: 'BookMarked', tier: 'silver', target: 25 },
  { key: 'lessons-50', label: 'Halfway Hero', icon: 'Award', tier: 'silver', target: 50 },
  { key: 'lessons-100', label: 'Centurion', icon: 'Trophy', tier: 'gold', target: 100 },
]

const STREAK_MILESTONES: { key: string; label: string; tier: BadgeTier; target: number }[] = [
  { key: 'streak-3', label: 'On a Roll', tier: 'bronze', target: 3 },
  { key: 'streak-7', label: 'Week Warrior', tier: 'silver', target: 7 },
  { key: 'streak-30', label: 'Unstoppable', tier: 'gold', target: 30 },
]

/** Full badge set with earned/locked state + progress, derived from a context. */
export function deriveBadges(ctx: BadgeContext): ComputedBadge[] {
  const out: ComputedBadge[] = []

  for (const m of LESSON_MILESTONES) {
    out.push({
      key: m.key, label: m.label, icon: m.icon, tier: m.tier, target: m.target,
      description: m.target === 1 ? 'Complete your first lesson' : `Complete ${m.target} lessons`,
      current: Math.min(ctx.lessonsCompleted, m.target),
      earned: ctx.lessonsCompleted >= m.target,
    })
  }

  for (const m of STREAK_MILESTONES) {
    // Earned off the LONGEST streak so a broken streak never revokes the badge.
    out.push({
      key: m.key, label: m.label, icon: 'Flame', tier: m.tier, target: m.target,
      description: `Reach a ${m.target}-day learning streak`,
      current: Math.min(ctx.longestStreak, m.target),
      earned: ctx.longestStreak >= m.target,
    })
  }

  // One "graduate" badge per category, finished when every lesson in it is done.
  for (const c of ctx.categories) {
    if (c.total <= 0) continue
    out.push({
      key: `category-${c.id}`, label: `${c.name} Graduate`, icon: 'GraduationCap', tier: 'gold',
      description: `Finish every lesson in ${c.name}`,
      current: c.completed, target: c.total, earned: c.completed >= c.total,
    })
  }

  if (ctx.totalLessons > 0) {
    out.push({
      key: 'all-complete', label: 'IAT Scholar', icon: 'Crown', tier: 'special',
      description: 'Complete the entire training library',
      current: ctx.lessonsCompleted, target: ctx.totalLessons,
      earned: ctx.lessonsCompleted >= ctx.totalLessons,
    })
  }

  return out
}

// ── Full per-user stats (computed from raw rows) ─────────────────────────────
export type CategoryProgress = {
  id: string; name: string; slug: string; accent: string | null
  completed: number; total: number; pct: number; xp: number
}

export type UserLearnStats = {
  totalXp: number
  level: LevelInfo
  lessonsCompleted: number
  totalLessons: number
  overallPct: number
  minutesLearned: number
  currentStreak: number
  longestStreak: number
  lastActive: string | null
  categories: CategoryProgress[]
  badges: ComputedBadge[]
  earnedBadgeCount: number
}

export type RawStatsInput = {
  categories: { id: string; name: string; slug: string; accent: string | null }[]
  moduleCategory: Map<string, string> // moduleId → categoryId
  lessons: { id: string; module_id: string; estimated_minutes: number }[]
  completedLessonIds: Set<string>
  completedDates: string[]
}

/** Single source of truth: turn raw rows into a full stats object. */
export function computeUserStats(input: RawStatsInput): UserLearnStats {
  const lessonInfo = new Map<string, { minutes: number; categoryId: string | undefined }>()
  for (const l of input.lessons) {
    lessonInfo.set(l.id, { minutes: l.estimated_minutes ?? 0, categoryId: input.moduleCategory.get(l.module_id) })
  }

  // Category totals (published lessons only — that's what `input.lessons` holds).
  const catTotal = new Map<string, number>()
  for (const l of input.lessons) {
    const c = input.moduleCategory.get(l.module_id)
    if (c) catTotal.set(c, (catTotal.get(c) ?? 0) + 1)
  }

  let totalXp = 0, minutesLearned = 0, lessonsCompleted = 0
  const perCat = new Map<string, { completed: number; xp: number }>()
  for (const id of Array.from(input.completedLessonIds)) {
    const info = lessonInfo.get(id)
    if (!info) continue // lesson was unpublished/deleted — don't count it
    lessonsCompleted++
    const xp = lessonXp(info.minutes)
    totalXp += xp
    minutesLearned += info.minutes
    if (info.categoryId) {
      const p = perCat.get(info.categoryId) ?? { completed: 0, xp: 0 }
      p.completed++; p.xp += xp
      perCat.set(info.categoryId, p)
    }
  }

  const categories: CategoryProgress[] = input.categories.map(c => {
    const total = catTotal.get(c.id) ?? 0
    const completed = perCat.get(c.id)?.completed ?? 0
    return {
      id: c.id, name: c.name, slug: c.slug, accent: c.accent,
      completed, total, pct: total ? Math.round((completed / total) * 100) : 0,
      xp: perCat.get(c.id)?.xp ?? 0,
    }
  })

  const totalLessons = input.lessons.length
  const streak = computeStreak(input.completedDates)
  const badges = deriveBadges({
    lessonsCompleted, totalLessons,
    currentStreak: streak.current, longestStreak: streak.longest,
    categories: categories.map(c => ({ id: c.id, name: c.name, completed: c.completed, total: c.total })),
  })

  return {
    totalXp,
    level: levelInfo(totalXp),
    lessonsCompleted,
    totalLessons,
    overallPct: totalLessons ? Math.round((lessonsCompleted / totalLessons) * 100) : 0,
    minutesLearned,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    lastActive: streak.lastActive,
    categories,
    badges,
    earnedBadgeCount: badges.filter(b => b.earned).length,
  }
}
