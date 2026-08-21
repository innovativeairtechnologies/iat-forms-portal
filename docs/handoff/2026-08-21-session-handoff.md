# Session handoff — 2026-08-21

Covers one long session spanning **2026-08-19 16:00 → 2026-08-21 10:40 ET**. One repo touched
(`iat-forms-portal`), **19 commits**, one new Supabase storage bucket, one cron added and removed,
one long-standing scheduled job fixed that had never once run.

Written for a session picking this up cold. Read §6 first if you are in a hurry.

**Final state:** `iat-forms-portal` at `eafa756`, clean, in sync with origin. One untracked file,
`supabase/migrations/093_super_admin_lee_childers.sql`, is **not mine** and is deliberately
uncommitted — see §3.9.

⚠️ **This tree is shared.** Seven of the 26 commits in this range came from concurrent sessions and
are NOT described here: `516dd66`, `b913195`, `8061c1b`, `42502a6`, `ada3c3a`, `1c80d26`, `fb07483`.
Always `git add` by explicit path.

---

## 1. SCOPE

### What it set out to do

Resume the 2026-08-19 handoff. The immediate question was §6.3 of that document: tonight's one-off
leadership email duplicated Monday's edition — narrow it or suppress it?

### What it became

A continuous build-and-ship stream at the owner's direction. Everything below was asked for
in-session, not planned.

| Area | Outcome |
|---|---|
| One-off leadership email | Narrowed to two days; sent and **delivered** |
| Leadership report engine | Two silent-failure bugs found and fixed |
| Daily admin digest | **Had never sent since built.** Root-caused and fixed; first send landed |
| RFQ outdoor design conditions | Replaced a national placeholder with real ASHRAE data per site |
| RFQ Celsius entry | °F/°C toggle across the survey |
| RFQ step 5 | Wall build-up images, hover-magnify, tightness restored, Advanced disclosure |
| RFQ option lists | "Not sure" / "Let IAT recommend" / "Painted galvanized" removed throughout |
| American spellings | Standing rule established and applied |
| Em dashes | Removed from all customer-facing copy and every outgoing email |
| RFQ colour scheme | Five accent tones cut to two |
| Room render library | 86 images stored, optimised and indexed |

### Left open

1. **The render build has no spec** (§6.1). Assets are ready; the feature is not defined.
2. **Only 16 of 37 room cutouts can take an overlay** (§6.2) — needs re-exports.
3. **21 RFQ presets have no render mapping** (§6.3) — needs owner judgment.
4. **`school` overlay set is unusable** until re-exported.
5. **Building Materials / Dehumidifier Placement zips not uploaded** (§6.4).
6. **Celsius toggle and most RFQ steps were never click-tested** (§5).

---

## 2. CHANGE LOG

### 2.1 — Leadership report: interim periods (`eed8bf8`, `b3b228f`)

| File | Change | Why |
|---|---|---|
| `lib/edition.ts` | `Edition` generalised to `ReportPeriod` with a `kind` field; new `interimPeriod(from, to)`; `parseEdition` refactored onto a shared `parseDay()` | The one-off was pointed at edition `8.17.26` — the same edition Monday sends five days later. Two documents, same subject, same attachment filename, different contents, one inbox |
| `lib/leadership-update.ts` | Prompts became functions of the period; `entriesForEdition` → `entriesForPeriod`; `LeadershipUpdate.edition` → `.period` | For an edition every prompt string is byte-identical to before, so the Monday report is provably unchanged |
| `lib/leadership-docx.ts` | Header, empty state and part-2 blurb switch on `period.kind` | A two-day report that still said "week" would be wrong in the reader's hands |
| `lib/resend-leadership.ts` | Subject, header, body and **filename** switch on kind — `IAT-Portal-Interim-<id>.docx` | An interim must never borrow an edition's filename |
| `app/api/cron/leadership-update/route.ts` | New `?from=&to=`, mutually exclusive with `?edition=`; docblock rewritten | |
| `vercel.json` | One-off cron repointed, then **removed** after it fired | |

### 2.2 — Leadership report: two silent-failure bugs (`5cb2038`)

| File | Change | Why |
|---|---|---|
| `lib/leadership-update.ts` | `parseSections()` returns null instead of throwing; both halves retry; `stop_reason` inspected; `max_tokens` 2000→4000 and 3000→4000; empty technical half now `console.error`; both prompts told never to use a double quote inside a line | `JSON.parse` on the model reply was **unguarded**. One unescaped double quote — and the brief is written in quoted examples — threw out of the function, the route returned 500, and **nothing sent**. The technical half had the mirror bug: its parse sat in a try/catch and came back silently empty |

### 2.3 — Daily admin digest (`20a0bf8`)

| File | Change | Why |
|---|---|---|
| `lib/admin-digest.ts` | `isDigestTime()` split into a testable `withinDigestWindow(hour)`; window widened from a 10-minute band to hours **16–18** | `digest_runs` had **zero rows since migration 038 created it**. Vercel fires crons here 14–63 minutes late; the old window was 16:25–16:34 against a job scheduled for 16:30 exactly, so it missed every single day |
| `app/api/cron/admin-digest/route.ts` | `sent` hoisted; the day's claim is **released when `sent === 0`** | The route claimed the day before sending and never released it, so a failure fetching the briefing burned the whole day silently |

**No migration.** `digest_runs` (038) was already correct; only the guard was wrong.

### 2.4 — RFQ: outdoor design conditions from ASHRAE (`a9f1da4`, `9a32206`, `2047b93`)

| File | Change | Why |
|---|---|---|
| `lib/ashrae.ts` | **NEW.** `designForSite(lat, lon)` → nearest station's 0.4% dehumidification design point. `ASHRAE_VERSION = '2025'`, `MAX_STATION_MI = 100` | `emptyRfq()` seeded outdoor design at 95°F/55%rh and the room flow never asked, while `estimateLoad()` costed ventilation and infiltration from it |
| `app/api/rfq/elevation/route.ts` | Returns a `design` block alongside elevation; the two lookups run in parallel | Elevation stays USGS — a station is an airport tens of miles away |
| `lib/rfq.ts` | `outdoorSource` and `outdoorVintage` added to `RfqData` | Customer-facing attribution without the edition year; staff keep the vintage |
| `components/support/RfqWizard.tsx` | Step 1 lookup fills elevation **and** the outdoor condition in one atomic update | `setCondition` converts grains↔rh *at* an elevation, so elevation must land first |
| `lib/rfq-pdf.ts` | Attribution sentence appended to the existing design note | The PDF has a fixed mm budget; a sentence is cheaper than a row |
| `app/admin/rfq/[id]/page.tsx` | `OutdoorSource` pill + vintage pill | |

### 2.5 — RFQ: Celsius entry (`3a1a86e`)

| File | Change | Why |
|---|---|---|
| `lib/rfq.ts` | `TempUnit`, `TEMP_UNITS`, `fToC`/`cToF`, `tempToDisplay`, `tempFromDisplay`, `modeIsTemperature`; `tempUnit` on `RfqData` | Storage stays °F everywhere; Celsius is an entry-and-display choice only |
| `components/support/RfqWizard.tsx` | New `TempInput` with a **local text buffer**; dry bulb and the dew-point/wet-bulb moisture field both follow the unit; readout converts | See §4.3 and §4.4 |

### 2.6 — RFQ step 5 (`3a1a86e`, `b212e60`, `f77aa95`, `61a3fa7`)

| File | Change | Why |
|---|---|---|
| `public/rfq/shell-{good,better,best}.webp` | **NEW.** Three wall build-ups, 900px webp from 1.2MB PNGs | Envelope questions are the ones customers guess at |
| `components/support/RfqWizard.tsx` | `SHELL_EXAMPLES` above the material dropdowns; hover magnifies the figure to 2×; outer cards lean outward via `origin-[25%_50%]` / `origin-[75%_50%]`; vapor barrier + tightness folded behind an **Advanced** disclosure | Callouts render ~7px at a third of the row and cannot be read |
| `lib/rfq.ts` | `Tightness` drops `'Not sure'` | Its rate was 0.6, identical to `Average`, and the lookup already falls back to Average |

**Tightness is live again** — it was commented out on 08-19 while `data.tightness` stayed at
`'Average'` and `estimateLoad()` kept costing infiltration from it. That closed §6.1 of the previous
handoff.

### 2.7 — RFQ option lists (`79027f4`, `75fd147`, `b212e60`, `3a1a86e`)

`lib/rfq.ts` — all display-only, none read by `estimateLoad`, so deletions rather than retirements:

- `HEATING_TYPES` drops `'Not sure'`
- `VaporBarrier` drops `'Not sure'`; default `'Not sure'` → `'No'` (identical result: only `=== 'Yes'` is tested)
- `MERV_OPTIONS`, `INSTALL_LOCATIONS` drop `'Not sure'`
- `CONSTRUCTIONS` drops `'Painted galvanized'` and `'Let IAT recommend'`
- `INSTALL_LOCATIONS` cut to `['Indoor', 'Outdoor']`
- `regenAirSource` (inline at the call site) drops `'Let IAT recommend'`

### 2.8 — American spellings (`201fe32` and others)

Customer-facing strings, comments, `docs/`, and 53 instances in `CHANGELOG.md`.
⚠️ `LEGACY_MATERIAL_LABELS` added to `lib/rfq.ts` — see §4.1.

### 2.9 — Em dashes (`201fe32`, `eafa756`)

| Commit | Scope | Count |
|---|---|---|
| `201fe32` | RFQ wizard, both support forms, status page, customer portal, quote PDF, three email modules | 164 |
| `eafa756` | The **eight `lib/resend-*.ts` modules the first pass never scanned** | 26 |

Each rewritten by hand. Server `console.log` strings and the standalone `'—'` empty-cell
placeholders are deliberately untouched.

### 2.10 — RFQ colour scheme (`af77cb7`)

`components/support/RfqWizard.tsx` — `Tone` reduced from five to `'sky' | 'amber'`; `TONE` map
trimmed; a hardcoded `bg-violet-50/60` panel on the space step routed through `TONE.sky.softBg`;
the site-conditions lookup button given `bg-brand-soft` + `text-brand-ink`; `USGS 3DEP` removed
from the result line and the now-unused `source` state deleted.

### 2.11 — Room render library (`10a535c`)

| File | Change |
|---|---|
| `lib/render-assets.ts` | **NEW.** Typed index of 86 images: `renderAsset()`, `assetsInSet()`, `overlaysForRoom()`, `compositableCutouts()`, `renderAssetUrl()` |

Images are **not in git**. See §2.12.

### 2.12 — Infrastructure state changes

| System | Change | Notes |
|---|---|---|
| Supabase storage | **New public bucket `render-assets`** | 86 objects, 8.5 MB. Was 285 MB of a 1 GB free-tier cap before |
| Supabase `digest_runs` | **First row ever**: `2026-08-20`, `recipient_count: 3` | |
| Vercel crons | One-off added `0 22 19 8 *`, then **removed**. Back to **7 jobs** | |
| Env vars | **None added, changed or removed by me.** A concurrent session added `RESEND_FROM_INTERNAL` (`b913195`) | |
| DNS | **No changes** | |
| SharePoint | Owner created a **separate `Render Assets` document library** on the `IATDocumentation` site and moved all five zip folders there | See §3.8 |

---

## 3. DECISIONS & LOGIC

### 3.1 — Interim ≠ edition, and Monday still sends the full week

**Options:** (a) send edition 8.17.26 tonight as planned; (b) narrow tonight AND narrow Monday to
avoid the overlap; (c) send a two-day interim tonight, leave Monday untouched.

**Chose (c).** (b) looks tidy and is wrong: **fifteen of that edition's twenty-five entries are dated
17 August and had never been mailed to anyone.** Narrowing Monday would not remove a duplicate, it
would drop most of the week. Saying two days twice is the cheaper mistake.

An interim therefore carries its own label, range and filename, and never consumes the edition it
sits inside.

### 3.2 — Digest window: idempotency, not precision

**Options:** (a) widen to `hour === 16`; (b) move the cron to the top of the hour and widen to the
hour; (c) drop the narrow check and lean on `digest_runs`' unique index, keeping a broad sanity
bound.

**Chose (c), hours 16–18.** (a) is **insufficient** — the entry runs at :30 past, so any delay over
thirty minutes crosses into 17:xx. **Excluding hour 15 is load-bearing:** it makes the correct entry
win in each season, because the earliest *eligible* invocation claims the day.

|  | 20:30 UTC | 21:30 UTC | sends |
|---|---|---|---|
| EDT | 16:30 NY **claims** | 17:30 NY no-op | ~4:30–4:45pm |
| EST | 15:30 NY *skipped* | 16:30 NY **claims** | ~4:30–4:45pm |

**Vindicated in production:** the first real send fired **63 minutes late**, landing in hour 17.
Option (a) would have missed again.

### 3.3 — ASHRAE: the owner reversed a prior decision, knowingly

The 2026-08-19 session **declined** to build on `ashrae-meteo.info` because ASHRAE's Climatic Design
Conditions are copyrighted and sold by ASHRAE. That position was put to the owner with the licensing
argument stated; the owner chose **full customer-facing prefill** for consistency with the DryWare
calculators.

Recorded so it stays re-decidable. `lib/ashrae.ts` is the only file that would have to go.

**Rejected: elevation from the ASHRAE station.** A station is an airport tens of miles away —
Covington, GA is 745 ft, its nearest station 29 miles out at 943 ft. USGS resolves the actual site.

### 3.4 — Dehumidification, not cooling

`outdoorTempF` feeds **only** `grains()` and `vaporPressureInHg()`; there is no sensible term in
`estimateLoad()` (`sensibleLoadBtuh` is customer-entered). So the dehumidification point's cooler
MCDB costs nothing while capturing the moisture extreme. Cooling 0.4% would have cut Atlanta's grain
depression from **81.8 to 47.3 gr/lb** — the classic way to undersize a dehumidifier.

### 3.5 — ASHRAE 2025, and DryWare tracks no vintage

Started on 2021 out of caution, guessing DryWare might read an older set. The owner confirmed
**DryWare does not track an ASHRAE vintage**, so there is nothing to stay in step with. Switched to
2025 after checking coverage across eight US sites rather than assuming. ⛔ Do not re-open.

### 3.6 — A unit flip must never write

Tenths of °C and °F do not line up — 105°F displays as 40.6°C, which re-enters as 105.1°F. A toggle
that wrote the converted value back would edit a survey every time someone looked at it in the other
scale. Display converts; only a keystroke writes.

### 3.7 — Two tones, enforced by the type

Rose, violet and emerald were **deleted from the `Tone` union**, not left unused — an unused fifth
colour is one commit from being a sixth. Dropping emerald also aligns with the house rule that brand
green belongs to the single primary action.

⚠️ Order matters: convert **everything** to sky first, then hand amber back to the two callouts that
earn it. The other order wipes the step-3 badge the owner asked to keep.

### 3.8 — Render assets: bucket for the web, SharePoint for the masters

**Rejected: committing them to git.** 590 MB of binaries in a **public** repo is permanent bloat.

**Rejected: uploading originals.** Supabase was at 285 MB of a 1 GB cap; raw would have left ~150 MB
and eventually broken ticket-photo uploads, a live customer path. 275 MB → **8.5 MB** as webp.

**Rejected: a subfolder in the Jerry library.** The KB sync runs `driveDelta()` over an entire
document library from the root, and its supported types include `image/jpeg` and `image/png` — a
subfolder would still be swept. A **separate document library** is a different `driveId` and is
invisible to it. The owner created `Render Assets` on that basis.

⛔ **RFQ step 5 keeps its three committed webps.** Repointing it at the bucket was considered and
rejected by the owner. Do not re-propose.

### 3.9 — Migration 093 stays untracked

An untracked `supabase/migrations/093_super_admin_lee_childers.sql` grants super-admin to
`lee.childers@`. It is **already applied to production** and the file is only a record. The case for
committing it was put to the owner, who chose to leave it. ⛔ Do not re-raise. Also deferred:
revoking the departed employee's flag, and adding a second approver.

---

## 4. GOTCHAS DISCOVERED

### 4.1 — Renaming a material label silently re-prices every stored survey 🔴

`permOf()` matches `x.label === label` **exactly** and falls back to the **LAST array entry**.
Americanising `'Concrete over vapour barrier'` would have dropped every stored survey from 0.16 perm
onto the 0.4 retired row — a silent 2.5× change to floor permeation on historical quotes, with no
error anywhere.

Fixed with `LEGACY_MATERIAL_LABELS` and asserted **both ways**: old spelling now prices identically
(202.18 gr/hr), an unknown label still falls back (231.87). **Any future material rename needs an
entry there.**

### 4.2 — Vercel crons on this project run 14–63 minutes late

Measured from send timestamps: 13:00→13:41, 21:30→22:03, 22:00→22:42, and the digest at
20:30→21:33 (**63 min**). Any guard reading the clock must be at least an hour wide.

### 4.3 — A converting input needs a text buffer

Convert on every keystroke and feed the result back as the value and typing breaks: `"20."` parses
to 20, stores 68°F, redisplays `"20"`, and the next digit makes **205**.

### 4.4 — I broke dew-point rounding and did not notice

`fmtDewPoint()` rounded; the unit-aware rewrite swapped in `tempToDisplay()`, which returns the raw
value untouched in Fahrenheit. `49.05563453465°F` reached the page. **Caught by the owner looking at
the screen, not by any check.**

### 4.5 — An LLM asked for JSON in a brief full of quotes will emit unescaped quotes

Never call `JSON.parse` on a model reply without a guard. And never let the path that degrades
silently be the one nobody watches — see §2.2.

### 4.6 — Tailwind escapes `%` as well as `[` `]` and `:`

Three greps reported `sm:hover:scale-[2]` and `origin-[25%_50%]` **missing** from the compiled CSS.
All three were shell-escaping false negatives. Match exactly in node, not through a shell — and
check the compiled stylesheet, because a class that is never generated fails silently here.

### 4.7 — Sweep by glob, never by a hand-written file list 🔴

The em-dash pass hand-listed **three** `lib/resend-*.ts` modules when there are **eleven**. Eight
were never scanned and 26 em dashes kept going out for a full day, including the customer ticket
confirmation subject — probably the most-sent email in the system. Caught by reading the live send
log, not by any check I ran.

### 4.8 — The RFQ wizard cannot be driven past step 1 in an automated browser

`AnimatePresence mode="wait"` will not mount the next step until the exit animation completes, and
`requestAnimationFrame` never fires in a hidden tab. Both automation surfaces here run hidden. The
panel freezes mid-exit at `translateX(-23.89px)` of a −24px transform.

⚠️ **This is not a product bug.** I reported it as one mid-session and was wrong. Verify against the
deployed bundle instead.

### 4.9 — Vercel returns env values still envelope-encrypted — but only *sensitive* ones

`CRON_SECRET` is type `sensitive` and unreadable by any route. `LEADERSHIP_UPDATE_EMAIL` is merely
`encrypted` and pulls fine. The previous handoff's "every value comes back EMPTY" over-generalised
from two sensitive vars. `vercel env ls` does not show the type; the API's `envs[].type` does.

### 4.10 — Looks wrong, is correct on purpose

- The retired `'Not sure'` material rows must stay **last** in their arrays.
- The `'Not sure'` inside the commented-out tightness block was left as-is so restoring it stays a pure uncomment. It is now live anyway.
- `rose-*` classes survive in `RfqWizard.tsx` — required-field asterisk, error text, Remove hover. Those should stay red.
- Only 16 of 37 cutouts carry `overlayCanvas: true`. That is data, not a bug.
- Building Materials will be a **second copy** of the step 5 artwork when uploaded. Accepted.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Prod alias | Browser-tested |
|---|---|---|---|---|
| Interim leadership period | ✅ | ✅ | ✅ | n/a — **email delivered, verified in Resend** |
| Leadership JSON hardening | ✅ | ✅ | ✅ | n/a — both period types generated locally, both halves present |
| Digest window + claim release | ✅ | ✅ | ✅ | n/a — **`digest_runs` gained its first row; 3 emails delivered** |
| ASHRAE design conditions | ✅ | ✅ | ✅ | ❌ — verified via the **live endpoint** across 4 cities |
| ASHRAE 2025 switch | ✅ | ✅ | ✅ | ❌ — coverage checked across 8 sites |
| Celsius entry | ✅ | ✅ | ✅ | ❌ **NOT TESTED — highest-risk item** |
| Dew-point rounding fix | ✅ | ✅ | ✅ | ❌ — asserted against literals in both units |
| Step 5 images + hover | ✅ | ✅ | ✅ | ❌ — classes confirmed in the **shipped stylesheet** |
| Tightness + Advanced | ✅ | ✅ | ✅ | ❌ |
| Option-list trims | ✅ | ✅ | ✅ | ❌ — confirmed in the **shipped bundle** |
| Em dashes (both passes) | ✅ | ✅ | ✅ | ❌ — 0 rendered em dashes left; confirmed in bundle |
| Colour scheme | ✅ | ✅ | ✅ | ❌ |
| Render asset index | ✅ | ✅ | ✅ | n/a — 4 public URLs fetched, alpha round-tripped |

### Explicitly NOT verified

1. **The Celsius toggle has never been clicked.** Conversions are asserted against literals, but the
   buffer behaviour, the unit selector and the dp/wb interaction are untested in a browser.
2. **Steps 2–9 of the RFQ have not been seen since these changes** — the colour scheme, the Advanced
   block, the hover magnify and the option trims are all unobserved.
3. **No RFQ has been submitted end to end** since the ASHRAE change, so no PDF has been generated
   with the new attribution line.
4. **The 2026-08-24 Monday leadership send has not happened.** It will use the hardened parser for
   the first time on a real edition.

---

## 6. OPEN THREADS

### 6.1 — The render build has no specification 🔴

**This is where we stopped.** The owner said "initially we will reference these in the RFQ" and asked
what would be built. Nothing is queued. What exists is plumbing:

```
renderAsset('rooms-cutout', 'food-processing')  →  a URL, 1600×1218, transparent
overlaysForRoom('food')                          →  dimensions, occupants, openings, product
```

**Next action:** get the step and the interaction from the owner, then propose the preset→render
mapping table (§6.3) for approval **before writing code**.

### 6.2 — Overlays composite on 16 of 37 rooms 🔴

Overlays were drawn on a **2600×1980** canvas. Twenty-one cutouts were exported **trimmed to their
content bounds**, so each is a different size and an overlay lands at the wrong offset and scale.
Trimming discards the offset — it cannot be recovered from the file.

⚠️ **`school` is one of the trimmed ones**, and School is one of only **two** rooms that has
overlays. **Only `food` composites today.**

**Blocked on:** re-exporting `school` (and the other 20) at full canvas.

### 6.3 — 11 of 18 RFQ presets have no render mapping

Direct key matches: `cold-storage`, `food`, `ice-rink`, `water-treatment`, `military`, `cannabis`,
`electronics`. The rest need owner judgment — `archive` could be `museum` or `library`; `freezer`
may map to `cold-storage` or to nothing; `candy`, `seed`, `natatorium`, `restoration` may have no
render at all.

### 6.4 — Two zips not uploaded

`Building Materials` (295 MB, but 235 MB is video and 10 MB is SketchUp source) and
`Dehumidifier Placement` (35 MB, 13 files, each with a TRANSPARENT twin). Videos are deliberately
out — the portal hosts no video.

### 6.5 — Three people still excluded from the digest

A temporary opt-out from 08-17 holds three staff back; three others receive it. The review it was
waiting for could not have happened, since nobody had ever received a digest. Overridable without a
deploy via `DIGEST_OPT_OUT_EMAILS`.

### 6.6 — cfm still elsewhere in the PDF

Carried from the previous handoff and still true. Only the headline tile was removed.

### 6.7 — Tightness no longer prints on the customer PDF

It was dropped on 08-19 because we should not print a value nobody chose. That reason is gone now
that the question is asked again. Restoring it costs a row against the PDF's fixed mm budget, so it
waits for a decision. The admin view already shows it.

---

## 7. RESUME CONTEXT

### Read first

1. This file.
2. `docs/handoff/2026-08-19-session-handoff.md` — the session this one resumed. ⚠️ Its §4.2 and §6.3
   are corrected here (§4.9, §3.1).
3. `iat-forms-portal/lib/render-assets.ts` — the header carries the compositing warnings.
4. `iat-forms-portal/docs/rfq-moisture-survey.md`.
5. Memory: `room-render-library`, `rfq-moisture-survey`, `cron-secret-unset-crons-dead`,
   `leadership-weekly-update`, `american-english-spelling`, `animatepresence-hidden-pane-stall`,
   `rfq-option-lists-are-physics-tables`, `scoped-commit-parallel-sessions`.

### Key paths

```
iat-forms-portal/
  lib/render-assets.ts                    # 86 images, keyed → URL. START HERE for the render build
  lib/ashrae.ts                           # design conditions; the only file the licensing rests on
  lib/rfq.ts                              # option lists, RfqData, LEGACY_MATERIAL_LABELS, TempUnit
  lib/edition.ts                          # Edition + interimPeriod
  lib/leadership-update.ts                # parseSections, the hardened parser
  lib/admin-digest.ts                     # withinDigestWindow — do NOT narrow it
  components/support/RfqWizard.tsx        # the whole survey; TempInput, SHELL_EXAMPLES, TONE
  app/api/rfq/elevation/route.ts          # elevation (USGS) + design conditions (ASHRAE)
  public/rfq/shell-{good,better,best}.webp
```

### Commands

```bash
# Never npx tsc — it fetches a squatter
node node_modules/typescript/bin/tsc --noEmit

# Stop any dev server BEFORE building (shared .next)
npx next build

# Verify what actually SHIPPED, not what you edited
curl -s https://iatportal.vercel.app/support/rfq | grep -oE '/_next/static/chunks/app/support/rfq/[^"]+\.js'

# Did a scheduled job actually run? Vercel runtime logs are useless here
node --env-file=.env.local -e 'fetch("https://api.resend.com/emails?limit=100",{headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY}}).then(r=>r.json()).then(j=>j.data.forEach(e=>console.log(e.created_at,String(e.to),e.subject)))'

npx vercel crons ls
npx vercel env ls production      # names only; sensitive values never come back
```

### Project refs

| Thing | Value |
|---|---|
| Supabase internal | `dsbuhdjlkgwcghskvdse` |
| Storage bucket (new) | `render-assets`, public, 86 objects |
| Vercel `iatportal` | `prj_0xzYnqI81xqgwvHdApqIP9oCkfSb` |
| Vercel team | `team_lrnCHwUYvgaDrPFqg9wGnAxK` |
| SharePoint masters | site `IATDocumentation`, library **`Render Assets`** (NOT `Documents`) |

### Standing rules that bit this session

- `git add` by **explicit path** — seven commits in this range came from other sessions.
- Build **before** pushing; pushing `main` = production deploy.
- Verify the **prod alias moved** after every push.
- Sweep by **glob**, never a hand-written file list (§4.7).
- Verify against the **shipped artifact** — bundle, stylesheet, send log — not the source you edited.
