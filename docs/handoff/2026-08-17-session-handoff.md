# Session handoff — 2026-08-17

Business-continuity record for the session that built the **Request for Quote** feature and
everything that fell out of it. Written to be picked up cold.

**Everything described here is committed and live in production unless explicitly marked
otherwise.** Working trees for `iat-forms-portal` and `iat-customer` are clean.

---

## 1. SCOPE

### What it set out to do

Build an interactive, IAT-branded RFQ form under the support portal to replace two Word
documents that were being emailed as attachments (*IAT Quote Request and Moisture Survey Form* —
Room and Process). It had to be guided, fill in typical values, fork on room-vs-process at the
start, cover the paper forms' full technical ground, take a few minutes, and produce an
attractive PDF ending in a one-page takeaway graphic.

### What actually got done

| Delivered | State |
|---|---|
| `/support/rfq` guided moisture survey, both tracks | Live |
| 5-page (room) / 4-page (process) branded PDF with one-page takeaway | Live |
| Moisture unit selector — %rh, dew point, grains, wet bulb | Live |
| `/admin/rfq` queue + detail | Live |
| Triage: status, assignee, append-only note trail | Live |
| Automatic chasing of stalled requests (2 reminder types) | Live, **but see §6** |
| RFQ presence on department + Sales dashboards | Live |
| Weekly leadership update (Word doc, emailed Mondays) | Live |
| `CRON_SECRET` set — first time any cron has ever run | Done |
| `iat-customer` blank-page fix | Live |

### Scope that grew mid-session, at the owner's direction

1. Unit selector on every temperature/moisture pair (was %rh only).
2. PDF reordering + per-page watermark and disclaimer.
3. Triage controls, then assignee + notes + reminders + dashboard.
4. Weekly leadership update system.

### Left open

See §6. Nothing is half-built; the open items are follow-ups, not unfinished work.

---

## 2. CHANGE LOG

Commit range for this session: **`59aeff9..69d1393`** on `iat-forms-portal`, plus **`da035f4`**
on `iat-customer`.

> ⚠️ **Four commits in that range are NOT from this session.** A concurrent session was working
> in the same repo: `f3ca56c`, `aed563a`, `291c886`, `2c621dd` (shared mailboxes, customer
> replies, `noreply@` forwarding, message-box hardening). Their files are marked *(concurrent)*
> below. Two of my commits carried their work along because the working tree is shared — that is
> expected on this repo, not a mistake.

### 2.1 — RFQ core (new feature)

| File | What | Why |
|---|---|---|
| `lib/rfq-psych.ts` **(new)** | ASHRAE moist-air psychrometrics: saturation pressure over water and ice, humidity ratio, grains, dew point, wet bulb, air density, vapour pressure | The whole survey runs on grains, not %rh. Every live readout, the load engine and the PDF read from here so one set of numbers exists |
| `lib/rfq.ts` **(new)** | Domain model, 18 room + 11 process application presets, permeance/people/leakage tables, the moisture-load engine, `setCondition()`, formatting | One module shared by wizard, PDF and API so the customer's screen, their PDF and our record are byte-identical |
| `lib/rfq-pdf.ts` **(new)** | jsPDF vector document — cover, space/process, loads, equipment, takeaway infographic | Vector not raster: ~35 KB, crisp at any size, text selectable |
| `components/support/RfqWizard.tsx` **(new)** | The wizard: fork, 9 room / 7 process steps, live readout rail, unit selector, PDF download, submit | — |
| `app/support/rfq/page.tsx` **(new)** | Route. Static, anonymous — no session lookup | A stranger with a humidity problem must reach us without an account |
| `app/api/rfq/route.ts` **(new)** | Public POST. Rate limit, reCAPTCHA, payload coercion, atomic reference, desk email | Coerces against an empty `RfqData` so a direct POST cannot smuggle columns |
| `app/support/page.tsx` | Added the "RFQ — Request for Quote" card | Requested placement: directly under "Start a support request" |
| `supabase/migrations/087_rfq_requests.sql` **(new)** | `rfq_requests` + `rfq_counters` + `next_rfq_number()` | Own table, not `submissions`: that renders by iterating `form_fields`, and this is a hand-built two-branch wizard |

### 2.2 — Moisture units (second pass)

| File | What | Why |
|---|---|---|
| `lib/rfq-psych.ts` | Added `rhFromDewPoint`, `humidityRatioFromWetBulb`, `rhFromWetBulb`, `wetBulbF`; **replaced `dewPointF` curve fit with exact bisection** | See §4 — the fit and the saturation formula are different functions and did not round-trip |
| `lib/rfq.ts` | `MoistureMode`, `MOISTURE_MODES`, conversions, `setCondition()`, `conditionEntered()`, 8 new fields on `RfqData` | Additive only — 3 live submissions predate it and still render |
| `components/support/RfqWizard.tsx` | `ConditionField` + `ConditionReadout`; door toggle relabelled "Opens to Surrounding" | — |
| `app/api/rfq/route.ts` | Mode whitelist + server-side re-derivation of canonical values | A direct POST cannot claim 5%rh while its dew-point field says otherwise |
| `lib/rfq-pdf.ts` | Takeaway moved to **page 1**; `PRELIMINARY` watermark + highlighted disclaimer band on every page; `ensure()` page-break guard; doors moved to the load page | — |

### 2.3 — Admin queue and triage

| File | What | Why |
|---|---|---|
| `app/admin/rfq/page.tsx`, `RfqClient.tsx` **(new)** | List: search, status/track/owner filters, stat strip, Owner column | — |
| `app/admin/rfq/[id]/page.tsx` **(new)** | Detail. Survey read-only; renders from stored `data` + `summary` | The estimate is never recomputed — `summary` is what the customer was shown |
| `app/admin/rfq/[id]/TriageCard.tsx` **(new)** | Status picker, assignee dropdown, append-only note composer + trail | — |
| `lib/rfq-status.ts` **(new)** | `RFQ_STATUSES`, labels, help text, `UNSTARTED_STATUS`, `OPEN_STATUSES` | One vocabulary for list filter, detail picker and API validator — the column has a CHECK constraint |
| `app/api/admin/rfq/[id]/route.ts` **(new)** | PATCH: status + assignee **only** | See §3 |
| `app/api/admin/rfq/[id]/notes/route.ts` **(new)** | POST only. No PATCH, no DELETE | Append-only by construction |
| `lib/api-auth.ts` | `requireRfqAuth()` | Own named guard on the `deals` perm, per the house convention |
| `lib/roles.ts` | `{ prefix: '/admin/rfq', perm: 'deals' }` + **corrected 3 wrong comments** | See §4 — unmapped `/admin/*` is fail-OPEN |
| `components/admin/AdminSidebar.tsx`, `app/admin/layout.tsx` | `rfq` badge kind + unread count | Keyed on `is_read`, not `status='new'` |
| `supabase/migrations/088_rfq_assignee_and_notes.sql` **(new)** | Assignee columns, reminder stamps, `rfq_notes` table, migrates old `internal_notes` | `internal_notes` kept as a tombstone — dropping a column is irreversible |

### 2.4 — Chasing and dashboards

| File | What | Why |
|---|---|---|
| `lib/rfq-reminders.ts` **(new)** | Two sweeps: assigned-but-unstarted → owner; unassigned → shared desk | Grouped per owner: one email covering all their stalled rows |
| `lib/resend-rfq-reminders.ts` **(new)** | The two reminder emails | Separate module from `resend-rfq.ts`: submission-triggered vs schedule-triggered mail, and it avoids touching the concurrent session's file |
| `lib/rfq-mine.ts` **(new)** | "What is waiting on me?" for both dashboard surfaces | Returns unclaimed count too — see §3 |
| `components/dashboards/dept-cards.tsx` | `my_rfqs` card; `CardCtx` gains `userId` | First card that reads the *viewer's* work rather than a department roll-up |
| `components/dashboards/SalesDashboardView.tsx`, `app/admin/page.tsx` | Two RFQ pills in the Sales header | Sales lands on its own command centre and would otherwise never see an RFQ |
| `app/api/cron/rfq-reminders/route.ts` **(new)** | Manual/standalone trigger. **Not in `vercel.json`** | The sweep piggybacks on the digest run |
| `app/api/cron/admin-digest/route.ts` | Calls `runRfqReminders()` before its own guards | Deliberate — those guards stop the *digest* double-sending; gating the sweep behind them would mean a skipped digest day is an unchased day |

### 2.5 — Weekly leadership update

| File | What |
|---|---|
| `lib/leadership-update.ts` **(new)** | Reads last 7 days of `CHANGELOG.md`, Claude rewrites for a non-technical reader, validation gate + one retry |
| `lib/leadership-docx.ts` **(new)** | One-page US-Letter Word document |
| `lib/resend-leadership.ts` **(new)** | Delivery. **No hardcoded fallback recipient** — an internal report must not quietly mail a default address |
| `app/api/cron/leadership-update/route.ts` **(new)** | Mondays. `?dry=1` previews without sending. `maxDuration = 60` |
| `vercel.json` | Third cron: `0 16 * * 1` |
| `package.json` | Added `docx@^9.7.1` |

### 2.6 — Infrastructure / other

| File | What |
|---|---|
| `lib/admin-digest.ts` | `DIGEST_OPT_OUT_DEFAULT` — 3 admins held back; logs the count every run |
| `lib/staff.ts` | `shortStaffName()` → "Jacob Y." |
| `public/maplibre/*.mjs` | Vendored worker synced 6.0.0 → 6.1.0 by the prebuild step. Build churn, not a decision |
| `docs/rfq-moisture-survey.md` **(new)**, `docs/support-tickets.md` | Documentation |
| **`iat-customer`**: `components/customer/SessionUnlinked.tsx` **(new)**, `app/page.tsx`, `app/srv/page.tsx`, `app/tickets/[id]/page.tsx` | Blank-page fix — see §4 |

### 2.7 — Concurrent session's files (committed by me, authored by them)

`lib/resend-customer-tickets.ts`, `app/api/tickets/route.ts`,
`app/api/tickets/[id]/notes/route.ts`, `lib/resend-tickets.ts`,
`app/api/tickets/status/message/route.ts`, `app/support/status/StatusClient.tsx`,
`lib/recaptcha.ts`, `app/api/troubleshooting/route.ts`, and the customer-confirmation additions
inside `lib/resend-rfq.ts`.

### 2.8 — External state changed

| Where | Change |
|---|---|
| **Supabase** (`iat-forms`) | Migrations **087** and **088** applied to production |
| **Vercel env** | `CRON_SECRET` **added** (48-byte CSPRNG, Production only) |
| **Vercel env** | `LEADERSHIP_UPDATE_EMAIL` **added** = `lee.childers@dehumidifiers.com` |
| **Vercel** | `vercel.json` now registers **3** crons |
| **DNS** | Untouched this session (the domain was already verified by the concurrent session) |
| **Emails actually sent** | 1 accidental REMINDER (see §4), 1 deliberate REMINDER test, 2 leadership updates to Lee Childers |

---

## 3. DECISIONS & LOGIC

**Own table, not `submissions`.** `submissions` renders by iterating `form_fields`; anything not
backed by a builder field does not display. The RFQ is a two-branch wizard with nested door rows
and a computed estimate — modelling it as ~70 builder fields would produce a form nobody could
edit and a detail page rendering half of it.

**Store both `data` and `summary`.** `data` is what they said; `summary` is what we told them.
The load engine will be refined, and replaying `data` later would silently produce different
figures from the PDF in the customer's inbox.

**Ventilation load carried separately from the room total.** Folding it in grossly oversizes the
system, because the unit dries that air upstream of the room. This looks like an omission and is
not.

**One canonical moisture value; the unit is presentation.** `setCondition()` is the only place a
condition changes. Two invariants it exists to hold: the dry bulb is part of the moisture answer
(a 50°F dew point is 49%rh at 75°F and 70%rh at 60°F), and switching units *converts* rather
than clears.

**Survey is immutable; only triage is writable.** A record you can quietly edit after the fact is
not a record. If a figure is wrong the fix is a new survey or a note saying so.

**Notes append-only by construction**, not by convention: POST-only route, author and timestamp
from the verified session and DB clock.

**`/admin/rfq` shares the `deals` perm** rather than taking a new one — an RFQ is the front of
the sales pipeline and becomes a deal, so same trust boundary. Also avoids the perm-seed
migration entirely.

**Dashboard shows unclaimed as well as your own.** A dashboard listing only your assignments goes
quiet exactly when nobody has picked something up — the failure the feature exists to stop.

**Reminders ride the digest cron** rather than claiming a slot, on the belief that only 2 were
available. **That belief turned out to be wrong** (§4) — worth revisiting.

**Leadership update sourced from `CHANGELOG.md`**, not git subjects. Commit messages describe
code; changelog entries describe what changed for the business. It also means the report cannot
claim anything that was not written down.

**PDF built with jsPDF vector primitives, not `html2canvas`.** ~35 KB, crisp at any size,
selectable text.

### Rejected — do not re-propose

| Rejected | Why |
|---|---|
| Cloud scheduled agent for the weekly update | No access to Resend credentials — it could generate the document but never send it |
| Emailing the RFQ into `submissions` / a builder form | See above |
| Making survey fields editable in admin | Destroys the record |
| A separate `rfq` permission | `deals` is the same trust boundary; a new perm needs a migration + seed |
| Auto-signing-out an unlinked customer (`iat-customer`) | Makes "not linked yet" indistinguishable from "portal is down" |
| Relaxing a cron guard to `if (SECRET && …)` | **Actively dangerous** — see §4 |

---

## 4. GOTCHAS DISCOVERED

**⚠️ `if (CRON_SECRET && auth !== …)` is fail-OPEN.** I shipped `/api/cron/rfq-reminders` that
way. With the variable unset the check is skipped entirely; an anonymous GET ran the sweep and
**sent real mail** to the shared desk. Fixed in `426de37`. All four cron routes now use
`if (!CRON_SECRET || auth !== …)`. A route whose only job is to send email must never be
reachable by default.

**⚠️ `CRON_SECRET` did not exist in Vercel until this session.** Every cron route 401'd since the
day it was written. `digest_runs` was **empty** — the daily admin digest had never sent, once.
Weekly PTO accrual had never run. Now set and verified.

**⚠️ An unmapped `/admin/*` path is fail-OPEN, not fail-closed.** The fallback perm `dashboard`
is held by **all five** scoped roles (verified against live `role_permissions`). Three comments
in `lib/roles.ts` claimed the opposite; corrected. Every new admin route must be added to
`ADMIN_PATH_PERMS`.

**⚠️ The "2-cron tier limit" is stale.** A third cron deployed fine. That belief is why the
digest registers only its EDT schedule and needs a manual flip each DST changeover.

**⚠️ jsPDF's Helvetica is WinAnsi with no fallback.** `≈` rendered as `ʺH`, `′` as a stray `2` —
silently, no error. Every string goes through `san()` in `lib/rfq-pdf.ts`.

**⚠️ ASHRAE's dew-point curve fit is a different function from `satVaporPressure`.** rh → dew
point → rh did not round-trip across the ice/water crossover (0°F/70%rh returned 70.25%).
Replaced with bisection. Matters because freezer and cold-storage presets sit on that crossover
and customers can now type a dew point directly.

**⚠️ Two preset numbers were confidently wrong** until checked against the psychrometrics:
"1%rh at 68°F ≈ −20°F dew point" (it is −30°F) and "0.4 gr/lb ≈ −40°F dew point" (that is −45°F;
−40°F dp is 0.55 gr/lb). **Never state a psychrometric figure without computing it.**

**⚠️ The LLM invented a number.** An early leadership update wrote "six weeks of scheduled
background work never executed" — the changelog says only "never run since it was built". The
prompt now forbids any figure not explicitly in the source.

**⚠️ Vercel webhooks get silently missed.** The push carrying the cron auth fix produced no
deployment. Needed an empty commit. **Always confirm the prod alias moved.**

**⚠️ `vercel env pull` redacts secrets.** `CRON_SECRET` comes back as `""`.

**Looks wrong, is correct:**
- Ventilation excluded from the room total — deliberate (§3).
- Reminder stamps cleared when status leaves `new` — so a row returning to `new` is chased fresh.
- The takeaway page's `T` constants sum to 238mm with apparently arbitrary values — they are a
  fixed budget so the page can never overflow.
- `iat-customer`'s `SessionUnlinked` renders instead of redirecting — redirecting loops.

**Environment traps:** no LibreOffice or Python on this box (use Word COM via PowerShell for
page counts); bash heredocs mangle JS template literals and apostrophes — use the Write tool for
anything containing backticks or `${}`.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Prod alias confirmed | Browser-tested |
|---|---|---|---|---|
| RFQ wizard, both tracks | ✅ | ✅ | ✅ | ✅ Playwright, both tracks end-to-end |
| RFQ PDF | ✅ | ✅ | ✅ | ✅ Rasterised and visually reviewed every page |
| Unit selector | ✅ | ✅ | ✅ | ✅ Verified live on production |
| Door label | ✅ | ✅ | ✅ | ✅ Verified live |
| `/admin/rfq` list + detail | ✅ | ✅ | ✅ | ❌ **Auth-gated; never rendered with a real session** |
| TriageCard | ✅ | ✅ | ✅ | ✅ Via temporary unauthenticated route (since deleted) |
| Assignee dropdown | ✅ | ✅ | ✅ | ❌ Roster verified by query, UI not seen with a session |
| Note trail | ✅ | ✅ | ✅ | ✅ Rendered in all states |
| Reminder sweep | ✅ | ✅ | ✅ | ✅ Fired live; Resend id `a272dc79-…` |
| Dashboard card + Sales pills | ✅ | ✅ | ✅ | ❌ **Not seen rendered** |
| Weekly leadership update | ✅ | ✅ | ✅ | ✅ Generated + sent live twice |
| `iat-customer` fix | ✅ typecheck | ✅ pushed | ❌ **not confirmed** | ❌ |

**Explicitly NOT verified:**
- Any `/admin/*` page rendered with a logged-in session. All admin UI is compile- and
  query-verified only.
- The `my_rfqs` dashboard card and Sales pills rendering.
- The assignee dropdown in a real browser session.
- Whether the `iat-customer` deploy succeeded (separate Vercel project, not checked).
- The Monday cron actually firing on schedule (first real fire: **Mon 24 Aug, 12:00 ET**).
- The daily digest actually sending (first ever: the evening of 17 Aug).

**Verified numerically:** psychrometrics against published handbook points; the load engine
against a worked warehouse example; `setCondition` state machine incl. legacy-row compatibility;
the byline formatter; the status CHECK constraint accepting all four values and rejecting a bad
one; anonymous PATCH/POST returning 401 against production.

---

## 6. OPEN THREADS

**1. Admin UI has never been seen by a human.** Highest-value next action: open `/admin/rfq`,
click into a survey, assign someone, change status, add a note. *Blocked on nothing.*

**2. Five real quote requests are unread and unassigned.** Two are from an outside company.
References RFQ-2026-0001 … 0005. Next unclaimed reminder is due ~19 Aug.

**3. The daily digest sends for the first time tonight** (17 Aug, 16:25–16:34 ET) to Crystal,
Kacy and Lee. Jacob Younker, Tyler Bell and Jo Evans are **temporarily** held back —
`DIGEST_OPT_OUT_DEFAULT` in `lib/admin-digest.ts`, or `DIGEST_OPT_OUT_EMAILS` in Vercel.
**Revisit once the format has been reviewed.**

**4. The cron tier limit is stale — the digest's DST handling can be fixed.** Add the second
entry (`30 21 * * *`) back to `vercel.json` for zero-maintenance DST. Same applies to
`/api/cron/rfq-reminders`, which could take its own slot instead of piggybacking.

**5. `iat-customer` deploy unconfirmed.** `da035f4` pushed; confirm the separate Vercel project
built and aliased.

**6. `iat-learn` has ~460 MB of uncommitted import material** (`_import/`, `trainual-existing/`,
`_tmp_*`) plus dependency additions. Exploratory — the large directories should never be
committed. Someone should decide what to keep.

**7. Nothing converts an RFQ into a deal.** Re-keyed by hand.

**8. No assignee notification.** Being assigned sends nothing until the 24h nudge.

**9. This repo is PUBLIC.** The RFQ load engine mirrors the arrangement of an internally-marked
workbook (equations are ASHRAE and public). Flagged; Jacob's call.

---

## 7. RESUME CONTEXT

### Read first

1. `iat-forms-portal/docs/rfq-moisture-survey.md` — the feature end to end
2. `iat-forms-portal/CHANGELOG.md` — top ~6 entries
3. `iat-forms-portal/docs/support-tickets.md` — email + cron state
4. Memory: `rfq-moisture-survey`, `cron-secret-unset-crons-dead`,
   `unmapped-admin-path-is-fail-open`, `iat-forms-portal-repo-is-public`,
   `scoped-commit-parallel-sessions`

### Key paths

```
lib/rfq-psych.ts          psychrometrics (exact; do not "optimise" dewPointF back to a fit)
lib/rfq.ts                model, presets, load engine, setCondition
lib/rfq-pdf.ts            the PDF (san(), T constants, ensure())
lib/rfq-status.ts         status vocabulary — shared by 3 consumers
lib/rfq-reminders.ts      the chasing sweeps
lib/leadership-update.ts  weekly summary prompt + validation gate
components/support/RfqWizard.tsx
app/admin/rfq/            queue + detail + TriageCard
app/api/rfq/              public submit
app/api/admin/rfq/[id]/   triage writes + notes
supabase/migrations/087, 088
```

### Commands

```bash
# typecheck — never `npx tsc` (fetches a squatter)
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json

# build (stop any dev server first — shared .next)
npm run build

# migrations
node_modules/.bin/supabase db push --linked
node_modules/.bin/supabase db query --linked "select ..."

# preview next week's leadership update without sending
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://iatportal.vercel.app/api/cron/leadership-update?dry=1"

# rasterise a PDF to look at it (Poppler is installed, LibreOffice/Python are not)
~/AppData/Local/Microsoft/WinGet/Packages/oschwartz10612.Poppler_*/Library/bin/pdftoppm \
  -png -r 110 out.pdf page
```

### Rules that bit this session

- **`git add` by explicit path.** Never `-A`/`-am` — sessions share this working tree.
- **Always confirm the prod alias moved** after a push; webhooks get missed.
- **Build before pushing** — main is unprotected, push = production deploy.
- **Update `CHANGELOG.md` + `docs/`** for anything pushed live.
- **No competitor names, no customer names or organisations** in anything authored.
