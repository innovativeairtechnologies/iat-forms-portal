# RFQ — Request for Quote (guided moisture survey)

**Live:** `/support/rfq` · **Admin queue:** `/admin/rfq` · **Shipped:** 2026-08-14 · **Migration:** 087

The interactive replacement for the two Word documents we used to email as attachments —
*IAT Quote Request and Moisture Survey Form*, Room and Process. A customer answers a guided
survey in about three minutes, watches the numbers build as they type, and leaves with a
branded PDF. The survey lands in `rfq_requests` and pings the sales desk.

---

## Step 1 is `about` — contact, project, and site location

`about` used to sit second-to-last, so a customer answered nine engineering questions before
telling us who they were, and an abandoned survey left us nothing to follow up on. It now
leads both flows.

**Project location and elevation moved here** from the `target` step (room) and `entering`
step (process). Elevation is an input to `grains()` and `dewPointF()`, so asked last it meant
every psychrometric number the wizard displayed was computed at sea level until the final
screens.

`about` and `application` are indices 0 and 1 in **both** flows on purpose — switching track
mid-survey leaves the current index meaningful.

### Site lookup — `GET /api/rfq/elevation?q=`

Fills the elevation field **and the outdoor design conditions** from a typed "City, ST" or a 5-digit ZIP.

**Deliberately not an LLM.** Elevation feeds the psychrometrics, so a plausible-but-wrong
number is worse than a blank field: it is wrong quietly, somewhere nobody thinks to check.
Every source is a public geodetic service returning a measured value:

| Step | Service | Notes |
|---|---|---|
| ZIP → lat/lon | Zippopotam | free, keyless |
| City → lat/lon | Open-Meteo geocoding | free, keyless; state matched against `admin1` so "Covington, GA" is not the Louisiana one |
| lat/lon → feet | **USGS EPQS (3DEP)** | the authority; Open-Meteo's own elevation is the fallback |

The two elevation sources agreed within 4 ft on the first point tested. Verified against known
values: Covington GA → 745 ft, Denver CO → 5,276 ft (the city is 5,280).

Failure is **always soft** — the fields stay hand-editable, a miss says so quietly and changes
nothing, and every one of these services can be down with the wizard still working.

### Outdoor design conditions (added 2026-08-19)

The same lookup returns the site’s **ASHRAE 0.4% dehumidification design point** — dew point,
humidity ratio in grains, and the mean coincident dry bulb — plus the cooling and heating
design points for reference. `lib/ashrae.ts` owns it.

| Step | Endpoint | Notes |
|---|---|---|
| lat/lon → 10 nearest stations | `request_places.php` | rejects any `number` but **10**; its `elev` is **metres** |
| WMO → design record | `request_meteo_parametres.php` | `si_ip=IP` for feet/°F; 599 fields; `elev` is **feet** here |

Both need a `Referer` of the site itself or they return 500. Responses carry a UTF-8 BOM that
`JSON.parse` rejects.

**Why it matters.** `emptyRfq()` seeded outdoor design at 95°F / 55%rh and the room flow never
asked, while `estimateLoad()` computes ventilation and infiltration from it — so every room quote
was priced against a national placeholder.

That placeholder is **wet**: ~78°F dew point, ~140 gr/lb near sea level and *more* at altitude,
since a fixed %rh converts to more grains as pressure falls. It **overstated** outdoor moisture
almost everywhere and by inconsistent amounts — grain depression against a 70°F/45%rh room:

| | Seattle | Denver | Phoenix | Minneapolis | Atlanta | Houston |
|---|---|---|---|---|---|---|
| placeholder vs real | +189% | +166% | +31% | +16% | +10% | −7% |

So the old estimate generally **oversized**, worst at dry high-elevation sites, and understated
only on the Gulf coast.

**Elevation is still USGS**, deliberately. The station record carries its own elevation, but a
station is usually an airport tens of miles away: Covington, GA is 745 ft and its nearest
station is 29 miles out at 943 ft.

**A station beyond 100 miles is refused** (`MAX_STATION_MI`). The endpoint always answers with
its ten nearest however far that is — asked about a mid-Atlantic point it returns an island 314
miles away. Design conditions from the wrong climate are the worst output here because they
look exactly like the right ones.

**Vintage** is one constant, `ASHRAE_VERSION`, currently **`2025`** — the newest published,
observation period 1999–2023 against 2021's 1994–2019. Coverage was checked across eight US sites
before switching (all resolve; Covington GA moves to a nearer station; Houston shifts 143.9 →
147.9 gr/lb where the newer period genuinely moved). The site also serves 2009, 2013 and 2017.

**DryWare does not track an ASHRAE vintage** (confirmed by the owner, 2026-08-19), so there is no
version to match and 2025 stands on being the newest. Take the newest the site offers when a
later one appears. ⚠️ The point of this integration is that a quote and a DryWare check
agree — **confirm which vintage DryWare reads** and match it, or the two will differ in the
first decimal with no visible reason.

**Licensing.** ASHRAE’s Climatic Design Conditions are copyrighted and sold by ASHRAE, and
`ashrae-meteo.info` is an unaffiliated republisher. An earlier pass declined to build on it for
that reason. The owner reviewed the position on 2026-08-19 and chose to serve the values to
customers, for consistency with DryWare. Every figure is labeled with its source wherever it
appears — page, PDF and admin view — and `lib/ashrae.ts` is the only file that would have to go
if the position changes.

**Attribution is split in two (2026-08-20).** `RfqData.outdoorSource` is the CUSTOMER-facing
string and deliberately carries no edition year — `ASHRAE · MONROE WALTON COUNTY AP, GA, USA ·
16 mi`. `RfqData.outdoorVintage` carries `ASHRAE 2025, 2004-2023 observations` and is rendered
**only** on the admin detail view.

Owner's call: the year told a customer nothing actionable and read as ambiguous (data year? a
forecast?), and the observation window read as though the figures were two decades old. It stays
on the record because the numbers genuinely move between editions — Houston is 143.9 gr/lb under
2021 and 147.9 under 2025 — so when a quote and a later check disagree, the vintage is the only
thing that explains why. Records created before the split carry the year inside `outdoorSource`
and no `outdoorVintage`; the admin view simply omits the second pill.

## Temperatures can be entered in Celsius (2026-08-20)

A °F/°C control sits on the temperature box and sets `RfqData.tempUnit` for the whole
survey. **Everything is stored in °F** — `setCondition`, the psychrometrics, the record,
the PDF and the admin view. Celsius is converted at the input and straight back.

Three things that are not obvious and must not be "simplified":

1. **Dew point and wet bulb follow the unit too.** They are temperatures. A °C dry bulb
   beside a °F dew point is how someone types 15 meaning 15°C into a field storing 15°F.
2. **`TempInput` keeps a local text buffer.** Converting on each keystroke and feeding
   the result back as the input's value destroys typing: `"20."` parses to 20, stores
   68°F, redisplays `"20"`, and the next digit makes **205**.
3. **A unit flip writes NOTHING.** Tenths of °C and °F do not line up — 105°F displays as
   40.6°C, which re-enters as 105.1°F — so a toggle that wrote back would edit a survey
   every time somebody looked at it in the other scale.

⚠️ The readout must round. `fmtDewPoint()` used to; the unit-aware rewrite briefly
replaced it with `tempToDisplay()`, which returns the raw value untouched in Fahrenheit,
and `49.05563453465°F` reached the page before it was caught.

## Step 5 — wall build-ups and the Advanced block (2026-08-20)

Three images sit above the material dropdowns: **Good, Better, Best**, from
`public/rfq/shell-*.webp`. Hovering magnifies the *figure* to 2× — the figure owns the
rounded clip, so scaling the image inside it would crop rather than enlarge. The outer
two use `origin-[25%_50%]` and `origin-[75%_50%]` so they lean outward instead of
growing across their neighbors.

⚠️ Their order comes from the **file names** and does not match the order they were
supplied: *Good* is the brick build-up, *Best* is the insulated metal panel.

**Vapor barrier and building tightness** sit behind one **Advanced** control under Floor,
matching the disclosure on step 7. It opens on arrival if either answer differs from its
default, so a returning customer is never shown a step that hides what they chose.

⚠️ **Tightness is asked again.** It was hidden on 2026-08-19 while `data.tightness`
stayed at `'Average'` and `estimateLoad()` kept costing infiltration from it — every
survey priced at average leakage as an assumption nobody confirmed. Do not re-hide it
without also dealing with that term.

### The two answers, and where each one lands (2026-08-24)

Neither control changes anything on screen — the load readout was withheld from the
customer on 2026-08-18 and both answers feed only the model. What they actually move:

| Answer | What it drives | Size of the effect |
|---|---|---|
| **Vapor barrier** | Flips every envelope material from its `perm` column to `permSealed`, then Eq. 5.1 | Material-dependent. Insulated metal panel is 0.16 either way — **the toggle is a genuine no-op there**. Painted gypsum goes 50 → 0.45 |
| **Tightness** | `TIGHTNESS_RATES` straight into the infiltration term | Linear, so **Loose is exactly 6× Tight**. On a 50×40×14 room at 70 °F/45 % against 95 °F/55 %, the total goes 1.76 → 7.60 lb/hr |

**Tightness now prints on the PDF**, in the construction and envelope table, as
`Loose — 1.5 cu.ft/hr per sq.ft of envelope`. Before this it was recorded nowhere on
the document the customer keeps; it surfaced only inside a breakdown-bar caption. The
rate is spelled out because the band name alone does not say what was assumed, and the
`?? TIGHTNESS_RATES.Average` fallback mirrors `estimateLoad()` exactly — a survey stored
under the retired *Not sure* band prints the 0.6 the math used rather than a blank the
PDF and the model would disagree about.

⚠️ The em dash in that row is **not** covered by `san()`, which maps en dash and minus
but leaves `—` alone. It happens to be correct — `—` is a real WinAnsi code point
(`0x97`) — but any new glyph in a PDF string needs checking against the shipped file,
not against the source.

**`summary.breakdown` now carries `detail`**, the assumption behind each line
("loose construction, 1.5 cu.ft/hr per sq.ft", "vapor barrier credited", the door-open
minutes). It renders as a caption under each bar on `/admin/rfq/[id]`. Records written
before 2026-08-24 have no `detail`, so it is typed optional and every reader must treat
it that way — those surveys render the bar with nothing underneath.

## Two tones, and only two (2026-08-20)

`Tone` is `'sky' | 'amber'`. Sky carries ordinary information; amber marks the one thing
on a step worth stopping at — the unit-conversion badge on the target step and the doors
note. Rose, violet and emerald were **deleted from the type**, not left unused.

Red survives only where it means something: the required-field asterisk, error text, and
the hover on Remove.

## The fork

The application step asks the one question that reshapes everything after it:

| Track | When | What we size on |
|---|---|---|
| **Room** | A space held at a condition — warehouse, cold store, dry room, production hall | Moisture load calculated from the room itself |
| **Process** | Dry air delivered to a machine, line or vessel | Grain depression × airflow |

The two tracks then ask genuinely different questions (9 steps vs 7). Switching is offered
**only on the application step**, where nothing branch-specific has been entered yet — past
that point a silent switch would strand half the answers.

## Answer in your own units

Every temperature/moisture pair takes **%rh, dew point °F, grains, or wet bulb °F** from a
dropdown. Room specs arrive as %rh, dry rooms as a dew point, process wheels as grains, and a
sling psychrometer gives a wet bulb — making a customer convert before they can answer is how
you get a wrong number typed confidently.

`setCondition()` in `lib/rfq.ts` is the **only** place a condition changes, and every edit —
temperature, number, or unit — routes through it. Two behaviours it exists to guarantee:

- **The dry bulb is part of the moisture answer.** A 50°F dew point is 49%rh at 75°F and 70%rh
  at 60°F. Change the temperature and the canonical %rh is recomputed; leave that out and the
  survey quietly reports air the customer never described.
- **Switching units converts, it never clears.** The air is the same; only the way of saying it
  changes.

The canonical field beside each pair (`…RhPct`, or `leavingGrains` on the process track) stays
the single input to the load engine, so `estimateLoad`, the PDF and the admin page neither know
nor care which unit was used. `/api/rfq` re-derives every canonical value server-side from
(temp, mode, value), so a direct POST cannot claim 5%rh while its dew-point field says otherwise.

Surveys taken before this shipped carry no mode at all; `normalizeMode()` treats a missing mode
as the canonical one, so those rows still render. The reading is echoed back on the PDF
("entered 35 °F dp") and on the admin detail, because how a spec is written is itself a signal.

## Typical values are the whole trick

Picking an application seeds the target condition, the surrounding space, occupancy and door
activity with numbers a person in that industry recognizes, so most steps are a glance-and-next
rather than a fill-in. Every seeded value stays editable, and each one carries a one-tap
`Typical: 40% rh — use it` chip. Presets live in `ROOM_PRESETS` / `PROCESS_PRESETS`
(`lib/rfq.ts`) — adding an application is adding one object there.

⚠️ **Provenance — the presets are the one uncited input in this survey.** "Numbers a person in
that industry recognizes" describes the *intent* behind the figures, not a source, and it reads
like one. There isn't a source: all 29 sets were authored in a single pass (2026-08-14, `59aeff9`)
from general industry knowledge and have not been edited since. That makes them the exception
here — `lib/rfq-psych.ts` is ASHRAE Fundamentals checked against published points, the load
equations follow IAT's moisture-load workbook, `PEOPLE_LOADS` is IAT's own table, and elevation
comes from USGS, which explicitly refuses to guess. **Treat any preset figure as an unverified
starting point until an engineer signs it off**; the same caveat and the corresponding comment
live above `ROOM_PRESETS`. Two values were already found wrong exactly this way — the dry-room
note (−20°F dp, should have been −30.2) and `dry-room-process` (0.4 gr/lb, should have been
0.55) — and both read as plausible until they were checked against the psychrometrics. A review
sheet of all 29 presets with their derived grains and dew points went out 2026-08-26.

## The readout — "Typical Conditions"

The right rail computes as you type. It shows **grains and dew point only**. This is the
engagement moment — it also quietly teaches the customer that **relative humidity alone
cannot size a dehumidifier**, which is the single most useful thing a first-time buyer can
learn.

⚠️ **The moisture-load figures are deliberately withheld from the customer** (owner's call,
2026-08-18). The running load estimate, the pints-per-day line, the per-source bar breakdown,
the dry-air cfm and the process water-removal figures were all shown here and are now hidden,
because they read as a quotable selection when they are a rough planning estimate off partial
inputs. The one-line summary on the review step lost its `lb/hr` clause for the same reason.

**Nothing was removed from the model.** `estimateLoad` / `estimateProcess` are unchanged, and
the full `summary` payload — load totals, breakdown, dry-air cfm — still reaches our desk on
every submission. This is a display decision, reversible by putting the blocks back.

⚠️ **The takeaway PDF still prints all of it** — headline stat cards, the calculation
walkthrough, and the narrative. If the intent is that a customer never sees these numbers, the
PDF is the remaining surface, and it is a layout-sensitive change (see "Four rules for editing
the PDF").

---

## The application render (2026-08-21)

Under the readout in the same sticky rail sits a cutaway illustration of the application the
customer picked on step 2. It is the answer to "what am I even filling this in for" — a constant
picture of the room while they answer nine screens of questions about it.

**Where it lives matters.** `ApplicationRender` is rendered in the rail, *outside* the
`AnimatePresence` that swaps step panels. So it is not unmounted and re-fetched on every
Continue, and it does not re-animate on each step. It has no entrance animation of its own:
DESIGN.md allows one entrance per view and the step column already owns it.

**The map is `lib/rfq-renders.ts`, hand-maintained, and separate on purpose.**
`lib/render-assets.ts` is generated by the convert/upload scripts and carries a do-not-hand-edit
banner, so the pairing cannot live there.

⚠️ **Pair by explicit key, never by string munging.** The two vocabularies drifted
independently — the survey says `pharma` where the artwork says `pharmaceutical`, and `dry-room`
(a lithium battery room) where the artwork says `battery`. A `startsWith`/`includes` match
mis-pairs several and shows a customer the wrong room with no error anywhere.

**It uses the `rooms` set, pinned.** 1920x1080, 16:9, with a background. Deliberately not
`rooms-cutout`: those are transparent, trimmed to content bounds and about 1.31:1, and they are
the set the overlay-compositing warnings apply to. Nothing here composites, so none of that
matters — but the two sets are not interchangeable in one 290px slot.

**28 of 29 applications are mapped.** Nine are a judgment call rather than a name match and are
listed in the file header so they stay re-decidable. `natatorium` (indoor pool) is deliberately
**absent** — there is no pool render in the set, and an unmapped application shows no picture,
which is correct. A wrong room is worse than no room. Add the key if a pool render is ever
produced.

**Verifying it.** The wizard cannot be driven past step 1 in an automated browser (see the
handoff on `AnimatePresence mode="wait"` and `requestAnimationFrame` in a hidden tab), so this
was checked with a temporary page that mounted the real component for all 29 presets: every
image loaded, all rendered 288x162, and the tokens resolved to a white card on warm canvas with
a 1px hairline and no shadow in light, and the dark surface ladder in dark. That page was
deleted before commit.


### Hover to magnify (2026-08-21)

`HoverMagnify` enlarges on hover. That is all it does. Used by the rail render and by the people
illustration on step 7.

⛔ **Two interaction ideas have been tried here and BOTH were rejected. Do not add a third without
asking.**

1. **Tilt following the pointer on hover** — the picture moved under an uncommitted cursor, which
   reads as drift rather than control.
2. **Press-and-drag to turn it in 3D** — "missed the mark"; the owner is finding a reference for
   what they actually want.

`perspective` and `preserve-3d` went with the rotation rather than being left behind. A dormant 3D
context on a purely 2D scale is an invitation to "just add a small rotate" to it.

- **`origin` is load-bearing.** The rail sits against the right edge of the page, so it magnifies
  from `100% 50%` and grows LEFTWARD. Measured: 290px → 569px with the right edge moving 3px.
  Centered content (step 7) uses `center`.
- **Reduced motion keeps the magnify** — a zoom is a function, not an ornament — and drops only
  the transition, so it snaps.
- **Touch is excluded** via `useCanHover()` — `(hover: hover) and (pointer: fine)` and ≥640px. A 2x
  panel on a phone covers the form it is annotating.
- The transition is 180ms ease-out.

⚠️ **Verifying it in an automated browser needs a trick.** The pane does not run animation frames,
so a CSS transition never advances and `getComputedStyle().transform` reports the START value —
an identity matrix — for a transform that is actually applied correctly. Set
`element.style.transition = 'none'` first, then read the computed transform. Without that the
feature looks broken when it is not. Same root cause as the `AnimatePresence` stall.

### Live L/W/H on the picture (2026-08-21)

`DimensionOverlay` draws the step-4 dimensions around the render as they are typed. Length along
the bottom, width along the top, height up the left — each edge appearing only once its own field
has a value.

**One coordinate system, or the lines drift.** `DIM` holds the padding and the image box in SVG
user units; the `<Image>` is positioned from the same numbers as percentages. Because every asset
in the `rooms` set is 1920x1080, the padded box has a fixed aspect ratio and the two cannot
disagree. Verified on screen: the rules span exactly the image's 252x142 box and sit 8–10px
outside it.

Room track only. A process survey has no room geometry, so it never dimensions even if the fields
carry values from an earlier switch of track.

#### Corrections, 2026-08-21 (same day)

**Hover no longer tilts.** The first build leaned the picture toward the pointer as it crossed the
image. It was rejected on sight: a picture that shifts under an uncommitted cursor reads as drift,
not control.

**The press-and-drag replacement was ALSO rejected, later the same day** ("missed the mark"), and
has been removed. See the section above — this subsection is kept as the record of what was tried,
not as a description of what the code does. Nothing here rotates today.

If a third attempt is ever commissioned, the drag build is in git and followed the portal's pointer
idiom (see `DiagramCanvas`): state in a ref, `setPointerCapture` on pointerdown so the gesture
survives the pointer leaving the element, move handler reading the ref rather than state, rotation
clamped to ±38° / ±52° at 0.4°/px because a flat image mirrors near 90°.

**🔴 `unoptimized` on both images is deliberate. Removing it silently softens them.**
`next/image` re-encodes AND downscales to the layout width, at a default quality of 75. Measured on
the live site: a 61 KB 1920×1080 source came back as a **13 KB 640px JPEG**. That is invisible at
rest and obvious at 2×, which is the entire point of the magnifier. The `rooms` assets were already
resized and compressed once, deliberately, by the upload script; a second pass is pure loss. Served
as built, the room render is 7.6× oversampled at rest and 3.8× when magnified.

The panda is stored at 760×1013 / q92 for the same reason, sized to about 1.2× the device pixels it
needs at full magnification. It carries its own callout text, and text is what a second lossy pass
destroys first.

**Label clearance.** `padT` 26 put the top of "25 ft wide" at −3 in the viewBox — outside it, and
visibly clipped. 34/30 fixed the top but left only 1.5px at the bottom, which is not a margin. Now
40/38, measured at 6.3px clear on top and 4.6px at the bottom.

⚠️ **Measure label clipping in SCREEN space, not with `getBBox()`.** `getBBox()` ignores an
element's own transform, so it reports the rotated height label as starting at x = −14.8 and
therefore clipped, when the rendered box actually starts at +1.6. Use `getBoundingClientRect()`
relative to the SVG.


### The render in the PDF (2026-08-21)

`roomDiagram()` in `lib/rfq-pdf.ts` takes an optional image. With one it draws the render and calls
the sizes out around it; without one it falls back to the abstract isometric box that was there
first — which is what an unmapped application and any failed fetch still get.

⚠️ **The two modes use different conventions for width, deliberately.** The box has a real
isometric depth edge, so width belongs on it. A photograph does not, so the render mode matches the
on-screen overlay: length bottom, width top, height left. A customer reads the screen and the page
side by side, so they must agree.

Three things in `loadRoomRender()` are not optional:

1. **JPEG, not PNG.** `loadLogo` emits PNG because a flat two-color mark compresses to nothing that
   way. The same treatment on a photographic render costs about a megabyte per PDF.
2. **`crossOrigin = 'anonymous'`.** The bucket is a different origin; without it the canvas taints
   and `toDataURL()` throws instead of returning. The bucket does send
   `Access-Control-Allow-Origin: *` — verified, not assumed.
3. **jsPDF cannot read webp**, so the canvas hop is required anyway; it is the same hop that
   re-encodes to JPEG.

The ROOM DIMENSIONS card grew from 62mm to 76mm to give the picture somewhere to sit. That came out
of this page's slack; the envelope section below still calls `ensure()`, so a long survey spills to
a continuation page exactly as before. Verified against the generated file: one `/DCTDecode` stream,
the image placed at 68.7 × 38.6 mm, all three callout labels present in the content streams.

⚠️ **"Still five pages" was wrong, and stayed wrong for three days.** It was five in the sense that
nothing overran — but the envelope table stopped fitting and moved onto a continuation page of its
own, so **every** room-track PDF was six pages, two of them mostly empty. The 14mm was not really
the cause: `ensure()` was being asked for `9 + tableH(6)` = 65mm to draw a block that occupies
52mm, and the 14mm was merely what took the slack below that inflated figure. `tableH()` already
allows for the header row, so passing `rows + 1` double-counts it. Fixed 2026-08-24 by reserving
`4 + tableH(envelopeRows.length)` — measured from a rendered file rather than inferred: y reaches
187.3mm, `CONTENT_BOTTOM` is 246.4mm, the block is 52mm, and it clears by 7.1mm.

⚠️ **Over-reserving in the LAST block on a page is not a safe error.** Everywhere else a too-large
`ensure()` just shuffles content down. Here there is nothing below it, so the only thing the
reserve can do is emit an entire continuation page holding one short table — which is precisely
what moving the doors table off this page was meant to prevent.

The general lesson: **a page-count claim is worth exactly what the rendered file says.** This one
was reasoned from the arithmetic of a slack budget and checked against nothing.


---

## Two ways to give the room's size (2026-08-24)

Step 4 accepts either **Dimensions** (length × width × height) or **Volume**. `roomDims()` in
`lib/rfq.ts` is the **single definition** of the room's size — the load engine, the wizard's live
readout, the step validation, the PDF diagram and the admin detail page all read through it, so
they cannot disagree. **Nothing reads `roomL/roomW/roomH` directly any more.**

⚠️ **Volume alone cannot size a system, and this is the reason the mode is shaped the way it is.**
L, W and H are not just a volume here — they are the wall, ceiling and floor **areas** the
permeation term needs (`wallArea = 2(L+W)H`, `ceiling = floor = L×W`). Two rooms of identical
volume can have very different envelope area.

So volume mode also takes a **ceiling height** — the one dimension nearly everyone knows without
measuring — and derives a square footprint:

```
H = ceiling height (DEFAULT_CEILING_FT = 12 when blank)
L = W = sqrt(volume / H)
```

Volume is exact, floor and ceiling area are exact, and only the footprint **shape** is assumed. A
square is the minimum-perimeter case, so **wall area is the low end** — an elongated room has more
wall than this predicts (a 200 × 12.5 ft room of the same volume has 53% more).

Because it is an assumption, three surfaces say so rather than presenting it as measured: the
wizard shows an amber callout with the derived footprint, the PDF heading reads `ROOM SIZE (FROM
VOLUME)` and prints `… ft assumed`, and the admin field is labeled **Dimensions (assumed)**.
`roomDimsAreDerived()` is what each of them tests.

Scale check before worrying: permeation was **283 of 78,791 gr/hr (0.4%)** on a real survey, so a
53% wall-area error moves the total by ~0.2%. A tight, cold room with little internal load leans
on permeation far harder — that is the case where the wording matters.

`roomSizeMode` is pinned server-side in `/api/rfq`'s `coerce()` next to the moisture modes, for the
identical reason: it is a string union, the generic string copy would accept anything, and an
unknown value falls through to the dimensions branch and reads fields volume mode never filled in —
a silent zero-volume survey. Legacy rows default to `dimensions` and resolve exactly as before.

### Where the render appears (2026-08-24)

Both room-track surfaces now show the **same** application render, from one `ctx.roomImage`:

| Where | Size | Callouts |
|---|---|---|
| Page 3, ROOM SIZE card | 68.7 × 38.6 mm | **yes** — length, width, height along the room's edges |
| Page 1, panel 2 YOUR SPACE | 42.7 × 24 mm | **no** — volume and L × W × H are printed underneath instead |

⚠️ **The takeaway's callouts are off for a measured reason, not a stylistic one.** That panel is
`T.duo` = 46mm tall on a page whose bands are fixed constants, so the diagram slot is 27mm and
cannot grow — the budget sums to 238mm against a `CONTENT_BOTTOM` of 242.4mm, leaving ~2mm. The
callout padding costs 17mm in each direction, which in that slot yields a **17.8 × 24 → 17.8 × 10mm**
picture with unreadable 7pt labels. Dropping the padding gives **42.7 × 24mm**. The panel already
prints the volume and the dimensions as text directly below, so callouts there would repeat that
in a space too small to read them.

`roomPhotoDiagram(..., callouts)` carries this: `true` uses the callout padding and draws the three
edges, `false` uses a 1.5mm margin and returns straight after the image and its hairline.

**The fallback is unchanged and still matters.** `roomImage` is null for an unmapped application
(`natatorium` has no pool artwork) and for any fetch or CORS failure, and both surfaces then draw
the abstract isometric box with its own callouts, exactly as before. Verified against a natatorium
survey: no render fetched, both surfaces fall back, still 5 pages.

## Dimension callouts on the room render (2026-08-24)

The customer's L, W and H are drawn onto the application render, in the wizard's right rail and
again on the PDF. They run **along the room's own edges**, standing just outside it — not as rules
around the picture, which is what they were until 2026-08-24.

`ROOM_RENDER_EDGES` in `lib/rfq.ts` is the **single** definition, as fractions of the image box:

| Point | x | y | Edge it anchors |
|---|---|---|---|
| `leftTop` | 0.178 | 0.252 | wall top-left |
| `apex` | 0.531 | 0.048 | near corner, top |
| `leftBot` | 0.178 | 0.703 | wall base, outer left |
| `floor` | 0.479 | 0.950 | floor's near corner |

`leftTop→apex` is **width**, `leftTop→leftBot` is **height**, `leftBot→floor` is **length**.
`lib/rfq-pdf.ts` draws the same three from the same constants — the customer reads the screen and
the PDF side by side, so **changing one alone splits them**.

⚠️ **Fit the floor edge across MANY renders — it has been wrong twice for fitting too few.**
The first pass used `battery` alone and ran 2.5° steep on the warehouse. The correction that
followed was checked on four renders and was **still 3.9° shallow** (20.88° against a true 24.8°):
the length line started clear of the slab on the left and had drifted onto the concrete by the
right-hand end, so it read as balanced at one end and wrong at the other. Owner-reported, both
times, from the wizard and the PDF. **The floor edge is the sensitive one** — the top edge and the
vertical tolerate far more error, which is why only the length line has ever looked wrong.

**How `floor` was settled (2026-08-24, second correction).** The slab's front-lower boundary was
measured on **all 39** room renders — strongest vertical gradient per column down the edge, least-
squares line, outliers dropped, refit. 27 fitted at rms < 1.5px and agreed tightly:

| | value |
|---|---|
| edge angle | **24.75° – 24.98°, median 24.80°** |
| slab far corner | x ≈ **0.4786** |
| previous `leftBot→floor` | **20.88°** |

The 12 that would not fit are renders whose floor edge is occluded by contents — a detector
failure, not different geometry. The corrected line was composited onto those too (`automotive`,
`aerospace`, `ice-rink`, `museum-1-glass-case`, `grow-room`) and hugs the edge on every one.

`floor` is **derived, not eyeballed**: hold `leftBot` (the height callout ends there and is
correct), run at 24.8°, stop at the slab corner → `{ 0.479, 0.950 }`. It lands ~10px outside the
fitted edge because `leftBot` is the wall base rather than a point on the slab boundary, which is
the right direction — the callout is meant to stand outside the room.

⚠️ **The outward normal is not the same sign on all three.** For the downward vertical, `-uy/ux`
points *into* the room, so height takes `+1` where width takes `−1`. Getting it wrong puts the line
on the wall face — which looks almost right.

⚠️ **Padding does not fix a callout that crosses the picture edge.** The callouts are fractions of
the *image* box, so they move with it; expanding the frame moves the line too and the clearance is
unchanged. The stand-off (`OFFSET`, 4 overlay units / `0.0125 × iw` in the PDF) is the lever.

To re-fit: composite candidate lines onto real renders and **look**. A thresholded silhouette tracer
lies — one "proved" the renders were inconsistently framed when it was reading shadows and
background gradient as room. A *gradient* fit down a single known edge is trustworthy where a
silhouette threshold is not, but only with the residual reported: the good fits here came in at
rms 0.3px and the useless ones at rms 20–60px, and nothing but that number separates them.
Composite the result and look regardless.

⚠️ **Judge a callout along its whole length, not at one end.** An angle error and a stand-off error
look identical where the line starts and only diverge at the far end — which is why "the width line
finishes too close to the top" was fixed by trimming the stand-off while a 3.9° error in the length
line sat there untouched.

⚠️ **`sharp` resizes before it composites, whatever order you call them in.** Compositing a
full-size overlay onto a render and scaling the result in one chain fails with "image to composite
must have same dimensions or smaller". Finish the composite in its own pass, then resize.

## The maths

`lib/rfq-psych.ts` — ASHRAE Fundamentals moist-air properties (saturation pressure over
water and ice, humidity ratio, dew point, vapor pressure, density). Checked against the
published points at sea level: 70°F/30%rh → 32.5 gr/lb, 70°F/20%rh → 21.6, 75°F/40%rh → 51.6,
80°F/50%rh → 76.5.

`lib/rfq.ts` — the load set, arranged like IAT's internal moisture-load workbook:

| Source | Equation |
|---|---|
| Permeation | `area × permeance × Δ vapor pressure` |
| Shell air leakage | `envelope area × tightness rate × density × Δ grains` |
| Doors & openings | `open area × velocity × min/hr × density × Δ grains` |
| People | `count × gr/hr by activity` |
| Product / process | `lb of water per hour × 7,000` |
| Unvented combustion | `cu.ft/hr × 650 gr/cu.ft` |
| Wet surfaces | Carrier's latent-transfer form, still-air coefficient |
| Fresh air | `cfm × density × 60 × Δ grains` |

A 10% safety factor is applied. **Ventilation air is carried separately from the room total on
purpose** — the unit dries that air upstream, so folding it in would grossly oversize the
system. Dry-air cfm assumes a 5 gr/lb supply depression (floored for very dry rooms).

Sanity-checked against the *Parts Warehouse* worked example in the moisture-load literature:
room grains 52.8 (book 52), outdoor 148.5 (book 146), permeation 1,599 gr/hr (book 1,383), and
the same dominant driver — door openings. The wizard total lands lower than the hand calc because
the tightness band rolls up what the book itemises crack by crack; that is the intended
trade-off for a customer-facing estimate.

> **Every surface that renders the estimate also renders `LOAD_DISCLAIMER`.** It is
> preliminary, for discussion, and never for equipment selection.

---

## The PDF

`lib/rfq-pdf.ts`, generated client-side with jsPDF — vector throughout (no `html2canvas`), so
the file is ~35 KB, prints crisply and stays text-searchable.

| Page | Contents |
|---|---|
| **1** | **The takeaway infographic** — one page, the customer's own numbers |
| 2 | Cover — project identity, four at-a-glance tiles, contact + project detail, purpose |
| 3 | The space (application render with L/W/H callouts, design conditions, envelope) *or* the process spec |
| 4 | *Room only* — openings, internal loads, estimated breakdown bars, totals |
| 5 | Equipment & utilities + standing engineering notes from the paper form |

The takeaway **leads** the document (moved from last, 2026-08-14). The person opening it wants
their own numbers first; the detail pages behind are the evidence, not the headline. jsPDF has
no page-reorder, so it is simply built first.

Every page carries a diagonal **PRELIMINARY** watermark and a highlighted disclaimer band with
IAT's required wording, applied by `stampEveryPage()` after all content is laid out.

### Four rules for editing the PDF

1. **Every string passes through `san()`.** jsPDF's Helvetica is WinAnsi-encoded and does not
   fall back — `≈` rendered as `ʺH` and `′` as a stray `2` before the sanitiser existed. It is
   a silent corruption, not an error.
2. **The takeaway page has a fixed vertical budget** (the `T` constants, summing to 238 mm). It
   must stay one page no matter how long the project name is or how many load lines there are,
   so panel heights are constants and their contents are sized to fit. Change one, re-check the
   total against `FOOTER_BAND_TOP`.
3. **Nothing may cross `CONTENT_BOTTOM`.** The record pages flow, and their length varies with
   the survey, so each section calls `ensure()` with the height it is about to draw and
   continues on a fresh page if it would run under the disclaimer band.
4. **The watermark is drawn on top, not underneath.** The pages are built from opaque white
   cards; drawn first it would survive only in the gutters between them, which reads as a
   rendering fault rather than a stamp. Its strength is the single constant
   `WATERMARK_OPACITY` — **0.10** since 2026-08-17, raised from 0.07 because the stamp came
   through a printer as very nearly nothing. Screen contrast flatters it and toner does not, so
   judge any change from a rendered page rather than from the number. Nudge that constant rather
   than the gray, so there is one thing to reason about.

### Verifying a PDF change

Render it and look at it — layout bugs here are invisible to the type checker, and the page-count
error above survived a type check, a build, a deploy and a written verification note. Poppler's
`pdftoppm -png -r 130 out.pdf page` is on the dev box and turns each page into an image;
`pdftotext -layout` gives you something greppable for the strings.

**Getting a file to look at, without a browser.** `generateRfqPdf()` is browser-only — it early-
returns `null` from `loadLogo`/`loadRoomRender` when `window` is undefined, and both go through
a `<canvas>` because jsPDF cannot read the webp the render bucket stores. That does not mean it
needs a browser to *check*. Transpile the module graph and shim the three browser APIs:

```bash
node node_modules/typescript/bin/tsc \
  lib/rfq-psych.ts lib/rfq.ts lib/render-assets.ts lib/rfq-renders.ts lib/rfq-pdf.ts \
  --module commonjs --target es2022 --moduleResolution node --esModuleInterop \
  --skipLibCheck --outDir <scratch>
```

then run the real `generateRfqPdf` with `window`, `Image` and `document.createElement('canvas')`
stubbed — `Image` fetching the bucket URL (or reading `public/` for a rooted path) and `toDataURL`
shelling out to `sharp`, which is already a dependency. Two details decide whether this works:

- **`toDataURL` is synchronous** and `sharp` is not, so the encode has to be a synchronous child
  process (`execFileSync`). Returning a promise from the shim silently embeds nothing.
- **Shim `window` first.** Without it both loaders return `null` and you get a PDF with no logo
  and no render — which looks like a broken fetch and is really a missing global.

Test at least the volume/dimensions pair (they must differ **only** in the heading and the
"ft assumed" suffix), one survey with a long looked-up design source (it is the note above the
envelope table that decides whether that table fits), and one process-track survey.

---

## What the wizard requires

Four contact fields, all four gating the About step and all four re-checked in `POST /api/rfq`
because that endpoint is public and unauthenticated:

| Field | Rule |
|---|---|
| `contactName` | more than one character |
| `company` | more than one character |
| `email` | `EMAIL_RE` |
| `phone` | **≥ 10 digits** after punctuation is stripped |

Phone joined the set 2026-08-17. Pricing a job almost always needs a question answered, and an
email round trip costs a day each time. The digit rule is deliberately loose — it checks a number
was really given, not that it is dialable — and is **the same rule `POST /api/tickets` applies**, so
the two public intakes cannot drift into disagreeing about what a phone number is. Change one,
change both.

## Storage & delivery

`rfq_requests` (migration 087) stores **both** `data` (the full wizard state) and `summary`
(the computed estimate). The estimate is snapshotted, never recomputed on read: the load engine
will be refined, and a detail page that quietly disagreed with the PDF in the customer's inbox
would be worse than no page.

- **POST `/api/rfq`** — rate limited, reCAPTCHA-gated (fails open), coerces the payload against
  an empty `RfqData` so nothing unexpected reaches the column. References are allocated by
  `next_rfq_number(year)`, the same atomic per-year counter idiom as ticket numbers.
- **Desk email** — one notification. Recipient chain:
  `RFQ_NOTIFICATION_EMAIL` → `SUPPORT_NOTIFICATION_EMAIL` → `jacob@dehumidifiers.com`.
  The middle step is deliberate: while `dehumidifiers.com` is unverified in Resend, mail sends
  from the sandbox address and may only reach the Resend account owner — everything else is
  refused *silently* (see the 2026-08-13 changelog entry, and the six lost tickets behind it).
  Inheriting the existing support stopgap means RFQ alerts land on day one with no new Vercel
  config, and both revert to their proper defaults together when that stopgap is removed.
  The survey is committed **before** any send is attempted, so a refused email never costs us
  the request.
- **No customer confirmation email.** They already downloaded the PDF, which is a better
  artifact than a receipt.

## Admin

`/admin/rfq` (list) and `/admin/rfq/[id]` (detail), gated on the **`deals`** perm and mapped in
`ADMIN_PATH_PERMS`. That mapping is load-bearing: an *unmapped* `/admin/*` path falls back to
`dashboard`, which every scoped role holds — it would have shown a stranger's contact details to
HR, marketing and production. An RFQ shares the sales trust boundary because it is the front of
the pipeline and becomes a deal.

**Sidebar badge.** Sales › Quote Requests carries an unread count, keyed on `is_read` rather
than `status = 'new'` so it clears when a human has actually opened one — the same rule as
Submissions. Without it the only signal a survey arrived was the desk email, which is exactly
the channel that has been unreliable; five sat unopened before the badge existed.

### Multi-select and bulk actions (2026-08-24)

The list carries checkboxes and the shared bulk bar from `components/admin/bulk-select.tsx` —
the same kit as Customers, Employees, Equipment and Requests. Selecting rows offers:

| Action | Who | Notes |
|---|---|---|
| **Reviewing** | anyone with `deals` | Moves off `new`, which is what stops the reminder sweep chasing |
| **Close** | anyone with `deals` | The batch move people were doing one at a time |
| **Assign to me** | anyone with `deals` **and** an `employees` row | Hidden when the account has no row — the only auth-user → employee join is the email (`lib/my-employee.ts`) |
| **Delete** | 🔴 **full admins only** | `/api/admin/bulk-delete` calls `getAdminUser()`, but this page is gated on `deals`, which sales and engineering also hold. The button is hidden for them rather than offered and refused — a 403 reads as broken, not forbidden |

**The status actions drive the EXISTING per-row `PATCH /api/admin/rfq/[id]`, once per id** —
there is deliberately no bulk PATCH. That route already owns the perm gate, the status
whitelist, the reminder-stamp clearing and the assignment email; a second write path would have
to reimplement all of it and would drift. A triage queue is tens of rows, so the cost is a few
requests.

⚠️ **Failures are collected and shown above the table**, naming the references that did not move.
A partial success that looks total is the worst outcome — the ticket queue shipped exactly that
bug (`setStatusFor` discarded the error), and it went unnoticed because a refused action and a
successful one looked identical.

**Deleting an RFQ destroys the customer's survey answers and the estimate we sent back**, plus
its `rfq_notes` (no `ON DELETE CASCADE`, so the child rows go first). There is no undo. That is
the reason for the full-admin gate, not caution for its own sake.

### Triage is the only writable part

`PATCH /api/admin/rfq/[id]` accepts **`status` and the assignee and nothing else**; notes go to
the sibling `/notes` route and are append-only. The survey and its estimate are a record of a
conversation, and a record you can quietly edit after the fact is not a record — if a figure is
wrong the fix is a new survey or a note saying so.

`TriageCard` saves on click (optimistic, reverting on failure so the UI never shows a state the
server rejected) and calls `router.refresh()` so the list, the dashboard and the sidebar badge
follow.

The status vocabulary lives in `lib/rfq-status.ts` — one dependency-free module shared by the
list filter, the detail picker and the API validator, because the column carries a CHECK
constraint and three copies of that list would eventually disagree with it.

### Ownership (migration 088)

`assignee_id` / `assignee_name` / `assigned_at`. The roster comes from
`getEmployeesWithPerm('deals')` — only someone who can actually reach the queue may own a row in
it, resolved server-side against the live perm matrix and never taken from the client. The name
is a **snapshot** (`shortStaffName` → "Jacob Y."), so deleting an account later cannot erase who
was working it. Two people called Jacob is exactly why it is first name + last initial.

### The note trail

`rfq_notes`, one row per note, **append-only by construction**: the route is POST-only, there is
no PATCH or DELETE, and author and timestamp come from the verified session and the database
clock rather than the request body, so neither can be forged or backdated. A correction is a new
note. The card lists newest-first, scrolls at 300px, and shows a count above the list so a
clipped history reads as "more below" rather than as a rendering fault.

Migration 088 carried the old single `internal_notes` textarea into the trail and left the column
behind as a tombstone; drop it in a later migration once nothing has read it for a while.

**The trail is no longer internal-only.** A customer can add a message to their own request from
`/support/status` (`POST /api/rfq/status/message`), and it lands here as a row with
`author_type = 'customer'` — migration **089**, defaulting to `staff` so every pre-existing row and
every staff note is correctly labeled without touching either. The admin trail gives those entries
a sky wash and a **Customer** badge; the heading is *"Notes & messages"* and the privacy line moved
onto the composer, which is the only place *"the customer never sees this"* is still true.

`author_type` is hardcoded per route, never read from a request body. Ownership on the public
endpoint is the same pair the status lookup uses — reference **plus** the submitting email — behind
a fail-closed reCAPTCHA at `minScore` 0.7. Full write-up in
[support-tickets.md](support-tickets.md).

⚠️ `body` is rendered as **text**, not markup. Do not store escaped HTML in it — the ticket
endpoint does that because `ticket_notes.content` *is* markup, and copying that across would show
the customer's own words wrapped in visible tags.

### Telling the owner, then chasing them (lib/rfq-reminders.ts)

Four messages now, all to IAT staff, all rendered by `lib/resend-rfq-reminders.ts` from one shell so
the same request looks the same whichever one you open it from:

| When | Who gets mailed |
|---|---|
| The moment a survey is assigned to a person | The new owner — *"this one is yours"* |
| The moment a **customer** adds a message | The assignee if there is one, otherwise the shared desk — never both |
| Assigned, `assigned_at` > 24h ago, still `new` | The owner — one email covering **all** their stalled rows, not one per row |
| Unassigned, `created_at` > 24h ago, still `new` | The shared desk, subject prefixed **`REMINDER:`** |

The first two are action-triggered — from `PATCH /api/admin/rfq/[id]` and
`POST /api/rfq/status/message`; the other two are the daily sweep.

The customer-message alert quotes the message **in full** rather than linking to it: it is capped at
4000 characters, and asking someone to click through to read two sentences is how an alert becomes
something people skim past. Like the others it is logged-not-thrown — the message is already on the
trail and visible in `/admin/rfq` either way. But nobody refreshes a quote request they are not
thinking about, so without the push the reply sits unread and the silence the customer wrote to
break just gets longer.
Until the assignment notice existed (2026-08-17), being handed a quote request was **silent** — the
first thing an owner heard about it was the 24-hour nudge telling them they were already late. The
nudge is the second message now, not the first.

**The assignment notice is deliberately not sent when someone assigns a row to themselves.** You
know what you just did, and self-addressed mail is the fastest way to teach someone to filter the
sender. Three more things about it, all load-bearing:

- It fires only when the owner actually **changes** — the route reads the prior `assignee_id`
  before writing, so re-saving the same assignee does not re-notify.
- It runs **after** the write and never throws. The assignment is the record and it is already
  committed; a mail failure must not turn a saved triage decision into a 500 the operator retries.
- An assignee with no active `employees.email` is logged as a **warning**, not swallowed. The 24h
  nudge will hit the same dead end, and the desk sweep only covers *unassigned* rows — so that row
  would otherwise be chased by nobody.

Moving a survey to any other status stops the chasing. That is the point — one click on
*Reviewing* says a human has it.

**Idempotency** is `assignee_nudged_at` / `unclaimed_reminded_at`, stamped only on a successful
send (so a failure retries tomorrow rather than going quiet) and re-chased after 48h. Clearing
them when the status leaves `new` means a row that later returns to `new` is chased fresh
instead of being suppressed by a months-old stamp.

**Scheduling:** `/api/cron/rfq-reminders` has its **own** daily slot at 13:00 UTC — start of
business either side of the DST line. The `admin-digest` run also calls the same sweep, on purpose:
the stamps make the second run of the day a no-op, so the redundancy costs two queries and buys
chasing that survives either entry breaking. It used to ride the digest alone because `vercel.json`
was believed to cap cron entries at two — it does not; see `docs/support-tickets.md`.

### On the dashboard

`lib/rfq-mine.ts` answers "what is waiting on me?" for both surfaces: the **My Quote Requests**
card on the department dashboard (the first card that reads `ctx.userId` — everything else there
is a department roll-up) and two pills in the **Sales** dashboard header, since Sales lands on
its own command center and would otherwise never see an RFQ without opening the queue.

Both show the **unclaimed count as well as your own**. A dashboard that only listed your
assignments would go quiet exactly when nobody has picked something up, which is the failure this
whole feature exists to stop.

## Handoff record

The session that built all of this left a full continuity record at
[`docs/handoff/2026-08-17-session-handoff.md`](../../docs/handoff/2026-08-17-session-handoff.md)
(repo root `docs/`, not this app's). It carries the reasoning behind each decision, the options
**rejected**, the traps found, and an explicit table of what was and was not verified — notably
that **no `/admin/*` page here has ever been rendered with a logged-in session.**

## Known gaps

- **No application illustration for an indoor pool.** `natatorium` is the one preset with no
  entry in `lib/rfq-renders.ts`, because the `rooms` set has no pool artwork. That survey shows
  no picture, which is deliberate. Producing a pool render and adding the key is all it needs.
- No file/drawing upload; the form asks customers to mention drawings in the notes.
- **⚠️ Nothing converts an RFQ into a deal — it is re-keyed by hand.** Flagged 2026-08-17 as the
  next thing to build here, deliberately deferred rather than forgotten. **It needs a scoping
  decision before any code**: per `docs/projected-sales.md`, DryWare is the source of truth for the
  pipeline, and `replace_projected_sales()` *wipes and reloads* the table before
  `materializeDealsFromProjectedSales()` rebuilds `deals`. So an RFQ→deal button either writes into
  a table the next sync overwrites, or it has to push upstream into DryWare. That choice is the
  actual work — the form-filling is trivial either way.
- The reminder cadence (24h to first chase, 48h to re-chase) is hard-coded in
  `lib/rfq-reminders.ts` rather than configurable.

### The PDF the customer received is kept (2026-08-25, migration 095)

An engineer picking up a quote request could see the survey answers but not the document the
customer is holding. `/admin/rfq/[id]` now opens the **exact file their browser produced**.

**Why the browser has to send it.** `lib/rfq-pdf.ts` is browser-only by design — it uses
`<canvas>` to downscale the logo — so the server cannot build this document. Regenerating it
later would produce something matching *today's* template, not what was sent; the moment the
layout changes, the page and the customer's copy disagree. That is the same reasoning the detail
page already applies to `summary`, which is never recomputed.

**Flow.** Submit succeeds → server assigns the reference → the browser builds the PDF with that
reference stamped in → POSTs it base64 to `/api/rfq/pdf` → service role writes to the private
`rfq-pdfs` bucket and sets `pdf_path` / `pdf_stored_at`.

- It runs **whether or not the customer clicks Download**, because most never do, and "only the
  ones who downloaded it" is a strange rule for which requests have a record.
- It is **not awaited and never surfaces an error**. The survey is already committed; a customer
  must not wait on, or be shown a failure from, a convenience for us. Failure leaves `pdf_path`
  NULL, which is what every pre-095 row looks like.

⛔ **The browser does NOT write to Storage directly.** That would need an anonymous INSERT policy,
and anonymous storage writes are an open item in the ideas backlog (§8.2). The bytes go through a
route on the service role instead. The ~4.5MB Vercel function-body cap is irrelevant here — a
vector PDF is ~200KB — unlike ticket photos, which genuinely must bypass the route.

**What stops a stranger writing junk**, given the endpoint is necessarily anonymous like the submit
it follows. Four guards, none sufficient alone:

1. the reference must exist;
2. **`pdf_path` must still be NULL — one write per request, ever**, so the worst case is a race in
   the seconds after a submit, never overwriting an engineer's copy later;
3. the request must be under 30 minutes old, so an old reference off a forwarded PDF is refused;
4. rate limited per IP, size-capped before decode, and checked for a `%PDF-` header.

A missing reference and an already-stored one return the **same** response, so the endpoint cannot
be used to discover which references exist.

⚠️ **Private bucket, served by short-lived signed URL** — never a public link. Page one carries the
customer's contact details, site location and project economics. The URL is minted per page view
and expires in ten minutes, so one pasted into a chat is dead before anyone else opens it.

**Storage is not a concern and this does not belong in SharePoint or in Postgres.** ~200KB per
vector PDF, 13 requests to date; even 500/year is ~100MB against a project already running ten
buckets. `proposal-docs` and `soo-submittals` are the same shape.
