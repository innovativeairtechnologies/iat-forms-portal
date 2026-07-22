# Company Home

The shared company intranet home — the first screen **every internal user** sees after login,
rebuilt from the SharePoint intranet. It renders **inside the portal shell** (the sidebar is
present, "Company Home" is the active tab), as a **single-screen bento dashboard** that fills the
viewport without scrolling the page. External customers are unaffected (they still land on `/customer`).

## Layout — compact "Lobby" dashboard (2026-07-21)

`app/home/HomeContent.tsx` is a warm, **compact** dashboard tuned to fit close to one screen on
desktop (minimal scroll), matching the shipped portal chrome (`/admin`, `/employee/profile`): a
`zinc-50` canvas (`dark:bg-[#0a0a0b]`) with a soft ambient emerald glow, white `rounded-xl` cards
with `shadow-sm`, one emerald accent. Top to bottom:

1. **Home top bar** (`app/home/HomeTopBar.tsx`, desktop `md+`) — the home's own sticky bar:
   "Company Home" on the left; then **Have an idea** (opens a modal wired to the suggestion action),
   **Email IT**, a dark-mode toggle, the notifications **bell** (`TopBarBell` — real counts on the
   admin surface, "all clear" elsewhere until per-employee notifications are wired), and the
   **profile** avatar (links per shell). `/admin/home` had no bar before; the employee shell now
   **suppresses its own `PortalTopBar` on `/employee/home`** so there's exactly one bar.
2. **Greeting hero** — the emerald→teal gradient card with floating white **IAT-logo "particles"**
   on the right (`/iat-logo-transparent.png`, inverted to white, low opacity, gentle drift;
   `prefers-reduced-motion` off), the date eyebrow, greeting, live subtitle, quick-link buttons, and
   the wrapping fun-fact line (moved here from the old footer).
3. **Company at a glance** — a 4-up KPI row (Teammates · Days incident-free · Open roles · Next holiday).
4. **Content** — equal-height cards (`items-stretch` + `h-full`): News (lead + 2) spanning 2 of a
   3-col row beside This Week; then Our People · Milestones · Open Positions (3-col); then a slim
   full-width **Core Value** strip.

The **Suggestion box and Email IT moved out of a footer into the top bar** (the footer is gone).
`HomeContent`'s root is a flex column — the top bar (`flex-shrink-0`) over a
`flex-1 min-h-0 overflow-y-auto` scroll area (the same scroll pattern `/admin` uses); the
`heightClass` prop is removed. The sidebar + Jerry orb still come from the portal shell.

## What changed for routing

Company Home lives **inside each portal shell**, so it's a per-shell route rather than a single
standalone page:

- Admin-surface roles → **`/admin/home`** (wrapped by `app/admin/layout.tsx` → admin sidebar).
- Base employees → **`/employee/home`** (wrapped by `app/employee/(protected)/layout.tsx` → employee sidebar).
- Both pages render the one shared `app/home/HomeContent.tsx` (via `app/home/HomePage.tsx`).

`landingForRole(role)` in `lib/roles.ts` is the seam: customer → `/customer`; admin-surface →
`/admin/home`; everyone else → `/employee/home`. Repointed at the four landing sites — `app/page.tsx`,
`app/login/page.tsx`, `app/auth/callback/route.ts`, and the logged-in `/login` bounce in
`middleware.ts`. Deep links (`?redirect=`) and the `welcome` onboarding flows are preserved.
`/admin/home` is added to `OPEN_ADMIN_PREFIXES` so the middleware opens it to every admin-surface
role (not just full admin). The old **`/home`** URL is kept as a convenience redirect
(`app/home/page.tsx`) that forwards to the caller's shell home.

`homeForRole(role)` is unchanged — it's still each role's workspace root (`/admin`,
`/employee/profile`), reached from the sidebar's other tabs.

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
| Core Value of the Week | code (`CORE_VALUES` in `lib/home-content.ts`) | Shows ONE value, auto-rotating weekly via `coreValueOfWeek()` — advances each Monday (ET), holds all week, cycles all 9. Manual "pin for the week" override = planned follow-up. |
| Fun Fact / IT Support | code (`lib/home-content.ts`) | Brand copy, not DB data. |

### Editing content

- **Editorial cards** (news, events, openings, spotlights): manage at **`/admin/home-content`**
  (System → Company Home) — add/edit/delete with a modal form; changes revalidate `/home`
  immediately. Gated by the `home_content` perm (admin-only by default; grantable to HR/marketing
  from `/admin/permissions`). An empty section shows the `lib/home-content.ts` default; the first
  real row replaces it.
- **Fun facts, core values, the IT contact, referral bonus**: edit the arrays/constants in
  `lib/home-content.ts`. **TODO:** `IT_SUPPORT.email` currently routes to the portal admin —
  point it at the real IT inbox.
- **The KPI row**: "Teammates" is the live active-staff `headcount` (`lib/home-data.ts`); the
  "days incident-free" counter auto-increments from `SAFETY.since` in `lib/home-content.ts` — edit
  that date whenever the streak resets.

### The `home_content` permission

Added to `lib/roles.ts` (`Perm`, `PERM_LABELS`, `ADMIN_PATH_PERMS`). It is **admin-only by
omission** from `DEFAULT_ROLE_PERMS`, so it needs **no migration/seed** and doesn't affect the
`check-perm-seed.mjs` prebuild gate. It's left out of `NON_DELEGATABLE_PERMS`, so an admin can
hand it to a scoped role from `/admin/permissions` (which writes a `role_permissions` row).

## Files

- Per-shell pages: `app/admin/home/page.tsx` and `app/employee/(protected)/home/page.tsx` — thin;
  each resolves the user's name and renders `app/home/HomePage.tsx`
- Shared body: `app/home/HomePage.tsx` (loads data + greeting) → `app/home/HomeContent.tsx` (presentation + the home top bar)
- Top bar: `app/home/HomeTopBar.tsx` (Have-an-idea modal, Email IT, theme toggle, bell, profile) — reuses `TopBarBell`
- Client bits: `FunFact.tsx` (the hero fun-fact); primitives in `home-ui.tsx`; suggestion action `app/home/actions.ts` (also drives the top-bar idea modal). `SuggestionBox.tsx` is now unused.
- Redirect shim: `app/home/page.tsx` (`/home` → shell home)
- Sidebar links: `components/admin/AdminSidebar.tsx` (Company Home, top of rail) + `app/employee/(protected)/EmployeeShell.tsx` (Menu)
- Admin content editor: `app/admin/home-content/page.tsx` + `HomeContentManager.tsx` + `actions.ts` (System → Company Home)
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
