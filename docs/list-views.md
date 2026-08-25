# List views — the "one card" pattern

The house pattern for dense admin list pages. First built on **Performance**
(`app/admin/projected-sales/ProjectedSalesClient.tsx`); being rolled out to the other
`/admin` lists. Older lists still use the card-based kit in
`components/admin/list.tsx` (`ListPageHeader` + `HEADER_BOX`/`BODY_BOX`) — that's what this
replaces.

## The idea

The page is the warm canvas (`bg-canvas`). The **whole list module** — header, stat strip,
filters, table, and pagination — lives inside **one card** (`rounded-xl border-hairline
bg-surface`) that sits on it, the way a clean SaaS list (e.g. the Intouch reference) does
it. The shared `AdminTopBar` above stays the page's one chrome band.

```
AdminTopBar                        ← warm canvas, from the admin layout
┌ bg-canvas page (flex-1 overflow-y-auto, padded) ┐
│  ┌ card: rounded-xl border-hairline bg-surface ┐ │
│  │ header   overline · title · count | primary │ │
│  │ ── hairline ──                               │ │
│  │ stat strip   (hairline-separated cells)      │ │
│  │ ── hairline ──                               │ │
│  │ filters   search · rep dropdown              │ │
│  │ ── hairline ──                               │ │
│  │ column headers (bg-surface-soft, sortable)   │ │
│  │ rows      (hairline-soft dividers)           │ │
│  │ ── hairline ──                               │ │
│  │ pagination   Showing X–Y of Z · size · pager │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

## Alignment — the thing that makes it read as one unit

**Every band uses the same horizontal padding (`px-5`)** so the header title, stat labels,
search field, first column, and "Showing…" all start on one left edge, and the primary
button, last column, and pager all end on one right edge. Two gotchas, both real bugs we
hit:

- **Phantom scrollbar.** The table's horizontal-scroll wrapper must be
  `overflow-x-auto overflow-y-hidden`. `overflow-x:auto` alone silently promotes
  `overflow-y` to `auto`, which reserves a ~15px vertical scrollbar and pulls the columns
  off the right gutter. `overflow-y:hidden` fixes it (the table's height is natural; the
  page is the scroller).
- **Rows are `<button>`s → add `w-full`.** A `<button>` with `display:grid` shrink-wraps to
  its content instead of filling the row, so its grid resolves narrower than the header
  `<div>` and every column drifts left (up to ~470px, and worse on wider screens). `w-full`
  makes it fill and align. (Divs stretch by default, which is why a div-based mockup won't
  reproduce this — test with the real element.)
- **The card does NOT use `overflow-hidden`** — that would clip the rep-filter dropdown.
  Rounded corners are fine because the top (header) and bottom (pagination) bands have no
  background fill, so the card's rounded `bg-surface` shows through.

Verify alignment by measuring, not by eye: every left-aligned band's
`getBoundingClientRect().left` should be equal, and every right-aligned control's `.right`
should be equal.

## Rules

- **Root** is the scroll container: `flex-1 min-h-0 overflow-y-auto bg-canvas`, padded
  (`p-4 sm:p-6`), holding the one card. The table wraps in `overflow-x-auto overflow-y-hidden`
  + `min-w-[…]` so wide tables scroll sideways without squeezing.
- **Semantic tokens only** — `bg-surface(-soft|-strong)`, `border-hairline(-soft)`,
  `text-ink(-secondary|-muted|-faint)`, `bg-brand`. No `zinc-*`, no hex. **Never** an
  opacity modifier on a token (`bg-brand/70` compiles to nothing — use a solid token, or a
  standard-palette color like `bg-emerald-500/80`).
- **Life, with meaning** — color only where it encodes something: colored **avatars**
  (stable hue per name via `toneFor`), **tone pills** for category, a **meter** for a 0–100
  value, **urgency** tinting for dates, a **magnitude bar** for a headline number. Tones
  come from the six-tone `TONE` map (mirrors `list.tsx` TONE_CLS).
- **Pagination** — client-side when the page already loads the full set. Default **10**;
  options `[10, 25, 50, 100]`; reset to page 1 on filter/search/sort/size change; windowed
  pager (`‹ 1 … 4 5 6 … 20 ›`).
- **Honesty** — no decorative controls. Selection checkboxes / row kebabs only on pages with
  real bulk/row actions. Performance is read-only, so it has neither.
- **Weights** — titles `font-semibold` (≤650, per DESIGN.md), never `font-bold`.

## The shared kit (`components/admin/list-card.tsx`)

The pattern is now a kit — build new/converted lists from it, don't hand-roll:
`ListCardPage` (canvas root) · `ListCard` · `CardHead` · `StatStrip`/`Stat` · `Toolbar` ·
`CardTable` (bakes in `overflow-x-auto overflow-y-hidden` + min-width) · `Row` (bakes in
`w-full`) · `SortHeader` · `EmptyRow` · `Pagination` + `usePagedList` (default 10) ·
`PerPageSelect` · `Pager` · `FilterDropdown` · `ListSearch` · `ToneAvatar` · `TagPill` ·
`Meter` · `CARD_TONE`/`toneFor`/`confBand`. The three gotchas above are encapsulated in
`CardTable`/`Row`/`ListCard`, so you can't reintroduce them by composing the kit.
(`components/admin/list.tsx` still holds the older `ListPageHeader`/`HEADER_BOX` primitives +
`StatusPill` + the status→tone maps; reuse `StatusPill` and those maps.)

## Rollout status — DONE (2026-07-23)

Performance was the reference; the kit was then applied to every remaining `/admin` list:
Submissions, Tickets, Employees, Customers, Equipment, Tool Crib, Production, Gantt,
PTO/Sick requests, Accrual, Audit, Presentations, US Rotors Orders. **CRM (Deals)** is a
kanban and only took the header/shell. Notes:
- **Server-paginated pages stay server-paginated** — Submissions and the Audit "Emails" tab
  page/filter/count on the server; don't swap them to client `usePagedList` (it would only
  slice the current window and desync the counts). Match the footer look with `<Link>` pagers.
- **Rows with inline controls + navigation:** today those pages nest a checkbox/kebab inside
  the row `<Link>` with `preventDefault`/`stopPropagation` guards — it works everywhere but is
  HTML-invalid (interactive-in-interactive). A future `Row` "stretched-link" variant (a `<div>`
  row + an absolute `<Link>` overlay + `relative z-10` on the controls) would make it clean.

## 🔴 Select-all must be PAGE-scoped (fixed 2026-08-24)

Every admin list here paginates (10 per page by default), but all six with multi-select computed
their header checkbox from the **whole filtered set**:

```ts
const allSelected = filtered.length > 0 && filtered.every(r => sel.has(r.id))
onChange={() => sel.setAll(filtered.map(r => r.id), !allSelected)}
```

One click then ticked the header, visibly checked the ten rows on screen, and put **every
off-screen row in the selection too** — with a Delete button sitting on the same bar. Reproduced
on `/admin/tickets`: 10 rows checked, bulk bar reporting **"Selected: 17"**.

Affected and fixed together: Tickets, Customers, Employees, Equipment, Requests, and the new
RFQ list. Customers and Employees are the dangerous pair — both can bulk-delete.

**Use `sel.togglePage(pageRows.map(r => r.id), !allSelected)`**, added to
`components/admin/bulk-select.tsx`. It adds or removes only the ids passed, so a selection made
on page 1 survives paging forward and back rather than being replaced.

`SelectBox` also takes `indeterminate` now — without it a half-selected page renders identically
to an empty one.

⚠️ A checkbox has to mean what it looks like it means. If a future list wants "select all N
across pages", that needs an explicit affordance saying so, not a header box that quietly reaches
past the screen.

## 🔴 A checkbox inside a row link cannot use its own native toggle (2026-08-24)

**Symptom:** clicking a tick box selected the row — bulk bar counting up, actions operating on the
right records — while the box itself stayed visually empty. State correct, pixels wrong. There was
no way to confirm a selection before pressing Delete.

**Cause.** `SelectBox` renders *inside* the row's `<a href>`, so its wrapper must call
`preventDefault()` or selecting navigates into the record. On a checkbox that same call also
reverts the browser's own toggle, and React then declines to re-sync because the `checked` prop it
last wrote already equals the one it is rendering.

**Three fixes were tried against production and each failed for its own reason.** Recorded because
every one of them looks correct in review:

| Attempt | Why it failed |
|---|---|
| `checked` prop + `onChange` | React will not re-sync; last-written prop already matches |
| `checked` prop + **ref callback** | Ref runs during render, and React flushes discrete events (a click) **synchronously** — so it lands *before* the revert |
| `checked` prop + **`useEffect`** | Closest. Fixed every box *except the one clicked* — React flushes passive effects at the end of that same discrete event |

**What works: the input never receives the click.** `pointer-events` is off on it and the wrapper
is the control. With no default action on the input there is nothing to revert, so `checked` is
authoritative and cannot desynchronise.

The wrapper consequently carries the semantics — `role="checkbox"`, `tabIndex`, `aria-checked`
(with `"mixed"` for an indeterminate header) and Space/Enter. ⚠️ That is a genuine improvement, not
just a shuffle: the previous `readOnly` input with no `onChange` had **no keyboard path at all**.

⛔ **Do not "simplify" the input back into an interactive control** while these boxes live inside a
row link. The three attempts above are what that costs.

### One component, not five

Tickets hand-rolled its own boxes rather than using the kit. That is exactly why it behaved
differently from every other list, and why the click bug went unnoticed there while it was live on
five other pages. It now uses `SelectBox`.

⚠️ **A verification trap worth naming.** The first check of the tickets rows called
`.closest('div').click()` — the *wrapper*. That is the path that already worked, so the test passed
while the bug was live on the path a person actually uses. **Click the affordance the user clicks**,
not the container that happens to be convenient in a script.
