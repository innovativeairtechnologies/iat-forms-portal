# Company Home (`/home`)

The shared company intranet home — the first screen **every internal user** sees after login,
rebuilt from the SharePoint intranet into the Quiet Precision design system (`DESIGN.md`).
External customers are unaffected (they still land on `/customer`).

> **Status:** built 2026-07-17, **not yet deployed.** Requires migration
> `058_company_home.sql` run in the Supabase SQL editor before/with the deploy.

## What changed for routing

Login now lands internal users on `/home` instead of jumping straight to their role workspace.
A new `landingForRole(role)` in `lib/roles.ts` is the seam:

- **Internal roles** (admin, the 5 scoped roles, base production) → `/home`.
- **Customers** → `/customer` (unchanged).

Repointed at the four landing sites — `app/page.tsx`, `app/login/page.tsx`,
`app/auth/callback/route.ts`, and the logged-in `/login` bounce in `middleware.ts`. Deep links
(`?redirect=`) and the employee/customer `welcome` onboarding flows are preserved. `middleware.ts`
gains `/home` in its matcher plus a branch: any signed-in staff member may see it; customers are
bounced to `/customer`; anon → `/login`.

`homeForRole(role)` is unchanged and still each role's **workspace** — the home's
**"Launch IAT Portal →"** button (and the header "Launch Portal" link) use it to drop each person
into `/admin` or `/employee/profile` as before.

## Data model — "CMS with sensible defaults"

Every card reads **live** from Supabase via the service role (`lib/home-data.ts`), and falls back
to typed defaults in `lib/home-content.ts` when a table is empty or not yet migrated — so `/home`
looks complete on day one and the moment HR authors a row, that row takes over.

| Card | Source | Notes |
|---|---|---|
| Company News | `announcements` | `pinned` floats to top + gets an inverted date tile. |
| Company Calendar | `company_events` + computed federal holidays | Past events auto-filtered. "Next holiday" is computed in code (no seeding). |
| — "Out this week" | `time_off_requests` (approved, overlapping ±14d) | Live; replaces SharePoint's "PTO coming soon". |
| Open Positions | `job_openings` (`is_open`) | + the referral banner (`REFERRAL` in home-content). |
| Birthdays & Anniversaries | `employees.birthday` + `employees.hire_date` | Anniversaries are derived live; birthdays need the new `birthday` column populated. Staff-filtered via `getCustomerIds()`. |
| New Employee | `employee_spotlights` (`kind='welcome'`) → else newest `employees.hire_date` | Auto-derives the newest hire if no curated welcome row. |
| Employee Spotlight | `employee_spotlights` (`kind='spotlight'`, active) | Curated; falls back to the default sample until a row exists. |
| Company Suggestions | writes `company_suggestions` | Server action `app/home/actions.ts`; private inbox (admins read via service role). |
| Fun Fact / Core Values / IT Support | code (`lib/home-content.ts`) | Brand copy, not DB data. |

### Editing content

- **Editorial cards** (news, events, openings, spotlights): manage at **`/admin/home-content`**
  (System → Company Home) — add/edit/delete with a modal form; changes revalidate `/home`
  immediately. Gated by the `home_content` perm (admin-only by default; grantable to HR/marketing
  from `/admin/permissions`). An empty section shows the `lib/home-content.ts` default; the first
  real row replaces it.
- **Fun facts, core values, the IT contact, referral bonus**: edit the arrays/constants in
  `lib/home-content.ts`. **TODO:** `IT_SUPPORT.email` currently routes to the portal admin —
  point it at the real IT inbox.

### The `home_content` permission

Added to `lib/roles.ts` (`Perm`, `PERM_LABELS`, `ADMIN_PATH_PERMS`). It is **admin-only by
omission** from `DEFAULT_ROLE_PERMS`, so it needs **no migration/seed** and doesn't affect the
`check-perm-seed.mjs` prebuild gate. It's left out of `NON_DELEGATABLE_PERMS`, so an admin can
hand it to a scoped role from `/admin/permissions` (which writes a `role_permissions` row).

## Files

- Home page: `app/home/page.tsx` (data-fetch) → `app/home/HomeView.tsx` (presentation)
- Client bits: `HomeTopBar.tsx`, `FunFact.tsx`, `SuggestionBox.tsx`; primitives in `home-ui.tsx`
- Suggestion action: `app/home/actions.ts`
- Admin editor: `app/admin/home-content/page.tsx` + `HomeContentManager.tsx` + `actions.ts`; nav in `components/admin/AdminSidebar.tsx` (System group)
- Data: `lib/home-data.ts` · Content/defaults: `lib/home-content.ts` · Migration: `supabase/migrations/058_company_home.sql`

## Deploy checklist

**Security patch for already-applied 058 — DONE 2026-07-20:** the first draft of 058 granted
`authenticated` SELECT on the four editorial tables — which would let a logged-in *customer*
read internal content straight from PostgREST. The migration file no longer creates those
policies, and the four `DROP POLICY` statements below have been run against the live `iat-forms`
project (verified via `supabase db query --linked` against `pg_policies`; no policies remain on
the four tables):

```sql
DROP POLICY IF EXISTS announcements_read       ON announcements;
DROP POLICY IF EXISTS company_events_read      ON company_events;
DROP POLICY IF EXISTS job_openings_read        ON job_openings;
DROP POLICY IF EXISTS employee_spotlights_read ON employee_spotlights;
```

(RLS stays enabled; reads go through the service role, so nothing in the app breaks. Fresh
environments just run the current `058_company_home.sql`.)

1. `npm run build` (the `check-perm-seed` prebuild gate must pass), deploy, verify the Vercel prod alias updated.
2. Add the changelog line (`CHANGELOG.md` + `docs/06-changelog.md`).
3. (Optional) point `IT_SUPPORT.email` at the real IT inbox; author content via `/admin/home-content`.
