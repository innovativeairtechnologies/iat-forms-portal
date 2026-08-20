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
customers, for consistency with DryWare. Every figure is labelled with its source wherever it
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
activity with numbers a person in that industry recognises, so most steps are a glance-and-next
rather than a fill-in. Every seeded value stays editable, and each one carries a one-tap
`Typical: 40% rh — use it` chip. Presets live in `ROOM_PRESETS` / `PROCESS_PRESETS`
(`lib/rfq.ts`) — adding an application is adding one object there.

## The readout — "Typical Industry Conditions"

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

## The maths

`lib/rfq-psych.ts` — ASHRAE Fundamentals moist-air properties (saturation pressure over
water and ice, humidity ratio, dew point, vapour pressure, density). Checked against the
published points at sea level: 70°F/30%rh → 32.5 gr/lb, 70°F/20%rh → 21.6, 75°F/40%rh → 51.6,
80°F/50%rh → 76.5.

`lib/rfq.ts` — the load set, arranged like IAT's internal moisture-load workbook:

| Source | Equation |
|---|---|
| Permeation | `area × permeance × Δ vapour pressure` |
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
| 3 | The space (isometric room diagram, design conditions, envelope) *or* the process spec |
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
   than the grey, so there is one thing to reason about.

### Verifying a PDF change

Render it and look at it — layout bugs here are invisible to the type checker. Poppler's
`pdftoppm -png -r 110 out.pdf page` is on the dev box and turns each page into an image.

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
  artefact than a receipt.

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
every staff note is correctly labelled without touching either. The admin trail gives those entries
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

- No weather lookup — outdoor design conditions default to 95°F/55% and are confirmed against
  ASHRAE design data by hand during the survey.
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
