# Sizing Studio

`/admin/sizing-studio` — enter a job's design conditions, get a recommended IAT unit, the
predicted leaving-air condition, the moisture-removal duty and the reactivation energy, plotted
on a live psychrometric chart.

The page is a **pure calculator**: no database reads, no writes, no server actions. All the work
happens client-side and recalculates as you type.

---

## What is exact, and what is not

This distinction matters more than anything else in this document.

**Exact — the psychrometrics.** `lib/psychro.ts` implements ASHRAE Fundamentals (2017) Chapter 1
in IP units: saturation vapour pressure over water *and* ice, humidity ratio, grains, dew point,
wet bulb, enthalpy, specific volume, barometric pressure vs. altitude, and adiabatic mixing.
It is verified against published table values (see *Verification* below).

**Exact — the wheel geometry.** Since the DryWare port, unit sizes, wheel diameters, depths and
effective face areas are the real product data, not estimates (see *The product catalog*).

**Preliminary — the desiccant-wheel performance.** DryWare's product API gives geometry but *not*
performance curves. Grain depression vs. entering condition vs. reactivation temperature vs. RPH
still lives in the DryWare wheel calculator and engineering's selection charts. Until those land,
the Studio uses planning coefficients:

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

Every result is stamped **Preliminary** in the UI and in the copied summary. Engineering confirms
rotor performance before anything goes on a submittal.

**When the real curves arrive, replace `predictLeavingState()` in `lib/sizing.ts` and nothing
else moves.** That function is the only place wheel behaviour is modelled.

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

### HC is a 400 mm rotor

DryWare's rotor catalog (`productTypeId=19`, 24 rotors) offers **100 / 200 / 400 mm** depths, and
every standard IAT unit ships a 200 mm rotor. So a high-capacity wheel is physically a **400 mm
rotor** — double the depth, roughly double the air-to-desiccant contact time. That is why HC dries
deeper; it was previously modelled here as an abstract efficiency bump.

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
- **`verify-sizing.mjs` — 86 checks** on the engineering logic AND the catalog data: every worked
  model-number example, all 224 build→parse combinations, size-selection boundaries, directional
  sensitivity (more outside air → bigger unit; deeper target → HC wheel; altitude → more airflow),
  multi-unit selection, a 648-case sweep asserting the wheel never adds moisture / never cools /
  never returns NaN, and — since the DryWare port — the catalog itself: no phantom 25,000 unit,
  real geometry on every row, the 525–585 fpm face-velocity band, HC = 400 mm, react = 285 °F.

  > The catalog checks exist because a **full catalog rewrite once passed all 66 earlier checks**.
  > The suite was testing the engine and never the data it selects from. They are mutation-tested:
  > reintroducing a 25,000 unit, reverting HC depth, or corrupting an effective area each trip
  > multiple failures.

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

## Access

Gated by the `sizing` permission, which is **admin-only by omission** from `DEFAULT_ROLE_PERMS` —
the same approach as the SRV editor. No `role_permissions` seed and no migration are needed, and
`check-perm-seed` stays green.

Sales is the obvious next audience. Granting it requires a migration
`INSERT INTO role_permissions (role, perm) VALUES ('sales','sizing')` **and** adding it to
`DEFAULT_ROLE_PERMS`, or the prebuild gate will fail — see `docs/roles-and-permissions.md`.

---

## Not built yet

- **Submittal PDF** — follow the `lib/pdf.ts` jsPDF pattern; the burner tool is the precedent for
  a submittal-ready output.
- **Attach to a deal** — must land in a **portal-owned** column. The DryWare sync wipes and
  reloads DryWare-keyed deals on every run, so anything written to a synced column is lost. There
  is no deal-documents table or bucket yet.
- **Real rotor curves** — see the top of this document.
- **Customer-facing "size my project"** as a lead-gen front door.
