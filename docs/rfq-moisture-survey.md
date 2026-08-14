# RFQ — Request for Quote (guided moisture survey)

**Live:** `/support/rfq` · **Admin queue:** `/admin/rfq` · **Shipped:** 2026-08-14 · **Migration:** 087

The interactive replacement for the two Word documents we used to email as attachments —
*IAT Quote Request and Moisture Survey Form*, Room and Process. A customer answers a guided
survey in about three minutes, watches the numbers build as they type, and leaves with a
branded PDF. The survey lands in `rfq_requests` and pings the sales desk.

---

## The fork

The first screen asks the one question that reshapes everything after it:

| Track | When | What we size on |
|---|---|---|
| **Room** | A space held at a condition — warehouse, cold store, dry room, production hall | Moisture load calculated from the room itself |
| **Process** | Dry air delivered to a machine, line or vessel | Grain depression × airflow |

The two tracks then ask genuinely different questions (9 steps vs 7). Switching is offered
**only on the application step**, where nothing branch-specific has been entered yet — past
that point a silent switch would strand half the answers.

## Typical values are the whole trick

Picking an application seeds the target condition, the surrounding space, occupancy and door
activity with numbers a person in that industry recognises, so most steps are a glance-and-next
rather than a fill-in. Every seeded value stays editable, and each one carries a one-tap
`Typical: 40% rh — use it` chip. Presets live in `ROOM_PRESETS` / `PROCESS_PRESETS`
(`lib/rfq.ts`) — adding an application is adding one object there.

## The live readout

The right rail computes as you type: grains, dew point, the running load estimate, a bar
breakdown by source and the dry-air cfm. This is the engagement moment — it also quietly
teaches the customer that **relative humidity alone cannot size a dehumidifier**, which is the
single most useful thing a first-time buyer can learn.

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
| 1 | Cover — project identity, four at-a-glance tiles, contact + project detail, purpose |
| 2 | The space (isometric room diagram, design conditions, envelope, openings) *or* the process spec |
| 3 | *Room only* — internal loads, estimated breakdown bars, totals, disclaimer |
| 4 | Equipment & utilities + standing engineering notes from the paper form |
| **Last** | **The takeaway infographic** — one page, the customer's own numbers |

### Two rules for editing the PDF

1. **Every string passes through `san()`.** jsPDF's Helvetica is WinAnsi-encoded and does not
   fall back — `≈` rendered as `ʺH` and `′` as a stray `2` before the sanitiser existed. It is
   a silent corruption, not an error.
2. **The takeaway page has a fixed vertical budget** (the `T` constants). It must stay one page
   no matter how long the project name is or how many load lines there are, so panel heights
   are constants and their contents are sized to fit. Change one, re-check the total.

---

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

`/admin/rfq` (list) and `/admin/rfq/[id]` (read-only detail), gated on the **`deals`** perm and
mapped in `ADMIN_PATH_PERMS`. That mapping is load-bearing: an *unmapped* `/admin/*` path falls
back to `dashboard`, which every scoped role holds — it would have shown a stranger's contact
details to HR, marketing and production. An RFQ shares the sales trust boundary because it is
the front of the pipeline and becomes a deal.

Opening a detail marks it read, which is what makes the "Unread" stat mean anything.

## Known gaps

- No weather lookup — outdoor design conditions default to 95°F/55% and are confirmed against
  ASHRAE design data by hand during the survey.
- No file/drawing upload; the form asks customers to mention drawings in the notes.
- The admin detail is read-only — `status` and `internal_notes` columns exist but have no UI yet.
