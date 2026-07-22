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

## Rollout

Performance is the reference. When promoting to other lists, extract the shared bits
(`Stat`, `Pager`, `RepFilter`, the `TONE` map + `toneFor`, the card shell) into
`components/admin/list.tsx` so every list changes from one place — after the pattern is
settled on Performance.
