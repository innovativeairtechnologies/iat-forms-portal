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
   pages are light-only by design; they are print and PDF surfaces, not portal chrome. (Two
   documented exceptions — the [Desiccant Dehumidification HMI](#desiccant-dehumidification-hmi) and
   the [Damper Flow Model](#damper-flow-model) are live screens, not print surfaces, so both keep a
   full light/dark toggle. See their sections below.)

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

---

## Damper Flow Model

`/tools/damper-flow-model.html` — added 2026-08-10.

An interactive model of a **TAMCO Series 1000 Air-Foil Control Damper** (SP / NP / WP). It replaces a
one-way "type CFM, read pressure drop" calculator with something you drive: a blade-angle slider
moves a live section view and a face view, and free area, pressure drop, loss coefficient and the
ΔP→CFM K-factor all move with it. Like the HMI it keeps a light/dark toggle and swaps the header
logo, for the same reason — it is a screen, not a print sheet.

Two modes off one physics core:

- **Select** — size the damper. Face velocity, pressure drop, leakage class, blade-length limit,
  section-size and install-type checks.
- **Measure** — use the damper as a flow element. Lock a blade angle, get the K for `CFM = K√ΔP`,
  fit a real K from field-measured points, and export IEC 61131-3 structured text for the PLC so the
  HMI can display CFM from a differential-pressure transmitter.

### The model

Face velocity is `CFM ÷ (W×H/144)`; velocity pressure is `(V/4005)² × (ρ/0.075)`, where 4005 is the
standard-air constant TAMCO's own data assumes. Blade angle enters through free area — blades are
pitched to fill the height, so with `n` blades the projected blockage is `n·(b·cosθ + t·sinθ)` and

```
α(θ)  = 1 − cosθ − (n·t/H)·sinθ            0 at closed, 1 − n·t/H at full open
C(θ)  = C_size + C_blade·((α_open/α)^p − 1)        returns C_size exactly at 90°
K     = 4005·A ÷ √(C(θ)·ρ/0.075)           A in ft², ΔP in in. w.g.
```

`p` is the free-area **exponent** (2, the orifice default) and has nothing to do with `n`, the blade
count — raising the free-area ratio to the blade count instead of to 2 is an easy and badly wrong
mistake. `W` is **parallel** to the blades and therefore *is* the blade length, which is the
dimension the blade-length limit applies to.

Leakage is derived rather than fitted: every AMCA class in TAMCO's table is precisely `base × √ΔP`
cfm/ft² with base = 3, 4, 10, 40 for classes 1A, 1, 2, 3. That reproduces all **thirteen** published
numeric cells to TAMCO's own rounding (class 1A is rated at 1 in. w.g. only, so its other three cells
read n/a). It is evaluated at the **system design static pressure** (a rail input, defaulting to
1 in. w.g., the AMCA rating basis) because leakage is a closed-damper property — not at the damper's
own open-position drop, which is a different and much smaller number.

### Four things this tool is careful about

1. **The loss coefficient is a property of the size, not just the profile.** This is the big one, and
   it is what the calculator this tool replaces got wrong. AMCA Fig. 5.3 is **five separate curves**,
   not one: implied C spans roughly **0.18 to 0.70 for SP** and **0.30 to 1.04 for NP**, falling
   steadily as the opening grows, because frame and blade edges block a much larger fraction of a
   small opening. WP's published table shows the same thing more mildly, 2.17 to 2.60. A single
   blanket coefficient is about **2× wrong in the middle of the range** — the inherited 0.45 tracked
   the 48×12 curve, so a 36×24 read roughly double its true pressure drop and its K was ~30% low.
   `PERF` holds the per-size values for all three profiles and `nearestSize()` resolves in log space.

2. **The WP number is not the damper.** TAMCO's WP data (p.6) is a *plenum* test. Its
   "Damper & System" column — the one a coefficient can be derived from — is dominated by the
   opening's own entry loss, and the **"Damper Only" column is negative in all thirty published rows**
   (−0.003″ to −0.271″ w.g.): the air-foil blades cost *less* than the bare hole. The page labels the
   WP readout as damper + plenum opening. Never quote it as the damper's loss.

3. **Provenance is tracked, not assumed.** WP full-open comes from a published table. SP and NP
   full-open were **read off a log-log chart by eye** — three independent readings agreed within
   ±0.02 on four of the five SP curves, but the lowest (36×36) spanned 0.12–0.24, so it carries about
   ±30%. Nothing in the UI calls SP or NP "certified"; the pill, the chart legend, the angle hint and
   the exported summary all say chart-read.

4. **Everything off full open is modeled.** TAMCO publishes nothing for partly-closed blades — which
   is exactly why no manufacturer offers a universal partial-open K for rectangular dampers. Near
   closed the orifice term runs to infinity while a real damper simply leaks at its AMCA class, so
   `crossoverAngle()` **solves for** the angle where the modeled path passes less than the seals
   leak (~11–13° on the shipped default) and marks everything below it as not physical.

### The calibration path is guarded

The K is the number that ends up in a PLC, so the Measure side refuses to hand over one it cannot
stand behind:

- **Points are stamped** with `{profile, action, W, H, angle}`. Move the blades or change the damper
  and the fitted K is retired rather than silently relabelled to the new geometry — a K belongs to
  one blade position only, which is the whole premise of the method.
- **The fit is judged on worst-point error (≤3%), not R².** For a fit forced through the origin the
  centered R² does not decompose: a tap with a constant offset gives a beautifully straight line that
  misses the origin, scoring R² 0.985 while the worst point is 12% out. Verified — that exact case is
  now caught. R² is still shown, but in its uncentred through-origin form and labeled as such.
- **A shut damper exports no constant.** `K_FLOW := 0.0` would be a valid-looking number that reads
  zero CFM for ever, so the PLC card is replaced with an explanation instead.
- **Air density reaches the exported K**, not just the displayed ΔP. At 200 °F reactivation air
  (ρ ≈ 0.0602) ΔP falls to 0.803× and K rises to 1.116×; the emitted structured text carries a
  non-standard-density comment.

### The Assumptions panel is the point

Every number *not* taken from TAMCO is exposed as an editable field at the bottom of the page, tagged
**Measured** (certified test data), **Chart-read** (SP/NP full-open C, read by eye off the AMCA
Fig. 5.3 curves because no table exists), or **Modeled** (blade thickness, free-area exponent, air
density). Editing any of them recalculates the page.

The four coefficient fields are **overrides, not values**: left blank they resolve to the nearest
tested size and the placeholder shows what is in use, so clearing a field restores size-awareness
rather than pinning whatever was last typed. Pinning one raises a check saying how far it sits from
the size-matched value.

One coupling worth knowing: **the SP coefficient also drives WP's partly-closed behavior.** WP's
published number is a plenum-entry loss that does not scale with blade angle, so the incremental
throttling is modeled on the same 6″ air-foil blade at the same size — pin SP and WP moves too. The
exported summary states this.

**Copy review summary** dumps the whole state — inputs, results, every assumption with its provenance
tag, and every check — as plain text to paste into a review. The tool was built to be argued with.

### Sources and verification

TAMCO *Series 1000 Submittal & Performance Data* (TA-1000-TECH-24, April 2017) and *Aluminum Control
Damper Installation Guidelines* (TA-IOM-CD-24, 2020).

Verified in headed Playwright runs against the `tools-preview` launch config: the free-area maths
(drawn face free-area 0.8999 against 0.9000 modeled), the size-resolved coefficient at all five
tested sizes, keyboard entry into the calibration table, the tap-offset case, stamp invalidation when
the blades move, the crossover solve, density scaling of both ΔP and K, and a NaN/Infinity sweep from
3×3 to 200×200.

The whole tool was then put through a ten-agent adversarial audit against the source PDFs — four
independent lenses (data transcription, physics, claims, code robustness), each finding attacked by a
refuter whose default was that it was wrong. It confirmed all 30 WP table values, the leakage
identity, every geometry constant, the max-size logic and the core algebra, and it caught the
size-dependence error described above.

**Two bugs carried over from the source calculator were fixed here:**

1. The maximum **section** size is 25 ft² **and** (60″w × 60″h **or** 48″w × 75″h). The original
   checked `w > 60 || h > 75`, which passed a 60 × 70 that TAMCO does not allow. (Note this is
   section size — the finished O.D. is separately larger or smaller per install type, so a legal
   60 × 60 flanged opening correctly reports a 62 × 62 finished O.D.)
2. The single blanket loss coefficient, described above.

No jsPDF, no CDN dependencies beyond the Google Fonts link. No new perm or migration — the
`/tools/*` middleware already gates it to signed-in staff.
