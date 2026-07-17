# Production Board

A per-department shop checklist the floor opens by **scanning a QR code — no login**.
Built so the team can run the work while their manager is away, and keep using it after.

- **Public board:** `/board/<token>` — one per department, one unguessable link each.
  `/board/<token>?project=<id>` focuses a single project (the optional per-project link).
- **Manager's side:** `/admin/production` → a department → its **projects**; open a project to
  manage its tasks, crew, and details. Perm `production_board`.
- **Migrations:** `055_production_board.sql`, then `056_production_projects.sql` (both run by
  hand in the Supabase SQL editor).

---

## Why it isn't behind the portal

The floor has no portal accounts. Handing out logins the same week the manager is
away is a rollout, not a feature. So the board sits outside the auth gate exactly the
way `/support` does: **`middleware.ts`'s `matcher` is an allowlist, and `/board` isn't
on it.** Nothing else is required to make it public — and nothing else protects it.

**Do not add `/board` to the matcher.** That's the whole mechanism.

## The security model, stated plainly

The **URL token is the credential.** Anyone holding the link can read that board and
check items off, and the name recorded against a check-off is typed on the floor and
**not verified**. This is an honor-system board, not an auth system.

That's a deliberate trade, and it sets a hard rule for what may go on a board:

> **Shop work only. No customer names, no pricing, nothing you wouldn't pin to the
> break-room wall.**

What the design does do:

| Control | Where |
|---|---|
| 43-char, 244-bit token, minted by the DB (`prod_board_token()`), never app-side | `055` |
| Token never reaches the client — the page selects explicit columns, not `*` | `app/board/[token]/page.tsx` |
| Bad token and retired department return the **same 404** — never confirm what's real | page + check route |
| Task ownership re-proved against the token's department before any write | `app/api/board/[token]/check/route.ts` |
| `noindex, nofollow` + `Referrer-Policy: no-referrer` on `/board/:path*` | `next.config.js` |
| Tables are RLS-on/no-policies — **service-role only** | `055` |

### The trap worth knowing

**A public page must not become a public table.** Giving `anon` a SELECT policy on
`production_departments` would expose it over PostgREST — so a single
`GET /rest/v1/production_departments` with the publishable anon key would return every
row **including every token**, enumerating every "unguessable" board at once. The page
renders server-side with `supabaseAdmin` and returns one department's rows. Keep it that way.

### Rotating a link

`/admin/production` → QR → **New link**. Re-mints the token, so **every printed QR for
that board stops working immediately**. That's the recovery path when a printout walks
off: rotate and re-print, don't re-plumb.

---

## How the work is modelled

Since **migration 056** a department contains **projects**, and tasks hang off them:

```
Department (Production)
├─ standing duties         production_tasks with project_id NULL — "Every day"
└─ Project (Acme Unit A)   production_projects row
   └─ tasks                production_tasks with project_id set, optional `phase`
```

- **Standing duty** = `project_id IS NULL`. Department-wide, shows under *Every day* at the
  top of the board. `isStanding()` keys off `project_id` (the old free-text `project` column
  is **deprecated** — kept for pre-056 rows, never written by new code).
- **Project task** = `project_id` set. Grouped into its project's section; within a project,
  the optional `phase` text ("Day 1", "Framing") sub-groups tasks — blank = a flat list.

**Two projects can share a task list yet track separately** — the headline ask. Each project
is its own `production_projects` row with its own tasks, so checking off Acme never touches
Beta. The **Duplicate** button (`POST /api/admin/production/projects {duplicate_id}`) copies a
project and its task list — titles, details, phases, cadence, priority carry over; per-build
facts reset (status→open, done_* cleared, due dates + assignees dropped), because a new build
has its own dates and crew.

Project fields: `name`, `type` (free text — unit model / customer / 'R&D'), `detail`, `status`
(`active` | `complete` — complete hides it from the floor board), and `people` (a **text[]**
of roster names shown as "who's on this build"). **`people` is display-only** — by product
decision it does NOT gate the assignee picker, which stays the whole department roster.

`type`, `assignee`, `phase` and the project↔people tags are all free text / snapshots, not
FKs: there is **no deals → equipment → shop link in this schema** to key off (`deals.job_name`
is sales metadata; `equipment` is the post-ship installed base), and the roster is editable —
so an FK would either be a lie or would let a rename rewrite recorded history.

Likewise `assignee` and `done_by` are **free text, not FKs to `employees`** — the floor
has no accounts, and `employees` isn't staff-only anyway (every customer invite gets a
row; see `lib/staff.ts`). Names are snapshots, so renaming or removing someone from a
roster never rewrites who did the work.

### Recurring tasks reset with no cron

`cadence` is `once` | `daily` | `weekly`. There is **no scheduled job** and nothing to
fail overnight:

- `done_on` stores the **shop-local calendar date** (`America/New_York`) the work happened.
- A `daily` task counts as done only while `done_on == today`. A `weekly` one until Monday.
- The answer is computed fresh on every read.

**This lives in exactly one place — `effectiveDone()` in `lib/production.ts`.** Both the
board and the admin page call it. Don't reimplement it.

> **Why shop-local, not UTC:** Vercel runs UTC. A daily task keyed on the UTC date would
> reset at **8pm local** — the board would clear itself during second shift. `America/New_York`
> is the house timezone (`lib/learn-gamification.ts` `STREAK_TZ`, `lib/admin-digest.ts`).
> If IAT ever runs a shop in another zone, this becomes a column on `production_departments`.

---

## Departments and rosters

**Departments are data, not code.** Seeded with Production / Fabrication / Electrical;
add, rename or deactivate them at `/admin/production` with **no deploy**. Confirming the
real department list costs nothing.

**`production_people`** is the floor roster behind the board's tap-to-pick name list. It is
**not** portal accounts and deliberately not `employees` — the live table has no production
staff in it at all (12 rows, 4 of them customers, 7 with a null department). These are
names on a list; they prove nothing.

The board always keeps a **free-text fallback** next to the picker. The roster will never
be complete — a temp, a new hire or someone helping from another department must not be
locked out of checking off work they actually did.

---

## Rate limiting

The check-off route uses `board-check`, **240 per 10 min**, far above the in-house 5–10
for public writes. That's deliberate: **the whole shop shares one NAT IP**, so the limit is
effectively per-office, not per-person — a 10-person crew clearing a 20-item board is ~200
legitimate requests from one address. The house default would lock the floor out by 9am.

Note `rateLimit` **fails open by design**. It is not the security control here; the token is.

---

## Files

| Path | What |
|---|---|
| `supabase/migrations/055_production_board.sql` | 4 tables, token mint, perm grant, seed |
| `supabase/migrations/056_production_projects.sql` | `production_projects` + task `project_id`/`phase` |
| `lib/production.ts` | `effectiveDone`, `groupByPhase`, `buildBoard`, progress, `cleanActorName`, `SHOP_TZ` |
| `app/board/[token]/` | the public board (server page + client); `?project=` focuses one |
| `app/api/board/[token]/check/` | the one unauthenticated write |
| `app/admin/production/` | dept list → dept detail (projects + standing) → project detail |
| `app/api/admin/production/{departments,projects,tasks,people}/` | manager writes, `requireProductionAuth`; `projects` also does duplicate |

## Adding the perm (already done — for reference)

`production_board` is registered in **five** places. Miss the last one and a
`production_manager` gets a **silent 302** to `/admin` with no error anywhere:

1. `Perm` union — `lib/roles.ts`
2. `PERM_LABELS` — `lib/roles.ts` (TS-enforced)
3. `DEFAULT_ROLE_PERMS` — `lib/roles.ts` (**grants nothing on its own**)
4. `ADMIN_PATH_PERMS` — `lib/roles.ts`
5. **`INSERT INTO role_permissions`** — in `055`. This is the one that actually grants it.

Plus the sidebar entry in `components/admin/AdminSidebar.tsx`.
`scripts/check-perm-seed.mjs` gates `prebuild` on 3 vs 5 agreeing.

> Named `production_board`, **not** `production` — `production` is already a StaffRole
> (the base floor tier). Same collision class as `tools` vs `tool_crib`.

## Known gaps / next

- **Ordering** is `sort_order` from the API's append-at-end; there's no drag-to-reorder yet
  (projects, phases, and tasks all sort by it).
- **Duplicate resets dates + assignees** by design; if a build reuses the same crew, they're
  re-picked on the copy. Revisit if that's more annoying than helpful.
- Admin-side check-off records `done_by: 'Manager'` rather than the signed-in user's name.
- No per-department timezone (see above).
- Nothing notifies anyone. The board is pull, not push.
