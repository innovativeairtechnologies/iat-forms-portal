# Roles & Permissions

_Shipped 2026-07-02. Requires migration `042_roles_permissions.sql`._

The portal has seven internal staff roles plus one external customer role. Each
staff role sees only the admin sections it needs; the full `admin` role sees
everything. This replaced the old coarse `admin | employee | customer` split.

## Roles

| Role | Lands in | Sees |
|------|----------|------|
| `admin` | `/admin` (executive dashboard) | Everything |
| `sales` | `/admin` (department dashboard) | Tickets, Equipment, Customers, Deals, Gantt, Jerry |
| `hr` | `/admin` (department dashboard) | Accounts, Org Chart, Forms, PTO, Sick Time, Scheduling, Accrual, Jerry |
| `marketing` | `/admin` (department dashboard) | Presentations, Jerry |
| `engineering` | `/admin` (department dashboard) | Submissions, Tickets, Equipment, Gantt, Jerry |
| `production_manager` | `/admin` (department dashboard) | Tickets, Equipment, Gantt, Scheduling, Jerry |
| `production` | `/admin` (Company Home) | The always-open `/admin/home` + `/admin/profile`; self-service pages still under `/employee` (My Board, time off, org chart, resources) |
| `customer` | `/customer` | External customer portal |

`production` is the base employee tier — it's the old `employee` role, renamed.
`normalizeRole()` maps any legacy `employee` value to `production` at read time.

Roles that land in `/admin` (everything except `customer`) are "admin-surface"
roles. **As of the portal consolidation (2026-07-23, Phase 1), `production` is an
admin-surface role too** — it lands in `/admin/home` like every other internal
role, holding no permissions, so per-section gating fail-closes it to the two
always-open prefixes (`/admin/home`, `/admin/profile`). Its self-service pages
haven't been ported off `/employee` yet, so those `/employee/*` routes stay alive
and reachable by `production` (middleware bounces only the 5 scoped roles + admin
out of `/employee`). New `production` invites still run the `/employee/welcome`
set-password flow, then land in `/admin`.

## Where it's defined

**`lib/roles.ts`** is the single source of truth. It's dependency-free so the
edge middleware, server components, and client components all import it. Key
exports:

- `STAFF_ROLES`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS` — the vocabulary.
- `hasPermission(role, perm, matrix?)` — the matrix check. `admin` implicitly has
  every permission; any permission not listed for a scoped role (including
  `dashboard`, `us_rotors`) is admin-only by omission (fail-closed). The optional
  `matrix` is the DB-backed override (see below); omit it and it falls back to the
  code defaults (`DEFAULT_ROLE_PERMS`).
- `DEFAULT_ROLE_PERMS` — the code seed + fail-safe fallback for the matrix (was
  the private `ROLE_PERMS`).
- `normalizeRole(raw)` — legacy `employee` → `production`; validates the value.
- `isAdminSurfaceRole(role)`, `homeForRole(role, matrix?)` — routing helpers.
- `canAccessAdminPath(role, pathname, matrix?)` — used by middleware for page gating.

The set of permissions (columns) and their nav/route bindings stay in **code**: to
add a section, add the `Perm`, and keep `ADMIN_SECTIONS`, `ADMIN_PATH_PERMS`, the
`AdminSidebar`/`CommandPalette` item `perm`, and `PERM_LABELS` in sync. Which role
holds which permission is now editable **live** from the DB — see below.

## Editing permissions live — `/admin/permissions` (migration 045)

Since 2026-07-08 the role→permission membership lives in a DB table
(`role_permissions`, migration `045`) and is editable from **`/admin/permissions`**
(admin-only) with no deploy. Toggling a permission on adds that section's tab to
the role's sidebar and lets them reach its pages on their next navigation.

- **Source of truth.** `lib/permissions.ts` `getPermMatrix()` reads the table
  (service role, cached per request) → a `role → perm[]` map. It **falls back to
  `DEFAULT_ROLE_PERMS`** if the table is missing (pre-migration), the read errors,
  or it's empty — so a DB hiccup never changes access from the code defaults. A
  successful read of zero rows for a role is honored as "revoked".
- **Who reads it.** The server layout fetches the matrix and feeds it to the
  client via the `ViewAs` context (`hasPerm`, `home`); middleware reads just the
  current role's rows via the request's RLS-scoped client and threads it into
  `canAccessAdminPath` + `homeForRole`; `getAdminSurfaceUser().can()` and
  the `lib/api-auth.ts` guards (`requireDealsAuth()`, `requireToolCribAuth()`,
  `requireUsRotorsActor()`) read it server-side. All layers share the one matrix,
  so nav, page-gating, and the per-feature write-guards stay consistent.
- **Non-delegatable perms.** `permissions`, `customer_jerry`, and `knowledge` are
  admin-only and can't be granted to a scoped role (rejected server-side, shown
  locked in the UI) — delegating `permissions` would be a privilege-escalation
  hole. `admin` is all-access and isn't stored/editable, so an admin can't lock
  themselves out via this page.
- **Writes** go through `POST /api/admin/permissions` (strict `getAdminUser`,
  audit-logged as `permission.update`). RLS: authenticated may SELECT
  `role_permissions`; there is no write policy, so only the service-role API can
  modify it. Keep the SELECT policy in place — dropping it reads as revocation.

### Granting a role a new permission — editing the code list is NOT enough

**`DEFAULT_ROLE_PERMS` does nothing in a deployed environment.** It reads like the
source of truth and isn't: once `role_permissions` holds any rows, `getPermMatrix()`
seeds every scoped role to `[]` and then fills from the DB, so `matrix[role]` is
always a non-null array — which means `hasPermission()`'s
`matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` **never reaches the code default**.
Middleware's per-role read behaves identically. The code list is only the fallback
for an *errored or empty* table.

So a new grant needs **both**: the entry in `DEFAULT_ROLE_PERMS` *and* an
`INSERT INTO role_permissions ... ON CONFLICT DO NOTHING` in a migration. Miss the
migration and the grant fails silently — no error, no log; the nav item just stays
hidden and the route 302s home, exactly as if you'd never made the change.

This is not hypothetical. `tools` was in the code list from the day the perm was
added, but migration `045` never seeded it — so `/admin/tools` was admin-only in
practice for months while the code claimed five roles had it. Only Engineering
ever got it, via a manual `/admin/permissions` grant on 2026-07-14. Migration
`051` seeds the five rows and closes it.

**Guardrail:** `node scripts/check-perm-seed.mjs` asserts `DEFAULT_ROLE_PERMS` and
the migration seeds agree, and prints the exact `INSERT` to add when they don't.
It's repo-only (no DB/network) — it deliberately does *not* compare against live,
because the matrix is admin-editable by design and prod legitimately drifts from
the seed. Run it after touching either list.

> Note: `getPermMatrix()` must **not** be "fixed" by merging the code defaults into
> the DB read. Merging would make revocation impossible — unticking any default
> perm in `/admin/permissions` would be silently restored on the next read. The
> `[]`-seeding is what makes the matrix genuinely editable.

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

**First scoped write exception (2026-07-07): Deals.** The `deals` permission
(sales pipeline, `/admin/deals`) is read **and write** for `sales` — the whole
point of that tool is reps editing their own pipeline inline. Its API routes
gate on `requireDealsAuth()` (`lib/api-auth.ts`), which accepts any role with
the `deals` permission — read live from the matrix, so revoking Deals in
`/admin/permissions` actually blocks writes — rather than the strict admin-only
guard. It's a
deliberately narrow, clearly-named exception — don't reuse it for other routes;
add a similarly-scoped guard per feature as write-enablement rolls out.

**Second scoped write exception (2026-07-16): Tickets.** The ticket detail action
`updateTicket` (`app/admin/tickets/actions.ts` — status / priority / owner) now gates
on `getTicketsActor()` (`lib/admin-auth.ts`), which accepts any role holding the
`tickets` perm, read live from the matrix. This is the **server-action** counterpart to
the `lib/api-auth.ts` route guards (those return a `NextResponse`; an action needs an
actor or null), and it is its own named guard rather than a general "any perm" helper,
per `requireDealsAuth`'s note.

Why it isn't admin-only: middleware already lets `tickets` holders — `sales`,
`engineering`, `production_manager` — onto `/admin/tickets/[id]`, and they work the
queue daily. With an admin-only write the page rendered a form that **always failed on
save**, offering an action it then refused. Gating the write on the same editable perm
as the page means the two can't drift when the matrix changes.

**Ticket notes (resolved 2026-07-16, later the same day).** `requireTicketAccess()`
(`lib/ticket-access.ts`) — the single boundary shared by all four dual-auth ticket routes
(notes, attachments, attachments/download, attachments/preview) — now resolves **three**
callers instead of two:

| caller | sees | may post | may reply to the customer |
|---|---|---|---|
| `admin` | everything | yes | **yes** — the only role that can |
| `staff` (holds `tickets`) | everything | yes, **internal only** | no |
| `customer` (owns the ticket) | public notes only | yes (forced public/customer) | n/a |

Order matters in that function: `admin` is tried **before** `staff`, because admins hold
every perm and `getTicketsActor()` would otherwise accept them and silently downgrade
them to the internal-only branch.

**A scoped role's note is forced `visibility='internal'` server-side**, ignoring whatever
the client sends — the same mechanism that forces a customer's note to public/customer.
The UI hides the "Reply to customer" toggle for them, but that's honesty, not the control:
hiding it is unnecessary for security precisely because the server doesn't trust it.
Sending text to a customer under IAT's name stays an admin act. 037's internal-by-default
is untouched.

`author_type` stays `'admin' | 'customer'`: it marks **staff-vs-customer**, not rank, and
it's what the customer thread keys on. A scoped role's note is `author_type='admin'` and
never customer-visible, so this can't leak. The admin UI's pill now reads **"Staff"**
rather than "Admin" to match.

**Why widening the read side was a non-event:** the admin ticket page already
server-renders *every* internal note to anyone with `tickets` (`page.tsx` reads
`ticket_notes` via `supabaseAdmin`, ungated). Scoped roles have been reading internal
notes all along — the 401 only ever blocked *writing*. What this change actually grants
is posting, plus attachment upload/download/preview, which was its own live incoherence:
they could see an attachment's name and size in a rendered note and get a 401 opening it.

**Note authorship (migration `054`).** `ticket_notes` recorded only `author_type`, so
every staff note was an anonymous "admin" — no record of who wrote it, right next to
status/priority/owner writes that are audit-logged with the real actor. `054` adds
`author_id` (FK `auth.users`, covering staff and customers alike; **not** `employees`,
whose customer rows are a trigger side-effect due for cleanup) and a snapshotted
`author_name` (same rationale as `crib_events.actor_name` — account deletion must not
erase who said what). Resolved from the session, never from the request body. Pre-`054`
notes stay unattributed rather than be backfilled with a guess.

**Staff names never reach customers.** The notes `GET` strips `author_*` for a customer
caller, and `app/customer/tickets/[id]/page.tsx` lists its columns explicitly instead of
`select('*')` — a bare `*` would have started shipping the name the moment `054` landed.

## `employees.is_admin` is NOT an authorization input

`profiles.role` is the only source of truth for who may do what. `employees.is_admin`
is a **denormalized legacy boolean**, written in exactly two places
(`/api/employees/invite`, `/api/admin/users/[id]/role`) and read by no *application*
code that makes an access decision. Never gate on it:

- It is a **copy**, so it can drift. Anything that writes `profiles.role` without
  also writing `is_admin` (a hand-edit in the Supabase dashboard, a future route,
  a migration) leaves a demoted admin still holding `is_admin = true` — the rest of
  the portal denies them while an `is_admin` check keeps letting them in.
- An `employees` row **proves nothing about staffness**. Every auth user gets one,
  customers included (`lib/staff.ts`, `docs/customer-portal.md`).

**2026-07-16:** `/api/us-rotors/orders` was the last authorization reader of
`is_admin` (GET's own-orders scoping + PATCH's status-write gate) and now uses
`requireUsRotorsActor()` (`lib/api-auth.ts`) — matrix-backed on `us_rotors`, the
same perm middleware gates `/admin/us-rotors` on, so the page and the API can't
disagree about who manages the queue. Non-holders keep the previous behavior
(their own orders only); customers are now refused outright rather than handed an
empty list. It returns the actor **plus** `canManage` from one role read because
GET scopes on it and PATCH refuses on it. This was not exploitable when fixed —
it's the drift class that's the point.

**2026-07-16 (later the same day):** the four remaining application readers — the
three notification recipient queries (`lib/admin-digest.ts`, `/api/tickets`,
`/api/requests`) and the ticket-owner picker (`app/admin/tickets/[id]/page.tsx`) —
now resolve people from `profiles.role` through two new `lib/staff.ts` helpers:

- **`getAdminRecipients()`** — active `profiles.role = 'admin'`, joined to `employees`
  for the email. It **throws** on an unreadable `profiles` table: a recipient list you
  couldn't compute is not an empty recipient list, and silently mailing nobody is how
  a digest dies unnoticed. The two notification *routes* catch it and fall back to
  `ADMIN_NOTIFICATION_EMAIL`, because their row is already committed by then and a
  lookup failure must not 500 the person who just filed the ticket/request.
- **`getEmployeesWithPerm(perm)`** — active staff holding `perm`, read from the live
  matrix. Fails **closed** (empty list), the opposite of `getCustomerIds()` right above
  it: a roster's worst failure is a blank org chart reading as "everyone left", but a
  picker's worst failure is offering the wrong people. Note it needs **no**
  `getCustomerIds()` call — `hasPermission()` is false for `customer` and for the null
  role a profile-less `employees` row resolves to, so both are excluded by holding no
  permission rather than by being filtered.

**No application code reads `is_admin` now.** The column stays (with its two writers),
because the **RLS policies still depend on it** — see the next section.

### The drift is not hypothetical — it is live (measured 2026-07-16)

Every write-up above this line, including this document, described `is_admin` drift as a
thing that *could* happen. A read-only check against **prod** found it already had, on
two rows:

| account | `is_admin` | `profiles.role` |
|---|---|---|
| `jacob.younker@dehumidifiers.com` | `false` | `admin` |
| `jacob@dehumidifiers.com` (Jacob Reagan) | `false` | `admin` |

The predicted third path is exactly what happened: an account created or promoted **by
hand in the Supabase dashboard** skips both writers, so `is_admin` keeps its
`default false` from migration 001. (This matches the 2026-07-16 `handle_new_user()`
finding — `jacob.younker` is one of the three hand-made accounts with no
`user_metadata.name`.)

**The drift runs in the SAFE direction.** Zero rows hold `is_admin = true` with a
non-admin role, so the copy never granted anyone access they lacked. It **denied two real
admins** instead — they were silently missing admin digests, new-ticket and PTO
notifications, and couldn't be assigned tickets. That is also why `4e90a06`'s
"not exploitable" verdict still stands, though **its stated reason — "the two columns are
currently in sync" — was false**: the endpoint was fail-closed for the drifted rows, not
unaffected by them. The code fixes above make all four surfaces read `profiles.role`, so
those two accounts are correct immediately, with no migration.

`is_admin` itself is resynced by **migration `053` (pending — run by hand)**. It is a
stopgap: it makes the copy correct today so the RLS policies below stop being wrong about
Jacob's own account. The real fix is the policy rewrite.

## ⚠️ The RLS policies DO gate on `is_admin` — the column cannot simply be dropped

The claim "nothing makes an access decision from `is_admin`" is true of the app and
**false of the database**. Migrations `001` (`employees`, `time_off_requests`,
`accrual_log`), `007` (`accrual_log`) and `022` (`us_rotors_orders`) all carry policies
of the form:

```sql
exists (select 1 from public.employees e where e.id = auth.uid() and e.is_admin = true)
```

Those are authorization decisions, at the database layer, on the drifting column. They
are **mostly dormant** — every app read of these tables goes through `supabaseAdmin`
(service role, bypasses RLS) — but not entirely: `app/employee/welcome/page.tsx` updates
`employees` with the **browser** client, so `employees_update_own`, whose `WITH CHECK`
pins `is_admin` to its current value, is live on that path.

Consequences, both of which bit the earlier write-ups:

- **Postgres will refuse `ALTER TABLE employees DROP COLUMN is_admin`** while those
  policies reference it. Dropping the column means rewriting them (to join
  `profiles.role = 'admin'`) in a migration first.
- **A stale `is_admin` is a real, if latent, RLS-layer access bug** — not merely the
  notification drift. Any future surface that talks to these tables with the anon key
  inherits it. **This is live today:** with `jacob.younker` sitting at `is_admin = false`,
  Jacob's own daily-driver account is **not an admin as far as RLS is concerned**.
  Dormant only because every server read uses the service-role key; migration `053`
  resyncs the column as a stopgap.

Rewriting those policies is the outstanding follow-up; it was deliberately left out of
the 2026-07-16 change because it touches live RLS on four tables and cannot be exercised
against prod data from a dev box.

## Department dashboards

Every scoped role now has `dashboard` in its permission list, so `/admin` is a
real landing page for all of them (`homeForRole` sends anyone with `dashboard`
to `/admin`, same as full `admin`) instead of a redirect to their first
permitted section. `app/admin/page.tsx` branches on the effective role: `admin`
renders the existing executive dashboard unchanged; every scoped role renders
`components/admin/DepartmentDashboard.tsx` — real Supabase counts + a short
recent-activity list scoped to what that role can see, plus a "Quick Links"
grid generated from `ADMIN_SECTIONS` filtered by `hasPermission`, so it stays
in sync automatically as sections are added or a role's permissions change.

## Jerry (internal assistant)

`jerry` is a permission granted to every scoped role (plus implicit for
`admin`) — it gates the `/admin/jerry` nav item and page, a standalone "GPT
style" chat page any staff member can use to ask internal questions or just
try Jerry out. It's a separate route from the per-ticket Jerry embedded in
`/admin/tickets/[id]` (which is grounded in that ticket's equipment/problem
context); this one only knows IAT's documentation (same RAG pipeline,
`includeInternal: true`), with no live ticket/equipment lookup. See
`app/api/admin/assistant/route.ts`.

## "View as [role]"

`components/admin/ViewAs.tsx` — an admin-only control in the sidebar that
re-renders the nav (and command palette) as any role would see it. It's a pure
client-side display override: it never touches the session, cookies, or
middleware, so it cannot change the admin's real access or lock them out. A hard
refresh resets to the real role.

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
- Gate individual dashboard widgets by permission.

_(Live DB-editable matrix — shipped 2026-07-08, migration `045`. See "Editing
permissions live" above.)_
