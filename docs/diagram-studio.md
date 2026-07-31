# Application Diagram Studio

`/admin/diagram-studio` — build the airflow figure that goes into a proposal. Pick the
application, edit every condition on the drawing, drop in a photo of the space, export a PNG.

The page is **pure client-side**: no database reads, no writes, no server actions. Work autosaves
into the rep's own browser and travels between people as an exported `.json` file. Nothing about
a figure exists on the server.

Perm: `diagrams` — seeded for **sales**, **engineering** and **marketing** in migration 073.

---

## The one thing to understand first

**The application dropdown changes the layout, not just the numbers.**

Each application is a *template*: its own equipment blocks, its own airflow paths, its own set of
value cards. A hospital OR is a desiccant DOAS bolted onto an existing air handler. An ice arena
is a recirculating loop with no air handler at all. A battery dry room is a three-stage
precool → desiccant → post-cool train. Switching applications genuinely redraws the figure, which
is why it asks before discarding your edits.

Inside a template a rep edits **content** — every value, title, label, colour, the photo, and
where the cards sit. A rep does **not** re-plumb the equipment: block positions and airflow arrows
are fixed by the template. That boundary is deliberate (see *Limits* below).

Templates that ship today:

| Application | Shape |
|---|---|
| Hospital operating rooms | Desiccant DOAS ahead of an existing AHU — reheat eliminated |
| Pharmaceutical coating suite | Same hybrid train, tuned for a repeatable grain depression |
| Ice arena | Recirculating unit, overhead distribution, no AHU |
| Battery dry room | Three-stage train at −40 °F DPT |
| Cold storage dock | Dries the vestibule so moisture never rides through the door |
| Natatorium / indoor pool | Perimeter supply protecting glass and structure |

---

## The numbers are not calculated

**Every value on the figure is typed in.** The studio is a drawing tool, not a psychrometric
engine — it does no thermodynamics and validates nothing. The values a template ships with are
plausible design conditions for that application, put there so a rep starts from a filled-in
figure rather than a blank one. **They are placeholders and must be replaced with the numbers for
the actual job.**

If you want the psychrometrics computed, that is [`/admin/sizing-studio`](sizing-studio.md) —
size the unit there, then type the results in here. Wiring the two together (push a sizing result
straight onto a figure) is the obvious follow-up and nobody has asked for it yet.

---

## Using it

**Click anything on the drawing to edit it.** Value cards, labels and equipment all select, and
the **Selection** tab of the right-hand rail fills in with that element's settings. Cards and
labels **drag** to reposition; a selected card with a leader line also shows a draggable dot at
the far end of the leader.

The rail's other two tabs:

- **Figure** — figure number, title, the right-hand eyebrow, the photo, the footer abbreviation
  key, the airflow key, and the background grid.
- **Elements** — every card and label in one list (click to jump to it), plus **Add**. New value
  cards land in the middle of the artboard; drag them where they belong.

**The photo** is the block in the room position. Upload replaces it; it is downscaled to 1400px
and JPEG-encoded on the way in. HEIC will not decode in a browser canvas — convert to JPEG first.
The caption underneath is edited with the photo.

**Exports:**

| Button | What you get |
|---|---|
| **Download PNG** | 4000 × 2300 (2× the artboard) — this is the one for proposals, Word and PowerPoint |
| **SVG** | Vector, for anyone who needs to scale or edit it downstream |
| **Save file** | The figure as `.json` — the only way to hand work to a colleague |
| **Open** | Load a `.json` back in |

The selection outline never appears in an export.

---

## Where the work lives

Autosave writes to `localStorage` under `iat.diagram-studio.v1`, debounced 500 ms. That means:

- Your figure survives a reload and a closed tab.
- It does **not** follow you to another browser, another machine, or a colleague. Use **Save
  file** for that.
- Clearing site data loses it. So does a private window.
- Only **one** figure is held at a time — starting a new one overwrites the last. Export before
  you move on.

This is the main thing to know before handing the tool to the team. A DB-backed library (save,
name, list, reopen, attach to a customer) is the natural next step and would slot in where the
autosave effect is in `DiagramStudio.tsx`; the scene is already plain JSON, so the table is a
`jsonb` column and nothing about the renderer changes.

---

## Code map

| File | Role |
|---|---|
| `lib/diagrams.ts` | The scene model + all six application templates + persistence helpers |
| `app/admin/diagram-studio/DiagramCanvas.tsx` | The SVG renderer, drag handling, PNG/SVG serialisation |
| `app/admin/diagram-studio/DiagramStudio.tsx` | Editor shell, inspector, exports, autosave |
| `app/admin/diagram-studio/page.tsx` | Perm gate |
| `supabase/migrations/073_diagram_studio_perm.sql` | The `diagrams` grant (no tables) |

**Adding an application is a data change in `lib/diagrams.ts` and nothing else.** Write a `build()`
returning a `Scene` — nodes (`desiccant` / `ahu` / `room` / `box`), flows (`arrow` / `duct`),
callouts, notes, legend — and add it to `TEMPLATES`. Coordinates are hand-placed against a fixed
2000 × 1150 artboard.

### Two rules for anyone touching the renderer

**1. The artboard does not use the design tokens.** DESIGN.md governs the app chrome around the
drawing; the figure itself is a customer-facing document that has to match our printed figures and
look identical in every theme. Its palette lives in `TONES` / `PAPER` in `lib/diagrams.ts` as
literal hex, and the artboard deliberately does **not** respond to dark mode. Wiring it to
`--canvas` / `--ink` would make an exported PNG come out dark for a rep working at night.

**2. Everything the figure needs must live inside the `<svg>`.** Export works by serialising that
element, so gradients go in `<defs>`, the photo is embedded as a data URL, and colours are
literals — no CSS classes, no `currentColor`, no external references. Editing chrome (selection
outlines, drag handles) is tagged `data-chrome` and stripped from the clone before serialising.

The PNG path rasterises through a **base64 `data:` URL**, not a `blob:` URL — an SVG drawn from a
blob URL taints the canvas in some engines, and a tainted canvas makes `toBlob()` throw at the
very last step.

---

## Limits

- **No psychrometric validation.** See above — every number is typed.
- **Equipment cannot be moved or re-plumbed** in the UI. Flows are absolute coordinates, so
  dragging a block would leave its arrows behind. Changing topology means editing (or adding) a
  template.
- **One figure at a time, on one machine.** No server-side library yet.
- **No PDF export.** PNG into Word/PowerPoint is the actual workflow; SVG covers vector needs.
- **Font in exports.** The artboard uses a system sans stack (Segoe UI / Helvetica / Arial), not
  the portal's Nunito Sans — a webfont is not available in the isolated context the SVG rasterises
  in, so using it would silently fall back and the export would not match the preview.
