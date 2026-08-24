# Session handoff — 2026-08-24

Covers one long session, **2026-08-21 ~10:00 ET → 2026-08-24 08:10 ET**. One repo touched
(`iat-forms-portal`), **16 commits**, 54 files, +4,335/−123. No migrations. One env var changed.
One Vercel cron schedule replaced.

**Final state:** `iat-forms-portal` at `669687d`, clean, in sync with origin. One untracked file,
`supabase/migrations/093_super_admin_lee_childers.sql`, is **deliberately uncommitted** — owner's
standing decision, do not re-raise.

⚠️ **Read §4.1 before touching anything scheduled.** The single most expensive lesson of this
session is that *deploying near a cron's scheduled time silently kills that run*, and an entire
evening went into the wrong end of the problem before anyone looked at the deploy timeline.

---

## 1. SCOPE

### What it set out to do

Resume the 2026-08-21 handoff. The immediate question was §6.1 of that document: the render library
had no specification. The owner answered it directly — show the room the customer picked, in the
quote request.

### What it became

A continuous build-and-ship stream at the owner's direction. Everything below was asked for
in-session.

| Area | Outcome |
|---|---|
| RFQ application render | Built, mapped 28/29 applications, live |
| Render magnify | Built, **two interaction designs rejected**, ended at magnify-only |
| Live L/W/H dimensions | Built on screen and in the quote PDF |
| Image sharpness | Root-caused and fixed (double compression) |
| RFQ copy | Step headings reworded, "mould" → "mold" in six places |
| Ticket queue | My Tickets, Unassigned, Active/Closed switch, new default tab |
| Ticket alerts | Assignment email, reopen email, 30-day reopen window |
| **Reports section** | **New.** Six reports, new permission, new nav group |
| Daily digest | Quote requests added alongside tickets |
| Leadership report | Mon/Wed/Fri 18:00, three recipients, window widened, day-claim added |
| Dashboard | Two morning ticket-alert cards |
| Word document | 72-hour leadership summary, delivered to the owner |

### Left open

1. **Tonight's 18:00 leadership run is unverified** (§6.1) — first real test of the new schedule.
2. **Indoor pool has no render** (§6.2) — needs artwork exported.
3. **The 3D interaction is withdrawn**, awaiting an owner reference (§6.3).
4. **`ticket-reminders` behavior on 2026-08-21 is unexplained** (§6.4).
5. **No `closed_at` column** — blocked on Supabase CLI auth (§6.5).
6. **Almost nothing has been human-clicked** (§5).

---

## 2. CHANGE LOG

### 2.1 — RFQ application render (`b4a85a8`, `fc947dc`, `aa961bb`)

| File | Change | Why |
|---|---|---|
| `lib/rfq-renders.ts` | **NEW.** `PRESET_RENDER` map, preset key → `rooms` render key | ⚠️ Hand-maintained and separate from `lib/render-assets.ts`, which is generated and carries a do-not-hand-edit banner |
| `components/support/RfqWizard.tsx` | `ApplicationRender` in the sticky rail; `HoverMagnify`; `DimensionOverlay`; `useCanHover` | Rail sits **outside** the `AnimatePresence` that swaps steps, so it is not unmounted and re-fetched on every Continue |
| `lib/rfq-pdf.ts` | `loadRoomRender()`, `roomPhotoDiagram()`, `roomDiagram()` takes an optional image; ROOM DIMENSIONS card 62mm → 76mm | The picture and its dimensions now print; the abstract box remains the fallback |
| `public/rfq/panda-moisture.webp` | **NEW**, 760×1013 q92, 163 KB | Step 7 people-load illustration |

Mapping was done by **looking at all 39 renders**, not by filename. The vocabularies drifted:
the survey says `pharma` where the artwork says `pharmaceutical`, `dry-room` where it says
`battery`. A `startsWith` match would have shown customers the wrong room with no error anywhere.

### 2.2 — RFQ copy (`7516ff6`, `fc1e595`)

`components/support/RfqWizard.tsx`, `lib/rfq.ts`, `lib/hvacr/exercises.ts`, `lib/psychro.ts`:

- Step 2 `What are we protecting?` → **What is the application**
- Step 3 `Your target condition` → **Target conditions**
- Step 5 `The shell around it` → **Space construction**; kicker → **Tell us about your building materials**; rail label `Shell` → **Construction**
- Right panel `Typical Industry Conditions` → **Typical Conditions**
- **Mould → Mold** in six places; `Vapour barrier`/`fibreglass` in `lib/rfq-pdf.ts`

⚠️ Each spelling hit was checked individually, not swept — see §4.2.

### 2.3 — Ticket queue (`6e175fb`, `12b312b`)

| File | Change | Why |
|---|---|---|
| `app/admin/tickets/TicketsQueueClient.tsx` | `mine`/`unassigned` filters; `MineScope` Active/Closed switch; `matchesFilter()`; default tab → `mine` | Old default was `open`, which held **zero** of 14 live tickets — it opened on an empty screen |
| `app/admin/tickets/page.tsx` | Resolves the signed-in person's `employees.id` | |
| `lib/my-employee.ts` | **NEW.** `employeeIdForEmail()`, extracted when the dashboard needed it too | ⚠️ **Email is the only join** — see §4.3 |

### 2.4 — Ticket alerts and the reopen window (`504abcd`)

| File | Change | Why |
|---|---|---|
| `lib/resend-tickets.ts` | `sendCustomerMessageAlert` takes a required `ticketId`; new `sendTicketAssignedAlert`, `sendTicketReopenedAlert` | The customer-reply alert linked to the bare queue — the only alert that did |
| `app/admin/tickets/actions.ts` | Assignment email on owner change | New owner only; nothing on unassignment or self-assignment |
| `lib/ticket-history.ts` | **NEW.** `ticketLifecycles()`, `reopenDecision()`, `REOPEN_WINDOW_DAYS = 30` | ⚠️ Close times come from `audit_log` — there is no `closed_at` column |
| `app/api/tickets/status/message/route.ts` | 30-day gate before the note is written; reopen `closed → open`; reopen alert | |
| `app/support/status/StatusClient.tsx` | Renders the 409 as a real "Open a new ticket" link | Naming a rule without offering the way forward is not help |
| `app/api/bridge/ticket-note/route.ts` | Passes `ticketId` | |

### 2.5 — Reports (`504abcd`, `f4784c6`, `f6f9229`, `66def4c`)

**New section, six reports.** `app/admin/reports/{,tickets,rfq,sales,warranty,adoption,tools}/`
plus builders `lib/{ticket,rfq,sales,warranty,adoption,crib}-report.ts`, shared
`lib/report-shared.ts` + `lib/ticket-report-types.ts`, shared UI `components/admin/report-ui.tsx`.

| File | Change | Why |
|---|---|---|
| `lib/roles.ts` | New `reports` Perm; `ADMIN_PATH_PERMS` entry; `PERM_LABELS` | Admin-only **by omission** — no migration needed, same pattern as `srv`/`sizing` |
| `components/admin/AdminSidebar.tsx` | New **Reports** group, six children | |

### 2.6 — Notifications and scheduled jobs (`3eabef4`, `68df1a8`, `ca4fea9`)

| File | Change | Why |
|---|---|---|
| `lib/admin-digest.ts` | `getAdminRfqDigest()` — assigned / aging / **unclaimed** | ⚠️ Unclaimed is org-wide while all else is per-person — see §3.6 |
| `lib/resend-digest.ts` | `rfqList()`, three RFQ sections, subject carries the unclaimed count | |
| `app/api/cron/leadership-update/route.ts` | Mon/Wed/Fri 18:00; `withinSendWindow` 18–20; `claimDay()`; `scheduledSpan()`; `trace()` | See §3.7 and §4.1 |
| `vercel.json` | leadership `0 21/22 * * 1` → **`0 22/23 * * 1,3,5`** | |

### 2.7 — Dashboard (`66def4c`)

`components/dashboards/dept-cards.tsx` — `my_tickets` and `ticket_alerts` cards, both leading the
admin and scoped-role default layouts. `components/admin/DepartmentDashboard.tsx` resolves
`myEmployeeId` once into `CardCtx`. `components/dashboards/exec-cards.tsx` exports `AttentionRow`.

### 2.8 — Infrastructure state changes

| System | Change |
|---|---|
| **Vercel env** | `LEADERSHIP_UPDATE_EMAIL`: `lee.childers@` → **Lee, Kacy, Crystal**. ⚠️ Set with `--value --no-sensitive` — see §4.4 |
| **Vercel crons** | Leadership moved to `0 22 * * 1,3,5` + `0 23 * * 1,3,5`. Still **7 entries**, all `enabled: true` |
| **Supabase** | **No migrations.** One new `app_settings` key in use: `leadership_last_invocation` (and `leadership_last_sent`, not yet written) |
| **DNS / storage / buckets** | **No changes** |

### 2.9 — Documents produced

`C:\Users\JacobY\Documents\IAT-Portal-Update-2026-08-19_to_08-21.docx` — two-part leadership
summary covering 19–21 August. **This is the delivery vehicle for the content Friday's failed
6pm send would have carried.**

---

## 3. DECISIONS & LOGIC

### 3.1 — The render is a `rooms` asset, paired by an explicit map

**Options:** (a) match preset key to render key by string munging; (b) an explicit hand-maintained
map; (c) put the map inside `lib/render-assets.ts`.

**Chose (b), in a new file.** (a) mis-pairs several presets silently. (c) is barred: that file is
generated and says so. ⛔ Do not add the pairing there.

Pinned to the `rooms` set (1920×1080, 16:9, with background), **not** `rooms-cutout` — those are
transparent, trimmed to content, ~1.31:1, and are the set the overlay-compositing warnings apply
to. Nothing composites here, but the sets are not interchangeable in one slot.

### 3.2 — ⛔ TWO interaction designs were rejected. Do not propose a third unprompted.

1. **Pointer-tracked tilt on hover** — rejected: *"the way the picture moves is not what I want."*
   A picture that shifts under an uncommitted cursor reads as drift, not control.
2. **Press-and-drag 3D rotation** — rejected: *"you missed the mark on that."*

Current state is **magnify only**. `perspective` and `preserve-3d` were removed with the rotation
rather than left dormant, because a 3D context sitting on a 2D scale invites the next person to
"just add a small rotate". The owner is finding a reference example. The drag build is in git
(`aa961bb`) if a third attempt is ever commissioned.

### 3.3 — Indoor pool shows no picture, deliberately

28 of 29 applications map. There is no natatorium render in the set — verified by looking at all
39. Nothing is a fair substitute. **A wrong room is worse than no room**, so `natatorium` is absent
from the map and the card simply does not render.

### 3.4 — "My Tickets" scoping, decided twice

First shipped as **every ticket ever assigned to you** (all statuses), on the reasoning that a
filter named after a person should mean everything that is theirs. The owner corrected it: default
to active work, with a switch for closed.

Final: an **Active / Closed switch** inside the tab, defaulting to Active. **"Active" means NOT
closed** — open, in progress *and resolved*. Resolved sits on the active side because a resolved
ticket is not finished: a customer saying "seems fixed" raises a hand and someone here still has to
close it formally. Filing resolved under Closed would hide exactly the tickets awaiting a decision.

### 3.5 — Reopen goes to `open`, keeps its owner

**Options:** back to `open`; back to `in_progress`; leave closed and only notify.

**Chose `open`.** It needs triage and should surface in Open/Unassigned rather than looking like
something already in hand. The **owner is kept** so it stays with whoever knows it and no
assignment alert re-fires.

### 3.6 — Unclaimed is org-wide in an otherwise per-person digest

Deliberate asymmetry. An unclaimed request belongs to nobody, so a strictly per-owner digest is
precisely the shape that never mentions one — and unclaimed is the state that matters most, because
it is a customer waiting on a number. At the time, **all ten live requests were unassigned**; a
per-owner-only view would have shown every admin an empty section.

### 3.7 — Every scheduled leadership send is now an INTERIM

**Options:** (a) keep Monday as the full-week edition and add Wed/Fri interims; (b) make all three
cover only the days since the previous run.

**Chose (b).** (a) re-sends Tuesday-to-Friday content that already went out on Wednesday and Friday
— the exact duplication the interim concept was built to avoid (see §3.1 of the 08-21 handoff).

⚠️ **There is no automatic weekly edition any more.** `?edition=8.17.26` still rebuilds a week by
hand. Reinstating a Monday edition alongside these would reintroduce the duplication.

### 3.8 — Reporting access: a new perm, admin-only by omission

**Options:** reuse `tickets`; gate on the `admin` role in code; a new `reports` perm.

**Chose a new perm, granted to no scoped role.** `hasPermission()` returns true for `admin`
regardless, so it is admin-only immediately with **no `role_permissions` seed and no migration** —
the same pattern `srv` and `sizing` already use, and the `check-perm-seed` prebuild gate passes
precisely because nothing is granted.

⛔ **Not `tickets`** — engineering and production_manager hold that live. Reporting on who closed
what and how fast is a different question from working a queue; widening the queue perm would have
been invisible.

Gated **twice**: `ADMIN_PATH_PERMS` maps the prefix *and* every page re-checks and calls
`notFound()`. An unmapped `/admin/*` path falls back to `dashboard`, which all five scoped roles
hold, so the second check is what makes a future matcher edit fail closed.

### 3.9 — Sales reports value and confidence, NOT a stage funnel

I recommended stage velocity on row count (479 history rows), then checked the data: **402 are
`actor: 'dryware-sync'` seed rows**. The remaining 77 are one person between 21–29 July, nothing
since, several immediately reversed (`quoted→follow_up` 23×, `follow_up→quoted` 21× back, plus a
`won→verbal` and a `lost→verbal` undo). Every deal sits in `quoted`.

A velocity chart off that shows clicking presented as selling. `lib/deals.ts` already said the
board *"forecasts by confidence, not kanban stages"*. **If the board starts being used, re-check
the actor split — the history is already recording.**

### 3.10 — Close times from the audit trail, not a new column

The owner chose this over re-authenticating the Supabase CLI, so nothing was blocked. All then-closed
tickets were covered exactly. A real `closed_at` column with this as the backfill remains the
intended end state.

### 3.11 — Two dashboard cards, not one

Merging "mine" and "everyone's" produces a list where *"3 overdue"* could mean either. **A number
you cannot act on is worse than no number.**

---

## 4. GOTCHAS DISCOVERED

### 4.1 — 🔴 Deploying near a cron's scheduled time silently kills that run

**This is the headline finding of the session.** Measured 2026-08-21, all UTC:

| Cron due | Nearest production deploy | Result |
|---|---|---|
| 13:00 reminders | none nearby | ✅ ran 13:27 |
| 20:30 digest | 20:24:48 — 6 min before | ❌ |
| 21:30 digest | 21:31:43 — **on top of it** | ❌ |
| 22:00 leadership | 21:57:56 — **still building** | ❌ |
| 23:00 leadership | idle | ❌ |

**Ten production deploys between 20:09 and 23:21 UTC.** Control: Saturday and Sunday had **zero**
deploys and **all three** cron paths ran on **both** days.

⛔ **It is NOT the Hobby plan.** That was the first hypothesis (team is `hobby`, 7 crons) and it is
**disproven** — three distinct paths ran the same day, twice, and all 7 report `"enabled": true`.
Do not re-open it.

**Diagnostic order matters more than the finding.** An entire evening went into the route, the
guard and the secret before anyone looked at the deploy timeline. **Check deployments first.**

### 4.2 — Renaming a material label silently re-prices every stored survey 🔴

Carried from 08-21 and still live. `permOf()` matches `x.label === label` exactly and falls back to
the **last array entry**. This is why the "mould → mold" pass was checked hit-by-hit rather than
swept: every hit turned out to be a preset `driver`/`blurb` (display text), none a lookup key.

### 4.3 — `employees` has no `user_id`, and `profiles` has no email

**Email is the only join** between an auth user and an employee row. Consequences: match
case-insensitively, and **never `.maybeSingle()`** — the table is not staff-only (every customer
invite adds a row) so a duplicate address is possible, and `maybeSingle()` throws rather than
degrades. Checked: 10 rows, 0 duplicates, 0 blanks.

⚠️ **`login_events` DOES carry `user_id`**, and it is `profiles.id`. The adoption report's
"never signed in" first matched `display_name` against the login *email* and reported **10 of 11
staff as never having signed in when the truth was 2**. Caught by re-deriving the number
independently, not by reading the code.

### 4.4 — Vercel CLI 54 stores new Production vars as SENSITIVE, which pull back EMPTY

Setting `LEADERSHIP_UPDATE_EMAIL` the first time stored `""`. A sensitive value cannot be read
back, so it cannot be verified — and an empty recipient list means nobody gets the report, silently.

**Always:** `npx vercel env add NAME production --value "..." --no-sensitive --yes`, then confirm
with `vercel env pull` and read the value back.

### 4.5 — A `'use client'` component must never import a VALUE from a builder 🔴

`TicketReportClient` imported `RANGES` from `lib/ticket-report.ts`, which imports `supabase-admin`.
That shipped the **service-role client to the browser**; the page died at hydration with
`supabaseKey is required` — **past `tsc` and past a green server render**. Only loading the page
caught it. `lib/report-shared.ts` exists for exactly this. Types are erased and safe with
`import type`.

### 4.6 — Two measurement traps that made working code look broken

- **`getComputedStyle().transform` returns a transition's START value** in the preview pane, which
  runs no animation frames. A correctly-applied transform reads as an identity matrix. Set
  `style.transition = 'none'` before reading.
- **`getBBox()` ignores an element's own transform**, so it reported a rotated SVG label as clipped
  at `x = −14.8` when the rendered box starts at `+1.6`. Measure clipping with
  `getBoundingClientRect()` relative to the SVG.

### 4.7 — Bundle greps must match the ESCAPED form

Minified JS ships `°C` as `\xb0C`; Tailwind escapes `%` in selectors. Searching for the glyph — in
a shell *or* in node — reports ABSENT for code that is present. Anchor on an ASCII prop name.

### 4.8 — `next/image` was silently destroying the renders

A 61 KB 1920×1080 source came back as a **13 KB 640px JPEG** — downscaled and re-encoded at the
default quality of 75, on top of the q82 the upload script had already applied. Invisible at rest,
obvious at 2×. Both images now use `unoptimized`. 🔴 **Removing that prop silently softens them
again.**

### 4.9 — `lib/hvacr/` is only PARTLY generated

`gen-hvacr-course.mjs` writes `branch.ts` and `terms.ts` (both carry a "GENERATED FILE" header) and
the 085/086 migrations. **`exercises.ts` is hand-maintained** and safe to edit. Check the header,
not the folder.

### 4.10 — Looks wrong, is correct on purpose

- `'Not sure'` still appears in the shipped bundle — those are the **retired physics rows** that
  must stay last in their arrays. Their presence is not a failed deletion.
- Nine em dashes remain in customer-facing code — the standalone `'—'` empty-cell placeholders,
  deliberately excluded from the punctuation pass.
- The **register-value tile on the tools report shows "—"**, not `$0`: no purchase costs are
  recorded, and `$0` reads as broken.
- **Sales `rep_contact` holds the rep's NAME; `rep` is empty.** Reading `rep` gives blanks.
- The report `Section` open/shut state is **not persisted**, on purpose — range tabs re-render from
  the server and a remembered layout would show yesterday's choices against today's numbers.

### 4.11 — CHANGELOG ordering is load-bearing

`entriesForPeriod()` walks newest-first and **breaks on the first entry older than the period
start**. Audited: four entries are out of order at positions 86–137 (late July / early August).
Harmless for the 2–3 day runs; a manual `?edition=` over those weeks **will truncate**.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Prod alias | Browser-tested |
|---|---|---|---|---|
| RFQ render + 28/29 mapping | ✅ | ✅ | ✅ | ⚠️ real component, harness only |
| Magnify (final, no rotation) | ✅ | ✅ | ✅ | ⚠️ transform asserted, **never seen in motion** |
| Live L/W/H overlay | ✅ | ✅ | ✅ | ⚠️ geometry measured to the pixel |
| Render in the quote PDF | ✅ | ✅ | ✅ | ⚠️ **PDF bytes inspected, page never looked at** |
| Image sharpness | ✅ | ✅ | ✅ | ✅ served source confirmed 1920×1080, not via optimizer |
| RFQ copy + mold | ✅ | ✅ | ✅ | ✅ confirmed in the shipped bundle |
| My Tickets / Unassigned / scope switch | ✅ | ✅ | ✅ | ⚠️ real component + fixtures, **not the live page** |
| Ticket deep link | ✅ | ✅ | ✅ | ✅ **CONFIRMED IN A REAL SENT EMAIL** |
| Assignment email | ✅ | ✅ | ✅ | ❌ **never sent** |
| Reopen + 30-day window | ✅ | ✅ | ✅ | ❌ **never exercised** |
| Six reports | ✅ | ✅ | ✅ | ⚠️ numbers re-derived independently; gating confirmed 307 anon |
| Dashboard alert cards | ✅ | ✅ | ✅ | ❌ **queries verified, cards never rendered in the real dashboard** |
| Daily digest: RFQ sections | ✅ | ✅ | ✅ | ❌ **never sent** |
| Leadership Mon/Wed/Fri | ✅ | ✅ | ✅ | 🔴 **FAILED TO SEND 2026-08-21 — see §6.1** |
| Recipients (Lee/Kacy/Crystal) | n/a | ✅ | n/a | ✅ read back from Vercel |

### Explicitly NOT verified

1. 🔴 **The leadership schedule has never successfully sent.** Friday's run was eaten by deploys.
2. **No assignment or reopen email has been sent.** Both are inspected and typechecked only.
3. **The dashboard cards have never rendered in the real dashboard** — it is gated, and the card
   loaders were verified by re-running their queries, not by viewing the page.
4. **The quote PDF's space page has never been looked at.** Its content streams were inspected.
5. **The Word document's layout is unverified** — no LibreOffice/pandoc on this machine, so it was
   checked structurally (120 balanced paragraphs, 3 tables, correct page size) but never rendered.
6. **The RFQ wizard still cannot be driven past step 1 by automation** (§4.8 of the 08-21 handoff).

---

## 6. OPEN THREADS

### 6.1 — 🔴 Tonight's 18:00 leadership run is the live test — **THIS IS WHERE WE STOPPED**

Friday's send never happened (§4.1). The owner chose to **hold for Monday's scheduled 18:00 run**
rather than trigger manually, because triggering on Monday morning would have covered 22–24 August
and burned the day-claim, turning tonight's report into a 07:55 one.

**Next action:** after 18:00 ET on 2026-08-24, read the breadcrumb:

```bash
npx vercel env pull /tmp/e --environment=production --yes && node --env-file=/tmp/e -e 'const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;fetch(`${u}/rest/v1/app_settings?select=key,value,updated_at&key=like.leadership_%`,{headers:{apikey:k,Authorization:"Bearer "+k}}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,1)))'
```

- **No row** → the cron never fired. Check the deploy timeline first.
- **A row** → it fired; the `outcome` field says what it decided.

⚠️ **Do not deploy between 17:45 and 19:15 ET.**

Tonight's report should cover **22–24 August**. Thursday and Friday are already covered by the Word
document (§2.9), so no content is lost.

### 6.2 — Indoor pool has no render

`natatorium` is the one unmapped application. Needs a pool render exported into the SharePoint
`Rooms` library; then upload to the bucket and add one line to `lib/rfq-renders.ts`.

### 6.3 — The 3D interaction is withdrawn, awaiting a reference

⛔ Two designs rejected (§3.2). The owner is finding an example. Do not propose a third unprompted.

### 6.4 — `ticket-reminders` on 2026-08-21 is unexplained

The reminder stamps are "last run" timestamps, not a log, so they are overwritten daily and the
Friday state can no longer be recovered. Watch it on a day with no deploys.

### 6.5 — Blocked: no `closed_at` column

**Blocked on:** the Supabase CLI being unauthorized (`npx supabase login`). DDL cannot go through
PostgREST. When unblocked: add `closed_at`, backfill from `audit_log`, and reduce
`lib/ticket-history.ts` to the backfill script. ⚠️ Run `migration repair` first — the CLI shows
059–063 pending but they are LIVE.

### 6.6 — Judgment calls in the render mapping awaiting a look

Nine of 28 are judgment rather than name matches; the sheet was sent to the owner. Most worth
re-checking: `restoration → residential-1` and `investment-casting → manufacturing`.

### 6.7 — Carried forward, untouched this session

- **§8.2 anon storage uploads** in the ideas backlog
- **Email deliverability is invisible** — `email_events` is empty because `RESEND_WEBHOOK_SECRET`
  was never set. Given how much mail has quarantined this year, worth closing.
- **`submissions` is 0 against 57 forms** — worth understanding before building on it.
- **19 of 20 equipment units have no warranty data** — the aftermarket list cannot work until the
  installed base is imported.
- **Only 4 of 15 active people use Microsoft SSO.**

---

## 7. RESUME CONTEXT

### Read first

1. This file.
2. `docs/handoff/2026-08-21-session-handoff.md` — the session this one resumed.
3. `iat-forms-portal/docs/notifications.md` — **§ "Deploying near a cron's scheduled time"** before
   touching anything scheduled.
4. `iat-forms-portal/docs/reports.md` — the new section's architecture and access model.
5. `iat-forms-portal/docs/support-tickets.md` — queue filters, reopen window, alerts.
6. Memory: `deploys-near-cron-time-eat-the-run`, `rfq-application-render`, `portal-reports-section`,
   `leadership-weekly-update`, `bundle-grep-escaped-forms`,
   `rfq-option-lists-are-physics-tables`, `scoped-commit-parallel-sessions`.

### Key paths

```
iat-forms-portal/
  lib/rfq-renders.ts              # preset → render map. HAND-MAINTAINED
  lib/report-shared.ts            # 🔴 never import a server module here
  lib/ticket-history.ts           # close times from audit_log; the 30-day gate
  lib/my-employee.ts              # auth user → employees.id; EMAIL IS THE ONLY JOIN
  lib/*-report.ts                 # six builders, server-only
  components/admin/report-ui.tsx  # Tile / BarRow / Section / RangeTabs / CSV
  components/support/RfqWizard.tsx        # HoverMagnify, DimensionOverlay, DIM
  app/api/cron/leadership-update/route.ts # window, claimDay, scheduledSpan, trace
  app/admin/reports/                      # index + six reports
```

### Commands

```bash
# Never npx tsc — it fetches a squatter
node node_modules/typescript/bin/tsc --noEmit

# Stop any dev server BEFORE building (shared .next)
node node_modules/next/dist/bin/next build

# Trigger a cron BY HAND — no CRON_SECRET needed, Vercel supplies the header.
# ⚠️ Cannot pass query params, so it runs the job's default behavior only.
npx vercel crons run /api/cron/leadership-update

npx vercel crons ls --format json          # registered vs pending-deploy
npx vercel env add NAME production --value "..." --no-sensitive --yes   # see §4.4

# Verify what SHIPPED, matching the ESCAPED form (§4.7)
curl -s https://iatportal.vercel.app/support/rfq | grep -oE '/_next/static/chunks/[^"]+\.js'
```

### Project refs

| Thing | Value |
|---|---|
| Supabase internal | `dsbuhdjlkgwcghskvdse` |
| Vercel `iatportal` | `prj_0xzYnqI81xqgwvHdApqIP9oCkfSb` |
| Vercel team | `team_lrnCHwUYvgaDrPFqg9wGnAxK` (plan: **hobby**) |
| Cron windows (ET) | 09:00 reminders · 16:30 digest · 18:00 leadership Mon/Wed/Fri |

### Standing rules that bit this session

- **Do not deploy near a cron window** (§4.1) — new, and the most expensive.
- `git add` by **explicit path** — this tree is shared with concurrent sessions.
- Build **before** pushing; pushing `main` = production deploy.
- Verify against the **shipped artifact**, matching the **escaped** form.
- **Re-derive a number independently** rather than reading the code that produced it — that is what
  caught §4.3.
