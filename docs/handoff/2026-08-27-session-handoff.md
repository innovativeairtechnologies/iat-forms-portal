# Session handoff — 2026-08-27: the RFQ survey, end to end

Covers **2026-08-26 ~11:45 ET → 2026-08-27 ~15:45 ET**. One repo (`iat-forms-portal`),
**21 commits by this session**, 15 files, **no migrations**, **no env vars**, no DNS.

⚠️ **THIS TREE IS SHARED.** Seven commits in the same range are NOT this session's work and are not
described here: `0032a4e`, `5a745f1`, `7fd8f99`, `98543cf`, `09fd0b4`, `8eecfa6`, `b416d7a`
(engineering board, post-production walkarounds, an RFQ PDF section-header change). Origin moved
under this session three times. Always `git fetch` and check `git status -sb` before assuming your
last push is the tip.

⚠️ **A concurrent session may also write a `2026-08-27-session-handoff*.md`.** If two exist, both are
needed — do not merge or overwrite.

🔴 **Read §4 before touching the RFQ.** Three things shipped broken this session and every one of
them passed a type check, a build and a bundle grep first.

---

## 1. SCOPE

### What it set out to do

Resume the 2026-08-26 handoff at §6.1 — the cron exclusion windows in `docs/notifications.md` were
recorded as stale.

### What it became

Owner-directed throughout, in this order. Nothing below was speculative.

| Area | Outcome |
|---|---|
| §6.1 cron windows | Resolved — **and the handoff's own diagnosis was wrong** |
| Deploy rule | Reduced to one line: nothing to production outside 8:00am–5:30pm ET |
| Support landing page | Hero copy rewritten; quote request tile on the mark's blue |
| RFQ step 1 | Site lookup result survives leaving the step; "Quote needed by" removed |
| RFQ step 3 | Source buttons removed, `targetSource` derived; caveat reworded; panel shows temperature |
| RFQ step 5 | Outside air / Box-in-a-box; retarder classes; leakage rates and basis; Custom boxes; ⓘ disclaimers |
| RFQ step 6 | Opening quantity |
| RFQ step 8 | Regeneration air source repositioned |
| RFQ PDF | Five pages → **four**; white space closed; headers rebuilt |
| Calculation audit | 49 assertions; two findings; three owner decisions on air density |
| Whole survey | Leading zeros and decimals fixed on every number input |

### Left open

1. 🔴 **`IAT-2026-2945` auto-resolves ~9 Sept** — a real customer ticket on the waiting ladder (§6.1).
2. **RFQ bulk actions still never executed** (§6.2).
3. **The RFQ PDF has never been captured from a real submission** (§6.3).
4. ⏸️ **Survey vs Sizing Studio ~7.6% gap** — deferred by the owner, deliberately undocumented (§6.4).
5. **Migration 093** — standing owner decision, do not re-raise.

---

## 2. CHANGE LOG

### 2.1 — Notifications and the deploy rule (`5984c12`, `f33fb03`, `5997889`)

| File | Change | Why |
|---|---|---|
| `docs/notifications.md` | Deploy rule reduced to one line; `accrue-pto` nominal 09:00 → **04:00**; digest/leadership times reconciled; leadership window 18:00–20:00 → **20:00–22:00**; stale DST table replaced with a pointer | The 08-25 timing commits were near-pure additions (`+43/-1`, `+53/-3`, `+43/-5`), so a new section was appended and the older prose kept describing the pre-move times in the present tense |
| `app/api/cron/leadership-update/route.ts` | Skip response `'outside the 18:00-20:00 NY window'` → `20:00-22:00`; two stale comments | 🔴 Not a comment — the breadcrumb read while diagnosing a missing report named the wrong two hours |
| `docs/handoff/2026-08-26-…-rfq-pdf.md` | §6.1 marked resolved, with the correction that its own claim was stale | The exclusion table had already been fixed; what was stale was everything around it |

### 2.2 — Support landing page (`a105cd3`, `d6c1ec3`)

| File | Change | Why |
|---|---|---|
| `app/globals.css` | `--brand-blue` / `--brand-blue-hover` token pair, light `#3b5fa8` and dark `#5b83d0` | Sampled from the mark — the identical value `lib/rfq-pdf.ts` already carries as `brandBlue [59, 95, 168]`, so page and PDF agree |
| `tailwind.config.ts` | `brand.blue` / `brand.blue-hover` | Semantic token, not a hex in a component |
| `app/support/page.tsx` | Quote request tile `bg-surface-strong` → `bg-brand-blue`; hover arrow to blue; hero line rewritten | Grey-on-grey read as disabled, so the second of two front doors looked shut. Hero copy was written when the page had one door |

### 2.3 — RFQ wizard, steps 1/3/6/7/8 (`d6c1ec3`, `1efe464`, `5bd63b1`, `7676069`, `1473479`)

| File | Change | Why |
|---|---|---|
| `components/support/RfqWizard.tsx` | **Step 3**: both "where should these numbers come from" buttons removed; `targetSource` DERIVED from the values; caveat moved beside the chip and reworded to name itself a disclaimer | The caveat belongs next to the thing it qualifies. 🔴 `validateStep('target')` still requires a non-empty `targetSource` and no button sets it any more |
| | **Step 3 panel**: leads with Temperature; dew point made unit-aware | It printed °F under a °C temperature — the confusion the input fields were fixed for |
| | **Step 5**: moisture sub-text removed from every condition field | Owner |
| | **Step 6**: `Qty` box beside each opening heading | Twelve identical doors were twelve rows |
| | **Step 7**: preset-headcount chip removed | How many people are in the customer's building is not ours to suggest |
| | **Step 8**: regeneration air source moved into the utilities box, `sm:col-start-2` | A 2-col grid with one child fills column ONE, so it had landed under Electrical service |
| | **Step 1**: site-lookup state lifted to the wizard; "Quote needed by" field removed | Only the current step is mounted, so the panel died on every Continue |
| `lib/rfq.ts` | `DoorSpec.quantity`; `estimateLoad` multiplies load and open-minutes by it; opening count is openings not rows | Physics field, not a label |
| `app/api/rfq/route.ts` | `quantity` in `coerce()`, clamped 1–999 | ⚠️ That map REBUILDS every door; a field it does not name is dropped on submit |
| `app/admin/rfq/[id]/page.tsx`, `lib/rfq-pdf.ts` | Quantity shown; "Quote needed by" row hidden when empty | |
| `lib/resend-rfq.ts` | "Quote needed by" row hidden when empty | |

### 2.4 — RFQ step 5, the envelope questions (`4af92bc`, `6483225`, `ffa1ae3`)

| File | Change | Why |
|---|---|---|
| `lib/rfq.ts` | `SurroundSource` = `'outdoor' \| 'manual'`; blank until answered | Option A mirrors the ASHRAE design point in; Option B is typed. Moves permeation and infiltration, the two biggest lines |
| | `TIGHTNESS_RATES` 0.10/0.30/0.60 → **0.05/0.10/0.20**, and basis walls+ceiling → **exterior wall area only** | Engineering advice. Roof, floor, doors and ventilation are each evaluated elsewhere, so the ceiling was counted twice. Average 1,356 → 252 cu.ft/hr on a 50×40×14 room |
| | `VaporBarrier` Yes/No → **Class I/II/III/None/Custom**, permeances 0.06/0.60/3.00, combined in **series** | `permSealed` could not have been a published lookup — a retarder's permeance belongs to the retarder |
| | `TightnessBand`, `VaporClass`, `tightnessCustom`, `vaporBarrierCustom`, `normalizeTightness`, `normalizeVaporBarrier`, `normalizeActivity` | Unions pinned so `coerce()` cannot store arbitrary text |
| `components/support/RfqWizard.tsx` | `InfoDot`, `InlineNum`; `Segmented` gains `trailing` and `dimUnselected`; both controls rebuilt | Disclaimers behind ⓘ, Custom boxes on the same line |
| `app/api/rfq/route.ts` | `normalizeVaporBarrier`, `normalizeTightness`, `normalizeActivity` | |

### 2.5 — RFQ PDF (`5808763`, `6483225`, `1334874`)

| File | Change | Why |
|---|---|---|
| `lib/rfq-pdf.ts` | Removed: panel 3 formula, panel 5 reference table, the closing strip, the cover's at-a-glance tiles, the engineering-notes panel, the panel-1 caption, "What we're protecting" | Each was a repeat of something already on the page, or identical standing text on every survey |
| | `table()` and `loadBars()` **split across pages**; every reserve shrunk to header-plus-two-rows | A table was atomic, so a page ended in 20–53mm of white |
| | Cover band 66 → 48 → **40**; row pitch 6.8 → 6.4; bars 10.6 → 9.4; tiles 30 → 24; eleven gaps tightened | Dead space |
| | Project name in **every** header; marks re-centred on their text; draft chip shows the project | A loose sheet could not be identified; "DRAFT PREVIEW / PREVIEW" said the word twice |

### 2.6 — Number input handling (`dfdd2b0`, `5239fe3`, `6dd5550`)

| File | Change | Why |
|---|---|---|
| `components/support/RfqWizard.tsx` | `noLeadingZero()` on all five number inputs; `limitDecimals()` capped at 2 on the Custom boxes; `step="any"` / `step="0.01"` | React compares `node.value != value` LOOSELY for `type="number"`, so `"01"` and `1` read as equal and the DOM is never corrected. No `step` meant the browser defaulted to `step=1` and rejected decimals |

### 2.7 — Air density (`1473479`)

| File | Change | Why |
|---|---|---|
| `lib/rfq-psych.ts` | New `dryAirDensity()` = `1/v` | Grains are per lb of DRY air. `airDensity()` returns `(1+W)/v` and overstated 0.7–2%; its own comment cited 0.075, which IS the dry value |
| `lib/rfq.ts` | Loads use `max(roomDensity, sourceDensity)` per term; `dryAirCfm` keeps the room density; process uses the real leaving condition | Owner chose Chapter 5 for conservatism, guarded where it reverses |

### 2.8 — Infrastructure

| System | Change |
|---|---|
| Supabase migrations | **None.** `093` still unapplied and untracked |
| Supabase data | **Read-only queries only** (ticket status counts, one waiting ticket) |
| Vercel env | **None changed** |
| Vercel deploys | ~21 production deploys, all inside the 8:00am–5:30pm ET window |
| DNS | No changes |

---

## 3. DECISIONS & LOGIC

### 3.1 — `targetSource` derived, not clicked

**Options:** (a) keep the two buttons; (b) remove them and derive the source from the values.

**Chose (b), owner-directed.** The only affordance left is the "use typical" chip. Values exactly
equal to the preset mean `typical`, anything else means `entered`. 🔴 `validateStep('target')` still
requires a non-empty `targetSource`, so this MUST be set on every edit or the step can never be
completed. Deriving it also fixed a smaller thing: changing the temperature unit after accepting our
figures no longer re-labels the record as customer-entered.

### 3.2 — Option A mirrors, it does not resolve at calculation time

**Options:** (a) leave `surround*` empty and teach `estimateLoad` to substitute; (b) write the
outdoor condition into the surround fields.

**Chose (b).** `estimateLoad`, the PDF and the admin view all read those fields directly, so (a) put
one fact in four places. The cost is that the mirror lives in **two** places — `StepShell` while
mounted, and the location lookup — because someone who picks Outside air, corrects the location and
jumps to review would otherwise submit a condition from the site they first typed.

### 3.3 — Air density: Chapter 5 kept, with a reversal guard

**Options:** (a) keep Chapter 5 as-is; (b) switch to per-source density (the Sizing Studio method);
(c) keep Chapter 5 and guard where it reverses.

**Owner chose (c), for a conservative posture.** Chapter 5 OVERSTATES wherever the room is cooler
than the entering air — freezer dock +15.45%, cold store +10.86%, warehouse +7.57% — which is nearly
every job. (b) would have made every survey **5.3% smaller**. But Chapter 5 reverses when the room is
warmer than the source (curing room −1.64%, winter make-up −5.51%), so each air-driven line now takes
`max(roomDensity, sourceDensity)`.

⚠️ **The guard is `max()` ONLY where density multiplies.** In `dryAirCfm` it divides, so a larger
density means less airflow — `max()` there would undersize the fan. That one keeps the room density
deliberately.

### 3.4 — Fix the units error rather than keep it as margin

The moist/dry error overstated by 0.7–2%, i.e. it was "helping". **Owner chose to fix it** and let
the explicit **10% safety factor** carry the conservatism, where it is visible and tunable. Do not
reintroduce hidden margin.

### 3.5 — ⛔ REJECTED / SETTLED, do not re-propose

- **Cutting the room render from the PDF record.** Built, measured at **still five pages**, reverted.
  The estimate was ~62mm; it is **13.5mm**, because the "THE NUMBERS" panel has to stay. Reverted
  rather than lose the L/W/H dimension callouts, which appear nowhere else.
- **Per-source density to match the Sizing Studio** — see 3.3. Rejected on conservatism.
- **Applying the retarder class to walls only** — owner: leave it applying to roof and floor too.
- **Rewording the per-door exposure labels** — owner: leave alone, despite the 7× velocity effect.
- **A separate "mixed envelope" answer** — owner: one surrounding condition is enough.
- **Removing the outdoor fields unconditionally** — they reappear when the ASHRAE lookup fails, or the
  step becomes uncompletable.
- **Documenting the survey/Studio gap** — owner deferred it deliberately (§6.4).

### 3.6 — "Quote needed by" removed, field retained

The question is gone from the form, review, PDF and desk email. ⚠️ The FIELD stays on `RfqData`, in
`date_required`, on the admin record and in the reports `withDeadline` metric — older surveys carry
real dates. Every surface hides the row when empty rather than printing a permanent dash.

---

## 4. GOTCHAS DISCOVERED

### 4.1 — 🔴 A prop that is destructured, typed and passed but never rendered is not a type error

`Segmented` gained `trailing` for the Custom box. It was destructured, typed, and passed by BOTH step
5 controls — and never drawn in the JSX. Selecting Custom did nothing and there was nowhere to type.
**It passed `tsc`, `next build`, and a bundle grep** — the suffix strings were in the bundle because
the element was *created* and then thrown away. **Presence in a bundle is not evidence of rendering.**
`Segmented` now has a render test that reads the real function out of the file, compiles it with the
TypeScript API and asserts the slot appears inside the button row.

### 4.2 — 🔴 A shell heredoc eats backslashes, and it shipped a dead regex

`limitDecimals`/`noLeadingZero` were written via a heredoc; `\d` reached the file as `d`. The
lookahead required a literal letter **d**, so the leading-zero fix **did nothing for ~16 hours while
appearing to be deployed**. The unit test passed because it typed the regex INTO THE TEST rather than
reading it from the file. **Extract the literal from the source and test that.**

### 4.3 — ⚠️ React does not normalise `type="number"` for you

`ReactDOMInput` compares `node.value != value` **loosely**, so `"01"` and `1` are equal and the DOM is
left alone — the box reads `010` while state says `10`. The state was always right. Rewriting
`e.target.value` is the only fix, which is why the up/down arrows were never affected. And with no
`step`, the browser defaults to `step=1` and rejects decimals entirely.

### 4.4 — ⚠️ `'endstream'` contains `'stream'`

A PDF stream scanner advancing by one after a match cascades into the end marker and silently drops
most of the document — **57k characters recovered instead of 211k**, producing four false failures
including static labels that could not possibly be missing. Advance past the whole token.

### 4.5 — ⚠️ Three watcher scripts lied about deployments

One compared the alias against a remembered id and matched a **16-hour-old** deployment; one failed to
capture the target id and compared against an empty string; one mis-parsed a status field and reported
a timeout on a deploy that had succeeded. **Check the alias's own status field, and wait for a
specific deployment id.**

### 4.6 — ⚠️ Shell greps against bundles are unreliable here

Two greps for `sm\:col-start-2` and for a regex literal returned zero because of shell escaping, not
because the content was missing. Both were present. **Use node, and anchor on an ASCII string, not an
identifier** — minification removes function names.

### 4.7 — Looks wrong, is correct on purpose

- **`permSealed` is still in the material tables and is never read.** It is the record of what
  pre-2026-08-27 surveys were quoted under.
- **`airDensity()` still exists and returns moist density.** It is the honest answer to a different
  question; the loads use `dryAirDensity()`.
- **`dryAirCfm` uses the room density while every load uses `max()`.** Density divides there.
- **`estimateProcess` uses `airDensity(leavingT, 50, …)`** — no longer; but note the *entering*
  density is still not used, which is a methodology choice, not an oversight.
- **A Custom band with an empty box falls back to Average** inside `estimateLoad`, and
  `validateStep` refuses to advance in that state. The fallback is a guard, not an assumption.
- **Blank `vaporBarrier` and `'None'` produce identical arithmetic.** They differ only in what the
  record can honestly say.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Alias confirmed | Browser-tested |
|---|---|---|---|---|
| Notification docs + deploy rule | ✅ | ✅ | ✅ | n/a (docs) |
| Leadership skip-response window | ✅ | ✅ | ✅ | ❌ only fires outside the window |
| Support hero + blue tile | ✅ | ✅ | ✅ | ✅ **computed colour on the live page, both themes** |
| Step 3 — derived `targetSource` | ✅ | ✅ | ✅ | ✅ **owner clicked through 2026-08-27** |
| Step 5 — surround gate, classes, Custom boxes | ✅ | ✅ | ✅ | ✅ **owner clicked through 2026-08-27** |
| Step 6 — opening quantity | ✅ | ✅ | ✅ | ✅ **owner clicked through 2026-08-27** |
| Step 8 — regen air source column | ✅ | ✅ | ✅ | ⚠️ `.sm\:col-start-2` confirmed in deployed CSS **and** applied in markup; not visually seen |
| Step 1 — lookup persistence | ✅ | ✅ | ✅ | ❌ **code path verified end to end, never clicked** |
| Leading zeros / decimals | ✅ | ✅ | ✅ | ⚠️ regex extracted from source and tested (11 + 14 cases); not clicked |
| PDF — four pages, headers, splitting | ✅ | ✅ | ✅ | ⚠️ **generated and read back by inflating its own content streams**; never opened in a viewer |
| Air density decisions | ✅ | ✅ | ✅ | n/a — arithmetic |
| "Quote needed by" removal | ✅ | ✅ | ✅ | ⚠️ absent from deployed bundle; not clicked |

### Calculation verification

- **49 assertions** before the density change, **all passing**: every load term recomputed
  independently from its documented equation, totals, safety factor, dry-air cfm, air changes, both
  make-up-air routings, every step 5 option against Eq 5.1 and Ch.5 Method A, and the generated PDF's
  own text against the model.
- **Re-reconciled after** the density change: all ten terms and totals agree on the new basis.
- **Guard tested** on four scenarios: warehouse and freezer dock (dormant), curing room and winter
  make-up (engages, load rises).
- Page counts measured across six survey shapes.

### Explicitly NOT verified

1. **No PDF was ever opened in a viewer.** Every check was on the generated bytes.
2. **No email was opened.** No mail was sent by this session at all.
3. **The RFQ PDF has still never been captured from a real submission** (§6.3, unchanged since 08-26).
4. **No RFQ bulk action has ever been executed.**
5. **Step 1's lookup persistence was never clicked** — it was the one wizard change not in the
   owner's pass.
6. **The reissued Word memo was never rendered.** No LibreOffice, Python or pandoc on this machine;
   its structure and text were read from `document.xml` instead.

---

## 6. OPEN THREADS

### 6.1 — 🔴 A real customer ticket auto-resolves around 9 September

Snapshot 2026-08-27: 13 closed, 5 in progress, **1 in `waiting_on_customer`** — `IAT-2026-2945`,
waiting since 2026-08-26 (day 1), an external company address, **0 chases sent**.

🔴 **The owner confirmed customers are opening tickets for real while that workflow is still under
test.** On the 7/13/14 ladder this customer is chased about **2 Sept**, warned about **8 Sept**, and
the ticket **auto-resolves about 9 Sept** — customer-facing mail from an unverified workflow, on a
timer.

**Next action:** decide before ~2 Sept whether to let it run, move the ticket out of
`waiting_on_customer`, or pause the ladder.

### 6.2 — RFQ bulk actions still never executed

Reviewing / Close / Assign to me / Delete are confirmed to render and nothing more. Lower stakes than
recorded on 08-26: **every RFQ generated to date is a test** (owner, 2026-08-27).

### 6.3 — The RFQ PDF has never been captured from a real submission

Unchanged. Endpoint proven; the browser half has never completed a real run.
**Next action:** hard-reload `/support/rfq`, submit, confirm `pdf_path` is non-null and the signed
link opens.

### 6.4 — ⏸️ The survey and the Sizing Studio disagree by ~7.6%

Decomposed this session: **0.69%** was the units defect (now fixed) and **6.38%** is the deliberate
Chapter 5 choice. The owner chose to **leave this undocumented for now and come back to it**.
A rep running both tools gets two answers with nothing on either screen explaining which is which.

### 6.5 — Blocked / deferred

- **Migration 093** — unapplied, untracked, standing owner decision. ⛔ Do not re-raise.
- **§8.2 anonymous storage uploads** — still open.
- **`estimateProcess` density state** — uses the leaving condition, not the entering one. Noted in the
  memo as an approximation, not corrected.

---

## 7. RESUME CONTEXT

### Read first

1. This file.
2. `docs/rfq-moisture-survey.md` — rewritten heavily this session; the 2026-08-27 sections carry the
   decisions and the traps.
3. `docs/notifications.md` — the one-line deploy rule.
4. `docs/handoff/2026-08-26-session-handoff-tickets-lists-and-rfq-pdf.md` — §6.1 there is resolved
   **and its diagnosis was wrong**; read the correction.
5. Memory: `two-psychrometric-engines-diverge` (the 7.6% gap is DELIBERATE),
   `rfq-vapor-barrier-permsealed` (resolved), `ticket-waiting-on-customer` (real customers now),
   `rfq-option-lists-are-physics-tables`, `shared-tree-commit-is-not-a-hold`,
   `append-is-not-an-update`.

### Key paths

```
iat-forms-portal/
  lib/rfq.ts                      # estimateLoad; TIGHTNESS_RATES + VAPOR_BARRIER_PERMS are PHYSICS TABLES
  lib/rfq-psych.ts                # dryAirDensity() is the one to use with grains
  lib/rfq-pdf.ts                  # table() and loadBars() SPLIT across pages; reserves must stay small
  components/support/RfqWizard.tsx  # CRLF file. Segmented/InfoDot/InlineNum; noLeadingZero + limitDecimals
  app/api/rfq/route.ts            # coerce() REBUILDS every door and pins every union
  app/admin/rfq/[id]/page.tsx
```

### Commands

```bash
# Never npx tsc — it fetches a squatter
node node_modules/typescript/bin/tsc --noEmit

# Stop any dev server BEFORE building (shared .next)
node node_modules/next/dist/bin/next build

# ⛔ Move 093 aside FIRST — db push applies every pending migration
npx supabase migration list --linked
```

⚠️ **Running the RFQ in Node** (page counts, load reconciliation) needs a resolve hook: `lib/*.ts`
imports are extensionless and `jspdf` needs a CJS shim. The harness was left in the session
scratchpad, not the repo — rebuild it from §4.4 and §4.6 if needed.

### Project refs

| Thing | Value |
|---|---|
| Supabase | `dsbuhdjlkgwcghskvdse` (linked) |
| Vercel project | `prj_0xzYnqI81xqgwvHdApqIP9oCkfSb` |
| Vercel team | `team_lrnCHwUYvgaDrPFqg9wGnAxK` |

### Standing rules that bit this session

- **This tree is shared.** `git add` by explicit path; fetch before assuming your push is the tip.
- **Deploy only 8:00am–5:30pm ET.** Every deploy this session obeyed it.
- **A green build proves nothing about rendering.** See §4.1.
- **Test the artifact, not your intention.** See §4.2.
