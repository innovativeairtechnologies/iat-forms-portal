import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getPublishedModuleQuizzes, getAttemptSummaries, subjectIsComplete,
  type QuizAttemptSummary,
} from '@/lib/learn-quiz'

/* Required training + completion reporting (migration 076).

   Two things this file is careful about:

   1. THE AUDIENCE IS RESOLVED ON READ, never materialised. A 'role',
      'department' or 'everyone' assignment picks up a new hire the day their
      account exists — which is the entire reason to assign by group.

   2. COMPLETION HAS ONE DEFINITION. It is derived here from exactly the same
      inputs and the same subjectIsComplete() the library pages use, so a
      manager's report can never disagree with what the learner sees on their
      own dashboard. There is deliberately no `completed` column to drift. */

export type AudienceType = 'user' | 'role' | 'department' | 'everyone'
export type AssignmentScope = 'module' | 'category'

export type Assignment = {
  id: string
  scopeType: AssignmentScope
  scopeId: string
  scopeLabel: string
  audienceType: AudienceType
  audienceValue: string | null
  audienceLabel: string
  dueOn: string | null
  note: string | null
  createdAt: string
}

export type StaffMember = { id: string; name: string; email: string; role: string | null; department: string | null }

export type PersonProgress = {
  userId: string
  name: string
  /** Subjects in scope that this person has finished. */
  done: number
  total: number
  pct: number
  complete: boolean
}

export type AssignmentReport = Assignment & {
  people: PersonProgress[]
  completeCount: number
  headcount: number
  /** null when there's no due date. */
  overdue: boolean
  daysUntilDue: number | null
}

// ── Staff ────────────────────────────────────────────────────────────────────

/**
 * Active STAFF only.
 *
 * Customers historically live in this same employees table (every customer
 * invite added a row), so they are excluded by profiles.role — the same
 * definition lib/staff.ts getCustomerIds() uses. As of the Phase-2 customer
 * split the internal DB holds 9 staff and 0 customer profiles, so the filter is
 * currently a no-op; it stays because the table is not staff-only by design.
 *
 * Fails OPEN, deliberately, matching getCustomerIds(): an employees row with no
 * profile is treated as staff rather than dropped. This builds a ROSTER for
 * assigning training, not an authorization decision — a missing name is a worse
 * failure here than an extra one. Anything gating access must use isCustomer(),
 * which fails closed.
 */
export async function getAssignableStaff(): Promise<StaffMember[]> {
  const [{ data: emps }, { data: profs }] = await Promise.all([
    supabaseAdmin.from('employees').select('id, name, email, department').eq('is_active', true),
    supabaseAdmin.from('profiles').select('id, role'),
  ])
  const roleById = new Map((profs ?? []).map(p => [p.id, p.role as string | null]))
  return (emps ?? [])
    .filter(e => roleById.get(e.id) !== 'customer')
    .map(e => ({
      id: e.id,
      name: e.name ?? e.email ?? 'Unknown',
      email: e.email ?? '',
      role: roleById.get(e.id) ?? null,
      // Department is free text and often blank; normalise '' to null so the
      // "no department set" case is one thing, not two.
      department: e.department?.trim() ? e.department.trim() : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Who a given audience actually resolves to, out of `staff`. */
export function resolveAudience(
  staff: StaffMember[],
  audienceType: AudienceType,
  audienceValue: string | null,
): StaffMember[] {
  switch (audienceType) {
    case 'everyone': return staff
    case 'user': return staff.filter(s => s.id === audienceValue)
    case 'role': return staff.filter(s => s.role === audienceValue)
    case 'department': return staff.filter(s => s.department === audienceValue)
  }
}

// ── Assignments ──────────────────────────────────────────────────────────────

export async function listAssignments(): Promise<Assignment[]> {
  const { data } = await supabaseAdmin
    .from('learn_assignments').select('*').order('created_at', { ascending: false })
  if (!data?.length) return []

  const [{ data: mods }, { data: cats }, staff] = await Promise.all([
    supabaseAdmin.from('learn_modules').select('id, title'),
    supabaseAdmin.from('learn_categories').select('id, name'),
    getAssignableStaff(),
  ])
  const modTitle = new Map((mods ?? []).map(m => [m.id, m.title]))
  const catName = new Map((cats ?? []).map(c => [c.id, c.name]))
  const personName = new Map(staff.map(s => [s.id, s.name]))

  return data.map(a => ({
    id: a.id,
    scopeType: a.scope_type,
    scopeId: a.scope_id,
    scopeLabel: a.scope_type === 'module'
      ? (modTitle.get(a.scope_id) ?? 'Unknown subject')
      : (catName.get(a.scope_id) ?? 'Unknown category'),
    audienceType: a.audience_type,
    audienceValue: a.audience_value,
    audienceLabel: audienceLabel(a.audience_type, a.audience_value, personName),
    dueOn: a.due_on,
    note: a.note,
    createdAt: a.created_at,
  }))
}

function audienceLabel(type: AudienceType, value: string | null, names: Map<string, string>): string {
  switch (type) {
    case 'everyone': return 'Everyone on staff'
    case 'user': return names.get(value ?? '') ?? 'Unknown person'
    case 'role': return `Role · ${value}`
    case 'department': return `Dept · ${value}`
  }
}

// ── Completion ───────────────────────────────────────────────────────────────

/** The module ids an assignment covers: itself, or every published module in a category. */
async function modulesForScope(scopeType: AssignmentScope, scopeId: string): Promise<string[]> {
  if (scopeType === 'module') return [scopeId]
  const { data } = await supabaseAdmin
    .from('learn_modules').select('id').eq('category_id', scopeId).eq('is_published', true)
  return (data ?? []).map(m => m.id)
}

/**
 * Full reporting rollup. Resolves every audience, then computes each person's
 * completion from the same inputs the library pages use.
 *
 * Reads progress for ALL relevant users in one query rather than per person —
 * with 9 staff that hardly matters, but the shape shouldn't degrade if IAT
 * doubles.
 */
export async function getAssignmentReports(): Promise<AssignmentReport[]> {
  const [assignments, staff, moduleQuizzes] = await Promise.all([
    listAssignments(), getAssignableStaff(), getPublishedModuleQuizzes(),
  ])
  if (!assignments.length) return []

  // Modules per assignment, and the full lesson set for those modules.
  const modulesByAssignment = new Map<string, string[]>()
  for (const a of assignments) {
    modulesByAssignment.set(a.id, await modulesForScope(a.scopeType, a.scopeId))
  }
  const allModuleIds = [...new Set([...modulesByAssignment.values()].flat())]

  const { data: lessons } = allModuleIds.length
    ? await supabaseAdmin.from('learn_lessons').select('id, module_id')
        .in('module_id', allModuleIds).eq('is_published', true)
    : { data: [] as { id: string; module_id: string }[] }

  const lessonsByModule = new Map<string, string[]>()
  for (const l of lessons ?? []) {
    const arr = lessonsByModule.get(l.module_id) ?? []
    arr.push(l.id)
    lessonsByModule.set(l.module_id, arr)
  }

  // Everyone who appears in at least one audience.
  const involved = new Set<string>()
  for (const a of assignments) {
    for (const p of resolveAudience(staff, a.audienceType, a.audienceValue)) involved.add(p.id)
  }

  const { data: progress } = involved.size
    ? await supabaseAdmin.from('learn_progress').select('user_id, lesson_id')
        .in('user_id', [...involved]).not('completed_at', 'is', null)
    : { data: [] as { user_id: string; lesson_id: string }[] }

  const doneByUser = new Map<string, Set<string>>()
  for (const p of progress ?? []) {
    const s = doneByUser.get(p.user_id) ?? new Set<string>()
    s.add(p.lesson_id)
    doneByUser.set(p.user_id, s)
  }

  const attemptsByUser = new Map<string, Map<string, QuizAttemptSummary>>()
  await Promise.all([...involved].map(async id => attemptsByUser.set(id, await getAttemptSummaries(id))))

  const today = new Date().toISOString().slice(0, 10)

  return assignments.map(a => {
    const moduleIds = modulesByAssignment.get(a.id) ?? []
    const audience = resolveAudience(staff, a.audienceType, a.audienceValue)

    const people: PersonProgress[] = audience.map(person => {
      const done = doneByUser.get(person.id) ?? new Set<string>()
      const attempts = attemptsByUser.get(person.id) ?? new Map()
      let finished = 0
      for (const mid of moduleIds) {
        const ls = lessonsByModule.get(mid) ?? []
        const read = ls.filter(id => done.has(id)).length
        if (subjectIsComplete(read, ls.length, moduleQuizzes.get(mid), attempts)) finished++
      }
      const total = moduleIds.length
      return {
        userId: person.id,
        name: person.name,
        done: finished,
        total,
        pct: total ? Math.round((finished / total) * 100) : 0,
        complete: total > 0 && finished >= total,
      }
    }).sort((x, y) => x.pct - y.pct || x.name.localeCompare(y.name)) // least-done first — that's who needs chasing

    const completeCount = people.filter(p => p.complete).length
    const daysUntilDue = a.dueOn
      ? Math.round((Date.parse(a.dueOn) - Date.parse(today)) / 86_400_000)
      : null

    return {
      ...a,
      people,
      completeCount,
      headcount: people.length,
      // Overdue only counts if someone hasn't finished — a past due date with
      // everyone done is just history.
      overdue: daysUntilDue != null && daysUntilDue < 0 && completeCount < people.length,
      daysUntilDue,
    }
  })
}

// ── Learner side ─────────────────────────────────────────────────────────────

export type MyAssignment = {
  assignmentId: string
  scopeType: AssignmentScope
  scopeId: string
  dueOn: string | null
  daysUntilDue: number | null
  overdue: boolean
}

/**
 * What is required of ONE person, keyed by module id so the browse page can
 * stamp "Required" on a subject card.
 *
 * A category assignment fans out to its published modules, so a subject can be
 * required via several assignments at once — the EARLIEST due date wins, since
 * that's the one that actually binds.
 */
export async function getMyAssignedModules(userId: string): Promise<Map<string, MyAssignment>> {
  const [{ data: rows }, staff] = await Promise.all([
    supabaseAdmin.from('learn_assignments').select('*'),
    getAssignableStaff(),
  ])
  if (!rows?.length) return new Map()

  const me = staff.find(s => s.id === userId)
  if (!me) return new Map() // not staff (or inactive) — nothing is required

  const mine = rows.filter(a =>
    resolveAudience([me], a.audience_type, a.audience_value).length > 0,
  )
  if (!mine.length) return new Map()

  const today = new Date().toISOString().slice(0, 10)
  const out = new Map<string, MyAssignment>()

  for (const a of mine) {
    const moduleIds = await modulesForScope(a.scope_type, a.scope_id)
    const days = a.due_on ? Math.round((Date.parse(a.due_on) - Date.parse(today)) / 86_400_000) : null
    for (const mid of moduleIds) {
      const existing = out.get(mid)
      // Earliest due date wins; a dated assignment beats an undated one.
      if (existing) {
        const better = a.due_on && (!existing.dueOn || a.due_on < existing.dueOn)
        if (!better) continue
      }
      out.set(mid, {
        assignmentId: a.id,
        scopeType: a.scope_type,
        scopeId: a.scope_id,
        dueOn: a.due_on,
        daysUntilDue: days,
        overdue: days != null && days < 0,
      })
    }
  }
  return out
}
