# Design language — calm first

> **2026-07-07 — "Quiet Precision" supersedes ad-hoc styling.** The full design system
> (semantic tokens, type scale, component recipes, dark-mode surface ladder, migration plan)
> lives in `DESIGN.md` at the IAT-Portal workspace root, with the always-on rules mirrored in
> the workspace `CLAUDE.md`. Phase 0 (token layer: CSS variables in `app/globals.css`,
> semantic Tailwind colors `canvas/surface/hairline/ink/brand`, Inter via `next/font`,
> indigo-override + green-theme dead code removed) shipped 2026-07-07. New/edited components
> use the semantic tokens — raw `gray-*`/`zinc-*`/`slate-*` and hex literals are banned.
> The principles below predate that doc and still hold; DESIGN.md is the token-level authority.

The IAT Portal's visual baseline is **calm**. The layout, spacing, type scale,
and the shared card/list kit are already restrained and should stay that way.
The recurring failure mode is **decoration without meaning** — visual weight
that carries no information. This doc is the guardrail against re-introducing it.

## Principles

1. **One accent color.** Emerald is the brand accent (`#089447` / `#10b981`).
   Reserve saturated color for genuine meaning — a real status, a true alert,
   the one primary CTA. No rainbow icon rows, no per-item hues that encode
   nothing (e.g. Top-Forms/Top-Submitters rank bars are neutral/emerald, not
   violet/sky). If a color doesn't distinguish a state, it should be zinc.

2. **Motion only on meaning.** No perpetual/idle animation. Jerry's orb rests
   at a single gentle breathe and only spins/orbits behind `.is-thinking` while
   actually answering. No infinite pulses on static pages; a one-shot entrance
   at most. Never `animate-ping` alarm-red on a support/reading surface. Honor
   `prefers-reduced-motion`.

3. **Say each fact once.** Don't render the same value two or three times in one
   viewport (status/priority, streak/XP, counts). Pick the one canonical home
   (e.g. the ticket's Status & Priority editor; the Learn top-bar chips) and
   drop the echoes.

4. **Primary content first; hide the rest.** Put what the user opened the page
   for at the top (a ticket's Problem Description, not editing chrome). Fold
   read-only/secondary detail into a collapsed `<details>` disclosure rather
   than a stack of equal-weight cards. Give secondary cards a flat/borderless
   treatment so the primary cards read as elevated.

5. **No ghost cards.** Don't render full disabled "coming soon" tiles for
   unbuilt features — collapse them to a one-line muted note so the live action
   stands alone.

6. **Restraint on badges/pills.** Count badges are soft tinted chips
   (`bg-<tone>-500/10` + colored text), not solid saturated fills — reserve a
   solid fill for genuine critical/overdue. Status pills are a single soft fill
   (no border), `font-semibold` not `bold`.

7. **One glow, modest hero.** `PortalHero` uses a single subtle brand glow and a
   modest band — don't inflate the height or title, don't stack multiple glows.

## The reference surfaces

The calmest things in the portal are the target aesthetic: the **KB article
reader** (`/support/kb/[slug]`), the **`iat-home`** landing page, and the
**`iat-ticketing`** app. When a new surface feels busy, measure it against those,
and prefer **subtracting** over adding.

_History: the whole portal got a subtractive density pass on 2026-07-01; see the
CHANGELOG entry of that date._

## List views — one house style

Every `/admin` list (Tickets, Submissions, Equipment, Customers, Employees,
Deals, Forms, Employee Forms, PTO/Sick queues, Presentations, Gantt, Audit,
Accrual, and the hidden Troubleshooting / US Rotors queues) uses one shared
visual language so they read as a single system. The pattern is defined in
`components/admin/list.tsx` — build new list pages from these primitives rather
than hand-rolling a header or row.

**The anatomy:**

1. **`<ListPageHeader overline title count? actions? >`** — the white header band:
   a small-caps overline (the section word, e.g. "Support", "People", "Sales"),
   a bold 26px title, a light count/summary line, and right-aligned primary
   actions. The page's tabs/filters go in its `children`, rendered inside the
   same band so an underline tab's border meets the header's bottom edge.

2. **`<IdentityCell icon|leading title subtitle? mono? >`** — the signature of
   the whole system and the **first column of every row**: a bold primary line
   stacked over a muted secondary line. `leading` takes an `<Avatar/>` (people /
   customers), `icon` takes a lucide glyph in a subtle chip (objects), `mono`
   makes the subtitle monospace (slugs, reference numbers). Fold a row's
   secondary fields (IDs, a category, a rep) into the subtitle instead of
   spending a whole column on them.

3. **`tabCx(active)` / `tabCountCx(active)`** for underline tabs, **`filterPillCx(active)`**
   for rounded status pills — the same tab/pill look everywhere, whether the
   caller uses `<Link>` (query-param tabs) or `<button>` (client-state tabs).

4. **Airier rows** — the shared `ROW` token is `min-h-[52px]` (grows if a cell
   expands), giving the stacked identity room to breathe.

**Simplify, don't cram.** A list row is identity + a few genuinely useful
columns + real actions — never a spreadsheet of every field. When a column
duplicates what's in the identity subtitle or only matters on the detail page,
drop it. Copy (title, subtitle, counts) must say something real; no filler
labels or dead buttons.

The gold-standard references to match are `app/admin/customers/CustomersClient.tsx`
(icon-chip identity, client-state tabs) and `app/admin/tickets/TicketsQueueClient.tsx`
(avatar identity, folded columns). The **Forms** page (`app/admin/forms/page.tsx`)
is the one that keeps category cards — that grouping is specific to forms having
real categories; every other list is a flat table.

_History: the whole-admin list-view standardization shipped 2026-07-07; see the
CHANGELOG entry of that date._
