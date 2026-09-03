# RFQ step 5 — the live envelope panels

**Live:** `/support/rfq`, the *Construction* step · **Shipped:** 2026-08-28 · **No migration**

Three animated cross-sections sit above the material dropdowns — walls on the left, roof in the
middle, floor on the right. Each rebuilds layer-by-layer when its dropdown changes, and animated
droplets show roughly how much moisture that assembly lets through. They replaced the three
static *Good / Better / Best* cut-away photos.

Why: envelope questions are the ones customers guess at. The photos showed three build-ups we
happen to see often; the panels show **the customer's own** three surfaces, and make the vapor
retarder do something visible instead of being an abstract dropdown.

---

## What is real and what is drawn

This distinction is the whole safety story, so it is worth being blunt about.

**Real, and shared with the calculation.** Every permeance the panels show comes from
`WALL_MATERIALS` / `CEILING_MATERIALS` / `FLOOR_MATERIALS` in `lib/rfq.ts`, resolved through
`retarderPermOf()` and `assemblyPermOf()` — the same two exported functions `estimateLoad()`
calls. There is exactly one definition of the retarder rule and one of the series formula
(`1/P = 1/P_material + 1/P_retarder`). The picture cannot disagree with the quote.

**Drawn, and feeds nothing.** The layer build-ups in `lib/rfq-envelope-art.ts` — brick veneer,
foam core, granular base and so on — are an illustrator's guess at a plausible construction for
each material. They are not specifications, have not been through engineering review, and no
calculation reads them. Their thicknesses are relative and normalized at render time.

**The droplet rate is not a flux.** Real flux across these assemblies spans about 2,700:1. At the
tight end that is one droplet every few minutes, which reads as broken rather than as tight, so
the rate is compressed and capped: `(P / 3.0)^0.85`, clamped to 2–100%. It is anchored on 3.0
perm — the Class III / vapor-open end — rather than the 116-perm fabric extreme, because against
116 every ordinary assembly bunches at zero and all three panels look identical. Ordering is
preserved; magnitude is not. The pill next to each panel shows a plain-language band
(*Near vapor-tight* … *Very vapor-open*) with the numeric permeance on hover.

## How each panel is drawn

An extruded slab seen slightly from above: the front face carries the layer bands, a top or side
face gives it thickness. Each panel has its own axis and its own direction of travel.

| Panel | Layers run | Moisture travels | End labels |
|---|---|---|---|
| Walls | left → right | left → right | Outside → Inside |
| Roof / ceiling | top → bottom | top → bottom | Outside → Room |
| Floor | top → bottom | **bottom → top** | Ground → Room |

⚠️ **The floor inverts.** Its stack is stored room-side first, so drawing it in array order
correctly puts the slab on top and the subgrade at the bottom — which means moisture has to climb
the stack backwards, from the ground up into the room. That is `dir: -1`. Get this wrong and the
floor reads as though the room were underground.

Where a blocked droplet stops is drawn from the resistances in the stack, so the retarder
visibly does the work whenever it is the larger resistance. Its position in the drawing is
per-surface and **cosmetic**: walls and roofs show it just inside the innermost finish, a floor
shows it directly under the slab, which is where a slab vapor barrier actually goes. The
permeance reaching the arithmetic is identical either way.

## Deliberate departures from DESIGN.md

Both signed off by the owner on 2026-08-28, because here the motion *is* the content.

- **The build runs ~2.7s**, well outside the 120–200ms window. Speed was chosen after reviewing
  it on a slider from 0.4× to 3×; 3.0× won. The four numbers live in `T` at the top of
  `EnvelopePanels.tsx` and are the entire speed control.
- **The droplets loop**, which "nothing loops" otherwise forbids.

Both stop completely under `prefers-reduced-motion`, and the whole animation is suspended by an
`IntersectionObserver` while the panels are scrolled out of view.

The material patterns are **hex literals, not semantic tokens** — brick is brick-colored, and
re-toning materials for dark mode would misrepresent them. The artwork keeps its own light
ground in dark mode, exactly as the cut-away photos it replaced did. The chrome around the
drawing (card, borders, type, pills) uses tokens like everything else.

## Rolling back to the stills

The three photos are still in `public/rfq/` (`shell-good.webp`, `shell-better.webp`,
`shell-best.webp`) precisely so this stays small. **"Roll back to the stills"** means:

1. In `components/support/RfqWizard.tsx`, restore the `SHELL_EXAMPLES` const — the doc comment
   where it used to sit points here — and the `sm:grid-cols-3` figure grid that mapped over it,
   with the 2× hover magnifier and the per-column `transform-origin`. Both are in git history:
   `git show 8e163a1:components/support/RfqWizard.tsx` is the last revision that had them.
2. Replace `<EnvelopePanels data={data} reduced={!!reduce} />` with that grid, and put the
   overline back to *Typical wall build-ups*.
3. Drop the `EnvelopePanels` import, and `const reduce = useReducedMotion()` from `StepShell` if
   nothing else there uses it.
4. Delete `components/support/EnvelopePanels.tsx` and `lib/rfq-envelope-art.ts`.

⚠️ **Do not revert `lib/rfq.ts`.** `retarderPermOf()` and `assemblyPermOf()` were extracted from
inside `estimateLoad()` in the same change and are used by the load calculation itself. The
extraction was verified result-identical across 16,650 surveys. Leave them.

If instead you want **both** — panels plus the photos as a smaller identification reference —
that is an addition, not a rollback: the photos help a customer who does not know what their wall
is *identify* it, which is a different job from showing the consequence of a wall already picked.
