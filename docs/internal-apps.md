# Internal Apps

`/admin/tools` — the launcher for every internal tool that isn't a normal portal page.
Sits under **Operations** in the admin rail, and mirrors to `/employee/resources/tools`
and `/admin/me/apps` for staff without the `tools` perm.

> **Not to be confused with the Tool Crib** (`/admin/tool-crib`), which is the warehouse
> check-out registry for physical tools. Different feature, same word — see
> [tool-crib.md](tool-crib.md). The perms are `tools` and `tool_crib` respectively.

---

## What's on the page

The list is two kinds of thing, rendered as one card.

**In-app tools** come first. These are real admin routes, so they're internal links and each
is gated on **its own** perm — a `tools` holder without `sizing` never sees a dead link.
They live in `INTERNAL_APPS` in `app/admin/tools/page.tsx`:

| App | Route | Perm |
| --- | --- | --- |
| Presentations | `/admin/presentations` | `presentations` |
| Sizing Studio | `/admin/sizing-studio` | `sizing` |
| Application Diagrams | `/admin/diagram-studio` | `diagrams` |

**Self-contained HTML apps** come second. Each is a single file in `public/tools/<slug>.html`
that opens in a new tab, gated to signed-in staff by the middleware `/tools/*` rule. The
catalog is `lib/tools.ts` (`TOOL_APPS`) — one source of truth shared by the admin page and the
two employee-facing lists, so adding an entry there surfaces it everywhere at once.

### Why Sizing Studio and Application Diagrams live here

Both used to sit in the sidebar's **Sales** group. They were pulled onto this page on
2026-08-05 so every internal tool has one home instead of being scattered across nav groups.

Only the rail entry moved. **Routes, perms and middleware gating are unchanged** — bookmarks
still work, and `ADMIN_PATH_PERMS` still enforces `sizing` / `diagrams` on the routes
themselves. Because they no longer have a rail entry, both were added to the ⌘K command
palette (on their own perms, matching this page) — that's now their keyboard shortcut.

---

## Adding a self-contained app

1. Drop the file at `public/tools/<slug>.html`. It must be genuinely self-contained: no
   imports from the Next app, no build step. CDN script tags are fine (jsPDF is the usual
   one) but the app has to degrade if the CDN is slow — see the `window.print()` fallback in
   the existing calculators.
2. Add a `ToolApp` entry to `TOOL_APPS` in `lib/tools.ts`. `tag: 'New'` puts a green chip on
   it; move the tag off the previous holder so only one app wears it.
3. Match the **Quiet Precision** tokens (`DESIGN.md`, workspace root; see also
   [design-language.md](design-language.md)). Every existing tool declares the light ladder as
   CSS variables at the top of the file — copy that block rather than inventing colors. These
   pages are light-only by design; they are print and PDF surfaces, not portal chrome. (One
   documented exception — the [Desiccant Dehumidification HMI](#desiccant-dehumidification-hmi) is a
   live screen, not a print surface, so it keeps a full light/dark toggle. See its section below.)

The IAT logo is a ~41 KB base64 PNG. Define it **once** as a `const LOGO` and set the header
`<img>` src from JS — the older tools inline the same string twice (markup + PDF), which is
where most of their file size comes from.

---

## Washdown Moisture Load Calculator

`/tools/washdown-load-calculator.html` — added 2026-08-05.

A 1:1 port of *IAT Washdown Load Calculator.xlsx*. It estimates the moisture a daily washdown
adds to a space, in grains/hr, which is the number that feeds desiccant unit selection.

**The premise that makes it correct:** the load is *not* the water you spray — most of that
drains away. It is only the water that **evaporates** into the room air. The tool estimates
that evaporation two ways and rolls each into the total space load.

### Method 1 — residual film (average across the drydown)

After washdown a thin film clings to surfaces and evaporates over the drydown period.

```
water loading (lb/ft²) = film (in) ÷ 12 × 62.4          62.4 lb/ft³ = density of water
water per event (lb)   = total wetted area × loading
average rate (lb/hr)   = water ÷ drydown time
moisture load (gr/hr)  = rate × 7,000
```

This is the **recovery basis** — size on it to recover the space after each washdown.

Film thickness is the single biggest driver, so it has preset chips: 0.003″ (smooth sealed,
squeegeed) · 0.005″ (fair drainage, the default) · 0.010″ (textured) · 0.015–0.020″ (rough or
poorly drained). Drainage and squeegee practice shrink the load more than any unit upsize —
that's a sales lever, not a footnote.

### Method 2 — peak evaporation (Carrier)

While surfaces are fully wet, evaporation runs at its instantaneous peak:

```
Pw = 0.61094 × exp(17.625 T ÷ (T + 243.04)) × 0.2953     Magnus, T in °C, result in. Hg
Pa = (same at room temp) × target RH
E  = A × (95 + 0.425 V) × (Pw − Pa) ÷ 1050               1050 Btu/lb = latent heat
```

This is the **hold-RH basis** — size on it when RH must hold straight through the wash.

### The caveat that keeps it honest

The peak only lasts until the residual film is gone, and the tool shows that window in
minutes (`water ÷ peak rate × 60`). With the workbook's own default inputs it is **13 minutes**,
and the peak basis is **9.1× larger** than the recovery basis. Sizing on the raw peak would
badly oversize the unit. Below 30 minutes the page raises an amber callout saying so, and the
recommendation line always defaults to the recovery basis unless a brief RH excursion is
unacceptable for the product or process. The same caveat is printed on the PDF.

### Guards

- **Water at or below the room's vapor pressure** (`Pw − Pa ≤ 0`) means condensation, not
  evaporation. Peak rate clamps to 0 and the callout says *"No evaporation"* rather than
  reporting a negative load.
- **Zero or blank drydown time** suppresses the Method 1 chain instead of dividing by zero.
- Any blank input renders `—`, never `NaN`.

### Verification

`WATER_DENSITY`, `GRAINS_PER_LB`, `LB_PER_GAL`, `LATENT_HEAT` and the Magnus coefficients are
the workbook's own constants — **don't "improve" them without changing the workbook too**,
because sales quotes off both. All twelve outputs were checked against the values the xlsx has
cached in its cells (2,640 + 1,030 ft², 0.005″ film, 90 °F water, 70 °F room, 70 % RH,
100 ft/min, 2 hr drydown) and match to floating-point exactness:

| | value |
| --- | --- |
| Total wetted area | 3,670 ft² |
| Water per washdown | 95.42 lb (11.44 gal) |
| Average rate | 47.71 lb/hr → **333,970 gr/hr** |
| Pw / Pa | 1.420 / 0.517 in. Hg |
| Peak rate | 434.20 lb/hr → **3,039,411 gr/hr** |
| Time at peak | 13.19 min |

### Output

**Download PDF** builds a one-page letter sheet with jsPDF: header band, project meta, the two
design-point figures, the inputs, both method chains, the peak caveat, and the
*confirm final sizing with IAT — 770-788-6744* footer. If jsPDF hasn't loaded it falls back to
`window.print()`.

---

## Desiccant Dehumidification HMI

`/tools/desiccant-wheel-hmi.html` — added 2026-08-06.

A live, clickable process-flow diagram of a desiccant unit (model IAT-3000RE-IDP-6000, 6,000 CFM),
rebuilt from an external prototype into Quiet Precision. Both airstreams run on a fixed 1440×840
schematic — **process** left-to-right through filter → pre-cool coil → wheel → bypass damper → supply
fan, and **reactivation** counter-flow right-to-left through filter → electric heater → the shared
wheel → exhaust fan. Click any component for a right-hand drawer with live readings, its control
signal (valve %, VFD %, SCR %…), and setpoint sliders; toggle power per-component or Start/Stop all.
Header stats (supply/exhaust CFM, moisture removed, power draw) and a reactivation high-limit alarm
recompute live, and active ducts animate flow. All values come from a small in-file physics model
(`DERIVE` / `AIR` / `SIGNAL`) — it is a demonstration/training HMI, not wired to a real panel.

### Two deliberate exceptions to the static-tool convention

Unlike the calculators, this is a **live screen, not a print/PDF surface**, so it intentionally
departs from "light-only" in two places — don't "fix" either:

1. **It keeps a light/dark toggle.** Both themes are the DESIGN.md ladders in full (light warm
   canvas; dark cool-graphite surface ladder). Default is light so it lands looking native. The
   header logo swaps `/iat-logo.png` ⇄ `/iat-logo-white.png` on toggle (these tools are always
   portal-served under `/tools/*`, so the absolute asset paths resolve — this one does **not** inline
   a `const LOGO` base64, and is not meant to be opened standalone via `file://`).
2. **The schematic artboard keeps two functional flow hues** (process teal / reactivation warm),
   the same deliberate token exception the [Application Diagram Studio](diagram-studio.md) artboard
   makes — the colors encode airflow direction, which is meaning, not decoration. Everything else
   (chrome, cards, drawer, pills, type) is strict Quiet Precision. Equipment-icon fills are driven
   by CSS tokens (`.ic-body`, `.ic-accent-*`, `.ic-wheel-*`, …) so the icons retheme live on toggle
   instead of being rebuilt in JS.

No jsPDF, no CDN dependencies, no `window` globals beyond the sim. No new perm or migration — the
`/tools/*` middleware already gates it to signed-in staff.
