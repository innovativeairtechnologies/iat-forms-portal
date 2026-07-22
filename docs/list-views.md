# List views — the "unified sheet" pattern

The house pattern for dense admin list pages. First built on **Performance**
(`app/admin/projected-sales/ProjectedSalesClient.tsx`); being rolled out to the other
`/admin` lists. Older lists still use the card-based kit in
`components/admin/list.tsx` (`ListPageHeader` + `HEADER_BOX`/`BODY_BOX` cards) — that's
the thing this pattern replaces.

## The idea

Everything below the shared top bar lives on **one surface** — no stacked
background bands. The top bar (`AdminTopBar`, warm `bg-canvas`) stays the single distinct
header; the page itself is one white `bg-surface` sheet that scrolls under it. Sections
are separated by **hairlines**, not by changing background colors, and the list rows sit
**directly on the sheet** (no card border boxing them in).

```
AdminTopBar            ← warm canvas, the one header band (from the admin layout)
┌─ bg-surface sheet (flex-1 overflow-y-auto) ─────────────┐
│  header band  (overline · title · count · primary btn)  │
│  ── hairline ──                                          │
│  stat strip   (hairline-separated cells, not cards)      │
│  ── hairline ──                                          │
│  toolbar      (search · filter dropdown · …)             │
│  ── hairline ──                                          │
│  column headers (bg-surface-soft, click-to-sort)         │
│  rows         (hairline-soft dividers, hover surface-soft)│
│  pagination   (Showing X–Y of Z · per-page · pager)      │
└──────────────────────────────────────────────────────────┘
```

## Rules

- **Root** is the scroll container: `flex-1 min-h-0 overflow-y-auto bg-surface`. The list
  header + rows share a horizontal-scroll wrapper (`overflow-x-auto` + `min-w-[…]`) so wide
  tables scroll sideways without squeezing.
- **Semantic tokens only** — `bg-surface` / `bg-surface-soft` / `bg-surface-strong`,
  `border-hairline(-soft)`, `text-ink(-secondary|-muted|-faint)`, `bg-brand`. No `zinc-*`,
  no hex. **Never** an opacity modifier on a token (`bg-brand/70` compiles to nothing — use
  a solid token or a standard-palette color like `bg-emerald-500/80`).
- **Life, with meaning** — color only where it encodes something:
  - colored **avatars** for people (stable hue per name via `toneFor`),
  - **tone pills** for category/type,
  - a **meter** for a 0–100 value (confidence),
  - **urgency** tinting for dates (amber soon / rose overdue),
  - a **magnitude bar** for a headline number.
  All tones come from the six-tone `TONE` map (mirrors `list.tsx` `TONE_CLS`).
- **Pagination** — client-side when the page already loads the full set (Performance loads
  a synced snapshot). Page-size options `[10, 25, 50, 100]`; reset to page 1 when the
  filter/search/sort/page-size changes; windowed pager (`‹ 1 … 4 5 6 … 20 ›`).
- **Honesty** — no decorative controls. Selection checkboxes / row-action kebabs only on
  pages that actually have bulk actions or row actions. Performance is read-only, so it has
  neither.
- **Weights** — titles `font-semibold` (≤650, per DESIGN.md), never `font-bold`.

## Rollout

The Performance page is the reference. When promoting to other lists, extract the shared
bits (`Stat`, `Pager`, the `TONE` map + `toneFor`, the sheet shell) into
`components/admin/list.tsx` so every list changes from one place — but only after the
pattern is settled on Performance.
