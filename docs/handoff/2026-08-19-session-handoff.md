# Session handoff — 2026-08-19

Covers one long session spanning **2026-08-17 → 2026-08-19**. Two repos touched
(`iat-forms-portal`, `iat-customer`), one migration applied, one production database
row deleted, one one-off cron registered.

Written for a session picking this up cold. Read §7 first if you are in a hurry.

**Final state:** `iat-forms-portal` at `9627b7b`, clean, in sync with origin.
`iat-customer` at `9a08466`, in sync, with one **uncommitted `.gitignore` change that
is not mine** (adds `.vercel`) — left alone per the scoped-commit rule.

---

## 1. SCOPE

### What it set out to do

A support question: *"where do I administer credentials for the IAT customer portal?"*
Nothing more.

### What it became

The answer surfaced a live outage, and the session then ran as a continuous
build-and-ship stream at the owner's direction. Everything below was requested
in-session, not planned up front.

| Area | Outcome |
|---|---|
| Customer-portal admin question | Answered — no admin surface exists there by design |
| Blank screen after customer login | **Diagnosed and fixed** — redirect loop, not an outage |
| `iat-customer` README | Brought current (was 3 chunks stale) |
| `iat-customer` dependency alert | nanoid patched, Dependabot clear |
| Ticket numbers | New format `IAT-SSSS-NNNN` carrying the unit serial |
| Admin ticket detail page | Every card collapsible, intake moved to top |
| Hub core values | Synced to the staff-meeting rotation, company artwork, click-to-magnify |
| Hub hero | Jerry added with a speech bubble greeting |
| RFQ wizard | Seven separate changes (§2.5) |
| Leadership comms | Two one-page Word briefings + a one-off 6pm update scheduled |

### Left open

1. **Tightness question** — hidden but still driving the calculation (§6.1). Owner
   explicitly said *"lets come back to that."*
2. **The one-off cron must be removed** after tonight's 6pm send (§6.2).
3. **RFQ steps 7 and 8 were never visually verified** (§5).
4. **PDF still prints cfm elsewhere** — only the headline tile was removed (§6.4).
5. **Monday 8/24's update will duplicate tonight's** (§6.3).

---

## 2. CHANGE LOG

### 2.1 — `iat-customer`: the blank-screen fix

Commit `da035f4`. *(Authored by me; committed and pushed by a concurrent session
before I returned to it — see §4.7.)*

| File | Change | Why |
|---|---|---|
| `components/customer/SessionUnlinked.tsx` | **NEW** — renders an explanatory page for a signed-in login that cannot be resolved to a company | A `redirect('/login')` on a null session loops forever: middleware bounces a signed-in user off `/login` straight back. The loop never paints, so it shipped as a blank white page with the URL sitting on the dashboard, and nothing was logged |
| `app/page.tsx` | `redirect('/login')` → `return <SessionUnlinked />` | Same bug |
| `app/srv/page.tsx` | Same | Same bug — **had it too**, would have hit any customer reaching `/srv` unlinked |
| `app/tickets/[id]/page.tsx` | Same | Same bug — **had it too** |

Deliberately **does not sign out on its own**, unlike the internal portal's
equivalent. A silent auto-signout makes "not linked yet" indistinguishable from "the
portal is down" — precisely the ambiguity that made this hard to diagnose.

### 2.2 — `iat-customer`: docs + dependency

| File | Commit | Change | Why |
|---|---|---|---|
| `README.md` | `25861a0` | Status rewritten; env table gained `INTERNAL_BRIDGE_URL` / `INTERNAL_BRIDGE_SECRET`; "this repo is public" corrected to private; redirect-loop gotcha added | Said *"chunk B — foundation in place"* and listed SRV, warranty, ticket detail and Jerry as upcoming. All four had shipped. The two bridge vars were **missing entirely** despite being what makes every data card work |
| `package-lock.json` | `9a08466` | nanoid `3.3.16` → `3.3.18` | GHSA-2v37-7h3g-55p8. **No override added** — postcss declares `^3.3.16` which `3.3.18` satisfies, so a plain lockfile bump resolves it. A blanket nanoid override is a known trap in this codebase |

### 2.3 — Ticket numbers (`iat-forms-portal`)

Commit `8b2c853`.

| File | Change | Why |
|---|---|---|
| `supabase/migrations/092_ticket_number_serial.sql` | **NEW** — `ticket_number_seq` sequence + `next_ticket_seq()`, seeded above every number already issued | Format needs a globally-unique tail; see §3.2 |
| `lib/ticket-number.ts` | **NEW** — `serialTag()`, `formatTicketNumber()`, `fallbackTicketSeq()` | Both generation sites go through one place so the format can only change once |
| `app/api/tickets/route.ts` | Uses `next_ticket_seq()` + the helper | Customer intake |
| `app/api/admin/warranty-requests/[id]/approve/route.ts` | Same | Warranty approvals also mint ticket numbers |
| `docs/support-tickets.md` | Reference table + a new section | Records that `SSSS` identifies nothing |

**Migration 092 is APPLIED to the internal Supabase project** (`dsbuhdjlkgwcghskvdse`).
`next_ticket_number(p_year)` from 029 was deliberately **left in place** — dropping it
in the same deploy would break ticket creation for the seconds between the migration
landing and the new build going live.

### 2.4 — Admin ticket detail page

Commit `0ca757f`. Single file: `app/admin/tickets/[id]/TicketDetailClient.tsx`.

- New local `CollapsibleCard` wrapping the kit's `Card` in a native `<details open>`.
- All eight cards use it: Customer & Unit, Intake details, Problem, Status & Priority,
  Photos, Notes, AI Recommendations, KB Articles Viewed.
- **Intake details moved to the top** of the column. It was folded shut at the
  *bottom*, which meant the serial number and diagnostic checklist — the things
  triage starts from — were the hardest things on the page to reach.
- `Section` was converted rather than duplicated, which carried Problem and Photos for
  free.

### 2.5 — RFQ wizard (seven commits)

| Commit | Change | Why |
|---|---|---|
| `76299c3` | `about` becomes step 1 in both flows; project location + elevation move onto it; new `GET /api/rfq/elevation`; readout relabelled **"Typical Industry Conditions"** and reduced to grains + dew point | Customers answered nine engineering questions before saying who they were. Elevation feeds `grains()`/`dewPointF()`, so asking it last meant every displayed number was computed at sea level until the end |
| `edb94d9` | Hints move **below** the control (`Hint` component) in all three field types | Structural: a hinted field had a taller label block than its unhinted neighbour, pushing its input down. Reported as Email sitting higher than Phone |
| `1f5e0fd` | Step 8 trimmed (regen heat default Electric, no natural gas, no package preference, final filter default Not required); step 7's three optional sections folded behind **Advanced** | Owner request. Removed questions took their data fields with them — see §3.5 |
| `50cba8e` | Cooling drops "Not sure", defaults to "Not required" | Same reasoning as final filter |
| `e263831` | Progress rail gains 1–2 word labels and **forward navigation** via a `maxIndex` high-water mark | The rail could only reach the current step, so going back from Review to fix one field stranded you |
| `799fe47` | "Not sure" retired from walls/roof/floor; tightness hidden; cfm tile + tightness row off the PDF | See §3.6 — retiring vs deleting is the whole point |

Files touched across these: `components/support/RfqWizard.tsx`, `lib/rfq.ts`,
`lib/rfq-pdf.ts`, `app/admin/rfq/[id]/page.tsx`, `app/api/rfq/elevation/route.ts`
(new), `docs/rfq-moisture-survey.md`.

### 2.6 — Company Hub

| Commit | File(s) | Change |
|---|---|---|
| `25ef75b` | `lib/home-content.ts`, `app/home/home-modals.tsx`, `docs/company-home.md` | `CORE_VALUES` reordered to the staff-meeting rotation; `ROTATION_ANCHOR_MONDAY` added; nine clickable icon tiles; click-to-magnify modal |
| `e66b811` | + `public/core-values/*.png` (9 files) | Stock lucide glyphs replaced with the company's commissioned artwork |
| `00353f7` | `lib/home-content.ts` | Anchor corrected `2026-08-17` → `2026-08-10` |
| `1e80724` | `app/home/HomeContent.tsx`, `public/jerry-hero.webp`, `docs/company-home.md` | Jerry in the hero with a speech-bubble greeting |

`public/jerry-hero.webp` is **derived** from `public/jerry-bobble.webp` (the master,
already tracked). Regeneration command is in a comment above `JERRY_HERO_SRC`.

### 2.7 — Leadership comms

| Commit | Change |
|---|---|
| `9627b7b` | `vercel.json` gains a dated one-off cron; `app/api/cron/leadership-update/route.ts` header documents it |

Two Word briefings were produced for leadership. **They live in the session
scratchpad, not in any repo** — regenerate from the build scripts if needed:
- `Customer-Portal-Launch-Status.docx` — the domain / 60-day-window explainer
- `Quote-Request-Location-Data.docx` — where elevation data comes from, and the
  ASHRAE licensing position

### 2.8 — Infrastructure state changes

| System | Change | Notes |
|---|---|---|
| Supabase — internal (`dsbuhdjlkgwcghskvdse`) | Migration **092** applied | History was clean beforehand (001–091 all synced, no drift to repair) |
| Supabase — IAT-Customer (`wcosmaceaefquwcedoaz`) | **Unpaused by the owner**; one auth user **deleted** | See §4.1 and §4.2 |
| Vercel — `iatportal` | One cron added: `/api/cron/leadership-update?force=1&edition=8.17.26` at `0 22 19 8 *` | Verified registered — 8 jobs now |
| Env vars | **None added, changed or removed** | |
| DNS | **No changes** | |

---

## 3. DECISIONS & LOGIC

### 3.1 — The blank screen: render, never redirect

**Options:** (a) redirect to `/login`; (b) auto-sign-out then redirect, as the
internal portal does; (c) render an explanatory page.

**Chose (c).** (a) is the bug itself. (b) works but makes "signed in, not linked yet"
look identical to "the portal is down" — the exact ambiguity that made this cost
diagnosis time. Rendering states the situation, names the account, and offers sign-out.

**Rejected:** auto-signout. Do not re-propose it for this project.

### 3.2 — Ticket numbers: the counter is GLOBAL, not per-year

The owner asked for `IAT-{year}-{serial last 4}`. **That format cannot be unique.** It
makes the number a function of (unit, year), so a second ticket on the same unit in
the same year produces an identical string — and `tickets.ticket_number` is `UNIQUE`,
so the insert *fails* and the customer loses their submission. That is the ordinary
life of a machine with a recurring fault, not an edge case.

Presented three options; the owner chose `IAT-SSSS-NNNN` (serial first, counter last).

**I then corrected my own option description**: I had called the counter "per-year,"
but with the year gone from the string a per-year counter reissues `IAT-4821-0007`
every January. It is **global and never resets**.

**All uniqueness lives in `NNNN`.** `SSSS` identifies nothing — two units can share
their last four characters, one unit files many tickets. Anything treating `SSSS` as a
key is wrong.

### 3.3 — Core value rotation: order was not the problem, phase was

Reordering `CORE_VALUES` alone would **not** have synced the Hub to the meeting. The
rotation was `weekNumber % 9` counted from the Unix epoch — stable, but with no reason
to agree with the meeting. Correct order with the wrong phase still shows the wrong
value. `ROTATION_ANCHOR_MONDAY` pins one known Monday to `CORE_VALUES[0]`.

Resyncing is **one line**. Adding or removing a value shifts every later week.

### 3.4 — Elevation: deliberately NOT an LLM

The owner asked whether AI could populate elevation. **Declined, with reasoning**, and
built a deterministic chain instead: ZIP → Zippopotam or city → Open-Meteo geocoding
for lat/lon, then **USGS EPQS (3DEP)** for feet.

Elevation feeds the psychrometrics, so a plausible-but-wrong value is worse than a
blank field — it is wrong *quietly*, somewhere nobody checks. A model returns a
confident number for towns it has never seen, with no signal marking those.

Verified against known literals: Covington GA → 745 ft; **Denver → 5,276 ft against an
actual 5,280**; the two independent elevation sources agreed within 4 ft.

**ASHRAE:** its Climatic Design Conditions dataset is **licensed and sold by ASHRAE**.
Using a licensed copy internally is fine; serving it from our website is not. If design
conditions are ever prefilled, use NOAA/NREL public-domain data, label it honestly, and
have engineering confirm. **Do not build on ASHRAE data.**

### 3.5 — Removed questions take their data fields with them

When the natural-gas and package-preference questions were removed, `gasAvailable` and
`packagePref` were removed from `RfqData`, the admin detail view and the PDF.

Leaving them would have meant every future quote reporting *"Natural gas: Not
available"* / *"Package: Let IAT recommend"* — a default nobody chose, indistinguishable
from an answer. `tsc` located both consumers.

Historical records still carry the keys in stored JSON; they simply no longer render.

### 3.6 — "Not sure" materials: RETIRED, not deleted

`WALL_MATERIALS` / `CEILING_MATERIALS` / `FLOOR_MATERIALS` are two things at once: the
customer's choices **and** the permeance table `estimateLoad()` reads. `permOf()`
resolves an unmatched label to the **last array entry**, and "Not sure" was parked
there as the neutral fallback (1.0 / 1.0 / 0.4 perm).

Deleting those rows would have promoted the new last entries to fallback — **fabric/tent
at 116 perm** for walls, open-to-structure at 116 for ceilings. Roughly 100× the neutral
value, silently inflating permeation load on any unmatched record, including every
historical survey that stored "Not sure". No error. Just wrong quotes.

So `MaterialOption` gained `retired?: boolean`, the rows stay **last**, and the
dropdowns filter on it.

### 3.7 — Rail navigation needs a high-water mark

Reachability keys off `maxIndex` (furthest visited), not `index` (current). Steps never
visited stay **disabled on purpose**: later questions are seeded by earlier answers, so
skipping ahead yields a survey that looks complete and is not.

### 3.8 — The one-off update goes through Vercel Cron

**Options:** (a) hand-rolled curl at 6pm; (b) Vercel cron with a dated expression.

**Chose (b).** (a) needs `CRON_SECRET`, and `vercel env pull` returns it **empty** with
this CLI — confirmed this session. Vercel Cron supplies the Authorization header itself,
so no secret is handled at all.

Cron has no one-off concept, so day-of-month + month pin it: `0 22 19 8 *` fires once at
22:00 UTC on 19 August. Verified by resolving the expression, not by arithmetic:
*Wednesday, August 19, 2026 at 6:00 PM America/New_York.*

### 3.9 — Hidden, not deleted (tightness)

The owner said the tightness question *may come back*, so the JSX block is **commented
in place**. Restoring it is uncommenting it. See §6.1 for the live consequence.

---

## 4. GOTCHAS DISCOVERED

### 4.1 — The IAT-Customer Supabase project auto-pauses (free tier)

**This started the whole session.** The project pauses after **7 days of inactivity**.
While paused, `iat-customer.vercel.app` still serves pages and Vercel + GitHub look
perfectly healthy — only *auth* is dead. Symptom: "I can't log in," with three green
dashboards pointing nowhere. 90-day restore window.

**It will recur** — the portal has almost no traffic by design until cutover.

Diagnosis order: `/login` returns 200 → Vercel fine. Can't sign in → check for a paused
project. Signs in but blank page → app code.

### 4.2 — `vercel env pull` returns every value EMPTY

Confirmed twice this session (`CUSTOMER_PORTAL_URL`, `CRON_SECRET`). `vercel env ls`
lists names/scopes reliably, so use it to confirm a var **exists** — you just cannot
read the value back. Any plan requiring a secret locally is dead on arrival.

### 4.3 — Tailwind opacity steps that do not exist compile to NOTHING

`bg-emerald-50/94` is not a generated step. The class silently does not exist and the
element computes to `rgba(0, 0, 0, 0)` — a **fully transparent** speech bubble that had
vanished against the green hero. `/95` is real.

Caught only by reading the computed `background-color`. **Verify computed styles, not
class names.**

### 4.4 — Square PNGs with transparent padding size the canvas, not the art

`jerry-bobble.webp` is 512×512 with the figure occupying just **177×450** — ~165px of
transparent padding either side. Pointed at directly, a 128px box renders Jerry **44px
wide, floating 7px off the floor**. Trim first. Same class of trap as the non-square
core-value icons, which need `object-contain` or the crown stretches.

### 4.5 — Running `next build` while a dev server is live corrupts `.next`

Did this to myself. The RFQ page went blank mid-verification and looked like I had
broken it; a clean `rm -rf .next && next build` with the server stopped came back fine.
**Stop the dev server before building.**

### 4.6 — The browser preview pane was unreliable all session

Tabs drifted to `/login` and to the root between calls; `h2` updates before the step
body finishes animating, so mid-transition reads report the wrong step. One stray
generic button-click sent a tab to a **Microsoft sign-in page** — backed away, did not
interact.

**Do navigation + assertion in a single JS call** with an `await` for settle. Screenshots
time out entirely (pane does not composite).

### 4.7 — A concurrent session commits your working tree

`da035f4` was authored by me and committed+pushed by another session before I returned.
`iat-customer/.gitignore` currently holds an uncommitted change that is not mine.
**Always `git add` by explicit path.**

### 4.8 — Stale `.next/types` fail `tsc` after deleting a temp route

Deleting a scratch route leaves `.next/types/app/<route>/page.ts` behind, and `tsc`
fails on a module that no longer exists. Not a real error — `rm -rf` the stale type dir
or rebuild.

### 4.9 — Next's App Router ignores `_`-prefixed folders

A temp preview route at `app/__preview/` **will not route** — underscore-prefixed
directories are private. Cost one debugging round.

### 4.10 — Looks wrong, is correct on purpose

- `next_ticket_number(p_year)` still exists in the DB despite being unused. Deliberate —
  see §2.3.
- Sequence starts at **9004**, not ~2951, because a test ticket at `IAT-2026-9001` set
  the floor. Seeding above every issued number is what prevents a serial ending "2026"
  colliding with a legacy `IAT-2026-####`.
- The retired "Not sure" rows must stay **last** in their arrays (§3.6).
- `Tightness` and `TIGHTNESS_HELP` remain imported in `RfqWizard.tsx` though only
  referenced inside a JSX comment — kept so restoring the block is a pure uncomment.
  Build is clean with them.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Browser-tested | Prod alias confirmed |
|---|---|---|---|---|
| `SessionUnlinked` (iat-customer) | ✅ | ✅ | ✅ component in isolation | ✅ |
| iat-customer README | ✅ | ✅ | n/a | ✅ |
| nanoid bump | ✅ | ✅ | n/a — CSS tokens verified in compiled output | ✅ |
| Ticket numbers | ✅ | ✅ | ❌ **not browser-tested** | ✅ |
| Ticket page collapsibles | ✅ | ✅ | ✅ component only, **not the assembled page** | ✅ |
| RFQ step 1 + elevation | ✅ | ✅ | ✅ **full end-to-end**, incl. live endpoint | ✅ |
| RFQ hint alignment | ✅ | ✅ | ✅ 0px offset measured on 3 pairs | ✅ |
| RFQ steps 7 & 8 changes | ✅ | ✅ | ❌ **NOT VERIFIED** | ✅ |
| RFQ cooling default | ✅ | ✅ | ❌ | ✅ |
| RFQ rail navigation | ✅ | ✅ | ✅ jump-back-then-forward confirmed | ✅ |
| RFQ shell / PDF trims | ✅ | ✅ | ❌ UI; ✅ fallback verified structurally | ✅ |
| Core value rotation | ✅ | ✅ | ✅ + 24 unit assertions | ✅ |
| Core value artwork | ✅ | ✅ | ✅ all 9 load, `object-contain`, 3× zoom | ✅ |
| Jerry hero | ✅ | ✅ | ✅ measured, owner-reviewed in preview | ✅ |
| One-off cron | ✅ | ✅ | n/a | ✅ registered, 8 jobs |

### Explicitly NOT verified

1. **RFQ steps 7 and 8 rendered.** Several stacked changes. Later steps are gated behind
   earlier validation and the preview pane fought me. Structure checked by reading JSX
   nesting; types and build clean. **Needs a human click-through.**
2. **The assembled admin ticket detail page.** Gated behind admin auth; only the
   `CollapsibleCard` component was exercised.
3. **A real ticket number being minted.** The sequence was tested directly in SQL, and
   the helper unit-tested against literals, but no ticket has been created end to end.
4. **The customer-facing PDF after the tile/tightness removals.** jsPDF renders
   client-side; `tileRow` was read to confirm it sizes from `tiles.length`.
5. **Tonight's 6pm email.** Not yet fired at time of writing.

---

## 6. OPEN THREADS

### 6.1 — Tightness (owner said: come back to this) 🔴

Hidden from step 5, but **`data.tightness` is still live at its `'Average'` default and
`estimateLoad()` still costs infiltration from it.** Every survey is now priced at
average leakage as an *assumption nobody confirmed*. It was removed from the PDF so we
at least do not print a value the customer never chose.

**Decision needed:** accept average-for-everyone, suppress the infiltration term while
hidden, or restore the question. Restoring = uncomment the block in `StepInside`'s
sibling (`shell` step) in `RfqWizard.tsx`.

### 6.2 — Remove the one-off cron 🔴

After tonight's send, delete from `vercel.json`:

```json
{ "path": "/api/cron/leadership-update?force=1&edition=8.17.26", "schedule": "0 22 19 8 *" }
```

Dead weight otherwise, and it hard-codes an edition wrong for any later run.

### 6.3 — Tonight's email duplicates Monday's

It sends edition **8.17.26** (Mon 8/17 – Sun 8/23), which also includes **three 8/17
entries** the owner did not ask for — though those have never been emailed. Monday
8/24's regular send covers the same edition again. Decide whether to suppress or narrow
Monday's.

⚠️ **The job reads `CHANGELOG.md` from the DEPLOYED bundle**, not from git. Anything
from the 4pm meeting must be **committed and deployed before 6pm** to appear.

### 6.4 — cfm still elsewhere in the PDF

Only the headline "Dry air needed" tile was removed. cfm remains in ventilation in/out,
the process-track tiles, and the calculation walkthrough. Owner named one item; ask
before removing more.

### 6.5 — Jerry is hidden on phones

Deliberate — at phone width he crowds out the greeting. If wanted on mobile, stack him
above the bubble rather than beside it.

### 6.6 — Core-value rotation drifts if a meeting is skipped

It advances on calendar weeks whether the Monday meeting happened or not. A holiday
skip puts the Hub one ahead. Fix each time is the one-line anchor. If it recurs, build
the already-planned "pin a value for the week" control.

---

## 7. RESUME CONTEXT

### Read first

1. This file.
2. `iat-forms-portal/CHANGELOG.md` — top entries dated 2026-08-18/19.
3. `iat-forms-portal/docs/rfq-moisture-survey.md` — RFQ is where most change landed.
4. `iat-forms-portal/docs/company-home.md` — core values + Jerry gotchas.
5. Memory: `iat-customer-supabase-free-tier-pause`, `rfq-moisture-survey`,
   `leadership-weekly-update`, `scoped-commit-parallel-sessions`.

### Key paths

```
iat-forms-portal/
  components/support/RfqWizard.tsx        # the RFQ wizard — most changes live here
  lib/rfq.ts                              # option lists, RfqData, emptyRfq defaults
  lib/rfq-pdf.ts                          # customer PDF (layout-sensitive, mm budget)
  lib/ticket-number.ts                    # IAT-SSSS-NNNN, single source of format
  lib/home-content.ts                     # CORE_VALUES + ROTATION_ANCHOR_MONDAY
  app/home/home-modals.tsx                # core-value tiles + magnify modal
  app/home/HomeContent.tsx                # hero + Jerry (JERRY_HERO_SRC)
  app/api/rfq/elevation/route.ts          # elevation lookup (USGS/Open-Meteo/Zippopotam)
  app/api/cron/leadership-update/route.ts # weekly + tonight's one-off
  supabase/migrations/092_ticket_number_serial.sql
iat-customer/
  components/customer/SessionUnlinked.tsx # render-never-redirect
```

### Commands

```bash
# Supabase — run from the repo whose project you want (link is per-directory)
npx supabase migration list --linked
npx supabase db query --linked "select 1;"

# Never npx tsc — it fetches a squatter
node node_modules/typescript/bin/tsc --noEmit

# Stop any dev server BEFORE building (shared .next)
npx next build

# Vercel
npx vercel crons ls
npx vercel env ls production      # names only — values come back empty
```

### Project refs

| Thing | Value |
|---|---|
| Supabase internal | `dsbuhdjlkgwcghskvdse` |
| Supabase IAT-Customer | `wcosmaceaefquwcedoaz` |
| Vercel `iatportal` | `prj_0xzYnqI81xqgwvHdApqIP9oCkfSb` |
| Vercel `iat-customer` | `prj_kuJzYNjAFdKvmLWNall6wJ6DuzEL` |
| Vercel team | `team_lrnCHwUYvgaDrPFqg9wGnAxK` |

### Standing rules that bit this session

- `git add` by **explicit path** — other sessions share these repos.
- Build **before** pushing; pushing `main` = production deploy.
- Verify the **prod alias moved** after every push.
- Update `docs/` + `CHANGELOG.md` for anything shipped.
