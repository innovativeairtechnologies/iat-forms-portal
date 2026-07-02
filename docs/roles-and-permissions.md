# Roles & Permissions

_Shipped 2026-07-02. Requires migration `042_roles_permissions.sql`._

The portal has seven internal staff roles plus one external customer role. Each
staff role sees only the admin sections it needs; the full `admin` role sees
everything. This replaced the old coarse `admin | employee | customer` split.

## Roles

| Role | Lands in | Sees |
|------|----------|------|
| `admin` | `/admin` | Everything |
| `sales` | `/admin` | Tickets, Equipment, Customers, Gantt |
| `hr` | `/admin` | Accounts, Org Chart, Forms, Employee Forms, PTO, Sick Time, Scheduling, Accrual |
| `marketing` | `/admin` | Presentations |
| `engineering` | `/admin` | Submissions, Tickets, Equipment, Gantt |
| `production_manager` | `/admin` | Tickets, Equipment, Gantt, Scheduling |
| `production` | `/employee` | Employee self-service only (personal dashboard, time off, org chart, resources) |
| `customer` | `/customer` | External customer portal |

`production` is the base employee tier — it's the old `employee` role, renamed.
`normalizeRole()` maps any legacy `employee` value to `production` at read time.

Roles that land in `/admin` (everything except `production` and `customer`) are
"admin-surface" roles.

## Where it's defined

**`lib/roles.ts`** is the single source of truth. It's dependency-free so the
edge middleware, server components, and client components all import it. Key
exports:

- `STAFF_ROLES`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS` — the vocabulary.
- `hasPermission(role, perm)` — the matrix. `admin` implicitly has every
  permission; any permission not listed for a scoped role (including `dashboard`,
  `system`, `us_rotors`) is admin-only by omission (fail-closed).
- `normalizeRole(raw)` — legacy `employee` → `production`; validates the value.
- `isAdminSurfaceRole(role)`, `homeForRole(role)` — routing helpers.
- `canAccessAdminPath(role, pathname)` — used by middleware for page gating.

To change who sees what, edit `ROLE_PERMS` (nav/page permissions) and, if you add
a section, keep `ADMIN_SECTIONS`, `ADMIN_PATH_PERMS`, and the `AdminSidebar` item
`perm` in sync. (Moving the matrix into a DB table for no-deploy edits is a
planned follow-up.)

## Two-layer enforcement

Nav visibility alone is not access control. Two independent layers:

1. **Nav (`AdminSidebar`, `CommandPalette`)** — items carry a `perm` and are
   filtered by `hasPermission(effectiveRole, perm)`, so scoped roles don't see
   tabs/commands they can't use.
2. **Page access (`middleware.ts`)** — `canAccessAdminPath()` maps the URL to the
   permission it requires; a scoped role hitting a section it lacks is redirected
   to its home. This is what stops someone typing `/admin/accrual` directly. Any
   `/admin/*` path not explicitly mapped falls back to the `dashboard` permission,
   i.e. **admin-only** — new admin routes are protected by default until mapped.

### v1 boundary — scoped roles are view-only

`getAdminUser()` (the strict full-admin gate used by every admin write API and
server action) is deliberately **unchanged** — it still returns only the `admin`
role. A separate `getAdminSurfaceUser()` (loose) powers the `/admin` shell and
read-only pages so scoped roles can view their sections. Consequence: scoped
roles can **see** their tabs but their write actions return 403 until each API is
opened per-permission. That per-endpoint write-enablement is the planned next
pass; it's an intentional v1 scope cut, not a bug.

## "View as [role]"

`components/admin/ViewAs.tsx` — an admin-only control in the sidebar that
re-renders the nav (and command palette) as any role would see it. It's a pure
client-side display override: it never touches the session, cookies, or
middleware, so it cannot change the admin's real access or lock them out. A hard
refresh resets to the real role.

## Data Reset

`/admin/reset` (admin-only, `system` permission) bulk-deletes a single dataset
for pre-launch cleanup: submissions, tickets, equipment, customers, PTO requests,
sick requests, or employees. Each is behind a type-`DELETE` confirm and is
audit-logged.

Account deletes (employees, customers) go through `auth.admin.deleteUser()`,
which removes the row in `auth.users` — that's what frees the email address for
re-invite. Safety rails: the employees wipe never deletes an `admin` account or
the acting admin, and the route surfaces any account it couldn't delete rather
than silently skipping it. See `app/api/admin/reset/route.ts`.

## Migration 042

- Widens the `profiles.role` CHECK to all eight values, keeping `employee` as a
  **deprecated transitional** value so the old app can't error in the window
  between running the migration and deploying the new code.
- Migrates existing `employee` rows to `production` and repoints the signup
  trigger + column default.
- Swaps `time_off_requests.reviewed_by` to `ON DELETE SET NULL` (it was the lone
  `RESTRICT` FK to `employees`, which could block the employees wipe).

Run it **before** deploying the matching app code — the new code writes role
values the old constraint would reject. A later migration can drop the
transitional `employee` value once this release is confirmed live.

## Planned follow-ups

- Per-endpoint write-enablement so scoped roles can act, not just view.
- A personal self-service surface for admin-surface roles (their own PTO, etc.).
- Move the permission matrix into a DB table for no-deploy edits.
- Gate individual dashboard widgets by permission.
