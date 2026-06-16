import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  computeUserStats, computeStreak, lessonXp, levelInfo,
  type UserLearnStats,
} from '@/lib/learn-gamification'

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
export async function getAdminTree() {
  const [{ data: categories }, { data: modules }, { data: lessons }] = await Promise.all([
    supabaseAdmin.from('learn_categories').select('*').order('display_order'),
    supabaseAdmin.from('learn_modules').select('*').order('display_order'),
    supabaseAdmin.from('learn_lessons').select('id, module_id, title, slug, display_order, is_published, estimated_minutes').order('display_order'),
  ])
  return {
    categories: (categories ?? []) as LearnCategory[],
    modules: (modules ?? []) as LearnModule[],
    lessons: (lessons ?? []) as Omit<LearnLesson, 'content'>[],
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
  const raw = await fetchStatsRaw(userId)
  return computeUserStats({
    categories: raw.categories,
    moduleCategory: raw.moduleCategory,
    lessons: raw.lessons,
    completedLessonIds: new Set(raw.completed.map(p => p.lesson_id)),
    completedDates: raw.completed.map(p => p.completed_at),
  })
}

// Lightweight header chip (no badges/category work) — runs on every /learn page.
export type LearnHeaderStats = {
  totalXp: number; level: number; levelTitle: string; currentStreak: number; lessonsCompleted: number
}
export async function getLearnHeaderStats(userId: string): Promise<LearnHeaderStats> {
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabaseAdmin.from('learn_lessons').select('id, estimated_minutes').eq('is_published', true),
    supabaseAdmin.from('learn_progress').select('lesson_id, completed_at').eq('user_id', userId).not('completed_at', 'is', null),
  ])
  const min = new Map((lessons ?? []).map(l => [l.id, l.estimated_minutes ?? 0]))
  let xp = 0, count = 0
  for (const p of progress ?? []) { if (!min.has(p.lesson_id)) continue; xp += lessonXp(min.get(p.lesson_id)); count++ }
  const streak = computeStreak((progress ?? []).map(p => p.completed_at as string).filter(Boolean))
  const lvl = levelInfo(xp)
  return { totalXp: xp, level: lvl.level, levelTitle: lvl.title, currentStreak: streak.current, lessonsCompleted: count }
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
  const raw = await fetchStatsRaw(userId)
  const base = { categories: raw.categories, moduleCategory: raw.moduleCategory, lessons: raw.lessons }

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
  const [{ data: employees }, { data: lessons }, { data: progress }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, name, email, avatar_url, department, is_active').eq('is_active', true),
    supabaseAdmin.from('learn_lessons').select('id, estimated_minutes').eq('is_published', true),
    supabaseAdmin.from('learn_progress').select('user_id, lesson_id, completed_at').not('completed_at', 'is', null),
  ])
  const lessonMin = new Map((lessons ?? []).map(l => [l.id, l.estimated_minutes ?? 0]))
  const perUser = new Map<string, { xp: number; count: number }>()
  for (const p of progress ?? []) {
    if (!lessonMin.has(p.lesson_id)) continue
    const u = perUser.get(p.user_id) ?? { xp: 0, count: 0 }
    u.xp += lessonXp(lessonMin.get(p.lesson_id)); u.count++
    perUser.set(p.user_id, u)
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
