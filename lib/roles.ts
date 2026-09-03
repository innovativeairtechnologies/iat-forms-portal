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
//   • `production` — the base staff tier (formerly `employee`). As of the portal
//     consolidation it ALSO lands in /admin like everyone else (holding no perms,
//     so only the open /admin/home + /admin/profile). Its self-service pages
//     (My Board, directory, time off) remain under /employee until they're ported.
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
  // /admin root executive overview. ⚠️ NOT admin-only — every scoped role holds
  // it, which is exactly what makes an unmapped /admin/* path permissive rather
  // than fail-closed. See the warning above ADMIN_PATH_PERMS.
  | 'dashboard'
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
  | 'knowledge' // "Jerry's Brain" — feed docs into the RAG pool; admin-only (fed by omission)
  | 'customer_jerry' // admin preview of the customer-facing Jerry; admin-only
  | 'permissions' // the role-permission matrix editor itself; admin-only, non-delegatable
  | 'srv' // the SRV content editor (/admin/srv); admin-only by omission
  // /admin/reports — cross-cutting reporting (support tickets first, more to
  // follow). Admin-only BY OMISSION from the scoped-role defaults below, exactly
  // like 'srv' and 'sizing', so it needs no role_permissions seed and no
  // migration: hasPermission() returns true for `admin` and the DB matrix has no
  // row granting it to anyone else.
  //
  // ⚠️ Deliberately NOT reusing 'tickets'. That perm is held live by engineering
  // and production_manager (checked 2026-08-21), and reporting is a different
  // question from working the queue: it aggregates who closed what, how fast, and
  // how often work came back. Widening the queue perm to cover it would have been
  // invisible. Grant this from /admin/permissions when a specific person needs it.
  | 'reports'
  // /admin/sizing-studio — the psychrometric dehumidifier selection engine.
  // Admin-only by omission from the scoped-role defaults below, like 'srv', so it
  // needs no role_permissions seed. Sales is the obvious next audience: grant it
  // from /admin/permissions, or add a migration INSERT when that call is made.
  | 'sizing'
  | 'tools' // /admin/tools — the internal field-tool/app launcher (duct traverse, calculators)
  | 'tool_crib' // /admin/tool-crib — the warehouse tool check-out registry. NOT 'tools' (above).
  // /admin/production — manage the departments, rosters and tasks behind the
  // PUBLIC shop board at /board/<token> (migration 055). Named production_BOARD,
  // not 'production': `production` is already a StaffRole (the base floor tier),
  // and a perm sharing that name would read as "the production role's perm" —
  // the same collision 'tools' vs 'tool_crib' warns about below.
  | 'production_board'
  // /admin/home-content — edit the company home (/home) editorial content:
  // announcements, company_events, job_openings, employee_spotlights. Admin-only
  // by omission from the scoped-role defaults below (so no migration/seed is
  // needed); left off the non-delegatable list so an admin can still hand it to
  // HR/marketing from /admin/permissions later.
  // NB: keep the literal default-perms identifier out of this comment — the
  // check-perm-seed prebuild gate regexes for the first occurrence of it.
  | 'home_content'
  // /admin/marketing — the content calendar (social posts, email campaigns,
  // blog, trade shows, ads; migration 071). Named marketing_CALENDAR, not
  // 'marketing': `marketing` is already a StaffRole, and a perm sharing that
  // name would read as "the marketing role's perm" — the same collision
  // 'production_board' and 'tool_crib' are named around above. Granted to the
  // marketing role in the scoped-role defaults below + seeded by 071.
  | 'marketing_calendar'
  // /admin/case-studies — AI-drafted, human-approved customer case studies
  // (migration 072). Sales drafts, marketing approves (the approve action is
  // additionally role-gated to marketing/admin in requireCaseStudiesAuth).
  | 'case_studies'
  // /admin/proposals — AI-drafted, human-approved equipment proposals built from
  // a Sizing Studio selection (migration 079). Sales drafts them; APPROVAL is
  // additionally role-gated to admin in requireProposalsAuth, because an
  // approved proposal is a document a customer may read as a commitment.
  | 'proposals'
  // /admin/diagram-studio — the application airflow figures that go into
  // proposals (migration 073). Named DIAGRAMS rather than reusing 'presentations'
  // because the audience is different: sales builds them, engineering checks the
  // psychrometrics, marketing reuses them in collateral. Seeded for all three.
  | 'diagrams'
  // /admin/learn-content — IAT Learn authoring (the content tree + lesson
  // editor). The LEARNER surface (/admin/learn) is open to every admin-surface
  // role via OPEN_ADMIN_PREFIXES and needs no perm; this gates authoring only.
  // Admin-only by omission from the scoped-role defaults below, so no migration
  // or seed is needed. It is also on the non-delegatable list: the authoring
  // layout and all four app/api/learn/** write routes use the strict
  // getAdminUser(), so granting this to a scoped role would produce a broken
  // half-grant (nav link shows, middleware passes, the layout bounces).
  // Opening authoring to HR later means removing it from that list AND moving
  // the layout + those API routes onto this perm.
  | 'learn_admin'
  // /admin/comp-review — the annual compensation review (migration 078): every
  // employee's pay rate, score and merit increase. Its OWN perm rather than
  // sharing 'employees' (HR account management) or 'accrual': those are HR's
  // day-to-day, and pay is a strictly narrower trust boundary that should be
  // revocable on its own. Granted to hr in the scoped-role defaults below AND
  // seeded by migration 078 — both are required, see the note under those
  // defaults. (NB: as with 'home_content' above, keep the literal default-perms
  // identifier out of this comment — the check-perm-seed prebuild gate regexes
  // for its first occurrence and will parse this comment instead.)
  // The route MUST stay mapped in ADMIN_PATH_PERMS; an unmapped /admin/* path
  // falls back to 'dashboard', which five scoped roles hold, so omitting it
  // would open payroll to all of them rather than fail closed.
  | 'compensation'
  // /admin/soo — the Sequence of Operation builder (migration 084). Sales starts
  // the document (they download the submittal from DryWare); engineering reviews
  // it. Seeded for both. APPROVAL is additionally role-gated in requireSooAuth
  // ({ approve: true } → admin OR engineering) — unlike 'proposals', which is
  // admin-only, because signing off a control narrative is an engineering
  // judgement. Sales still cannot self-approve.
  // Its OWN perm rather than sharing 'proposals' or 'diagrams': an SOO is a
  // controls contract the field commissions against, which is a different trust
  // boundary from a sales document and should be revocable on its own.
  | 'soo'
  // /admin/engineering — the engineering job board, task queue and playbook
  // (migration 096). Named engineering_JOBS, not 'engineering': `engineering` is
  // already a StaffRole, and a perm sharing that name would read as "the
  // engineering role's perm" — the same collision 'production_board',
  // 'tool_crib' and 'marketing_calendar' are all named around.
  //
  // Granted to engineering and production_manager in the scoped-role defaults
  // below + seeded by 096 (both are required — see the note under those
  // defaults). Sales is deliberately excluded: sales GENERATES engineering work,
  // and a queue the requesters can re-prioritise is not an accountability tool.
  //
  // Editing the PLAYBOOK (the automation rules) is additionally role-gated to
  // admin or engineering inside requireEngineeringAuth, the same shape as SOO
  // approval — a production manager can work the board without being able to
  // change what every future job's schedule is measured against.
  | 'engineering_jobs'

// Human-readable labels for the permissions matrix UI.
export const PERM_LABELS: Record<Perm, string> = {
  dashboard: 'Dashboard',
  reports: 'Reports',
  submissions: 'Submissions',
  tickets: 'Tickets',
  equipment: 'Equipment',
  customers: 'Customers',
  gantt: 'Gantt / Timelines',
  org_chart: 'Org Chart',
  forms: 'Forms',
  employee_forms: 'Employee Forms',
  pto: 'PTO Requests',
  sick: 'Sick Time',
  scheduling: 'Scheduling',
  accrual: 'Accrual',
  presentations: 'Presentations',
  audit: 'Audit Log',
  employees: 'Accounts (roles)',
  us_rotors: 'US Rotors',
  jerry: 'Jerry (assistant)',
  deals: 'Deals pipeline',
  knowledge: "Jerry's Brain (KB)",
  customer_jerry: 'Customer Jerry (preview)',
  permissions: 'Permissions',
  srv: 'SRV editor',
  sizing: 'Sizing Studio',
  tools: 'Internal Apps',
  tool_crib: 'Tool Crib',
  production_board: 'Production Board',
  home_content: 'Hub Content',
  case_studies: 'Case Studies',
  proposals: 'Proposals',
  diagrams: 'Application Diagrams',
  marketing_calendar: 'Marketing Calendar',
  learn_admin: 'Learn — manage content',
  compensation: 'Compensation Review',
  soo: 'Sequence of Operation',
  engineering_jobs: 'Engineering Jobs',
}

// Perms an admin can grant to scoped roles from the /admin/permissions matrix.
// The rest are privilege-sensitive and stay admin-only: 'permissions' (granting
// it would let a scoped role edit access — a privilege-escalation hole),
// 'customer_jerry' (exposes a customer's data) and 'knowledge' (edits the RAG
// pool). 'learn_admin' is here for a different reason — not privilege, but
// consistency: its layout and API routes use the strict getAdminUser(), so a
// grant would be a half-grant that dead-ends. See the Perm comment above.
// They render locked (admin-only) in the matrix and are rejected server-side.
export const NON_DELEGATABLE_PERMS: Perm[] = ['permissions', 'customer_jerry', 'knowledge', 'learn_admin']

/** A role → granted-perms override, as stored in the DB (migration 045). */
export type PermMatrix = Partial<Record<StaffRole, Perm[]>>

// The DEFAULT matrix, in code. `admin` implicitly gets everything (see
// hasPermission). Any perm NOT listed for a scoped role — including 'dashboard',
// 'us_rotors' — is admin-only, so those are fail-closed by omission. Migration
// 045 seeds the editable role_permissions table from this; once seeded, the DB
// is the source of truth and this stays the seed + the fail-safe fallback used
// whenever the DB matrix is unavailable (table missing / read error).
export const DEFAULT_ROLE_PERMS: Record<Exclude<StaffRole, 'admin'>, Perm[]> = {
  sales: ['dashboard', 'tickets', 'equipment', 'customers', 'gantt', 'jerry', 'deals', 'tools', 'case_studies', 'diagrams', 'proposals', 'soo'],
  hr: ['dashboard', 'org_chart', 'forms', 'employee_forms', 'pto', 'sick', 'scheduling', 'accrual', 'employees', 'jerry', 'tools', 'compensation'],
  marketing: ['dashboard', 'presentations', 'jerry', 'tools', 'case_studies', 'marketing_calendar', 'diagrams'],
  engineering: ['dashboard', 'submissions', 'tickets', 'equipment', 'gantt', 'jerry', 'tools', 'diagrams', 'soo', 'engineering_jobs'],
  production_manager: ['dashboard', 'tickets', 'equipment', 'gantt', 'scheduling', 'jerry', 'tools', 'tool_crib', 'production_board', 'engineering_jobs'],
  production: [],
}
// NOTE: editing this list alone changes NOTHING in a deployed environment. Once
// role_permissions has any rows, lib/permissions.getPermMatrix() seeds every
// scoped role to [] and fills from the DB, so matrix[role] is always non-nullish
// and hasPermission() below never falls through to these defaults. A new grant
// must ALSO be inserted into role_permissions by a migration (see 050 for
// tool_crib). These defaults are only the fallback for an errored/empty table.

/**
 * Whether `role` holds `perm`. `matrix` is the DB-backed override (from
 * getPermMatrix / a middleware read); when omitted or missing the role, we fall
 * back to DEFAULT_ROLE_PERMS — so a DB hiccup never changes access from the
 * code default. An explicitly-empty list in the matrix (admin toggled a role's
 * perms all off) IS honored (it's not nullish), so access can be revoked.
 */
export function hasPermission(role: Role | null, perm: Perm, matrix?: PermMatrix | null): boolean {
  if (!role) return false
  if (role === 'admin') return true
  if (role === 'customer') return false
  const list = matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]
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

/**
 * Roles that get the /admin surface. As of the portal consolidation this is
 * EVERY staff role — full admin, the 5 scoped roles, AND base `production`
 * (which now lands in /admin like everyone else). Customers are excluded.
 *
 * Per-section access under /admin is still gated by the permission matrix, so
 * `production`, holding no perms, only reaches the open prefixes (/admin/home,
 * /admin/profile) — every other /admin/* path fail-closes it to a 302. The
 * base-vs-scoped distinction that still matters for the /employee shell + the
 * set-password welcome flow is expressed as an explicit `role === 'production'`
 * check at those call sites, NOT here.
 */
export function isAdminSurfaceRole(role: Role | null): boolean {
  return isStaffRole(role)
}

// Ordered list of admin sections → canonical landing href. Order defines a
// scoped role's default landing page (its first permitted section).
export const ADMIN_SECTIONS: { perm: Perm; href: string }[] = [
  // First for Engineering, deliberately. This list's order decides a scoped
  // role's landing page when they hold no 'dashboard' perm, and the engineering
  // status board is the screen that department is meant to open the day on.
  { perm: 'engineering_jobs', href: '/admin/engineering' },
  { perm: 'submissions', href: '/admin/submissions' },
  { perm: 'tickets', href: '/admin/tickets' },
  { perm: 'equipment', href: '/admin/equipment' },
  { perm: 'customers', href: '/admin/customers' },
  { perm: 'case_studies', href: '/admin/case-studies' },
  { perm: 'proposals', href: '/admin/proposals' },
  { perm: 'soo', href: '/admin/soo' },
  { perm: 'diagrams', href: '/admin/diagram-studio' },
  { perm: 'deals', href: '/admin/deals' },
  { perm: 'gantt', href: '/admin/gantt' },
  { perm: 'org_chart', href: '/admin/org-chart' },
  { perm: 'forms', href: '/admin/forms' },
  { perm: 'employee_forms', href: '/admin/employee-forms' },
  { perm: 'pto', href: '/admin/requests/pto' },
  { perm: 'sick', href: '/admin/requests/sick' },
  { perm: 'scheduling', href: '/admin/schedule' },
  { perm: 'accrual', href: '/admin/accrual' },
  { perm: 'marketing_calendar', href: '/admin/marketing' },
  { perm: 'presentations', href: '/admin/presentations' },
  { perm: 'employees', href: '/admin/employees' },
  { perm: 'audit', href: '/admin/audit' },
  // Appended LAST on purpose. This list's order decides a scoped role's default
  // landing page (its first permitted section), and HR holds 'compensation' —
  // slotting it any earlier would drop HR onto payroll every time they sign in.
  { perm: 'compensation', href: '/admin/comp-review' },
]

/**
 * Where a role lands after login / when redirected home. Pass the same `matrix`
 * used for gating (middleware does) so the landing page a denied request bounces
 * to is one the role can actually access — otherwise a revoked perm could send
 * the redirect target right back through the gate and loop.
 */
export function homeForRole(role: Role | null, matrix?: PermMatrix | null): string {
  if (role === 'admin') return '/admin'
  if (isAdminSurfaceRole(role)) {
    // Scoped roles with a department dashboard (see DepartmentDashboard.tsx)
    // land on it, same as admin, instead of jumping straight to their first
    // permitted section.
    if (hasPermission(role, 'dashboard', matrix)) return '/admin'
    const first = ADMIN_SECTIONS.find((s) => hasPermission(role, s.perm, matrix))
    return first?.href ?? '/admin/profile' // profile is always accessible
  }
  if (role === 'customer') return '/customer'
  return '/employee/profile'
}

/**
 * Where a user LANDS after login. Distinct from homeForRole (which is each role's
 * *workspace*): every internal role lands first on the shared Company Home, which
 * renders INSIDE the admin shell (`/admin/home`) — and since `production` is now an
 * admin-surface role, base staff land there too. External customers keep their own
 * portal. From the sidebar, the "Dashboard"/other tabs take each person into their
 * actual workspace. (`/employee/home` remains only as a fallback for a null role.)
 *
 * A deep link (?redirect=) still wins over this at the call sites that honor it.
 */
export function landingForRole(role: Role | null): string {
  if (role === 'customer') return '/customer'
  return isAdminSurfaceRole(role) ? '/admin/home' : '/employee/home'
}

// ─── Page-level access (used by middleware) ──────────────────────────────────

// Paths under /admin that are always allowed for any admin-surface role.
// /admin/home is the Company Home rendered in the admin shell — every internal
// role lands there, so it must not fall through to the 'dashboard' gate at all.
// '/admin/me/*' is the self-service namespace (Time Off, Submit a form, Directory,
// Internal Apps) — the pages every employee needs, ported off '/employee' into the
// admin shell. Open to any admin-surface role, like /admin/home. The perm-gated
// management copies (/admin/requests, /admin/employee-forms, /admin/org-chart,
// /admin/tools) are unaffected.
// '/admin/learn' is the IAT Learn training portal, ported off '/learn'. Open to
// every admin-surface role — training is for everyone, and it carried no perm on
// its old path either.
//
// ⚠️ requiredPermForPath below checks THIS list first and returns null
// unconditionally — it does not compete on prefix length with ADMIN_PATH_PERMS.
// So a gated leaf can never live under an open prefix: any
// { prefix: '/admin/learn/…', perm } entry would be silently dead code. That is
// exactly why Learn AUTHORING sits at the sibling '/admin/learn-content'.
const OPEN_ADMIN_PREFIXES = ['/admin/profile', '/admin/home', '/admin/me', '/admin/learn']

// Longest matching prefix wins, and the bare '/admin' catch-all maps to
// 'dashboard'.
//
// ⚠️ 'dashboard' is NOT admin-only. Verified against live `role_permissions`
// 2026-08-14: sales, hr, marketing, engineering and production_manager ALL hold
// it (it is what lets each of them land on their department dashboard). So an
// unmapped /admin/* route is fail-OPEN to every scoped role, not fail-closed —
// **every new admin route must be added here**, which is why the entries below
// for comp-review, learn-content and rfq each carry that warning.
// (This comment used to read "fail-closed to admin only". It was wrong.)
const ADMIN_PATH_PERMS: { prefix: string; perm: Perm }[] = [
  { prefix: '/admin', perm: 'dashboard' },
  { prefix: '/admin/jerry', perm: 'jerry' },
  { prefix: '/admin/customer-jerry', perm: 'customer_jerry' },
  { prefix: '/admin/knowledge', perm: 'knowledge' },
  { prefix: '/admin/permissions', perm: 'permissions' },
  { prefix: '/admin/srv', perm: 'srv' },
  // MUST be listed. An unmapped /admin/* path falls back to 'dashboard', which
  // all five scoped roles hold — omitting this would open every report to all of
  // them rather than failing closed.
  { prefix: '/admin/reports', perm: 'reports' },
  { prefix: '/admin/sizing-studio', perm: 'sizing' },
  { prefix: '/admin/submissions', perm: 'submissions' },
  { prefix: '/admin/tickets', perm: 'tickets' },
  { prefix: '/admin/troubleshooting', perm: 'tickets' },
  // Support-form content (reference photos for the public /support form). MUST be
  // listed: an unmapped /admin/* path falls back to 'dashboard', which every
  // scoped role holds, so omitting this would open it to all of them rather than
  // fail closed. Shares `tickets` — same audience as the support queue, so no new
  // perm key and no role_permissions seed. Sibling of /admin/tickets, not a child,
  // so it can't be swallowed by that prefix.
  { prefix: '/admin/support-content', perm: 'tickets' },
  { prefix: '/admin/equipment', perm: 'equipment' },
  { prefix: '/admin/customers', perm: 'customers' },
  // Case studies (070) — sales drafts, marketing approves. Own perm (seeded for
  // both roles in the migration) so access can be tuned per-role later without
  // touching the deals trust boundary.
  { prefix: '/admin/case-studies', perm: 'case_studies' },
  { prefix: '/admin/proposals', perm: 'proposals' },
  // Sequence of Operation builder (084). MUST be listed: an unmapped /admin/*
  // path falls back to 'dashboard', which every scoped role holds — so omitting
  // this would open the page to all of them rather than fail closed.
  { prefix: '/admin/soo', perm: 'soo' },
  // Engineering jobs, tasks and the playbook (096). MUST be listed, for the same
  // reason as every entry above it: an unmapped /admin/* path falls back to
  // 'dashboard', which sales, hr, marketing, engineering and production_manager
  // all hold — so omitting this would show the whole department's workload,
  // per-person, to every scoped role instead of failing closed.
  { prefix: '/admin/engineering', perm: 'engineering_jobs' },
  // Application diagram studio (073). MUST be listed: an unmapped /admin/* path
  // falls back to 'dashboard', which every scoped role holds — so omitting this
  // would open the page to all of them rather than fail closed.
  { prefix: '/admin/diagram-studio', perm: 'diagrams' },
  // Marketing content calendar (071). MUST be listed: an unmapped /admin/* path
  // falls back to 'dashboard', which every scoped role holds — so omitting this
  // would open the page to all of them rather than fail closed.
  { prefix: '/admin/marketing', perm: 'marketing_calendar' },
  { prefix: '/admin/deals', perm: 'deals' },
  // Projected-sales mirror (059) — read-only Dryware snapshot. Shares the `deals`
  // perm (Sales + admin) so it needs no new permission key or role_permissions
  // seed. Distinct prefix from /admin/deals, so longest-match keeps them separate.
  { prefix: '/admin/projected-sales', perm: 'deals' },
  // Closed Projects (100) — read-only Dryware "won" mirror, sibling of
  // projected-sales above. Shares `deals` for the same reason (Sales + admin,
  // no new perm to seed). Distinct prefix, so longest-match keeps them separate.
  { prefix: '/admin/closed-projects', perm: 'deals' },
  // Territory map (068) — rep firms, territories and pins. Shares `deals` like
  // projected-sales above (same Sales + admin audience, no new perm to seed);
  // writes are further restricted to admin/sales in requireTerritoryAuth.
  { prefix: '/admin/territories', perm: 'deals' },
  // Rep scorecard (075) — rep-health review over the same rep roster the
  // territory map uses. Shares `deals` for the same reason as the two above;
  // scoring is further restricted to admin/sales in requireRepScorecardAuth.
  { prefix: '/admin/rep-scorecard', perm: 'deals' },
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
  // Annual compensation review (078) — everyone's pay. MUST be listed: an
  // unmapped /admin/* path falls back to 'dashboard', which sales, hr, marketing,
  // engineering and production_manager all hold, so omitting this entry would
  // open payroll to every scoped role instead of failing closed. Its own perm,
  // NOT 'employees' — HR account management is a wider, older grant, and pay
  // should be revocable without taking account management away with it. Writes
  // are further restricted in requireCompReviewAuth (lines: admin/hr; cycle
  // constants and finalize: admin only).
  { prefix: '/admin/comp-review', perm: 'compensation' },
  { prefix: '/admin/us-rotors', perm: 'us_rotors' },
  { prefix: '/admin/tools', perm: 'tools' },
  // Distinct from /admin/tools above — matchesPrefix requires an exact match or a
  // trailing '/', so these two never collide. Without this entry a
  // production_manager hitting /admin/tool-crib would fall through to the
  // 'dashboard' default below and get a silent 302 to /admin.
  { prefix: '/admin/tool-crib', perm: 'tool_crib' },
  // NOTE: this gates the MANAGER's page only. The board itself (/board/<token>)
  // is deliberately outside middleware's matcher entirely — it's the public,
  // no-login surface the floor scans into. Adding /board here would break it.
  { prefix: '/admin/production', perm: 'production_board' },
  { prefix: '/admin/home-content', perm: 'home_content' },
  // Learn authoring. MUST be listed: an unmapped /admin/* path falls back to
  // 'dashboard', which every scoped role holds, so omitting this would OPEN the
  // authoring surface rather than close it. Deliberately NOT nested under
  // '/admin/learn' — see the OPEN_ADMIN_PREFIXES note above. matchesPrefix needs
  // an exact hit or a trailing '/', so '/admin/learn' never swallows
  // '/admin/learn-content' (same idiom as /admin/tools vs /admin/tool-crib).
  { prefix: '/admin/learn-content', perm: 'learn_admin' },
  // Inbound Requests for Quote from /support/rfq (087). MUST be listed: an
  // unmapped /admin/* path falls back to 'dashboard', which sales, hr,
  // marketing, engineering and production_manager all hold — so omitting this
  // would show every scoped role a stranger's contact details and project.
  // Shares the 'deals' perm rather than taking one of its own: an RFQ is the
  // front of the sales pipeline and becomes a deal, so the two are the same
  // trust boundary and should be granted and revoked together.
  { prefix: '/admin/rfq', perm: 'deals' },
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
  // Unmapped /admin path → 'dashboard', which EVERY scoped role holds. See the
  // warning above ADMIN_PATH_PERMS: this default is permissive, not restrictive.
  return best?.perm ?? 'dashboard'
}

/** True if `role` may view `pathname` under /admin. */
export function canAccessAdminPath(role: Role | null, pathname: string, matrix?: PermMatrix | null): boolean {
  if (role === 'admin') return true
  const perm = requiredPermForPath(pathname)
  if (perm === null) return isAdminSurfaceRole(role) // open path, staff-admin only
  return hasPermission(role, perm, matrix)
}
