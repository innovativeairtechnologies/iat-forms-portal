export type Crumb = { label: string; href?: string }

/* ────────────────────────────────────────────────────────────────────────────
   Shared breadcrumb derivation for the /admin surface.

   Both AdminTopBar (the single top nav bar) and PageChrome (which lets a detail
   page feed its record name up into that bar) derive the base `Section › Page`
   trail from the URL here, so the two never disagree.

   Longest matching prefix wins, so /admin/requests/pto beats /admin/requests
   beats /admin. Mirrors the sidebar section names (Operations / Sales / People /
   Jerry / System).
   ──────────────────────────────────────────────────────────────────────────── */

const ROUTES: { prefix: string; section: string; label: string }[] = [
  // Operations
  { prefix: '/admin/submissions',     section: 'Operations', label: 'Submissions' },
  { prefix: '/admin/tickets',         section: 'Operations', label: 'Tickets' },
  { prefix: '/admin/support-content', section: 'Operations', label: 'Support form' },
  { prefix: '/admin/troubleshooting', section: 'Operations', label: 'Troubleshooting' },
  { prefix: '/admin/forms',           section: 'Operations', label: 'Forms' },
  { prefix: '/admin/equipment',       section: 'Operations', label: 'Equipment' },
  { prefix: '/admin/tool-crib',       section: 'Operations', label: 'Tool Crib' },
  { prefix: '/admin/production',      section: 'Operations', label: 'Production Board' },
  { prefix: '/admin/srv',             section: 'Operations', label: 'SRV Form' },
  { prefix: '/admin/sizing-studio',   section: 'Operations', label: 'Sizing Studio' },
  { prefix: '/admin/gantt',           section: 'Operations', label: 'Gantt' },
  // Sales
  { prefix: '/admin/deals',           section: 'Sales',   label: 'CRM' },
  { prefix: '/admin/projected-sales', section: 'Sales',   label: 'Performance' },
  { prefix: '/admin/territories',     section: 'Sales',   label: 'Territories' },
  { prefix: '/admin/customers',       section: 'Sales',   label: 'Customers' },
  { prefix: '/admin/case-studies',    section: 'Sales',   label: 'Case Studies' },
  { prefix: '/admin/diagram-studio',  section: 'Sales',   label: 'Application Diagrams' },
  { prefix: '/admin/presentations',   section: 'Sales',   label: 'Presentations' },
  // Marketing
  { prefix: '/admin/marketing',       section: 'Marketing', label: 'Calendar' },
  // People
  { prefix: '/admin/employees',       section: 'People',  label: 'Accounts' },
  { prefix: '/admin/org-chart',       section: 'People',  label: 'Org Chart' },
  { prefix: '/admin/employee-forms',  section: 'People',  label: 'Employee Forms' },
  { prefix: '/admin/requests/pto',    section: 'People',  label: 'PTO' },
  { prefix: '/admin/requests/sick',   section: 'People',  label: 'Sick Time' },
  { prefix: '/admin/requests',        section: 'People',  label: 'Requests' },
  { prefix: '/admin/schedule',        section: 'People',  label: 'Scheduling' },
  { prefix: '/admin/scheduling',      section: 'People',  label: 'Scheduling' },
  { prefix: '/admin/accrual',         section: 'People',  label: 'Accrual' },
  // Jerry
  { prefix: '/admin/customer-jerry',  section: 'Jerry',   label: 'Customer Jerry' },
  { prefix: '/admin/jerry',           section: 'Jerry',   label: 'Ask Jerry' },
  { prefix: '/admin/knowledge',       section: 'Jerry',   label: "Jerry's Brain" },
  // System
  { prefix: '/admin/home-content',    section: 'System',  label: 'Hub Content' },
  { prefix: '/admin/audit',           section: 'System',  label: 'Audit Log' },
  { prefix: '/admin/permissions',     section: 'System',  label: 'Permissions' },
  // US Rotors
  { prefix: '/admin/us-rotors',       section: 'US Rotors', label: 'Orders' },
  // Training (/admin/learn/*) — IAT Learn, open to every admin-surface role.
  // The dynamic category/module/lesson routes have no static prefix, so they
  // fall back to the '/admin/learn' entry and append their record crumbs via
  // <PageChrome record={[...]}>.
  { prefix: '/admin/learn/me',          section: 'Training', label: 'My Learning' },
  { prefix: '/admin/learn/leaderboard', section: 'Training', label: 'Leaderboard' },
  { prefix: '/admin/learn-content',     section: 'Training', label: 'Manage content' },
  { prefix: '/admin/learn',             section: 'Training', label: 'Browse' },
  // Self-service (/admin/me/*) — personal pages open to every admin-surface role
  { prefix: '/admin/me/time-off',     section: 'Self-service', label: 'Time Off' },
  { prefix: '/admin/me/forms',        section: 'Self-service', label: 'Submit a Form' },
  { prefix: '/admin/me/directory',    section: 'Self-service', label: 'Directory' },
  { prefix: '/admin/me/apps',         section: 'Self-service', label: 'Internal Apps' },
  // Standalone
  { prefix: '/admin/tools',           section: 'Operations', label: 'Internal Apps' },
  { prefix: '/admin/home',            section: 'Company',    label: 'Home' },
  { prefix: '/admin/profile',         section: 'Account',    label: 'Profile' },
  // Dashboard (shortest — matched last)
  { prefix: '/admin',                 section: 'Operations', label: 'Overview' },
]

/** The base `Section › Page` trail for a pathname. The page-level crumb carries
 *  an href (its list route) so it becomes a link once a record crumb follows it. */
export function crumbsFor(pathname: string): Crumb[] {
  const hit = ROUTES
    .filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (!hit) return [{ label: 'Operations' }]
  return [{ label: hit.section }, { label: hit.label, href: hit.prefix }]
}
