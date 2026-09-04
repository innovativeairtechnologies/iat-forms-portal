import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCustomerIds } from '@/lib/staff'
import { prettyName } from '@/lib/display-name'

/* ────────────────────────────────────────────────────────────────────────────
   The company directory — ONE loader behind every surface that shows "who
   works here and how do I reach them": the dashboard card, the profile page
   section, and /api/admin/directory.

   Deliberately a plain module (no 'use client', no React): the dashboard card
   is a server component and the profile page is a client one, and both need
   the same shape. See [[use-client-value-imports]] — the org chart's own
   `shownEmail`/`initialsOf` live in a 'use client' file, so they are
   re-implemented here rather than imported into a server tree.

   It reads the same `employees` rows the org chart draws from, so a person
   added to the roster appears in both without a second place to maintain.
   ──────────────────────────────────────────────────────────────────────────── */

export type DirectoryPerson = {
  id: string
  name: string
  initials: string
  /** Null when the row still carries a seeded placeholder — see shownEmail below. */
  email: string | null
  phone: string | null
  jobTitle: string | null
  department: string | null
  avatarUrl: string | null
  /** Display name of this person's manager, resolved in memory (self-FK). */
  managerName: string | null
}

/**
 * Placeholder emails never reach a screen.
 *
 * The org chart was seeded from the company chart with `@*.iat.test` addresses
 * (scripts/seed-orgchart-test.mjs). Showing one invites somebody to mail it,
 * so an unresolved address reads as "no email on file" instead — the same rule
 * the chart's own `shownEmail()` applies.
 */
export function shownEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim()
  if (!e || /\.iat\.test$/i.test(e)) return null
  return e
}

/** Two-letter monogram for the avatar chip — matches the org chart's cards. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

/**
 * Everyone on the staff roster, alphabetical.
 *
 * Customers are excluded: every auth user gets an `employees` row, customers
 * included (see lib/staff.ts), and a customer rendered as a colleague is the
 * sharp failure here. Inactive people and anyone hidden from the org chart
 * (`org_visible = false`) are excluded too, so the directory and the chart
 * always agree on who is on the team.
 */
export async function getDirectory(): Promise<DirectoryPerson[]> {
  const [{ data, error }, customers] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, email, phone, job_title, department, avatar_url, manager_id, is_active, org_visible')
      .order('name'),
    getCustomerIds(),
  ])
  if (error || !data) return []

  const rows = data.filter(
    (e) => e.is_active !== false && e.org_visible !== false && !customers.has(e.id),
  )
  // Manager names resolve against the UNFILTERED set: a hidden or deactivated
  // manager should still label the people who report to them, otherwise the
  // reporting line silently reads as "reports to nobody".
  const nameById = new Map(data.map((e) => [e.id, prettyName(e.name, 'Unnamed')]))

  return rows.map((e) => {
    const name = prettyName(e.name, 'Unnamed')
    return {
      id: e.id,
      name,
      initials: initialsOf(name),
      email: shownEmail(e.email),
      phone: e.phone?.trim() || null,
      jobTitle: e.job_title?.trim() || null,
      department: e.department?.trim() || null,
      avatarUrl: e.avatar_url ?? null,
      managerName: e.manager_id ? nameById.get(e.manager_id) ?? null : null,
    }
  })
}

/** Department roll-up for the org-chart card's summary line. */
export function departmentCounts(people: DirectoryPerson[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of people) {
    if (!p.department) continue
    counts.set(p.department, (counts.get(p.department) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
