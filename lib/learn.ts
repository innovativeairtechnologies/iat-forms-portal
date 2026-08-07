import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import {
  computeUserStats, computeStreak, lessonXp, levelInfo, dateKey, keyToDayNum, QUIZ_PASS_XP,
  type UserLearnStats,
} from '@/lib/learn-gamification'
import {
  getPublishedModuleQuizzes, getAttemptSummaries, subjectIsComplete,
  quizXpFrom, quizStatsFrom,
} from '@/lib/learn-quiz'
import { getMyAssignedModules } from '@/lib/learn-assignments'

// ─────────────────────────────────────────────────────────────────────────────
// IAT Learn data layer
// Server-side reads via the service role (same pattern as /employee resources).
// Hierarchy: category → module → lesson.
// ─────────────────────────────────────────────────────────────────────────────

export type LearnCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  accent: string | null
  display_order: number
}

export type LearnModule = {
  id: string
  category_id: string
  title: string
  slug: string
  description: string | null
  display_order: number
  is_published: boolean
  source_file: string | null
  import_status: 'imported' | 'pending' | 'partial'
}

export type LearnLesson = {
  id: string
  module_id: string
  title: string
  slug: string
  content: string | null
  display_order: number
  is_published: boolean
  estimated_minutes: number
}

export type CategoryWithStats = LearnCategory & {
  moduleCount: number
  lessonCount: number
  totalMinutes: number
}

export type ModuleWithStats = LearnModule & {
  lessonCount: number
  totalMinutes: number
}

// ── Home: all categories with rollup stats ──────────────────────────────────
export async function getCategoriesWithStats(): Promise<CategoryWithStats[]> {
  const [{ data: categories }, { data: modules }, { data: lessons }] = await Promise.all([
    supabaseAdmin.from('learn_categories').select('*').order('display_order'),
    supabaseAdmin.from('learn_modules').select('id, category_id, is_published').eq('is_published', true),
    supabaseAdmin.from('learn_lessons').select('id, module_id, estimated_minutes, is_published').eq('is_published', true),
  ])

  const moduleById = new Map((modules ?? []).map(m => [m.id, m]))
  const modulesByCategory = new Map<string, number>()
  for (const m of modules ?? []) {
    modulesByCategory.set(m.category_id, (modulesByCategory.get(m.category_id) ?? 0) + 1)
  }
  const lessonStatsByCategory = new Map<string, { count: number; minutes: number }>()
  for (const l of lessons ?? []) {
    const mod = moduleById.get(l.module_id)
    if (!mod) continue
    const prev = lessonStatsByCategory.get(mod.category_id) ?? { count: 0, minutes: 0 }
    prev.count += 1
    prev.minutes += l.estimated_minutes ?? 0
    lessonStatsByCategory.set(mod.category_id, prev)
  }

  return (categories ?? []).map(c => ({
    ...c,
    moduleCount: modulesByCategory.get(c.id) ?? 0,
    lessonCount: lessonStatsByCategory.get(c.id)?.count ?? 0,
    totalMinutes: lessonStatsByCategory.get(c.id)?.minutes ?? 0,
  }))
}

// ── Category page: category + its modules (with lesson stats) ────────────────
export async function getCategoryWithModules(
  slug: string,
): Promise<{ category: LearnCategory; modules: ModuleWithStats[] } | null> {
  const { data: category } = await supabaseAdmin
    .from('learn_categories').select('*').eq('slug', slug).single()
  if (!category) return null

  const { data: modules } = await supabaseAdmin
    .from('learn_modules').select('*')
    .eq('category_id', category.id).eq('is_published', true)
    .order('display_order')

  const moduleIds = (modules ?? []).map(m => m.id)
  const { data: lessons } = moduleIds.length
    ? await supabaseAdmin.from('learn_lessons')
        .select('id, module_id, estimated_minutes')
        .in('module_id', moduleIds).eq('is_published', true)
    : { data: [] as any[] }

  const stats = new Map<string, { count: number; minutes: number }>()
  for (const l of lessons ?? []) {
    const prev = stats.get(l.module_id) ?? { count: 0, minutes: 0 }
    prev.count += 1
    prev.minutes += l.estimated_minutes ?? 0
    stats.set(l.module_id, prev)
  }

  return {
    category,
    modules: (modules ?? []).map(m => ({
      ...m,
      lessonCount: stats.get(m.id)?.count ?? 0,
      totalMinutes: stats.get(m.id)?.minutes ?? 0,
    })),
  }
}

// ── Module page: category + module + ordered lessons ────────────────────────
export async function getModuleWithLessons(categorySlug: string, moduleSlug: string): Promise<{
  category: LearnCategory; module: LearnModule; lessons: LearnLesson[]
} | null> {
  const { data: category } = await supabaseAdmin
    .from('learn_categories').select('*').eq('slug', categorySlug).single()
  if (!category) return null

  const { data: module } = await supabaseAdmin
    .from('learn_modules').select('*')
    .eq('category_id', category.id).eq('slug', moduleSlug).single()
  if (!module) return null

  const { data: lessons } = await supabaseAdmin
    .from('learn_lessons').select('*')
    .eq('module_id', module.id).eq('is_published', true)
    .order('display_order')

  return { category, module, lessons: lessons ?? [] }
}

// ── Lesson reader: lesson + siblings for prev/next ──────────────────────────
export async function getLessonContext(
  categorySlug: string, moduleSlug: string, lessonSlug: string,
): Promise<{
  category: LearnCategory; module: LearnModule; lesson: LearnLesson
  lessons: LearnLesson[]; index: number
} | null> {
  const ctx = await getModuleWithLessons(categorySlug, moduleSlug)
  if (!ctx) return null
  const index = ctx.lessons.findIndex(l => l.slug === lessonSlug)
  if (index === -1) return null
  return { ...ctx, lesson: ctx.lessons[index], index }
}

// ── Admin: full tree (includes unpublished) ─────────────────────────────────
// `completionsByLesson` is what makes the delete confirmations honest: every FK
// in this taxonomy is ON DELETE CASCADE (category → modules → lessons →
// learn_progress), so removing a category can silently erase completion records
// several levels down. The tree ships the counts so the UI can name the exact
// blast radius before anything is destroyed, without a second round trip.
export async function getAdminTree() {
  const [cats, mods, less, prog] = await Promise.all([
    supabaseAdmin.from('learn_categories').select('*').order('display_order'),
    supabaseAdmin.from('learn_modules').select('*').order('display_order'),
    supabaseAdmin.from('learn_lessons').select('id, module_id, title, slug, display_order, is_published, estimated_minutes').order('display_order'),
    supabaseAdmin.from('learn_progress').select('lesson_id').not('completed_at', 'is', null),
  ])

  // NULL means "we could not read the progress table", which is NOT the same as
  // "nobody has completed anything". Collapsing the two would let the delete
  // confirmation print a confident "no progress is lost" over data it is about
  // to destroy, so the failure is propagated and the UI says it doesn't know.
  let completionsByLesson: Record<string, number> | null = null
  if (!prog.error) {
    completionsByLesson = {}
    for (const p of prog.data ?? []) {
      completionsByLesson[p.lesson_id] = (completionsByLesson[p.lesson_id] ?? 0) + 1
    }
  } else {
    console.error('[learn] completion counts unavailable:', prog.error.message)
  }

  return {
    categories: (cats.data ?? []) as LearnCategory[],
    modules: (mods.data ?? []) as LearnModule[],
    lessons: (less.data ?? []) as Omit<LearnLesson, 'content'>[],
    completionsByLesson,
  }
}

// Rows that a cascade delete would take with it. Counted BEFORE the delete so
// the audit entry can record what was actually destroyed — afterwards the rows
// are gone and unrecoverable.
//
// `completions` and `progressRows` differ on purpose. POST /api/learn/progress
// writes a row with completed_at = NULL when someone UN-marks a lesson, so a
// learn_progress row is not necessarily a completion. The cascade destroys both
// kinds, but only completions carry XP/badge meaning — so `completions` is what
// the confirmation warns about, and `progressRows` is what the audit records.
export type LearnDeleteImpact = {
  modules: number
  lessons: number
  /** completed_at IS NOT NULL — the ones that count toward XP, levels, badges. */
  completions: number
  /** every learn_progress row destroyed, including un-marked (completed_at NULL). */
  progressRows: number
}

// THROWS if any count cannot be established. That is deliberate: this is the only
// pre-image of rows that are about to be destroyed forever, and supabase-js
// reports failure as `data: null` / `count: null` rather than throwing — so
// swallowing an error here would let a delete proceed while the permanent audit
// record claims nothing was destroyed. Callers must let the failure abort the
// delete, not default to zero.
export async function getDeleteImpact(
  scope: 'category' | 'module' | 'lesson',
  id: string,
): Promise<LearnDeleteImpact> {
  let moduleIds: string[] = []
  let lessonIds: string[] = []

  if (scope === 'category') {
    const { data: mods, error: modErr } = await supabaseAdmin
      .from('learn_modules').select('id').eq('category_id', id)
    if (modErr) throw new Error(`Could not count subjects: ${modErr.message}`)
    moduleIds = (mods ?? []).map(m => m.id)
    if (moduleIds.length) {
      const { data: ls, error: lErr } = await supabaseAdmin
        .from('learn_lessons').select('id').in('module_id', moduleIds)
      if (lErr) throw new Error(`Could not count lessons: ${lErr.message}`)
      lessonIds = (ls ?? []).map(l => l.id)
    }
  } else if (scope === 'module') {
    // The module itself is one of the rows the cascade removes — without this the
    // audit entry for a subject deletion would record `modules: 0`.
    moduleIds = [id]
    const { data: ls, error: lErr } = await supabaseAdmin
      .from('learn_lessons').select('id').eq('module_id', id)
    if (lErr) throw new Error(`Could not count lessons: ${lErr.message}`)
    lessonIds = (ls ?? []).map(l => l.id)
  } else {
    lessonIds = [id]
  }

  let completions = 0
  let progressRows = 0
  // Guarded: `.in(col, [])` is not a safe no-op to rely on, and an empty category
  // or subject is a normal case here.
  if (lessonIds.length) {
    const [done, all] = await Promise.all([
      supabaseAdmin.from('learn_progress').select('*', { count: 'exact', head: true })
        .in('lesson_id', lessonIds).not('completed_at', 'is', null),
      supabaseAdmin.from('learn_progress').select('*', { count: 'exact', head: true })
        .in('lesson_id', lessonIds),
    ])
    if (done.error) throw new Error(`Could not count completions: ${done.error.message}`)
    if (all.error) throw new Error(`Could not count progress rows: ${all.error.message}`)
    if (done.count == null || all.count == null) throw new Error('Progress counts unavailable')
    completions = done.count
    progressRows = all.count
  }
  return { modules: moduleIds.length, lessons: lessonIds.length, completions, progressRows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Browse dashboard (/admin/learn) — everything the gamified library page needs,
// Built only from signals that actually exist. Due dates and "required" are
// real now (assignments, migration 076) and quiz scores are real (074); there is
// still no "recommended" signal, and learn_progress.time_spent_seconds is still
// never written — so "time" here is always the estimated_minutes of lessons
// COMPLETED, never a measured duration.
// ─────────────────────────────────────────────────────────────────────────────

/** Category → Tone. Subjects inherit their category's tone, so colour means
 *  "same part of the library" rather than decoration. Falls back by index so a
 *  newly-created category still gets a stable colour. */
const CATEGORY_TONES = ['emerald', 'sky', 'amber', 'violet', 'rose', 'slate'] as const
export type LearnTone = (typeof CATEGORY_TONES)[number]

const TONE_BY_SLUG: Record<string, LearnTone> = {
  onboarding: 'emerald',
  company: 'sky',
  safety: 'amber',
  'technical-training': 'violet',
  'products-tools': 'rose',
  'refrigeration-hvacr': 'slate',
}

export type SubjectStatus = 'not-started' | 'in-progress' | 'completed'

export type SubjectCard = {
  id: string
  title: string
  description: string | null
  href: string
  categoryName: string
  tone: LearnTone
  lessonCount: number
  minutes: number
  completed: number
  pct: number
  status: SubjectStatus
  /** Set when this subject has a PUBLISHED quiz. `passed` gates completion. */
  quiz?: { id: string; passed: boolean; bestPct: number | null }
  /** Set when this subject is REQUIRED of this person (migration 076). */
  required?: { dueOn: string | null; daysUntilDue: number | null; overdue: boolean }
}

export type WeekDay = {
  key: string
  /** MON, TUE, … */
  label: string
  dayOfMonth: number
  minutes: number
  lessons: number
  isToday: boolean
}

export type UpNextLesson = {
  id: string
  title: string
  href: string
  moduleTitle: string
  categoryName: string
  tone: LearnTone
  minutes: number
  /** true when the subject is already underway — those are offered first. */
  resuming: boolean
}

export type LearnDashboard = {
  subjects: SubjectCard[]
  week: WeekDay[]
  weekMinutes: number
  lastWeekMinutes: number
  /** null when last week was zero — a percentage against zero is meaningless. */
  deltaPct: number | null
  upNext: UpNextLesson[]
  stats: {
    lessonsCompleted: number
    totalLessons: number
    libraryPct: number
    subjectsInProgress: number
    subjectsCompleted: number
    totalSubjects: number
    streak: number
    longestStreak: number
    totalXp: number
    level: number
    levelTitle: string
    levelProgressPct: number
    nextLevelTitle: string | null
    xpToNext: number | null
    /** Quiz tiles (migration 074). avgQuizPct is over BEST attempts. */
    quizzesTaken: number
    quizzesPassed: number
    avgQuizPct: number
    /** Required training (migration 076). */
    requiredTotal: number
    requiredDone: number
    requiredOverdue: number
  }
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export async function getLearnDashboard(userId: string): Promise<LearnDashboard> {
  const [cats, mods, less, prog, moduleQuizzes, attempts, assigned] = await Promise.all([
    supabaseAdmin.from('learn_categories').select('id, name, slug, display_order').order('display_order'),
    supabaseAdmin.from('learn_modules').select('id, category_id, title, slug, description, display_order')
      .eq('is_published', true).order('display_order'),
    supabaseAdmin.from('learn_lessons').select('id, module_id, title, slug, estimated_minutes, display_order')
      .eq('is_published', true).order('display_order'),
    supabaseAdmin.from('learn_progress').select('lesson_id, completed_at')
      .eq('user_id', userId).not('completed_at', 'is', null),
    getPublishedModuleQuizzes(),
    getAttemptSummaries(userId),
    getMyAssignedModules(userId),
  ])

  const categories = cats.data ?? []
  const modules = mods.data ?? []
  const lessons = less.data ?? []
  const completed = (prog.data ?? []) as { lesson_id: string; completed_at: string }[]

  const toneFor = (slug: string, i: number): LearnTone =>
    TONE_BY_SLUG[slug] ?? CATEGORY_TONES[i % CATEGORY_TONES.length]

  const catById = new Map(categories.map((c, i) => [c.id, { ...c, tone: toneFor(c.slug, i) }]))
  const doneIds = new Set(completed.map(p => p.lesson_id))

  const lessonsByModule = new Map<string, typeof lessons>()
  for (const l of lessons) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l)
    lessonsByModule.set(l.module_id, arr)
  }

  // ── Subject cards ──
  const subjects: SubjectCard[] = modules.map(m => {
    const ls = lessonsByModule.get(m.id) ?? []
    const cat = catById.get(m.category_id)
    const done = ls.filter(l => doneIds.has(l.id)).length
    const pct = ls.length ? Math.round((done / ls.length) * 100) : 0
    const quiz = moduleQuizzes.get(m.id)
    const req = assigned.get(m.id)
    const attempt = quiz ? attempts.get(quiz.id) : undefined
    // Reading everything is no longer enough once a quiz is published — see
    // subjectIsComplete. Subjects WITHOUT a published quiz are unaffected, so
    // publishing one later can't un-complete anyone retroactively.
    const complete = subjectIsComplete(done, ls.length, quiz, attempts)
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      href: `/admin/learn/${cat?.slug ?? ''}/${m.slug}`,
      categoryName: cat?.name ?? '',
      tone: cat?.tone ?? 'slate',
      lessonCount: ls.length,
      minutes: ls.reduce((n, l) => n + (l.estimated_minutes ?? 0), 0),
      completed: done,
      pct,
      status: complete ? 'completed' : done === 0 ? 'not-started' : 'in-progress',
      ...(quiz ? { quiz: { id: quiz.id, passed: attempt?.passed === true, bestPct: attempt?.bestPct ?? null } } : {}),
      ...(req ? { required: { dueOn: req.dueOn, daysUntilDue: req.daysUntilDue, overdue: req.overdue } } : {}),
    }
  })

  // ── Week chart: minutes of content COMPLETED per day, in the house timezone ──
  const minutesByLesson = new Map(lessons.map(l => [l.id, l.estimated_minutes ?? 0]))
  const perDay = new Map<string, { minutes: number; lessons: number }>()
  for (const p of completed) {
    const k = dateKey(new Date(p.completed_at))
    const cur = perDay.get(k) ?? { minutes: 0, lessons: 0 }
    cur.minutes += minutesByLesson.get(p.lesson_id) ?? 0
    cur.lessons += 1
    perDay.set(k, cur)
  }

  const todayKey = dateKey(new Date())
  const todayNum = keyToDayNum(todayKey)
  const keyFor = (dayNum: number) => new Date(dayNum * 86_400_000).toISOString().slice(0, 10)

  // Last 7 days ending today, oldest first.
  const week: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const dayNum = todayNum - (6 - i)
    const key = keyFor(dayNum)
    const hit = perDay.get(key) ?? { minutes: 0, lessons: 0 }
    const d = new Date(dayNum * 86_400_000)
    return {
      key,
      label: DAY_LABELS[d.getUTCDay()],
      dayOfMonth: d.getUTCDate(),
      minutes: hit.minutes,
      lessons: hit.lessons,
      isToday: key === todayKey,
    }
  })

  const weekMinutes = week.reduce((n, d) => n + d.minutes, 0)
  let lastWeekMinutes = 0
  for (let i = 7; i < 14; i++) {
    lastWeekMinutes += perDay.get(keyFor(todayNum - i))?.minutes ?? 0
  }
  const deltaPct = lastWeekMinutes > 0
    ? Math.round(((weekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
    : null

  // ── Up next: resume a started subject first, then start a fresh one ──
  const upNext: UpNextLesson[] = []
  const ordered = [...subjects]
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => {
      const rank = (st: SubjectStatus) => (st === 'in-progress' ? 0 : st === 'not-started' ? 1 : 2)
      return rank(a.s.status) - rank(b.s.status) || a.idx - b.idx
    })
  for (const { s } of ordered) {
    if (upNext.length >= 5) break
    if (s.status === 'completed') continue
    const next = (lessonsByModule.get(s.id) ?? []).find(l => !doneIds.has(l.id))
    if (!next) continue
    upNext.push({
      id: next.id,
      title: next.title,
      href: `${s.href}/${next.slug}`,
      moduleTitle: s.title,
      categoryName: s.categoryName,
      tone: s.tone,
      minutes: next.estimated_minutes ?? 0,
      resuming: s.status === 'in-progress',
    })
  }

  // ── Headline stats ──
  // Skip completions whose lesson is no longer published — `?? 0` would have
  // scored them lessonXp(0) = XP_BASE, i.e. phantom XP, and the other two XP
  // sites (getLearnHeaderStats, computeUserStats) both drop them instead.
  const lessonXpTotal = completed.reduce(
    (n, p) => n + (minutesByLesson.has(p.lesson_id) ? lessonXp(minutesByLesson.get(p.lesson_id)!) : 0), 0)
  const totalXp = lessonXpTotal + quizXpFrom(attempts)
  const lvl = levelInfo(totalXp)
  const streak = computeStreak(completed.map(p => p.completed_at))
  const quizzes = quizStatsFrom(attempts)
  // Required-training rollup. Counted from the SUBJECT CARDS, so 'done' uses the
  // same completion rule (lessons + quiz) the cards and the admin report use.
  const requiredCards = subjects.filter(s => s.required)
  const required = {
    total: requiredCards.length,
    done: requiredCards.filter(s => s.status === 'completed').length,
    overdue: requiredCards.filter(s => s.required!.overdue && s.status !== 'completed').length,
  }

  return {
    subjects,
    week,
    weekMinutes,
    lastWeekMinutes,
    deltaPct,
    upNext,
    stats: {
      lessonsCompleted: doneIds.size,
      totalLessons: lessons.length,
      libraryPct: lessons.length ? Math.round((doneIds.size / lessons.length) * 100) : 0,
      subjectsInProgress: subjects.filter(s => s.status === 'in-progress').length,
      subjectsCompleted: subjects.filter(s => s.status === 'completed').length,
      totalSubjects: subjects.length,
      streak: streak.current,
      longestStreak: streak.longest,
      totalXp,
      level: lvl.level,
      levelTitle: lvl.title,
      levelProgressPct: lvl.progressPct,
      nextLevelTitle: lvl.nextTitle,
      xpToNext: lvl.xpForNextLevel != null ? lvl.xpForNextLevel - lvl.xpIntoLevel : null,
      requiredTotal: required.total,
      requiredDone: required.done,
      requiredOverdue: required.overdue,
      quizzesTaken: quizzes.taken,
      quizzesPassed: quizzes.passed,
      avgQuizPct: quizzes.avgPct,
    },
  }
}

// ── Admin: single lesson for editing ────────────────────────────────────────
export async function getLessonForEdit(id: string) {
  const { data: lesson } = await supabaseAdmin
    .from('learn_lessons').select('*').eq('id', id).single()
  if (!lesson) return null
  const { data: module } = await supabaseAdmin
    .from('learn_modules').select('*').eq('id', lesson.module_id).single()
  return { lesson: lesson as LearnLesson, module: (module ?? null) as LearnModule | null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamification (Phase 2) — XP, levels, streaks, badges, leaderboard.
// All derived from learn_progress + learn_lessons; no extra tables. Pure logic
// lives in lib/learn-gamification.ts; these wrappers just fetch + feed it.
// ─────────────────────────────────────────────────────────────────────────────

// Shared fetch: published taxonomy + a user's completed rows.
async function fetchStatsRaw(userId: string) {
  const [{ data: categories }, { data: modules }, { data: lessons }, { data: progress }] = await Promise.all([
    supabaseAdmin.from('learn_categories').select('id, name, slug, accent').order('display_order'),
    supabaseAdmin.from('learn_modules').select('id, category_id').eq('is_published', true),
    supabaseAdmin.from('learn_lessons').select('id, module_id, estimated_minutes').eq('is_published', true),
    supabaseAdmin.from('learn_progress').select('lesson_id, completed_at').eq('user_id', userId).not('completed_at', 'is', null),
  ])
  const moduleCategory = new Map((modules ?? []).map(m => [m.id, m.category_id]))
  const completed = (progress ?? []).filter(p => p.completed_at) as { lesson_id: string; completed_at: string }[]
  return {
    categories: (categories ?? []) as { id: string; name: string; slug: string; accent: string | null }[],
    moduleCategory,
    lessons: (lessons ?? []).map(l => ({ id: l.id, module_id: l.module_id, estimated_minutes: l.estimated_minutes ?? 0 })),
    completed,
  }
}

export async function getUserLearnStats(userId: string): Promise<UserLearnStats> {
  // Quiz XP must be included here too. /admin/learn/me renders this object's
  // totalXp and level; the browse page and Company Home both add quizXpFrom, so
  // omitting it made the same person's XP differ between pages one click apart.
  const [raw, attempts] = await Promise.all([fetchStatsRaw(userId), getAttemptSummaries(userId)])
  return computeUserStats({
    categories: raw.categories,
    moduleCategory: raw.moduleCategory,
    lessons: raw.lessons,
    completedLessonIds: new Set(raw.completed.map(p => p.lesson_id)),
    completedDates: raw.completed.map(p => p.completed_at),
    extraXp: quizXpFrom(attempts),
  })
}

// Lightweight per-user snapshot — no badge or per-category work, just two
// queries. Feeds the "Your training" card on Company Home (/admin/home and
// /employee/home), which is now the one place a person sees their own progress
// without opening Learn.
export type LearnHeaderStats = {
  totalXp: number; level: number; levelTitle: string; currentStreak: number
  lessonsCompleted: number
  /** Published lessons in the whole library — the denominator for `pct`. */
  totalLessons: number
  /** 0–100, rounded. 0 when the library is empty. */
  pct: number
  /** Required training still outstanding, and how much of it is past due. */
  requiredOutstanding: number
  requiredOverdue: number
}
export async function getLearnHeaderStats(userId: string): Promise<LearnHeaderStats> {
  const [{ data: lessons }, { data: progress }, attempts, assigned] = await Promise.all([
    supabaseAdmin.from('learn_lessons').select('id, estimated_minutes').eq('is_published', true),
    supabaseAdmin.from('learn_progress').select('lesson_id, completed_at').eq('user_id', userId).not('completed_at', 'is', null),
    getAttemptSummaries(userId),
    getMyAssignedModules(userId),
  ])
  const min = new Map((lessons ?? []).map(l => [l.id, l.estimated_minutes ?? 0]))
  let xp = 0, count = 0
  for (const p of progress ?? []) { if (!min.has(p.lesson_id)) continue; xp += lessonXp(min.get(p.lesson_id)); count++ }
  // Quiz XP counts here too, or Company Home would quote a different total from
  // the Learn pages for the same person.
  xp += quizXpFrom(attempts)
  const streak = computeStreak((progress ?? []).map(p => p.completed_at as string).filter(Boolean))
  const lvl = levelInfo(xp)
  const totalLessons = min.size

  // Required-training rollup for the Company Home strip.
  //
  // This applies the FULL rule (lessons + quiz), not a lesson-only shortcut. The
  // first cut skipped the quiz gate to save a query, which meant someone who had
  // read every lesson but never passed a published quiz was told nothing was due
  // here while the compliance report showed them incomplete and overdue. One
  // extra query is worth the three surfaces agreeing.
  const doneLessonIds = new Set((progress ?? []).map(p => p.lesson_id as string))
  let requiredOutstanding = 0
  let requiredOverdue = 0
  if (assigned.size) {
    const [{ data: reqLessons }, moduleQuizzes] = await Promise.all([
      supabaseAdmin.from('learn_lessons').select('id, module_id')
        .in('module_id', [...assigned.keys()]).eq('is_published', true),
      getPublishedModuleQuizzes(),
    ])
    const byModule = new Map<string, string[]>()
    for (const l of reqLessons ?? []) {
      const arr = byModule.get(l.module_id) ?? []
      arr.push(l.id)
      byModule.set(l.module_id, arr)
    }
    for (const [moduleId, req] of assigned) {
      const ls = byModule.get(moduleId) ?? []
      const read = ls.filter(id => doneLessonIds.has(id)).length
      if (subjectIsComplete(read, ls.length, moduleQuizzes.get(moduleId), attempts)) continue
      requiredOutstanding++
      if (req.overdue) requiredOverdue++
    }
  }

  return {
    totalXp: xp, level: lvl.level, levelTitle: lvl.title, currentStreak: streak.current,
    lessonsCompleted: count,
    totalLessons,
    pct: totalLessons ? Math.round((count / totalLessons) * 100) : 0,
    requiredOutstanding,
    requiredOverdue,
  }
}

// Per-completion award for the lesson "Mark complete" toast: XP gained + any
// badges newly unlocked (diffed against the user's state without this lesson).
export type ProgressAward = {
  xpAwarded: number
  totalXp: number
  level: number
  levelTitle: string
  leveledUp: boolean
  newBadges: { key: string; label: string; icon: string; tier: string }[]
}
export async function computeAwardForCompletion(userId: string, lessonId: string): Promise<ProgressAward> {
  const [raw, attempts] = await Promise.all([fetchStatsRaw(userId), getAttemptSummaries(userId)])
  // Quiz XP is added to BOTH sides. The delta (xpAwarded) is unaffected — it is
  // still just this lesson's XP — but the toast's "N XP total" and its level /
  // leveledUp check are now computed on the real total. Without it, someone who
  // had passed a quiz would see an understated total and could miss the
  // level-up celebration entirely.
  const extraXp = quizXpFrom(attempts)
  const base = {
    categories: raw.categories, moduleCategory: raw.moduleCategory, lessons: raw.lessons, extraXp,
  }

  const allIds = new Set(raw.completed.map(p => p.lesson_id))
  const allDates = raw.completed.map(p => p.completed_at)
  const after = computeUserStats({ ...base, completedLessonIds: allIds, completedDates: allDates })

  // "Before": same data minus this lesson's completion (id + its date).
  const beforeIds = new Set(allIds); beforeIds.delete(lessonId)
  const beforeDates = raw.completed.filter(p => p.lesson_id !== lessonId).map(p => p.completed_at)
  const before = computeUserStats({ ...base, completedLessonIds: beforeIds, completedDates: beforeDates })
  const beforeKeys = new Set(before.badges.filter(b => b.earned).map(b => b.key))

  return {
    xpAwarded: Math.max(0, after.totalXp - before.totalXp),
    totalXp: after.totalXp,
    level: after.level.level,
    levelTitle: after.level.title,
    leveledUp: after.level.level > before.level.level,
    newBadges: after.badges.filter(b => b.earned && !beforeKeys.has(b.key))
      .map(b => ({ key: b.key, label: b.label, icon: b.icon, tier: b.tier })),
  }
}

// Team leaderboard: every active employee ranked by XP. Includes 0-XP folks so
// the whole team is visible; the UI highlights the viewer.
export type LeaderboardRow = {
  userId: string; name: string; avatarUrl: string | null; department: string | null
  xp: number; lessonsCompleted: number; level: number; levelTitle: string
}
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  // Customers hold an employees row too (see lib/staff.ts); without the filter
  // they'd sit on the team leaderboard forever at 0 XP.
  const [{ data: allEmployees }, { data: lessons }, { data: progress }, customers, { data: passes }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, name, email, avatar_url, department, is_active').eq('is_active', true),
    supabaseAdmin.from('learn_lessons').select('id, estimated_minutes').eq('is_published', true),
    supabaseAdmin.from('learn_progress').select('user_id, lesson_id, completed_at').not('completed_at', 'is', null),
    getCustomerIds(),
    // Quiz XP counts on the leaderboard too — otherwise it ranks quiz-passers
    // below their real XP and shows a different total from /admin/learn, which
    // links straight here.
    supabaseAdmin.from('learn_quiz_attempts').select('user_id, quiz_id').eq('passed', true),
  ])
  const employees = (allEmployees ?? []).filter(e => !customers.has(e.id))
  const lessonMin = new Map((lessons ?? []).map(l => [l.id, l.estimated_minutes ?? 0]))
  const perUser = new Map<string, { xp: number; count: number }>()
  for (const p of progress ?? []) {
    if (!lessonMin.has(p.lesson_id)) continue
    const u = perUser.get(p.user_id) ?? { xp: 0, count: 0 }
    u.xp += lessonXp(lessonMin.get(p.lesson_id)); u.count++
    perUser.set(p.user_id, u)
  }
  // Once per (user, quiz) — a retake after passing must not pay again.
  const paid = new Set<string>()
  for (const a of passes ?? []) {
    const key = `${a.user_id}:${a.quiz_id}`
    if (paid.has(key)) continue
    paid.add(key)
    const u = perUser.get(a.user_id) ?? { xp: 0, count: 0 }
    u.xp += QUIZ_PASS_XP
    perUser.set(a.user_id, u)
  }
  const rows: LeaderboardRow[] = (employees ?? []).map(e => {
    const u = perUser.get(e.id) ?? { xp: 0, count: 0 }
    const lvl = levelInfo(u.xp)
    return {
      userId: e.id,
      name: e.name?.trim() || e.email?.split('@')[0] || 'Team Member',
      avatarUrl: e.avatar_url, department: e.department,
      xp: u.xp, lessonsCompleted: u.count, level: lvl.level, levelTitle: lvl.title,
    }
  })
  rows.sort((a, b) => b.xp - a.xp || b.lessonsCompleted - a.lessonsCompleted || a.name.localeCompare(b.name))
  return rows
}
