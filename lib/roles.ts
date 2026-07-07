// ─────────────────────────────────────────────────────────────────────────────
// lib/roles.ts — single source of truth for staff roles & nav permissions.
//
// This file is intentionally dependency-free (pure TypeScript, no server or node
// APIs) so it can be imported by the edge middleware, server components, AND
// client components alike.
//
// Model (v1):
//   • `admin`  — full access to every admin-surface section.
//   • 5 scoped roles (sales, hr, marketing, engineering, production_manager) —
//     land in /admin but only see & reach the sections their permission set
//     allows. Enforced in the sidebar (nav visibility) AND the middleware
//     (page-level access — a hidden tab can't be reached by typing its URL).
//   • `production` — the base staff tier (formerly `employee`); uses /employee.
//   • `customer`  — external customer portal at /customer.
//
// Permissions are defined in code here for v1. Moving the matrix into a DB table
// (so it's editable without a deploy) is a planned follow-up; the helpers below
// are the seam that change would slot into.
// ─────────────────────────────────────────────────────────────────────────────

export const STAFF_ROLES = [
  'admin',
  'sales',
  'hr',
  'marketing',
  'engineering',
  'production_manager',
  'production',
] as const

export type StaffRole = (typeof STAFF_ROLES)[number]
export type Role = StaffRole | 'customer'

/** Roles an admin can assume in the account-management UI (everything but customer). */
export const ASSIGNABLE_ROLES: StaffRole[] = [...STAFF_ROLES]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  sales: 'Sales',
  hr: 'HR',
  marketing: 'Marketing',
  engineering: 'Engineering',
  production_manager: 'Production Manager',
  production: 'Production',
  customer: 'Customer',
}

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: 'Full access to every section and setting.',
  sales: 'Tickets, equipment, customers, deal pipeline, and project timelines.',
  hr: 'People, forms, time off, scheduling, and accruals.',
  marketing: 'Presentations and content.',
  engineering: 'Submissions, tickets, equipment, and project timelines.',
  production_manager: 'Tickets, equipment, project timelines, and scheduling.',
  production: 'Base employee access — personal dashboard, time off, org chart.',
}

// ─── Permission keys — one per gated admin area ──────────────────────────────

export type Perm =
  | 'dashboard' // /admin root executive overview — admin only
  | 'submissions'
  | 'tickets'
  | 'equipment'
  | 'customers'
  | 'gantt'
  | 'org_chart'
  | 'forms'
  | 'employee_forms'
  | 'pto'
  | 'sick'
  | 'scheduling'
  | 'accrual'
  | 'presentations'
  | 'audit'
  | 'employees' // account management (create / delete / assign roles)
  | 'us_rotors'
  | 'jerry' // internal AI assistant page — granted to every admin-surface role
  | 'deals' // sales deal pipeline ("Forecast Pulse") — sales gets read AND write, see docs

// The matrix. `admin` implicitly gets everything (see hasPermission). Any perm
// NOT listed for a scoped role — including 'dashboard', 'us_rotors' — is
// admin-only, so those are fail-closed by omission.
const ROLE_PERMS: Record<Exclude<StaffRole, 'admin'>, Perm[]> = {
  sales: ['dashboard', 'tickets', 'equipment', 'customers', 'gantt', 'jerry', 'deals'],
  hr: ['dashboard', 'org_chart', 'forms', 'employee_forms', 'pto', 'sick', 'scheduling', 'accrual', 'employees', 'jerry'],
  marketing: ['dashboard', 'presentations', 'jerry'],
  engineering: ['dashboard', 'submissions', 'tickets', 'equipment', 'gantt', 'jerry'],
  production_manager: ['dashboard', 'tickets', 'equipment', 'gantt', 'scheduling', 'jerry'],
  production: [],
}

export function hasPermission(role: Role | null, perm: Perm): boolean {
  if (!role) return false
  if (role === 'admin') return true
  if (role === 'customer') return false
  const list = ROLE_PERMS[role]
  return Array.isArray(list) && list.includes(perm)
}

// ─── Role classification & routing ───────────────────────────────────────────

/**
 * Legacy base employees were stored as `role = 'employee'`. Everywhere in the
 * app treats that as the `production` tier. Unknown values → null.
 */
export function normalizeRole(raw: string | null | undefined): Role | null {
  if (!raw) return null
  if (raw === 'employee') return 'production'
  if (raw === 'customer') return 'customer'
  return (STAFF_ROLES as readonly string[]).includes(raw) ? (raw as Role) : null
}

export function isStaffRole(role: Role | null): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}

/** Roles that get the /admin surface (full admin + the 5 scoped roles). */
export function isAdminSurfaceRole(role: Role | null): boolean {
  return isStaffRole(role) && role !== 'production'
}

// Ordered list of admin sections → canonical landing href. Order defines a
// scoped role's default landing page (its first permitted section).
export const ADMIN_SECTIONS: { perm: Perm; href: string }[] = [
  { perm: 'submissions', href: '/admin/submissions' },
  { perm: 'tickets', href: '/admin/tickets' },
  { perm: 'equipment', href: '/admin/equipment' },
  { perm: 'customers', href: '/admin/customers' },
  { perm: 'deals', href: '/admin/deals' },
  { perm: 'gantt', href: '/admin/gantt' },
  { perm: 'org_chart', href: '/admin/org-chart' },
  { perm: 'forms', href: '/admin/forms' },
  { perm: 'employee_forms', href: '/admin/employee-forms' },
  { perm: 'pto', href: '/admin/requests/pto' },
  { perm: 'sick', href: '/admin/requests/sick' },
  { perm: 'scheduling', href: '/admin/schedule' },
  { perm: 'accrual', href: '/admin/accrual' },
  { perm: 'presentations', href: '/admin/presentations' },
  { perm: 'employees', href: '/admin/employees' },
  { perm: 'audit', href: '/admin/audit' },
]

/** Where a role lands after login / when redirected home. */
export function homeForRole(role: Role | null): string {
  if (role === 'admin') return '/admin'
  if (isAdminSurfaceRole(role)) {
    // Scoped roles with a department dashboard (see DepartmentDashboard.tsx)
    // land on it, same as admin, instead of jumping straight to their first
    // permitted section.
    if (hasPermission(role, 'dashboard')) return '/admin'
    const first = ADMIN_SECTIONS.find((s) => hasPermission(role, s.perm))
    return first?.href ?? '/admin/profile' // profile is always accessible
  }
  if (role === 'customer') return '/customer'
  return '/employee/profile'
}

// ─── Page-level access (used by middleware) ──────────────────────────────────

// Paths under /admin that are always allowed for any admin-surface role.
const OPEN_ADMIN_PREFIXES = ['/admin/profile']

// Longest matching prefix wins. The bare '/admin' catch-all maps to 'dashboard'
// (admin-only), so ANY /admin/* route not explicitly listed here is fail-closed
// to admin only — new admin routes are protected by default until mapped.
const ADMIN_PATH_PERMS: { prefix: string; perm: Perm }[] = [
  { prefix: '/admin', perm: 'dashboard' },
  { prefix: '/admin/jerry', perm: 'jerry' },
  { prefix: '/admin/submissions', perm: 'submissions' },
  { prefix: '/admin/tickets', perm: 'tickets' },
  { prefix: '/admin/troubleshooting', perm: 'tickets' },
  { prefix: '/admin/equipment', perm: 'equipment' },
  { prefix: '/admin/customers', perm: 'customers' },
  { prefix: '/admin/deals', perm: 'deals' },
  { prefix: '/admin/gantt', perm: 'gantt' },
  { prefix: '/admin/org-chart', perm: 'org_chart' },
  { prefix: '/admin/forms', perm: 'forms' },
  { prefix: '/admin/employee-forms', perm: 'employee_forms' },
  { prefix: '/admin/requests', perm: 'pto' }, // bare index (hr has pto)
  { prefix: '/admin/requests/pto', perm: 'pto' },
  { prefix: '/admin/requests/sick', perm: 'sick' },
  { prefix: '/admin/schedule', perm: 'scheduling' },
  { prefix: '/admin/scheduling', perm: 'scheduling' },
  { prefix: '/admin/accrual', perm: 'accrual' },
  { prefix: '/admin/presentations', perm: 'presentations' },
  { prefix: '/admin/audit', perm: 'audit' },
  { prefix: '/admin/employees', perm: 'employees' },
  { prefix: '/admin/us-rotors', perm: 'us_rotors' },
]

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/**
 * The permission required to view a given /admin path, or null if the path is
 * open to any admin-surface role (e.g. /admin/profile).
 */
export function requiredPermForPath(pathname: string): Perm | null {
  if (OPEN_ADMIN_PREFIXES.some((p) => matchesPrefix(pathname, p))) return null
  let best: { prefix: string; perm: Perm } | null = null
  for (const entry of ADMIN_PATH_PERMS) {
    if (matchesPrefix(pathname, entry.prefix)) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry
    }
  }
  return best?.perm ?? 'dashboard' // unmapped /admin path → admin only
}

/** True if `role` may view `pathname` under /admin. */
export function canAccessAdminPath(role: Role | null, pathname: string): boolean {
  if (role === 'admin') return true
  const perm = requiredPermForPath(pathname)
  if (perm === null) return isAdminSurfaceRole(role) // open path, staff-admin only
  return hasPermission(role, perm)
}
