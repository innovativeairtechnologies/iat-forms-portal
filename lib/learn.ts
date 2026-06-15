import { supabaseAdmin } from '@/lib/supabase-admin'

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
