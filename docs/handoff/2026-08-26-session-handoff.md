# Session handoff — 2026-08-26 (RFQ PDF, survey physics, notification scheduling)

Spans **three sittings**, 2026-08-24 14:07 → 2026-08-26 10:27 ET. **13 commits** on
`iat-forms-portal`, **14 files**. **No migrations. No env vars changed. No DNS.**
Repo at close: `54dfbdd`, clean, in sync with `origin/main`.
`supabase/migrations/093_super_admin_lee_childers.sql` stays uncommitted — owner's standing
decision, do not re-raise.

⚠️ **Other sessions worked this repo throughout.** Roughly 20 commits interleaved with these are
*not* this session's. Everything here was staged **by explicit path**. See §4.9 for the finding that
came out of that.

---

## 1. SCOPE

### What it set out to do

Resume `2026-08-24-session-handoff-dr-and-rfq-volume.md` at **§6.4 — "Render one PDF"**, the only
open thread marked *blocked on: nothing* and flagged "highest-value next engineering action".

### What actually got done

| | Outcome |
|---|---|
| §6.4 render one PDF | **Done**, and it found a live bug (§2.1) |
| Dimension callouts on paper | **Verified**, then found wrong a second way and re-fitted (§2.2) |
| Owner-directed RFQ changes | Seven separate requests, all shipped (§2.3–§2.9) |
| Notification scheduling | Grew from one bug into a full re-schedule (§2.10–§2.12) |

Everything after §2.2 was **owner-directed mid-session**, not planned.

### Left open

Six items in §6. None blocked on engineering except the ticket-reminder scope question, which needs
a decision the owner has not yet given.

---

## 2. CHANGE LOG

### A — RFQ PDF layout

#### 2.1 `8383ecb` — the envelope table stopped emitting a blank page

| File | What | Why |
|---|---|---|
| `lib/rfq-pdf.ts` | `ensure()` for the construction/envelope block: `9 + tableH(6)` → `4 + tableH(envelopeRows.length)`; rows hoisted to a named const | It reserved **65mm to draw 52mm**. `tableH()` already allows for the header row, so `rows + 1` double-counts it. Against the 59.1mm a typical room survey leaves, that spilled a continuation page holding one short table — on **every** room-track PDF since 08-21 |
| `docs/rfq-moisture-survey.md` | Corrected "still five pages", wrong for three days | The claim came from slack arithmetic and was checked against no rendered file |
| `CHANGELOG.md` | H2 | Standing rule |

**Measured, not reasoned:** y reaches 187.30mm, `CONTENT_BOTTOM` is 246.40mm, the block is 52mm and
clears by 7.1mm. Room surveys 6 → 5 pages.

#### 2.2 `a566e67` — the length callout follows the floor edge

| File | What | Why |
|---|---|---|
| `lib/rfq.ts` | `ROOM_RENDER_EDGES.floor` `{0.523, 0.937}` → `{0.479, 0.950}` | The line ran at **20.88°** against a floor edge that runs at **24.8°** — clear of the slab on the left, drifted onto the concrete by the right-hand end |
| `docs/rfq-moisture-survey.md`, `CHANGELOG.md` | The measurement method and the trap | Second correction to this line; both previous ones fitted too few renders |

**Fitted across all 39 room renders**, not a handful: strongest vertical gradient per column down the
slab's front-lower boundary, least-squares line, outliers dropped. 27 fitted at rms < 1.5px and
agreed at **24.75°–24.98°, median 24.80°**, slab corner at x ≈ **0.4786**. The 12 that would not fit
have floor edges occluded by contents — a detector failure, not different geometry.

`leftTop`, `apex`, `leftBot` **unchanged**, so the width and height callouts the owner had already
approved did not move.

#### 2.3 `1b13c20` — the takeaway shows the room render

| File | What | Why |
|---|---|---|
| `lib/rfq-pdf.ts` | Page 1 panel 2 "YOUR SPACE" draws `ctx.roomImage`; `roomPhotoDiagram` gains a `callouts` flag | The panel drew an abstract grey box while page 3 had shown the real room since 08-21 |

**Callouts are OFF on that copy and the reason is measured:** the panel is `T.duo` = 46mm on a page
with a fixed vertical budget, so the diagram slot is 27mm and cannot grow. Callout padding costs 17mm
each way → a **17.8 × 10mm** picture with unreadable 7pt labels. Without it, **42.7 × 24mm**. The
panel already prints the volume and L × W × H directly below.

### B — RFQ PDF branding

#### 2.4 `6e24fae` (part), `5a44088`, `eae315c` — letterhead, company colours, gradient

| File | What | Why |
|---|---|---|
| `lib/company.ts` | **NEW.** `COMPANY`, `companyAddressLine()`, `companyContactLine()` | ONE definition. A document that prints two different addresses is worse than one that prints none, and proposals/SOOs will want the same block |
| `lib/rfq-pdf.ts` | Letterhead on page 1 + cover; `brandNavy/brandBlue/brandSilver/brandLime/brandGreenDeep/onNavy/onNavyStrong`; `gradientBand()`; `markTile()`; all five dark blocks re-coloured; full-colour mark replaces the white knockout | Owner: "use more of our traditional Innovative Air colour scheme versus the green", then "use this logo… kind of fade from one color to the other" |

**Address** from the footer of the company website, read 2026-08-25, normalized to US postal form.
Corroborated inside the repo — `lib/ashrae.ts` uses the same town as its worked example because it is
the office's own location.

**Brand colours SAMPLED from `public/iat-logo.png`**, not picked: averaging its non-grey pixels gives
blue **#3b5fa8**, green **#56b043**, silver **#c0c0c0**.

🔴 **The portal's green is not the company's green.** `C.pine` #0a2e1e / DESIGN.md `--brand` #089447
is a *screen* system that had leaked onto the letterhead. The mark's green is #56b043 and the
letterhead colour is the blue.

### C — RFQ survey content and physics

#### 2.5 `6e24fae` (part) — step 5 stops hiding two questions

| File | What | Why |
|---|---|---|
| `components/support/RfqWizard.tsx` | Vapor barrier + building tightness out from behind the "Advanced" disclosure | Owner asked for them back on the page. Both feed `estimateLoad` and both carry a **live default** — hiding a question whose default is already costing the customer money is the shape this survey has hit twice |
| `lib/rfq.ts` | `TIGHTNESS_HELP.Average` "sealing programme" → "program" | American spelling. Display-only text, so safe — a material label would not be, `permOf()` matches by exact string |

#### 2.6 `6e24fae` (part) + `c58a471` — the estimated load leaves the customer's copy

Removed from **three** places: the page-1 amber panel, the cover's "Estimated load" at-a-glance tile,
and the load page's "Total to remove" tile. Still calculated, still on `rfq_requests.summary`.

`T.headline` (17mm) and its gap left the takeaway budget with it, **238 → 218mm**. Slack deliberately
NOT redistributed — that page's guarantee is that it never runs to two pages.

**Deliberately left:** the load page's "Room internal load" sub-line (a *component* the bars are made
of, now the only lb/hr on a room survey) and the whole process track (arithmetic on the customer's
own stated airflow, not an estimate of an unseen building).

#### 2.7 `943e411` — a conveyor pass-through is never closed

| File | What | Why |
|---|---|---|
| `lib/rfq.ts` | `DoorSpec.continuouslyOpen?`; `DOOR_TYPES` marks the conveyor; `estimateLoad` charges it 60 min/hr | Owner: drop *Opens per hour* / *Seconds open* for that type |
| `app/api/rfq/route.ts` | `continuouslyOpen` added to the door map | ⚠️ `coerce()` **rebuilds each door** — a field missing there is dropped on submit |
| `components/support/RfqWizard.tsx`, `lib/rfq-pdf.ts`, `app/admin/rfq/[id]/page.tsx` | Hide the two counters; state "open continuously"; PDF prints `Continuous / —` | The assumption is printed, not swallowed |

**The model changed with the UI on purpose.** Hiding the inputs while the stored `6/hr × 60s` kept
setting the price is the exact bug class this survey has hit twice. Measured on a 50 × 50 × 12 room
with one 4 × 2 ft pass-through: **8,489 → 84,894 gr/hr** on that opening, room total **3.02 → 15.03
lb/hr**. Legacy rows read back `undefined` and keep the counted model.

#### 2.8 `457629a` — makeup air: its own condition, and a load target

| File | What | Why |
|---|---|---|
| `lib/rfq.ts` | `ConditionKey` gains `vent`; `VentLoadTarget`, `VENT_LOAD_TARGETS`, `normalizeVentLoadTarget()`; `LoadEstimate` gains `ventGrPerHr` / `ventTarget` / `ventGrains`; engine branches | Box relabelled "Outdoor makeup air, vent for people, or exhaust" plus two new answers |
| `app/api/rfq/route.ts` | Pins `ventLoadTarget` | String union; the generic copy would accept anything |
| `components/support/RfqWizard.tsx` | `ConditionField` + `Segmented`, consequence printed below | `StepInside` now takes `setData` |
| `lib/rfq-pdf.ts`, `app/admin/rfq/[id]/page.tsx` | Condition folded into "Ventilation air in"; tile shows `ventGrPerHr`; closing note conditional | See §3.8 |

**Semantics confirmed with the owner before building** — the two readings are opposite:

| | `dehumidifier` (default, *preferred*) | `room` |
|---|---|---|
| Air is | ducted to the unit, dried first | delivered into the space untreated |
| Moisture | carried separately | a line in the breakdown |
| In `dryAirCfm`? | no | **yes** |

Measured, 500 cfm: total **25.75 lb/hr either way** — same water — but dry air **849 vs 8,438 cfm**.
Different equipment.

#### 2.9 `54dfbdd` — the tightness leakage rates were wrong

| Band | was | now |
|---|---|---|
| Tight | 0.25 | **0.10** |
| Average | 0.60 | **0.30** |
| Loose | 1.50 | **0.60** |

🔴 **The old Average (0.60) was exactly the new Loose.** A customer describing an ordinary building
was priced at the leakage rate IAT calls loose — every survey since the feature shipped. Corrected,
shell leakage falls to 0.40–0.50 of what it was (Average 10,400 → 5,200 gr/hr on a 50 × 50 × 12
warehouse).

Also: `Segmented` options gained an optional `title`, so hovering a band shows its rate, and the
selected band's rate is printed under the control.

### D — Notification scheduling

#### 2.10 `46ef5e2` — the leadership update's real fault

| File | What | Why |
|---|---|---|
| `lib/resend-leadership.ts` | `Promise.all` → sequential loop; returns `{ sent, failed }`; subject "IAT Leadership Update:" | **The only sender in the codebase firing parallel requests, and the only one with an attachment** — three simultaneous sends of a base64 .docx against Resend's documented 2 req/s |
| `app/api/cron/leadership-update/route.ts` | `releaseDay()`; traces `sent` / `sent-partial` / `failed` | A failure after the claim burned the day *and* disarmed the paired entry |
| `vercel.json` | 6:00pm → 6:30pm ET | Separation from the digest |

**The differential proves it.** On 08-24 the digest arrived and this did not, with an *identical*
sender to the *same three* mailboxes on the *same day*. Only the concurrency and the attachment
differed — which rules out the whole Proofpoint/SPF/spoofing family.

🔴 **A partial failure was silent** — it threw only when *every* send failed, so one success and two
429s returned "ok". That is why it "worked before" and then intermittently did not.

#### 2.11 `cb156f8` — both scheduled mails leave the deploy window, and the winter gap closes

| Job | was (ET) | now (ET) | backstops (ET) |
|---|---|---|---|
| Admin digest | 4:30pm | **6:00pm** | 7:00pm, +8:00pm in summer |
| Leadership (M/W/F) | 6:30pm | **8:30pm** | 9:30pm, +10:30pm in summer |

Owner deploys most days **4:30–5:30pm**; the digest was scheduled into its own worst hour.

🔴 **A DST pair gives a backstop in SUMMER ONLY.** The two entries exist so the *correct* one fires
each season — the earlier is skipped — so in winter exactly **one** entry can send. One lost
invocation Nov–Mar meant no digest and no report at all, and the claim-release had nothing to release
to. Both jobs now register **three** entries.

Windows moved with them: digest 16–18 → **18–20**, leadership 18–20 → **20–22**.

#### 2.12 `b44c4f4` — reminders to 3:00am

`rfq-reminders` and `ticket-reminders` `0 13 * * *` → `0 7` + `0 8` (3:00am ET, 4:00am backstop).
Owner deploys **every day at 9:00am**, and `ticket-reminders` had no backstop and no other caller.

**Two entries, not three, and no window guard** — these have no day-claim; idempotency is per ROW via
the migration-090 stamps, written only on success. Nothing is excluded by season, so both entries are
live in both seasons and each backstops the other.

### 2.13 — External state

| Where | Change |
|---|---|
| **Vercel** | `vercel.json` crons **7 → 9 → 11**. All 11 verified registered and `enabled: true` |
| **Supabase** | **No migrations.** Read-only queries only (`digest_runs`, `app_settings`, `rfq_requests`, `email_events`, `information_schema`) |
| **Env vars** | **None changed.** `vercel env pull` used read-only into the scratchpad |
| **DNS / SharePoint** | Untouched |
| **Emails sent** | None by this session. The 08-24 digest was hand-triggered by a *peer* session, not this one |

---

## 3. DECISIONS & LOGIC

**3.1 The PDF is verified by generating it in Node, not a browser.** `generateRfqPdf` early-returns
`null` from both image loaders when `window` is undefined, so it *looks* browser-only. Transpiling
the module graph and shimming `window` + `Image` + `document.createElement('canvas')` over `sharp`
runs the real module. Options: (a) drive the live wizard — blocked by the AnimatePresence hidden-tab
stall and reCAPTCHA; (b) a temporary route — rejected, this repo is public; (c) the shim. **(c) won**
and became the tool the whole session ran on.

**3.2 Fit render geometry across ALL renders, not a sample.** The floor edge had been corrected twice
already, each time from too few. Fitting all 39 and *reporting the residual* is what made the answer
trustworthy — good fits came in at rms 0.3px and useless ones at 20–60px, and nothing but that number
separates them.

**3.3 Callouts off on the takeaway render.** Options: (a) keep them and accept a 17.8 × 10mm stamp;
(b) grow the panel — impossible, fixed budget with ~2mm slack; (c) drop them and gain 42.7 × 24mm.
**(c)**, because the dimensions are already printed as text directly below.

**3.4 The load total left all three places, not the two named.** The owner named page 1 and the load
page. Removing only those left the identical figure on the cover, defeating the stated intent. I
flagged rather than assumed, and it cost a round trip — see §4.10.

**3.5 The conveyor's MODEL changed with its UI.** Options: (a) hide the inputs and keep pricing off
the stored values — rejected, that is the hidden-default bug this survey has hit twice; (b) hide them
and charge the aperture the full hour. **(b)**, with the assumption printed on the page.

**3.6 `ventLoadTarget` semantics were CONFIRMED, not inferred.** Two readings existed — "where the air
goes" vs "which total to report" — with **opposite** outcomes for the same label. Asked; the owner
chose "where the air goes".

**3.7 Leadership at 8:30pm, not the 8:00pm asked for.** The digest's third entry is 00:00Z = 8:00pm
EDT, and `admin-digest` runs the RFQ reminder sweep **before** its window and claim guards — so an
invocation that skips the digest still sends mail. Two mailing jobs on one UTC minute is exactly the
collision the owner asked to remove. Closest approach is now 30 min in both seasons.

**3.8 The makeup-air condition rides on an existing table row.** A new row cost 8mm and spilled the
breakdown for any survey with a second opening or room-load air. The block's reserve is **honest**
(97.4mm actual vs 96.4mm reserved), so there was no slack to reclaim — unlike §2.1, where the reserve
was inflated.

**3.9 Native `title` for the tightness tooltip.** The wizard already uses them (breakdown bars), there
is no shared Tooltip in `components/ui`, and a bespoke one would be a fourth pattern for the same job.
The same text is printed under the control, so nothing depends on hovering.

**3.10 The colour mark sits on a white tile.** Not decoration: the mark is green → silver → blue and
on a green-to-navy band its own colours land within a few shades of the field behind it. The tile is
what makes the *colour* logo usable at all.

### Rejected — do not re-propose

| Rejected | Why |
|---|---|
| Leadership at exactly 8:00pm ET | Collides with the digest's third entry, whose RFQ sweep sends mail before any guard (§3.7) |
| A "Makeup air" row in INTERNAL LOADS RECORDED | Spills the breakdown onto a sixth page; the reserve there is honest (§3.8) |
| Removing the process track's "Moisture removed" tile | Arithmetic on the customer's own stated airflow, not an estimate of an unseen building |
| Removing the "Room internal load" lb/hr sub-line | A component the breakdown bars are made of; removing it leaves them unexplained |
| Reinstating the load total on any page | Owner removed it from all three deliberately |
| Putting vapor barrier or tightness back behind a toggle | Both carry live defaults that price the survey |
| Re-`Promise.all`-ing the leadership sends | Three emails, three times a week. The concurrency was the bug |
| Relaxing the breakdown block's `ensure()` reserve | Measured honest at 97.4 vs 96.4mm |
| Trusting `vercel crons ls`'s "local changes pending" warning | False positive from duplicate paths (§4.7) |

---

## 4. GOTCHAS DISCOVERED

**4.1 🔴 `leadership_last_sent` is a CLAIM marker, not a send marker.** `claimDay()` writes it *before*
anything is sent. Two people read it as proof of delivery, including me — I told the owner "it did
send" on that basis and had to correct it. Worse, a failure after the claim burned the day *and*
disarmed the paired entry. Now released on a zero send.

**4.2 🔴 A partial Resend failure was completely silent.** The function threw only when *every* send
failed. One success + two 429s returned "ok". Intermittent-looking, invisible in every log.

**4.3 🔴 `coerce()` in `app/api/rfq/route.ts` REBUILDS each door.** A field not listed in that map is
dropped on submit — the browser prices one way, the stored record another.

**4.4 ⚠️ Several files in this repo are CRLF.** Multi-line edit anchors written with `\n` silently fail
to match. Detect and convert per file; a single-line anchor hides the problem.

**4.5 ⚠️ `sharp` resizes BEFORE it composites**, whatever order you call them in. Compositing a
full-size overlay then scaling in one chain fails with "image to composite must have same dimensions
or smaller". Finish the composite in its own pass, then resize.

**4.6 ⚠️ Cron lateness "14 to 63 minutes" is unsupported at BOTH ends.** Checked against the four
Resend measurements `docs/notifications.md` cites for it: 41, 33, 42 and **63 — which IS the ambiguous
two-entry digest row**. Nothing in the set is near 14 (minimum 33). Corrected there.

**4.7 ⚠️ `vercel crons ls` reports phantom "local changes pending deploy".** It pairs entries by path,
so a job with N entries reports (N−1) false "modified" rows. Compare the full registered set against
`vercel.json` instead; the count scaled 2 → 4 exactly as (entries−1) × paths predicts.

**4.8 🔴 DIAGNOSING FROM AN ABSENCE.** Three sessions spent an hour concluding a deploy had eaten the
08-24 digest, from nothing but a missing row past its usual landing time. It had not run yet. Four
confident causes were offered for one timestamp and three were wrong. **"Late" and "eaten" are
indistinguishable until the whole delay budget has passed.**

**4.9 🔴 A LOCAL COMMIT IS NOT A HOLD.** Any session's `git push` ships every commit on `main`. A
commit parked here deliberately went to production inside another session's push 26 minutes later.
Worse: it makes you **misreport your own deploy state** — a peer told its user it was "holding" 30
minutes after the work was live. Check `git rev-list --count origin/main..main` before saying the word.

**4.10 ⚠️ Reading an instruction too literally costs round trips.** The owner said "we just do not want
it in the customer's document" and named two boxes. I removed exactly two and flagged the third, which
was the same number. The intent was plain; the flag was the wrong call.

**4.11 ⚠️ `RESEND_API_KEY` pulls back EMPTY** from `vercel env pull` (sensitive-redacted), so Resend
cannot be queried from here. `LEADERSHIP_UPDATE_EMAIL` is only *Encrypted* and does decrypt.

**4.12 ⚠️ Vercel runtime logs return nothing for crons on this project** — confirmed again. Check side
effects, never the logs.

**4.13 ⚠️ `email_events` has 0 rows** because `RESEND_WEBHOOK_SECRET` is unset. Every send failure is
invisible. Setting it would have made 08-24 answerable in seconds.

**4.14 ⚠️ Nested template literals and apostrophes break generated edits.** A nested `${x ? \`...\` : y}`
and `'the room's own'` both produced unterminated-literal errors. Hoist to a named const.

**Looks wrong, is correct:**

- Leadership cron days are **`2,4,6`** (Tue/Thu/Sat), not `1,3,5`. 8:30pm ET is past midnight UTC, so
  a Monday-evening send is Tuesday in UTC. The route reads NY time and still resolves to Monday.
- Reminders register **two** entries where the digest needs three — no window excludes one.
- The takeaway render carries **no** callouts while page 3 does.
- `ventilationGrPerHr` is **0** under the room branch; `ventGrPerHr` is the figure to display.
- The digest's window still admits hour 18, overlapping leadership's 20–22 band — different jobs,
  30 min apart.

---

## 5. VERIFICATION STATE

| Change | tsc | Built | Deployed | Prod alias | Rendered | Browser |
|---|---|---|---|---|---|---|
| Envelope page fix `8383ecb` | ✅ | ✅ | ✅ | ✅ | ✅ 6→5, measured | n/a |
| Floor callout `a566e67` | ✅ | ✅ | ✅ | ✅ + bundle grep | ✅ 39 renders + PDF | ⚠️ no |
| Takeaway render `1b13c20` | ✅ | ✅ | ✅ | ✅ + bundle grep | ✅ | ⚠️ no |
| Leadership send fix `46ef5e2` | ✅ | ✅ | ✅ | ✅ crons ls | n/a | **⚠️ never sent since** |
| Schedule move `cb156f8` | ✅ | ✅ | ✅ | ✅ 9 entries enabled | n/a | n/a |
| Reminders 3am `b44c4f4` | ✅ | ✅ | ✅ | ✅ 11 entries enabled | n/a | **⚠️ never fired since** |
| Step 5 / letterhead / load total `6e24fae` `c58a471` | ✅ | ✅ | ✅ | ⚠️ not re-checked | ✅ | ⚠️ no |
| Conveyor `943e411` | ✅ | ✅ | ✅ | ⚠️ not re-checked | ✅ engine + PDF | ⚠️ no |
| Makeup air `457629a` | ✅ | ✅ | ✅ | ⚠️ not re-checked | ✅ both branches | ⚠️ no |
| Brand colours `5a44088` `eae315c` | ✅ | ✅ | ✅ | ⚠️ not re-checked | ✅ before/after | ⚠️ no |
| Tightness rates `54dfbdd` | ✅ | ✅ | ✅ | ⚠️ not re-checked | ✅ engine + PDF | ⚠️ no |

### Explicitly NOT verified

- **NOTHING in the RFQ wizard was browser-tested this session.** Steps 5, 6 and 7 all changed.
  Reaching step 7 needs six steps filled and the wizard stalls in automated browsers. Everything is
  typechecked, built, and verified through the real engine and rendered PDFs — but no human or browser
  has driven the actual controls.
- **The leadership update has not sent since the fix.** 08-26 20:30 ET (Wednesday) is the first run.
- **The 3:00am reminders have not fired since moving.** First run 08-27.
- **The 6:00pm digest has not fired since moving.**
- **Prod alias was confirmed for the first three commits only.** The later ones were pushed and the
  deploys observed READY, but the alias/bundle was not re-checked each time.
- **No PDF has been printed.** All colour and layout judgements are from screen rasters at 130–160dpi.
- **The ~10 existing quote requests** were priced at the old tightness rates. Their stored numbers are
  unaffected by design, but nobody has looked at whether any are live deals.

---

## 6. OPEN THREADS

**1. Ticket reminders — scope decision, blocked on the owner.** They asked these "go out daily to any
IAT employee that has something assigned to them in any portal". **That is not what the job does.** It
chases what has gone *stale*, and "assigned" spans four tables of which two are swept:

| Table | Column | Chased? |
|---|---|---|
| `tickets` | `owner_id` | ✅ |
| `rfq_requests` | `assignee_id` | ✅ |
| `deals` | `assigned_to` | ❌ |
| `production_tasks` | `assignee` | ❌ |

Recommendation: extend coverage to the two missing tables, keep the stale-only trigger. A daily mail
to everyone holding anything trains people to ignore it. *Blocked on: owner.*

**2. The old-rate quote requests.** ~10 existing requests were priced at Average = 0.60 when the table
says 0.30 — roughly double the air leakage. Stored figures do not change. **If any are live deals,
their number is wrong.** Offered to list which and by how much; no answer yet. *Blocked on: owner.*

**3. `RESEND_WEBHOOK_SECRET` is unset**, so `email_events` is empty and send failures are invisible.
One env var. *Blocked on: nothing.* Highest-value small item.

**4. Wednesday 8:30pm ET leadership run** — first since the parallel-send fix. Check
`app_settings.leadership_last_invocation`, which now records the send outcome rather than only a
claim. *Blocked on: the clock.*

**5. Carried from the previous handoff, still open:** rehearse a DR restore; lock down
`disaster-recovery/` in SharePoint; Supabase Pro (~$45/mo); the public-repo question; digest opt-out
for three admins; RFQ-2026-0009 and 0010 still unassigned (created 08-20). *Blocked on: owner, except
the restore rehearsal.*

**6. The deploy-vs-cron collision itself is unfixed.** Both mails moved out of the deploy window,
which removes the *exposure*, not the *cause*. 08-24 turned out to be a false alarm — do not let that
become the reason it stays open.

---

## 7. RESUME CONTEXT

### Read first

1. **This file's §4** — especially 4.1 (claim marker), 4.8 (diagnosing from absence) and 4.9 (a local
   commit is not a hold).
2. `docs/handoff/2026-08-24-session-handoff-dr-and-rfq-volume.md` — the thread this resumed.
3. `docs/notifications.md` — rewritten this session by a peer; its lag section is now honest.
4. `docs/rfq-moisture-survey.md` — the survey's own record; several new sections.
5. Memories: `rfq-moisture-survey`, `rfq-render-dimension-callouts`, `always-eastern-time`,
   `scoped-commit-parallel-sessions`, `deploys-near-cron-time-eat-the-run`,
   `rfq-option-lists-are-physics-tables`.

### Key paths

```
lib/rfq.ts                      TIGHTNESS_RATES, ROOM_RENDER_EDGES, DoorSpec.continuouslyOpen,
                                VentLoadTarget, ConditionKey('vent'), estimateLoad
lib/rfq-pdf.ts                  gradientBand(), markTile(), brand* colours, ensure() reserves
lib/company.ts                  NEW - the company's name/address/website, one definition
lib/resend-leadership.ts        sequential sends, { sent, failed }
lib/admin-digest.ts             withinDigestWindow 18-20
app/api/cron/leadership-update/route.ts   withinSendWindow 20-22, releaseDay(), trace()
app/api/rfq/route.ts            coerce() - PIN every string union, and doors are REBUILT here
components/support/RfqWizard.tsx  StepShell(5), StepOpenings(6), StepInside(7), Segmented.title
vercel.json                     11 cron entries; DST pairs/triples share a path
```

### The PDF harness (the session's main tool)

Not in the repo — rebuild it in a scratch dir. Recipe is in `docs/rfq-moisture-survey.md` under
**"Verifying a PDF change"**. In short:

```bash
node node_modules/typescript/bin/tsc \
  lib/rfq-psych.ts lib/rfq.ts lib/company.ts lib/render-assets.ts lib/rfq-renders.ts lib/rfq-pdf.ts \
  --module commonjs --target es2022 --moduleResolution node --esModuleInterop \
  --skipLibCheck --outDir <scratch>
```

then run the real `generateRfqPdf` with `window`, `Image` and `document.createElement('canvas')`
shimmed over `sharp`. ⚠️ `toDataURL` is synchronous and sharp is not — the encode must be an
`execFileSync` child. ⚠️ Shim `window` FIRST or both loaders return null.

### Commands

```bash
# typecheck - never `npx tsc` (fetches a squatter)
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json

# build without killing another session's dev server
NEXT_BUILD_DIST_DIR=.next-verify npm run build
git checkout -- tsconfig.json && rm -rf .next-verify

# ET, always - TZ= does NOT work in Git Bash here
node -e "console.log(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}))"

# am I actually holding, or has it shipped?
git rev-list --count origin/main..main

# crons - compare the SET, do not trust the pending warning
vercel crons ls

# DB
node_modules/.bin/supabase db query --linked "select ..."

# rasterise a PDF (poppler, in the WinGet packages dir)
pdftoppm -png -r 130 out.pdf page
pdftotext -layout out.pdf -
```

### Rules that bit this session

- **`git add` by explicit path.** ~20 concurrent commits from other sessions.
- **A local commit is not a hold** — stash or branch if it truly must not ship.
- **Report times in Eastern**, always. Cron entries are UTC and their ET meaning shifts with DST.
- **Build before pushing.** Push = production deploy.
- **Never diagnose from an absence.** Wait out the whole delay budget.
- **Measure the reserve before changing an `ensure()`** — over-reserving in a *last* block emits a
  whole page; here one was inflated and another was honest.
- No competitor names, no customer names or organizations.
