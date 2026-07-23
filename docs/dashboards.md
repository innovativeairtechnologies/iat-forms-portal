# Department Dashboards

Status: **Sales shipped 2026-07-21; admin executive dashboard re-skinned onto the shared warm
bento 2026-07-23.** The rest of the departments are the rollout ahead.

## The idea

Every admin-surface role lands on `/admin`, which is the department dashboard. Historically
that page showed one of two things:

- **`admin`** → the full executive operations dashboard (`app/admin/page.tsx` → `getData()`).
- **every scoped role** (`sales`, `hr`, `marketing`, `engineering`, `production_manager`) →
  the generic `DepartmentDashboard` (`components/admin/DepartmentDashboard.tsx`): a handful of
  count tiles + a recent-rows list + quick links, filtered to that role's permissions.

We are now **separating each department's dashboard into its own purpose-built view**. Sales is
the first one done; the others still fall through to `DepartmentDashboard` until each is built.

The switch is a plain role branch at the top of `app/admin/page.tsx`:

```tsx
const surfaceUser = await getAdminSurfaceUser()
if (surfaceUser?.role === 'sales') {
  const { data: deals } = await supabaseAdmin.from('deals').select('*').order('created_at', { ascending: false })
  return <SalesDashboardView deals={(deals ?? []) as Deal[]} displayName={surfaceUser.displayName} />
}
if (surfaceUser && surfaceUser.role !== 'admin') return <DepartmentDashboard … />   // the other scoped roles
// …executive dashboard for admin
```

Add the next department by adding a branch here + a `<Role>DashboardView` component.

## The Sales dashboard

`components/dashboards/SalesDashboardView.tsx` — a **one-screen command center** (no page scroll
on desktop; relaxes into a scrollable stack below `lg`). Six KPIs across the top, then a
4-column × 3-row grid sized so each card matches its content:

| Row | Cards |
|---|---|
| KPI strip | Total pipeline · Qualified (weighted) · Won to date · Win rate · Avg deal size · Open deals |
| 1 | Top rep leaderboard · Deals by status (donut) · Pipeline by industry (donut) · Pipeline by confidence (funnel) |
| 2–3 | **Largest open deals** (tall, left) · Quoting activity (wide trend) · Projections · Recently won · Sales activity · Needs attention |

Everything is **live from the `deals` table** via the pure helpers in `lib/deals.ts`
(`computeSummary`, `monthlyQuoteSeries`, `confidenceBands`, `groupStats`, and the two added for
this: `industryStats`, `salesProjections`). No fabricated numbers — the three things the board
can't yet feed (a sales **goal/quota** line, and **leads / opportunities / meetings** activity)
render an explicit *"Not tracked yet"* state.

Notes:
- **Industry** = `deals.project_type` (the "Industry / vertical" column). **Rep** = `group_name`.
- **Projections** are honest derivations, no quota needed: run rate (won-YTD annualized, `null`
  until there's a dated win this year), best case (won + full open pipeline), commit case (won +
  weighted pipeline).
- The importer + optimistic editing still live in the **`/admin/deals`** workspace; this
  dashboard is read-only and links there ("Deals workspace").

## Building blocks

`components/dashboards/sales-charts.tsx` — **pure, server-safe** presentational primitives (no
`use client`, no hooks): `Kpi`, `Card`/`CardHead`/`CardBody`, `Donut`/`DonutLegend`,
`ConfidenceFunnel`, `QuoteActivityChart`, `RepRow`, `OpenDealRow`, `RecentWonRow`,
`ProjectionTile`, `NotTracked`. All hand-rolled SVG/CSS — the repo has no chart library.

These primitives are now **shared beyond Sales**: the **admin executive dashboard**
(`app/admin/page.tsx`) was re-skinned onto them 2026-07-23 (warm `bg-canvas`, hairline cards,
Tone-chip KPIs, token colors). `CardHead` gained an optional `action`/`href` link for the admin
dashboard's "View all" affordances — the Sales dashboard passes neither and renders unchanged.

> The `/admin/deals` command center (`SalesDashboard.tsx`) still carries its own copies of the
> older chart primitives. Deduping it onto this shared module is a tracked follow-up.

## Color (a scoped DESIGN.md exception)

The dashboards use a **measured amount of color** — colored KPI icon chips and multi-hue category
donuts — which is a deliberate departure from DESIGN.md's "one accent / no colored KPI tiles"
rule. Every swatch is a sanctioned **Tone** (slate / emerald / amber / sky / rose / violet), so it
reads as one system, not arbitrary rainbow. See DESIGN.md §2.4 for the carve-out.

## Not this

An earlier iteration scaffolded a separate universal `/dashboard` route (its own layout +
middleware gate) under a "one landing for everyone" plan. That was retired in favor of the
per-department `/admin` approach above. If a universal post-login landing is wanted later, it
would reintroduce a `/dashboard` route and point `landingForRole` at it.
