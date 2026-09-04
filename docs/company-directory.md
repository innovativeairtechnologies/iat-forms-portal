# Company directory

"Who works here, and how do I reach them." One loader, four surfaces.

## The loader — `lib/directory.ts`

A plain module (no `'use client'`, no React) so a server component and a client
component can both use it. `getDirectory()` returns `DirectoryPerson[]`,
alphabetical:

```ts
type DirectoryPerson = {
  id, name, initials, email, phone, jobTitle, department, avatarUrl, managerName
}
```

It reads the same `employees` rows the org chart draws from, so a person added to
the roster shows up in both without a second place to maintain.

**Three filters, each for a reason:**

- **Customers are excluded.** Every auth user gets an `employees` row — customers
  included (see `lib/staff.ts`). A customer rendered as a colleague is the sharp
  failure here, so `getCustomerIds()` is joined in memory (there is no FK to join
  on) and those ids are dropped.
- **Inactive people are excluded** (`is_active = false`).
- **Anyone hidden from the org chart is excluded** (`org_visible = false`), so the
  directory and the chart never disagree about who is on the team.

**Manager names resolve against the *unfiltered* set.** A hidden or deactivated
manager should still label the people who report to them; otherwise the reporting
line silently reads as "reports to nobody".

**Placeholder emails never reach a screen.** The chart was seeded from the company
chart with `@*.iat.test` addresses (`scripts/seed-orgchart-test.mjs`). Showing one
invites somebody to mail it, so `shownEmail()` resolves those to `null` — "no email
on file" — mirroring the org chart's own rule.

> ⚠️ `shownEmail` and `initialsOf` are re-implemented here rather than imported
> from `components/org-chart/OrgChart.tsx`. That file is `'use client'`, and
> importing a **value** from a client module into a server tree is a live 500.
> Components may cross that line; values may not.

## Surfaces

| Where | What | Gate |
| --- | --- | --- |
| `/admin/org-chart` | The full pan/zoom chart with a Chart / List toggle. **HR** nav group. | `org_chart` — admin + hr |
| `/admin/me/directory` | Read-only roster + chart. **Self-service** nav group. | none (`OPEN_ADMIN_PREFIXES`) |
| `/admin` dashboard | `org_chart` and `directory` cards — see [`dashboards.md`](dashboards.md). | per card |
| `/admin/profile` | Searchable directory panel beside your own settings. | none (`OPEN_ADMIN_PREFIXES`) |

`app/api/admin/directory/route.ts` exists only for the profile page, which is a
client component. Server components call `getDirectory()` directly. It is gated on
the loose `getAdminSurfaceUser()` — the same audience that can already open
`/admin/me/directory` — so an anonymous or customer session gets 401, never the
staff contact list.

## The UI — `components/dashboards/DirectoryCard.tsx`

`'use client'`, because the whole point is type-to-filter. The roster is the whole
company, so shipping it once and filtering in the browser beats a round trip per
keystroke. It holds no query and no auth logic — it receives shaped rows.

Two exports: `DirectoryList` (the searchable list, no card chrome, for embedding)
and the default `DirectoryCard` (the dashboard card). Contact actions stay visible
rather than hover-only — this gets used from a phone, where there is no hover.

## Data gaps show as data gaps

The directory is only as good as the `employees` rows. A person with no
`job_title` renders as a bare name; nobody currently has a `phone`, so no
click-to-call buttons appear. The Org Chart card says out loud how many people
actually have a manager set, because a chart where nobody does looks broken rather
than flat. Fill these in at **HR → Employees**.
