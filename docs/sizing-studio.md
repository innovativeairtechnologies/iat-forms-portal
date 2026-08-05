# Sizing Studio

`/admin/sizing-studio` — enter a job's design conditions, get a recommended IAT unit, the
predicted leaving-air condition, the moisture-removal duty and the reactivation energy, plotted
on a live psychrometric chart.

The page is a **pure calculator**: no database reads, no writes, no server actions. The selection
maths happens client-side and recalculates as you type.

One server round trip exists, and only on request: **Verify with DryWare** runs the selection
through DryWare's real wheel-performance model and returns the actual leaving condition, the
optimised rotation speed and the pressure drop. See *Verifying against DryWare* below. It still
writes nothing.

---

## What is exact, and what is not

This distinction matters more than anything else in this document.

**Exact — the psychrometrics.** `lib/psychro.ts` implements ASHRAE Fundamentals (2017) Chapter 1
in IP units: saturation vapour pressure over water *and* ice, humidity ratio, grains, dew point,
wet bulb, enthalpy, specific volume, barometric pressure vs. altitude, and adiabatic mixing.
It is verified against published table values (see *Verification* below).

**Exact — the wheel geometry.** Since the DryWare port, unit sizes, wheel diameters, depths and
effective face areas are the real product data, not estimates (see *The product catalog*).

**Preliminary — the desiccant-wheel performance, until you verify.** The Studio's *local* engine
uses planning coefficients, because DryWare's product API gives geometry but not performance
curves. Since 2026-08-05 the real curves are reachable on demand: **Verify with DryWare** calls
DryWare's own wheel model and replaces the estimate with engineering-grade numbers for that one
selection. Unverified results remain planning figures and are stamped **Preliminary**.

The planning coefficients the local engine falls back on:

| Wheel | Depth | Moisture removed | Floor |
|---|---|---|---|
| Standard | 200 mm | 80% of entering grains | 3 gr/lb |
| High-capacity (`HC`) | 400 mm | 90% of entering grains | 1.5 gr/lb |

…derated by the reactivation heat source, because a lower regeneration temperature genuinely
cannot drive the wheel as dry:

| Reactivation | Temp | Removal factor | Source |
|---|---|---|---|
| Electric / Gas | 285 °F | 1.00 | DryWare default |
| Steam | 250 °F | 0.95 | planning figure, unconfirmed |
| Hot Water | 190 °F | 0.70 | planning figure, unconfirmed |

An unverified result is stamped **Preliminary** in the UI and in the copied summary; a verified
one is stamped **Verified** and the summary says so. Engineering still confirms before anything
goes on a submittal.

⚠️ **The planning coefficients are materially conservative.** On the default 2,000 CFM case the
local engine predicts 15.56 gr/lb leaving where DryWare's model returns **7.58 gr/lb** — the real
wheel removes closer to 90% than the 80% assumed. Practically, that means the Studio has been
**over-sizing**, and it may have recommended a high-capacity wheel (a real cost adder) on jobs a
standard wheel would meet, or flagged a reachable target as out of reach. Verify before quoting.

`predictLeavingState()` in `lib/sizing.ts` is still the only place wheel behaviour is modelled
locally. It was deliberately **not** replaced by the DryWare call: the local engine has to stay
synchronous and instant so the page recalculates as the rep types, and the upstream takes ~2 s per
call. Verification reconciles against it instead of replacing it.

---

## How the selection works

1. **Resolve the conditions.** Entering, target and outdoor air are each entered as dry-bulb plus
   *one* of relative humidity, dew point, or grains — all three modes resolve to the same
   internal state, at the site's barometric pressure.
2. **Mix in outside air.** Return and outdoor air are mixed by mass to get the true condition
   entering the wheel. This is the most common reason a "room condition" sizing comes out
   undersized.
3. **Pick the wheel.** On `Auto`, a high-capacity wheel is selected *only* when a standard wheel
   cannot reach the target — an HC wheel is a real cost adder, not a free safety margin.
4. **Predict the leaving air.** Moisture drops per the coefficients above. Temperature is
   modelled as **adiabatic**: the latent heat the air gives up reappears as sensible heat, so the
   process runs up a line of constant enthalpy and the air leaves much drier *and much hotter*
   (typically 120 °F+). Real units run slightly warmer still, from reactivation heat carryover.
5. **Size the airflow.** Two independent requirements, and the unit must satisfy both:
   - *Circulation* — stated directly, or room volume × air changes ÷ 60.
   - *Load* — the airflow needed to carry away the total moisture load (outside-air load +
     internal generation) given the drying this unit achieves.

   `required = max(circulation, load)`. When the load governs, the UI says so.
6. **Select the size.** The smallest catalog size at or above the requirement. Above 30,000 CFM
   it proposes multiple units.
7. **Reactivation duty.** Reactivation airflow is ⅓ of process airflow (planning default), heated
   from the outdoor condition to the regeneration temperature. Reported as BTU/hr and converted
   to kW, gas CFH, or steam lb/hr to match the selected heat source.

**Altitude is handled throughout.** At 5,280 ft the air is ~17% less dense, so the same CFM
carries proportionally less moisture — and the chart's own curves shift, because they are drawn
from the same physics at the same pressure.

---

## The product catalog

`lib/sizing-catalog.ts` is transcribed from **DryWare's own product API** —
`/api/Product/getProductsForProductType?id=4` — the same catalog DryWare's wheel calculator
matches against. Each entry carries the real `wheelDiameterMm`, `wheelDepthMm` and
`effectiveAreaFt2`, not derived values.

> ⚠️ **There is no 25,000 CFM product.** An earlier version of this file carried one, taken
> from the size list on the 2022 nomenclature sheet, flagged "build to order". The product
> data has **13 CFM values / 14 SKUs** (600 ships as both `IAT-600` and `IAT-600REC`, same
> geometry) and 25,000 is not among them — a ~22,000 CFM job correctly selects the 30,000 unit.
> Where the nomenclature sheet and the API disagree, **trust the API**: the sheet lists
> *nomenclature* sizes, not shipping products.

Keep this in sync with `scripts/kb-reference/iat-unit-nomenclature.md` (prose, so Jerry answers
correctly) — but the API is the authority for what actually ships.

### Face velocity picks the wheel

The catalog makes a design rule measurable instead of assumed: every rotor from 1,000 CFM up sits
in a tight **530–580 fpm** band through the 270° process sector at its nominal airflow (the
compacts deliberately run slower, 240–500). `MAX_DESIGN_FACE_VELOCITY_FPM = 600` is the top of
that observed band, and the Studio warns when a job pushes a unit past it — too fast leaves the
air too little residence time in the desiccant and raises pressure drop.

### HC is a rotor of double the depth

DryWare's rotor catalog (`productTypeId=19`, 24 rotors) offers **100 / 200 / 400 mm** depths. A
high-capacity wheel is physically a rotor of **twice the standard depth** — roughly double the
air-to-desiccant contact time. That is why HC dries deeper; it was previously modelled here as an
abstract efficiency bump.

⚠️ **The base depth is per size, not a constant.** Most of the line is 200 mm (so HC = 400 mm), but
**IAT-75REC and IAT-150REC ship a 100 mm rotor** (so HC = 200 mm). `selection.wheelDepthMm` used to
return `WHEEL_SPECS[wheel].depthMm` — a flat 200/400 — which mis-labelled the two compacts on
screen and, once it started feeding DryWare's performance engine, produced confidently wrong
verified numbers: a 100 CFM job came back ~2 gr/lb drier than reachable at double the true pressure
drop, under a green **Verified** pill. It now reads the catalog row's own depth.

The lesson generalises: a test that asserts the payload equals the field it was copied from is
tautological. `verify-desmod.mjs` now asserts rotor depths as **literals** per size.

The file also holds the series (Compact / Rotor / IDP), reactivation letters (`E`/`S`/`G`/`HW`),
the `HC` wheel flag, and a model-number **builder and parser**:

```
IAT-<nominalCFM><system><reactivation>[HC][C][-IDP][-<actualCFM>]
```

`parseModelNumber()` decodes any IAT model number and returns `valid: false` rather than throwing
on a mistyped one — useful beyond this page, since the equipment registry stores `model_number`
as free text.

---

## Verification

Two scripts, no build step (Node ≥22.18 strips TypeScript types on import):

```bash
node --import ./scripts/ts-resolve.mjs scripts/verify-psychro.mjs
```
```bash
node --import ./scripts/ts-resolve.mjs scripts/verify-sizing.mjs
```

- **`verify-psychro.mjs` — 40 checks** against published ASHRAE values: saturation pressure
  (including the boiling point at 212 °F, which must return exactly 1 atm), chart points,
  ice/water branch continuity at 32 °F, round-trip identities across all three input modes, and
  guard rails on bad input.
- **`verify-sizing.mjs` — 120 checks** on the engineering logic AND the catalog data: every worked
  model-number example, all 224 build→parse combinations, size-selection boundaries, directional
  sensitivity (more outside air → bigger unit; deeper target → HC wheel; altitude → more airflow),
  multi-unit selection, a 648-case sweep asserting the wheel never adds moisture / never cools /
  never returns NaN, and — since the DryWare port — the catalog itself: no phantom 25,000 unit,
  real geometry on every row, the 525–585 fpm face-velocity band, HC = 400 mm, react = 285 °F.

  > The catalog checks exist because a **full catalog rewrite once passed all 66 earlier checks**.
  > The suite was testing the engine and never the data it selects from. They are mutation-tested:
  > reintroducing a 25,000 unit, reverting HC depth, or corrupting an effective area each trip
  > multiple failures.

- **`verify-desmod.mjs` — 63 checks** on the DryWare verification path: that the request we build
  matches what DryWare's own client would send (the velocity formula is restated independently
  rather than imported, so a drift in `faceVelocityFpm()` fails here instead of silently agreeing),
  the sanity envelope, the response guard against every captured failure shape, reconciliation, and
  a **live round-trip** that pins the real endpoint's answer for a known payload.

  > The response guard is **mutation-tested**: a known-good payload is corrupted seven ways —
  > `passwordOk` flipped, the headline output removed, a number replaced with a string — and each
  > must be rejected, plus a control asserting the unmutated payload still passes. A guard that only
  > ever sees good input passes a suite that proves nothing.

  Run with `--offline` to skip the live round-trip.

A useful independent signal: reactivation works out to **~2,246 BTU per lb of water removed** on
the baseline job — mid-band of the 1,500–2,500 that desiccant systems typically run, a figure the
engine has no knowledge of. The engine warns if a job falls outside that band.

> If a check fails, **verify the reference value before changing code.** During the initial build
> three reference values were wrong and the implementation was right.

### Seeing the chart

The page is behind the admin auth gate, and SVG geometry fails silently — a bad coordinate
transform typechecks and builds perfectly while drawing nonsense. To eyeball it:

```bash
node --import ./scripts/ts-resolve.mjs scripts/preview-psychro-chart.mjs
```

That server-renders the **real** `PsychroChart` component against five scenarios (baseline, deep
dry, heavy ventilation, altitude, sub-freezing) into `../claude-design/psychro-chart-preview.html`,
wrapped in the real Quiet Precision tokens with a light/dark toggle.

`scripts/ts-resolve.mjs` is the loader hook that makes all of the above work: it teaches Node the
`@/*` alias and extensionless imports, and transpiles `.tsx` (Node strips types but cannot
transform JSX).

---

## Verifying against DryWare

`POST /api/admin/sizing/verify` → `lib/desmod.ts` (pure) + `calculateDesiccantPerformance()` in
`lib/dryware-sizing.ts` (the fetch).

DryWare exposes its real wheel engine — internally a separate service it calls "DesMod" — at
`POST /api/DesiccantCalculator/calculate`. The portal sends one calculation per explicit user
click and reconciles the answer against the local estimate. **The local numbers are not
overwritten**: the gap between the two is itself useful, because it shows how much margin the
planning coefficients were carrying on that job.

What comes back that the Studio cannot compute at all: **pressure drop** (process and
reactivation, in. w.g.) and a genuinely **optimised RPH** — the local engine only ever reported a
mid-range placeholder.

**The client posts inputs only.** The selection is recomputed server-side against the live catalog,
so a caller cannot hand the route a forged unit or airflow and get an authoritative-looking answer
back for it.

### Three hostile properties of the upstream

These are verified by live probe, not assumed, and each one shapes the code:

1. **Every failure is HTTP 200** — including a zero-byte body, an `{errorMessage}` envelope, and
   the DTO echoed back with `passwordOk:false`. A `res.ok` check reports SUCCESS on total failure,
   the same class of bug as the middleware-swallows-`/api` trap. `readDesmodResponse()` is the only
   thing that decides whether a calculation happened; it requires `passwordOk === true` **and** an
   empty `error` **and** the presence of every headline output.
2. **The upstream is single-threaded** — ~1.9 s per call, strictly serialised (8 parallel calls
   returned at 2.1 s … 12.8 s). So: one call per click, never a catalog sweep, a per-user rate
   limit, and a deterministic in-memory cache keyed on the full request.
3. **It validates nothing** — a 9,999 fpm face velocity returns a confident extrapolated answer.
   `validateDesmodRequest()` owns the sanity envelope. It deliberately allows velocities *above*
   the 600 fpm design ceiling (an engineer may want to look at an over-velocity case) but refuses
   anything past 1,200 fpm, where the answer stops being physics.

Also: with `autofillPurgeOutletToReactInlet: true` the server **rewrites request fields** in its
echo. Never read an input back off the response — `pickResponse()` only ever reads `*Out` fields.

### Risk

Unlike the product catalog, **there is no local fallback for the physics.** If DryWare puts this
endpoint behind a login the feature dies rather than degrades — the page falls back to showing the
preliminary estimate, which is the pre-2026-08-05 behaviour. This is why verification is an
internal `/admin` action and not part of any customer-facing flow.

`scripts/verify-desmod.mjs` pins the live response for a known payload, so upstream drift fails
loudly:

```bash
node --import ./scripts/ts-resolve.mjs scripts/verify-desmod.mjs
```

Add `--offline` to exercise only the pure logic. The suite includes mutation tests that corrupt a
known-good response and assert the guard rejects each one — a guard that only ever sees good input
passes a suite that proves nothing.

---

## Access

Gated by the `sizing` permission, which is **admin-only by omission** from `DEFAULT_ROLE_PERMS` —
the same approach as the SRV editor. No `role_permissions` seed and no migration are needed, and
`check-perm-seed` stays green.

Sales is the obvious next audience. Granting it requires a migration
`INSERT INTO role_permissions (role, perm) VALUES ('sales','sizing')` **and** adding it to
`DEFAULT_ROLE_PERMS`, or the prebuild gate will fail — see `docs/roles-and-permissions.md`.

---

## Not built yet

- **Submittal PDF** — note `lib/pdf.ts` is *not* a usable starting point: it is one monolithic
  function with no tables, no running header, no logo, and A4 rather than letter. The real
  precedent is `public/tools/washdown-load-calculator.html` / `burner-selection-guide.html` —
  jsPDF with a base64 logo, hand-rolled column tables (`jspdf-autotable` is not installed) and a
  disclaimer footer.
- **Saving a run** — the Studio persists **nothing**: no table, no migration, not even
  `localStorage`. The only way a selection leaves the page today is the clipboard. Anything that
  needs to reference a saved selection has to create the storage for it.
- **Attach to a deal** — must land in a **portal-owned** column or its own table. Note the sync is
  an *upsert*, not the wipe-and-reload this doc previously claimed: `drywareFields()` in
  `lib/dryware-deals.ts` is an 11-column allowlist and every other column survives, so a new column
  would too. There is still no deal-documents table or bucket, and no deal→equipment link.
- **Real rotor curves, locally** — the DryWare verification above covers this on demand, but the
  local engine's own coefficients are still the conservative planning figures. Correcting them
  (or caching verified results to calibrate them) is unbuilt.
- **Customer-facing "size my project"** as a lead-gen front door. Note this could not use the
  DryWare verification: the dependency is unauthenticated and has no fallback, so it stays internal.
