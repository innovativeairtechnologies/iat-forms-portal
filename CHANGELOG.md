# Changelog

Notable changes to the IAT Forms Portal, newest first. Dates are deploy dates.

## 2026-07-02 — Roles & permissions, "View as" preview, and Data Reset panel

Go-live prep: replaces the coarse admin/employee split with seven staff roles and
adds an admin-only tool to wipe test data cleanly before launch. Full write-up in
`docs/roles-and-permissions.md`. **Requires migration `042_roles_permissions.sql`.**

### Added
- **Granular staff roles** — `admin, sales, hr, marketing, engineering,
  production_manager, production` (plus external `customer`). The base employee
  tier is renamed to `production`. Each role sees only its permitted admin tabs;
  the permission matrix lives in `lib/roles.ts` (the single source of truth,
  imported by the edge middleware, server, and client alike).
- **Two-layer access control** — the sidebar filters nav by permission AND the
  middleware page-gates scoped roles, so a hidden tab can't be reached by typing
  its URL. Any unmapped `/admin` route fails closed to admin-only.
- **"View as [role]"** — an admin-only sidebar control that previews the portal as
  any role would see it, with zero effect on the admin's real access (client-only).
- **Data Reset panel** (`/admin/reset`, admin-only) — per-dataset bulk delete
  (submissions, tickets, equipment, customers, PTO, sick, employees) behind a
  type-`DELETE` confirm. Account deletes remove the Supabase auth user so the
  email is immediately reusable; the employees wipe preserves all admins.

### Changed
- Role is assignable when inviting an employee and on the employee detail page.
- Login, the root router, and the auth callback each route a user to the correct
  home for their role via the shared `homeForRole()` helper.

### Fixed / hardened (from an adversarial preflight review)
- Removed a legacy `is_admin`→role sync from `/api/employees/[id]` that wrote the
  now-retired `employee` value unchecked — it could have left a demoted admin with
  full access. All role changes flow through the validated role endpoint.
- Migration 042 keeps `employee` as a deprecated transitional CHECK value so the
  old app can't error during the deploy window, and swaps `time_off_requests.
  reviewed_by` to `ON DELETE SET NULL` so the employees wipe can't be silently
  blocked by a foreign key.
- The reset tool now surfaces per-account delete failures and the customers-delete
  error instead of swallowing them.

### Migration
- **042_roles_permissions.sql** (required) — widens the `profiles.role` CHECK,
  migrates existing `employee` rows to `production`, repoints the signup trigger,
  and fixes the `reviewed_by` foreign key.

## 2026-07-02 — Gantt v2 "Honest Schedules": windows, baselines, risk rules, Monte Carlo

Answers leadership's critique of the Gantt tool ("deceptive and deep, with a ton
of nuances and conditional IF-THEN statements") with the mechanisms real
scheduling tools use (LiquidPlanner ranged estimates, MS Project baselines,
Primavera-style P50/P80/P90, RiskyProject probabilistic branching). The chart is
now a **forecast instrument**, not a promise. Full write-up in `docs/gantt.md`.

### Changed
- **Ship windows everywhere** — list cards, editor stats, callout, and print show
  "best – worst" (plan date secondary); the single ship date is gone. Bars draw a
  faded extension to their own worst case; milestones get accumulated
  best–worst whiskers instead of false-precision diamonds.
- **Scenario toggle retired** — it was itself a false-precision machine (click
  "Best case", screenshot it). The always-on window + P80 replaces it; the DB
  column stays for compat.
- **Failure toggle generalized** into per-task **risk rules** `{prob %,
  delayMin–delayMax, note}` — several per task, edited inline in the task table.
  Each risk is a what-if chip; "firing" it cascades the schedule, persists, and
  is loudly labeled on screen + print. Legacy `failure`/`reset_weeks` migrate
  lazily onto the anchor task (`normalizeChart()`); columns deprecated.

### Added
- **Baselines** — freeze the computed schedule as absolute dates (audit-logged);
  ghost bars under live bars; variance chips (emerald/amber/rose); what-ifs
  excluded from variance (plan vs plan).
- **Monte Carlo confidence** — 5,000 seeded client-side simulations (triangular
  durations, Bernoulli risks) → P50/P80/P90 ship dates + histogram + per-risk
  impact ("fires in 25% of runs, avg +7.8 wks"). Copy teaches the discipline:
  commit externally to P80.
- **Assumptions register** — editable, prints with the chart.
- **Print-designed sheet** — window headline, what-if banner, baseline variance
  table, risk register, assumptions, "Forecast, not a commitment" footer.
- Editor split into render-only components (`GanttChartView`, `TaskTable`,
  `ConfidencePanel`, `AssumptionsCard`, `PrintSheet`, `ui`); drag logic unchanged
  and spread-preserving (dragging the anchor keeps a user-entered range).

### Deploy / notes
- Run `041_gantt_ranges_risks.sql` in the Supabase SQL editor **before**
  deploying (autosave writes the new `baseline`/`assumptions` columns).
- Math verified by a 31-check sanity script: legacy charts compute identical
  dates through the new code; MC is deterministic, ordered (P50≤P80≤P90), and
  bounded by the analytic window; histogram binning capped for wide spreads.
- Pre-prod adversarial review (4 dimensions, each finding independently
  verified) caught + fixed 6 issues before ship: cleared start-date stranding
  every autosave; a deleted migrated risk reappearing on reload; the
  duplicate-during-debounce race; the 60-task silent cap; duplicate dropping a
  legacy contingency; and (found in passing) the debounced autosave logging a
  baseline audit event on every keystroke (baseline set/clear is now its own
  audit-logged action, out of the autosave path).

## 2026-07-01 — Gantt / Project Timelines: internal tool for customer project schedules

A new admin-only **Gantt** tab (`/admin/gantt`) for building and tracking customer
project schedules as interactive Gantt charts. Sales asked for a schedule on a
specific customer build; rather than a throwaway file that can't save, it's a
persistent, shareable portal tab. A timeline is a finish-to-start chain with one
**anchor** task (the long-lead / critical-path driver) whose arrival date drives
everything downstream — drag it (or the slider) and the whole tail re-cascades. A
**test-failure** toggle models the schedule reset (replacement long-lead parts,
`reset_weeks`), and ranged durations feed a Best/Likely/Worst scenario toggle.
Full write-up in `docs/gantt.md`.

### Added
- **`gantt_charts`** table (migration `040_gantt_charts.sql`) — one row per
  timeline; tasks stored inline as jsonb. Service-role only (RLS on, no policies).
- **`lib/gantt.ts`** — shared types + pure scheduling math (`layout`, `effDur`) +
  Auckland/blank templates; server-safe, so list and editor compute identical dates.
- **`lib/gantt-data.ts`** + **`app/admin/gantt/actions.ts`** — admin-gated,
  audit-logged reads and mutations (`create`/`update`/`duplicate`/`delete`).
- **`/admin/gantt`** list (cards, est-ship, new-from-Auckland-template) and
  **`/admin/gantt/[id]`** editor (draggable arrival anchor, scenario toggle,
  failure sim, editable task table, live stats, Print/PDF). Edits autosave.
- **Gantt** nav item in the `AdminSidebar` "IAT" section.

### Deploy / notes
- Run `040_gantt_charts.sql` in the Supabase SQL editor **before** deploying.
- Access is admin-only for now; Sales gets in via a temporary `admin` role.
  Role-based permissions (Sales sees Gantt, not PTO/Time Off) are still to come.
- Leadership flagged that a simple Gantt oversimplifies these projects' branching/
  conditional schedules; kept visible to demo. Pausing later = add `hidden: true`
  to the nav item (code, routes, and migration 040 all stay).

## 2026-07-01 — Portal-wide "calming" pass: subtracted visual noise on every surface

The portal — the `/admin` dashboard especially — had started to feel "in your
face." A density review across all nine surfaces found the bones (layout,
spacing, type, the shared card/list kit) were sound; the crowding came from
**decoration without meaning**: accent color used ornamentally (rainbow KPI
icons, six-color palettes, non-semantic rank-bar hues), the same fact rendered
two or three times (status/priority, streak/XP, stacked hero glows), and
animation that never rested (Jerry's idle orb, an alarm-red pulsing badge, an
infinite "Live" pulse, and a fake "⋯" affordance that did nothing). This pass
subtracts that noise everywhere while preserving every piece of information and
all behavior. Principles captured in `docs/design-language.md`.

### Changed
- **Shared DNA** — `AdminSidebar` nav count badges: solid saturated fills → soft
  tinted chips; `list.tsx` `StatusPill`: single soft fill (no border) +
  `semibold`; `PortalHero`: two glow blobs → one. Calms every portal at once.
- **Admin dashboard** (`app/admin/page.tsx`, `ExecutiveBriefing.tsx`) — one
  emerald focal point (flattened the Briefing, single hero glow), removed the
  non-functional `MoreHorizontal` "⋯" from KPI tiles, sparklines only on
  delta-bearing KPIs, Top-Forms/Top-Submitters rank bars recolored to emerald,
  secondary rail cards flattened, section rhythm `space-y-4`→`6`.
- **Customer + Jerry** (`CustomerDashboard.tsx`, `globals.css`) — Jerry's orb is
  calm at idle (one gentle breathe); the spin/orbit/twinkle now run only behind
  `.is-thinking` while he's answering. Cyan removed (pure emerald). Dropped
  redundant counters and muted request pills. Winding-road tracker untouched.
- **Ticket detail** (`TicketDetailClient.tsx`) — Problem Description promoted to
  the top; six read-only intake echoes folded into one collapsed "Intake details"
  disclosure (11 cards → ~5); duplicate status/priority pills removed from the top bar.
- **Support** (`app/support/page.tsx`, `status/StatusClient.tsx`) — alarm-red
  "Start here" badge → quiet emerald; five "coming soon" ghost cards → one-line
  note; static status dot; trimmed the run-on hero subtitle; softened
  secondary-card shadows.
- **Learn** (`app/learn/page.tsx`, `me/page.tsx`, `BadgeIcon.tsx`) — removed the
  duplicate dashboard stat strip; unified the four stat-tile hues to emerald;
  locked badges preview 4 behind "show all"; softened earned-badge tiers.
- **Employee** (`profile/page.tsx`, `EmployeeFormsView.tsx`, `OrgDirectory.tsx`) —
  unified KPI icon color; folded Quick Actions into the hero; muted the amber
  drafts panel; capped directory interest chips at 2 + "+N".

Sibling landing (`iat-home`) and ticketing (`iat-ticketing`) repos got matching
micro-fixes (one-shot "Live" pulse, tag trim; collapsed "coming soon" cards,
lighter review rows). No data, props, or behavior removed — visual noise only.
`tsc` + `next build` green. No migration. — J.Y. + Claude


The "Scan a Submittal PDF" tool in `NewCustomerWizard` sent the file as base64
directly in the POST body to `/api/admin/customers/extract-submittal`. Vercel
caps serverless function request bodies at ~4.5MB, so any Submittal whose
base64 exceeded that — roughly anything over ~3MB raw — was rejected by the
platform itself *before the route ever ran*, regardless of the route's own
(much higher) size check. The browser just got a non-JSON response back,
which surfaced as a generic "Could not read that file." A previous fix had
raised the route's own limit from 6MB to ~11MB, which didn't help — that
ceiling was never the actual constraint. Reported via a 7.1MB real Submittal.

### Fixed
- **`components/admin/NewCustomerWizard.tsx`** — the scan handler now uploads
  the file directly to Supabase Storage via a signed upload URL (new `POST
  /api/admin/customers/submittal-upload`, mirrors the existing
  ticket-attachments pattern) instead of embedding it in the function body.
- **`app/api/admin/customers/extract-submittal/route.ts`** — now accepts a
  Storage `path` instead of inline base64; downloads the file server-side
  (an outbound fetch, not subject to the inbound body-size limit) before
  handing it to Claude, and deletes it right after extraction (best-effort;
  it's not needed afterward and may contain customer PII).
- **New private bucket `admin-submittals`** (migration `035`, 20MB limit —
  comfortably above real-world Submittals, well under Claude's per-file cap).

`tsc` + `next build` green. Requires migration `035` before the fixed upload
path works; degrades to the same "could not read" error if deployed first
(no crash). — J.Y. + Claude

## 2026-07-01 — Self-serve "Request portal access" from support tickets

Customers no longer need a portal account forced on them just to check a
ticket, but can now opt in to one from a ticket they've already submitted —
gated by admin approval, not auto-created.

### Added
- **`RequestAccountCta`** (`components/support/RequestAccountCta.tsx`) — a
  shared CTA on the ticket success screen and the `/support/status` lookup
  result. Re-proves ownership via the same ticket-number + email match the
  status lookup already uses (`POST /api/tickets/request-account`); suppressed
  for already-logged-in portal customers, and shows "already linked" /
  "pending" states instead of re-submitting.
- **`customer_portal_requests`** table (migration `034`) — a pending queue,
  not an auto-created account. Snapshots the requester's details off the
  ticket (not client input) and carries a `suggested_customer_id` signal
  (set when the ticket's equipment serial is already linked to an existing
  customer) so the approving admin can spot a likely second-contact case
  instead of creating a duplicate company.
- **`/admin/customers` → Requests tab** (`CustomerRequestsQueue.tsx`) — pending
  count badge, each row linking back to the originating ticket. **Approve**
  opens `NewCustomerWizard` pre-filled from the request (now accepts an
  `initial` prop + a "attach to this company instead" toggle); **Deny** closes
  the request with an optional reason, no email sent.
- **`tickets.customer_id`** (migration `034`) — approving a request stamps it
  on the triggering ticket and backfills any other historical ticket from the
  same email, additive to `POST /api/admin/customers/invite`
  (`link_ticket_id` / `link_request_id`). Both `/customer` and
  `/admin/customers/[id]` now match tickets on `customer_id OR email OR
  serial` instead of email/serial only.

### Changed
- Confirmation email (`lib/resend-tickets.ts`) gained one line pointing back
  to the status page, where the CTA lives once ownership is re-proven — no
  new link, no email address in a URL.

Migration `034` applied to the DB before deploy. `tsc` + `next build` green.
End-to-end verified live in-browser up through ticket submission + the CTA
render/click; the approve/deny loop needs a post-migration pass. — J.Y. + Claude

## 2026-06-30 — OCR'd the image-only PDFs into Jerry's pool (+9 docs)

16 of the 80 source PDFs are image-only/scanned (no text layer), so they'd always
WARN-and-skip on ingest. They're now folded in via OCR — **no software install**, just
Claude PDF-vision and the existing `ANTHROPIC_API_KEY`.

### Added
- **`scripts/ocr-image-pdfs.mjs`** — transcribes each image-only PDF with Claude
  PDF-vision into a local sidecar `scripts/ocr-cache/<file>.txt` (page-delimited).
  Idempotent (cache-skips); `--force` / `--docs=` to re-run one.
- **`readOcrSidecar()` in the ingest script** — when a PDF extracts to 0 chunks, the
  ingest falls back to its OCR sidecar, so `--all` folds the scanned docs in.

### Changed
- **9 OCR'd docs ingested** (clean vendor-named titles + categories): Maxitrol Selectra
  94 gas valve, Belimo LF24-MFT-S, Belimo TF120, Fasco D215 motor, Fasco approval
  drawing, Control Products HS-70-O/HS-70-D sensor, Phasetronics EZ1 SCR, DRI rotor
  spec, NEMA Premium motor guide. Pool **58 → 67 docs (61 customer-facing), ~3,228
  chunks**. Verified each retrieves + cites correctly through Jerry's real path.
- **5 excluded** via `SKIP_DOCS` — 2 GE HumiTrac scans (already covered by
  `GEH2-D-TT2`/`GEH-S-TT3`/`DP4A`); `MMSQPL` + `Terms Certifigroup-MET Labs` (IAT
  internal business forms — an insurance questionnaire and a pricing quote, not product
  docs); and `ZWN030X6D Cond Unit Manual` (OCR revealed it's the **same Heatcraft
  H-IM-CU condensing-unit manual** already in the pool as `H-IM-CU-0808.pdf` — caught by
  verifying retrieval, the "ZWN…" filename is just an order number).
- **`scripts/ocr-cache/` is gitignored** — this repo is **public**, so full third-party
  manual text + the internal-form transcriptions stay out of git; the text lives only in
  the RLS-locked KB DB after ingest (same posture as the rest of the pool). Also
  gitignored `scripts/_*.mjs` (throwaway dev harnesses).

The OCR'd text is competitor-scrubbed at ingest like everything else. Data is already
live in the DB (ingest is data-only). The big 9 MB `ZWN030X6D` scan needed splitting into
page-batches to OCR (single-call timed out); once transcribed it proved to be a dup (see
above), so it was removed and excluded. `tsc` + `next build` green; no migration.

## 2026-06-30 — Jerry never names a competitor (Munters scrub, 3 layers)

IAT leadership's rule: a **competitor's name must never reach a customer through Jerry**
— not in an answer, not in a cited document's title, nowhere. Munters is the only
competitor in the corpus (component suppliers like Omron/Vaisala/Belimo are kept — those
names are useful and expected).

### Added
- **`lib/competitors.mjs`** — single source of truth (plain `.mjs` so the Node ingest
  script and the TS API route share it). `scrubCompetitors()` neutralizes every brand
  reference, even glued into a URL/email/compound word (`www.MuntersAmerica.com`,
  `info@muntersnv.be`); guarantee: `hasCompetitor()` is false afterward. One-line to add
  the next competitor.

### Changed
- **Ingest** (`scripts/ingest-kb-docs.mjs`) — chunk content is scrubbed before storage
  (so the `tsv` can't even index the brand), and citation titles are de-branded:
  Munters handbook → **"Dehumidification Guide"**, M120 → **"M120 Desiccant Dehumidifier"**.
- **Assistant** (`app/api/customer/assistant/route.ts`) — excerpts + source titles are
  scrubbed before the model sees them; a system-prompt rule forbids naming any competitor
  **and** revealing a referenced doc's publisher/author/address/provenance; the final
  reply is run through `scrubCompetitors()` as a net.
- **Document policy** — the 228-page competitor-authored handbook is held
  **`is_internal=true`** (its front matter leaked the publisher's address/editor — an
  indirect identifier a prompt can't fully launder out of 228 pages). De-branded and
  available to a future employee assistant; re-enable for customers by removing it from
  `INTERNAL_DOCS`. M120 stays customer-facing, de-branded. Customer-facing pool now 52
  docs (6 of 58 internal).

Data already re-ingested against the live DB (pool is Munters-free). **Verification:** a
node harness replays Jerry's real answer path; 31 adversarial probes (direct, oblique,
jailbreak, authority, translation/OCR tricks, footer/metadata extraction, "Swedish
company") were judged by an independent 2-judge panel — **0 direct or indirect leaks**;
supplier controls (Belimo/Vaisala/Omron) still answer correctly. `tsc` + `next build`
green. No migration. Auth-gated — verified via build + node harness, not a logged-in
screenshot.

## 2026-06-30 — Admin: "Employee Forms" sidebar item + unfinished-draft badge

Makes an admin's in-progress form drafts easy to find (the `/admin/employee-forms`
fill library — which carries the "Continue where you left off" resume list — had no
sidebar link, only ⌘K). Now there's a clear entry point with an at-a-glance count of
unfinished work.

### Added
- **"Employee Forms" nav item** in the admin sidebar (Employees section, beside the
  "Forms" *manager*) → `/admin/employee-forms`.
- **Amber draft-count badge** on it — the number of the signed-in admin's in-progress
  drafts (`lib/drafts.ts#getUserFormDraftCount`, wired through the admin layout like the
  other sidebar counts). Matches the amber "Continue where you left off" theme. Lets a
  reviewer doing a batch of reviews see at a glance they have unfinished ones to resume.

Distinct from **Forms** (`/admin/forms`, the builder/manager) and **Submissions**
(`/admin/submissions`, the review queue of completed forms). No migration.

## 2026-06-30 — Save & resume forms across devices (account drafts)

Stop a form mid-fill and pick it up later on any device. Built for performance
reviews — a manager can have several in progress at once and resume any of them.
**Requires migration `033_form_drafts.sql`**; degrades gracefully until it's run
(no crash — drafts are simply inert).

### Added
- **`form_drafts` table (migration 033)** — per-user drafts, multiple per form,
  service-role only.
- **`/api/drafts`** (GET list / PUT upsert / DELETE) — the user is resolved from the
  session, so a user only ever touches their own drafts.
- **Cross-device autosave** — logged-in portal fills autosave to the user's account
  (debounced); the form header shows a "Saved" cue.
- **"Continue where you left off"** on the Employee Forms tab — lists in-progress
  forms (with who/when) to **Resume** or **Discard**; the draft is cleared on submit.
- Anon public-link fills (`/forms/[slug]` while signed out) keep a same-device
  localStorage autosave as a fallback.

### Changed
- **`StepFormModal`** is now dual-mode — account drafts (cross-device) for the
  logged-in portal, localStorage otherwise — with a resume banner + "Start over".
  See `docs/form-drafts.md`.

## 2026-06-30 — Jerry is now the founder's bobblehead

Swapped the formal headshot avatar for the fun full-body **bobblehead** caricature:
- **Idle hero** ("Hi, I'm Jerry") = the standing bobblehead with a soft emerald aura + ground
  shadow, gently bobbing/floating (new `JerryFigure`).
- **Header + inline** = the **abstract emerald orb** (`Orb`) — Jacob preferred just the orb (no cropped face) in the small spots; only the hero is the bobblehead.
- Source 1024px PNG optimized to a **32 KB `public/jerry-bobble.webp`** (via `sharp`); removed the
  old `jerry.avif`. Also fixed a sizing bug where the avatar `<img>` used `inset` without explicit
  width/height (replaced elements fall back to intrinsic size → the orb avatar was oversized) — now
  a sized, `overflow:hidden` wrapper. `components/customer/CustomerDashboard.tsx`, `app/globals.css`.

## 2026-06-30 — Roadmap revised: gentler flowing road + clickable milestones

The "windier" serpentine shipped earlier today read as too plain/boring, so the customer
build/ship roadmap is reworked to the **gentler flowing curve** with the dashed **center-line
("road") markings back**, a thicker road, and up to **5 stops on a single row** when they fit.
Each stop is now **clickable**, opening a panel with the milestone's status / date / notes and a
**"Documents — coming soon"** section. (The real per-milestone document store + admin upload is the
separate follow-up build.) `Tracker` in `components/customer/CustomerDashboard.tsx`.

## 2026-06-30 — Jerry wears the founder's face + a windier build/ship roadmap

- **Jerry's avatar (#4).** The orb now carries a portrait of the company founder Jerry is named
  for — his photo as the orb's core, with the halo, spinning ring, and orbiting sparks kept and a
  gentle float on the idle hero (the "calm" treatment). `public/jerry.avif`; `Orb` in
  `components/customer/CustomerDashboard.tsx`; `.jerry-face` in `app/globals.css`.
- **Windier roadmap (#5).** The customer build/ship tracker is redrawn as one smooth, meandering
  curve (Catmull-Rom; stops alternately rise and dip) with the racetrack lane-markings removed —
  calmer and curvier. **Visual only** for now; the click-a-milestone-for-documents idea is a
  separate later build (needs per-milestone document storage). `Tracker` in `CustomerDashboard.tsx`.

## 2026-06-30 — Contact Us by department + Jerry reads from the top of long answers

Customer-portal feedback round (bossman review).

- **Contact Us → departments.** The customer "Contact Us" card now asks the customer to pick a
  **department** (Sales / Customer Service / Engineering / Billing) instead of listing staff names.
  Messages route to **iatsupport@dehumidifiers.com** for now, with the department in the subject
  (`[Department] Portal message — Company`) and body so they can be split to per-department inboxes
  later. Department is validated server-side. (`components/customer/CustomerDashboard.tsx`,
  `app/api/customer/contact/route.ts`, `lib/resend-customer.ts`.)
- **Jerry — long-answer scrolling.** When Jerry's answer lands it now scrolls to the **top of that
  answer** instead of the bottom (long replies used to dump you at the very end), and the panel is
  taller (max-h 340→460, min-h 268→340). (`components/customer/CustomerDashboard.tsx`.)

## 2026-06-29 — Print views: per-department form preview + submission printout

Two browser-native print views for the Performance Review (and any conditional form) — the ops
director can **Print** or **Save as PDF**, and both honor the `show_when` department conditions.
Code-only; no migration, no env vars.

### Added
- **`/print/forms/[id]`** — pick a department → preview **only that department's questions** as a
  blank questionnaire (universal sections + that department's gated questions) before sending to
  team leads. Linked from the form-builder toolbar (next to Tally). Works for any conditional form;
  non-conditional forms just print the whole form.
- **`/print/submissions/[id]`** — a clean printout of a completed submission showing only the fields
  that applied to that person's department, to hand to the employee. Linked from the submission
  detail (next to Download PDF).
- Standalone `/print/*` routes (no admin chrome → clean output), self-gated with `getAdminUser()`;
  shared `components/PrintFrame` + `PrintButton`; reuses `lib/forms.ts` visibility so the printout
  matches the live form. `tsc` + `next build` clean.

## 2026-06-29 — Jerry refinements (light-first, serif voice, tuned orb, real name) + KB pool to 58 docs

Follow-up polish after scaling Jerry's KB pool to the full documentation folder.

- **KB pool** — ran `ingest-kb-docs.mjs --all` (now **58 docs / ~3,164 chunks** after pruning 6
  duplicate source files via a new `SKIP_DOCS` set). Recovered `PXR3.pdf` (NUL-byte fix in
  `cleanText`), sealed a customer-PII doc (`References.pdf` → internal), and added vendor-named
  citation titles. See `docs/kb-rag-assistant.md`.
- **Light-first customer portal** — the customer portal now defaults to **light** for a browser
  that has never chosen a theme (scoped effect in `CustomerDashboard`; admin/employee keep the
  global `system` default; a customer who toggles to dark is still respected).
- ~~Jerry's serif "voice"~~ — tried a serif for his greeting + answers; **reverted same day**
  (didn't read well), so the answers stay in the portal's sans.
- **Tuned orb** — calmer/slower idle breathing + halo, a richer core/ring gradient, and a gentle
  floating drift on the large idle hero orb (`app/globals.css`; still honors `prefers-reduced-motion`).
- **Real name in the prompt** — the assistant's system prompt now introduces itself as **Jerry**
  (was "the IAT Assistant") so it answers to its name (`app/api/customer/assistant/route.ts`).

## 2026-06-29 — Customer assistant becomes "Jerry" + light/dark toggle

Reskinned the customer-portal AI assistant from a chat-bubble bot into **Jerry** — an animated
"presence" (a breathing emerald orb that spins up while it reads the docs), with typeset answers
and cited "receipts" (document + page) instead of speech bubbles. Same RAG underneath — only the
experience changed.

- **Jerry** (`components/customer/CustomerDashboard.tsx`; orb styles in `app/globals.css`) — idle
  hero with a large orb + greeting, a persistent orb in the header that energizes while loading,
  answers as clean text with source chips, an "Ask Jerry…" composer. Honors `prefers-reduced-motion`.
- **Light/dark toggle** — the existing `ThemeToggle` (Sun/Moon) is now surfaced in the customer-portal
  header. The portal already supported dark mode via Tailwind; it just wasn't exposed to customers.
  Built light-first.

## 2026-06-29 — Customer AI Assistant: documentation RAG with citations

The customer-portal **IAT Assistant** can now answer from IAT's documentation. PDFs are ingested
into a searchable pool; the assistant retrieves the most relevant excerpts, answers **grounded only
in them**, and **cites the source (document + page)** as chips under each answer — or says it's not
in the documentation and routes to support. It never guesses product specifics. **Lean POC: Postgres
full-text search only** — no new vendor, no embeddings key (semantic vectors are the planned upgrade).

- **Data (migration `030_kb_rag.sql`)** — `kb_documents` + `kb_chunks` (generated `tsvector` + GIN
  index), both service-role only; a `match_kb_chunks()` SQL function ranks chunks **TF-IDF-style** so
  a rare, distinctive term (`humidistat`, `e5cn`, `overcurrent`) outweighs a common one (`set`,
  `alarm`) and the document that actually covers the question wins.
- **Ingest** — `scripts/ingest-kb-docs.mjs` extracts each PDF **per page** (page numbers preserved
  for citations) with `pdftotext`, chunks it, and inserts via the service role; idempotent per file,
  internal/company docs flagged `is_internal` (hidden from customers). POC pool: **10 docs, ~2,114
  chunks**. (`A1094 Manual.pdf` is image-only/scanned — excluded pending OCR.)
- **Retrieval layer** — `lib/kb-rag.ts` (`retrieveChunks` + helpers) is reusable (an internal
  assistant can reuse it with `includeInternal: true`) and **degrades to no-op** until the pool exists.
- **Assistant** (`app/api/customer/assistant/route.ts`) injects the excerpts, cites doc+page by exact
  label, and returns the cited sources; `components/customer/CustomerDashboard.tsx` shows them as chips.
- Docs: **docs/kb-rag-assistant.md**. Deploy: apply `030_kb_rag.sql`, then run the ingest script. No new env vars.
- **Follow-up (same day):** widened the retrieval window **6 → 10 chunks** — a specific answer page can
  rank just outside the top few when it doesn't repeat the product name (e.g. the Omron E5CN "Current
  Value Exceeds" error table, p.230, which never says "E5CN"). Semantic (vector) search remains the
  durable fix for deep-manual needles.

## 2026-06-26 — Forms round 4: review tweaks, equipment-form dropdowns/photos, new ticket numbers, roadmap tracker

A batch of form changes plus two redesigns.

- **Performance Review** — removed the **Employee Signature** field (supervisor signature kept;
  existing submissions keep whatever they captured). Each individual submission page
  (`/admin/submissions/[id]`) now shows a **per-review ratings tally** — the Superstar / Rockstar /
  Star / Performer counts for that one person — complementing the form-wide tally page. It renders
  only when a submission has answers on that scale, so the other forms are unaffected.
- **Equipment Support form** — the sample-label photo is larger / more prominent; the **pre- and
  post-cooling "type"** fields are now **dropdowns** (Chilled water coil, DX, Glycol, Evaporative,
  City/well water, Cooling tower water) with an **"Other…"** free-text fallback; the **Wheel & Seals**
  step shows **reference-photo placeholders** for the desiccant wheel and seals (drop the real images
  into `public/support/` and set `src` on the two `<ReferencePhoto>` calls).
- **Ticket numbers** — new format **`IAT-YYYY-NNNN`** (e.g. `IAT-2026-0042`), sequential per year,
  replacing the old `TKT-<timestamp>-<random>`. Generated atomically in the DB (`next_ticket_number`
  RPC + `ticket_counters` table, **migration 029**) so simultaneous tickets can't collide, and seeded
  above any existing numbers. The route falls back to a timestamp-based number if the RPC is absent.
- **Customer build/ship tracker** — rebuilt from a vertical stepper into a **winding-road roadmap**:
  milestone "stops" along a road that snakes through the card, with a truck parked at the current
  stop. Same stages and in-order logic — a visual redesign (`components/customer/CustomerDashboard.tsx`).

## 2026-06-26 — Submittal reader: larger PDF limit

Raised the "New from Submittal" PDF size cap (`extract-submittal`) from ~4MB to **~11MB** — the old
limit was rejecting Submittals the platform itself accepts. The forwarded base64 stays well under
Claude's ~32MB request cap. (For PDFs beyond that, the next step would be routing the upload through
Supabase Storage instead of the request body.)

## 2026-06-26 — Admin nav: "Forms" link to the form builder

Replaced the admin sidebar's **Employee Forms** item (`/admin/employee-forms`) with a **Forms** link
to the admin form builder/manager at **`/admin/forms`**. The `/admin/employee-forms` page still
resolves by URL (now nav-orphaned).

## 2026-06-26 — Form engine: conditional fields + ratings tally (Performance Review)

Two new form-builder capabilities, both **additive** — a field with no condition behaves exactly as
before, so the other ~40 forms are unaffected.

- **Conditional fields** — a field can show only when another field has a given value (builder field
  settings → **"Show only when…"**). The multi-step renderer (`StepFormModal`), the embed renderer
  (`FormRenderer`), and the server-side submit validation (`/api/submit`) all respect it: hidden
  fields aren't required and their values are dropped from the submission; empty sections collapse to
  no step. Schema: `form_fields.show_when_field` / `show_when_value` (**migration 028**). Visibility
  logic lives in `lib/forms.ts` (`isFieldVisible` / `visibleFields` / `stripHiddenAnswers`).
- **Ratings tally** — **`/admin/forms/[id]/tally`** (linked from the builder toolbar) counts how many
  **Superstar / Rockstar / Star / Performer** each employee received across all rating questions in
  their reviews, grouped by the "Employee Name" field — for reviews and bonuses.

**Performance Review form** data changes ship via `scripts/update-performance-review.mjs` (run after
migration 028; dry-run by default, `--commit` to apply, idempotent): removes 5 first-page/doc fields
(position title, supervisor, review period, position description + doc), swaps the rating scale to
**Superstar / Rockstar / Star / Performer** (drops Performance Gap, adds Superstar), and gates the
**Department-Specific** questions by **Department** (Engineering questions only show for Engineering,
etc.). The general competencies, Safety/Initiative/Growth, Summary & Goals, and Signatures stay
universal.

## 2026-06-25 — Hotfix 2: the real fix for the `/customer ↔ /login` loop (unlinked customer logins)

The cookie fix below was correct hardening but **not** the root cause. The loop's real driver: the
`/customer` page server-redirected to `/login` whenever `getCustomerUser()` returned null — which
happens for a customer login **not linked to a company** (`profiles.customer_id` is null; the FK is
`ON DELETE SET NULL`, so deleting a `customers` row orphans its logins). Middleware sees `role=customer`,
lets `/customer` through and bounces `/login` → `/customer`, so the page's redirect looped forever.
Fix: `/customer` now renders a client `CustomerSessionError` that **signs out locally** (clears the
session) then routes to `/login` — no server redirect, so the loop is impossible. Find orphaned
logins to clean up: `SELECT id FROM profiles WHERE role='customer' AND customer_id IS NULL;`

## 2026-06-25 — Hotfix: production auth redirect loop (`/customer ↔ /login`)

A logged-in customer whose session token needed refreshing could hit an infinite `/customer ↔
/login` redirect loop (ERR_TOO_MANY_REDIRECTS) on the live domain. Cause: `middleware.ts` returned
redirects without carrying over the refreshed Supabase auth cookies that `getUser()` sets, so the
refreshed session was dropped on each redirect and the auth gate oscillated (logged-in → `/customer`,
unresolved → `/login`, forever). Fix: a `redirectTo()` helper copies `supabaseResponse`'s cookies
onto every redirect (the documented Supabase SSR pattern). Also: the root router (`app/page.tsx`)
now sends customers to `/customer` (was `/employee/profile`). Latent middleware bug — surfaced by an
aging customer session on prod, not by a specific feature change. Code-only; no migration.

## 2026-06-25 — Status lookup: prefill + request picker for signed-in customers

`/support/status` is now session-aware (like the support form). A logged-in customer gets their
**email prefilled** and a **"Your requests"** quick-picker — one tap looks up any of their own
tickets / checklists (matched by their account email, so the lookup always verifies). Anonymous
visitors get the unchanged public lookup — `/support/status` is **not** gated. Split into a server
`page.tsx` + `StatusClient.tsx`; `getStatusCustomerContext` in `lib/support-context.ts`. No migration.

## 2026-06-25 — Support form: prefill for signed-in customers (public form stays open)

When a logged-in portal customer opens the support form (`/support/equipment-support`) it now
prefills their account email + contact details and shows a **"Your account & equipment"** card —
pick a unit to fill in its serial / model / voltage (auto-filled when they have a single unit);
everything stays editable. The page is **session-aware**, so **anonymous, non-portal customers see
the exact same public form** — `/support` is not gated. Prefilling the exact serial also makes the
resulting ticket auto-link to the right equipment record. New `lib/support-context.ts`
(`getSupportCustomerContext`); the support page renders per-request. Code-only; no migration.

## 2026-06-25 — Admin tracker: one-click canned notes

The Build & Shipping tracker editor (admin equipment detail) now offers 2–3 customer-facing
**note presets per stage** (one click fills the note) alongside the existing free-text note — so
staff don't write an update from scratch for every unit. Presets live in `lib/customer.ts`
(`notePresetsFor`), with a generic fallback for custom stages. Code-only; no migration.

## 2026-06-25 — Customer portal: live IAT Assistant (read-only)

The dashboard's "IAT Assistant" placeholder is now a working chat. Code-only; **no migration**.

- `POST /api/customer/assistant` (Anthropic `claude-sonnet-4-6`) answers grounded in the logged-in
  customer's equipment (serials, warranty, build/ship milestones) + IAT's published KB, assembled
  server-side. **Read-only** — it can't open tickets or change anything, is told to route actionable
  requests to Submit a request / Contact Us, and won't invent serials, dates, or status.
- Right-rail chat panel with suggestion chips, a typing indicator, and a "can make mistakes" note.
- Uses the existing `ANTHROPIC_API_KEY` (same as the Submittal reader) — no new env vars.

## 2026-06-25 — Customer portal: unit photos, Contact Us + message form

Dashboard build-out (stacked on the admin front door below). Code-only; **no migration**.

- **Unit photos** — admin uploads build & QC photos on `/admin/equipment/[id]` (new uploader
  `components/admin/EquipmentPhotos.tsx`; browser → Supabase Storage `ticket-photos` bucket, then
  PATCH `equipment.photo_urls`). They render as an expandable lightbox gallery on the customer
  dashboard.
- **Contact Us** card on the customer dashboard — the IAT team roster (Kacy Orr, Crystal Hill,
  Jacob Reagan, James Pope) plus a small **message form**. Submissions email
  `jacob.younker@dehumidifiers.com` via Resend (`POST /api/customer/contact`,
  `sendCustomerContactEmail`); the sender's company / contact / email are attached server-side.

## 2026-06-25 — Customer portal: admin front door (Customers section + Submittal wizard)

A **customer-first** way to provision portal access, alongside the existing equipment-first
"Invite to portal" card. Code-only; **no migration**.

- New **Customers** entry in the admin nav + **`/admin/customers`** list (search, Active/Inactive
  filters, unit counts) and a **`/admin/customers/[id]`** detail page (linked units, contact details).
- **New Customer wizard** (`components/admin/NewCustomerWizard.tsx`): scan a Submittal → review the
  pulled **customer + unit** fields → one click creates the `customers` row, the login, the
  `equipment` row, seeds the build/ship tracker, and emails the temp-password invite — all through
  the existing `POST /api/admin/customers/invite` (which already accepted a full `equipment` object).
- The same wizard is the equipment list's **"New from Submittal"** button, so there's a single
  create-from-Submittal path (Submittal PDF + manual entry only — no DW integration).
- **Resend invite** (`POST /api/admin/customers/[id]/resend-invite`) resets the temp password,
  re-sends the email, and re-activates the account; **Remove from portal**
  (`POST /api/admin/customers/[id]/remove`) deletes the login and marks the customer inactive
  (equipment + history kept). Both audited.
- `genTempPassword` extracted to `lib/temp-password.ts` (shared by invite + resend).

## 2026-06-25 — Legacy troubleshooting intakes migrated into Tickets

The retired Troubleshooting Checklist's intakes (`troubleshooting_intakes`) now live in the
unified **Tickets** queue. Each row was copied into `tickets` keeping its original `TSC-…`
reference as the ticket number — so the origin is obvious in the queue and the move is
**idempotent** (a `TSC-` ref already in tickets is skipped) and **reversible**
(`DELETE FROM tickets WHERE ticket_number LIKE 'TSC-%'`). Dates and status are preserved
(`new→open`, `reviewed→in_progress`, `closed→closed`); the checklist-only diagnostics
(onset, wheel/seals, external factors, …) map 1:1 thanks to migration 027.

All 6 rows were internal **test** submissions (J.Y. + Kacy, Jun 23–24), moved at the user's
request; the source `troubleshooting_intakes` table is left intact as a backup (retire it in a
later cleanup). Data-only — ran against the live DB via the service role, no code deploy.
Script: `scripts/migrate-troubleshooting-to-tickets.mjs` (dry-run by default; `--commit` to write).

## 2026-06-24 — Portal cleanup batch: nav trim, milestone ordering, customer simplification, org-chart list, sectioned submissions

A pass across all four portals (admin, customer, employee, support). Code-only; no migrations.

### Admin
- Hid the **US Rotors** nav (kept for future use behind a `hidden` flag) and **deleted the
  one-item Actions** section (New Form is still in ⌘K and at `/admin/forms`).
- **Troubleshooting** folded into **Tickets** — the two customer forms now feed one pipeline;
  legacy `troubleshooting_intakes` remain reachable at `/admin/troubleshooting` by URL.
- **Equipment list** PM column shows the full year (`Jun 26, 2027`) instead of `Jun 26, 27`.
- **Build & Shipping tracker** enforces **in-order** milestones (client blocks the change with
  an inline error; the milestones API re-validates and returns 409) and was redesigned with a
  stepper + breathing room. Equipment detail `<main>` got `space-y-4` so its cards stop butting
  together.
- **`/admin/org-chart`** gained the same **Chart / List toggle** the employee directory has
  (extracted to a shared `components/org-chart/OrgDirectory.tsx`).
- **Submission detail** now renders a **card per form section** (grouped by `section_header`)
  instead of one endless "Responses" list — mirrors the ticket detail.

### Customer
- Removed the redundant **"Support & resources"** card grid: the single support form
  ("Submit a request") and "Check status" live in the hero, and the Knowledge Base lives in the
  right rail (was 2 KB blocks + 2 form cards). Reflects the merged support form; spacing tightened
  toward a single-screen layout.

### Employee
- Hid the **US Rotors** nav section and the dashboard "US Rotors order" quick-action (kept for future).

### Support
- Removed the **US Rotors** brand option from the equipment support form (IAT-only now).

### Responsive
- Form grids that were a fixed two columns (cramped on phones / narrow laptops) now stack to
  one column below `sm` — the customer support form (`EquipmentTicketForm`) and the admin
  equipment & employee detail forms. (Best-effort pass; the dashboard KPIs already ship a
  separate mobile layout, and the detail two-column breakpoints stay `xl` because the admin
  sidebar takes 240px.)

## 2026-06-24 — Hardening: gate `/tools/*`, fix the inert router-cache config, add a smoke suite

Shipped the two genuinely-new fixes that had been stranded (done on a branch, never
deployed) on `chore/cleanup-hardening`. Cherry-picked to `main`; that branch's duplicate
Employee-Forms and support-rebrand commits were dropped (already live) and the branch deleted.

### Security
- **Gated `/tools/*.html` behind authentication** (security item 8.3). The internal static
  calculators (order-status card, voltage scaling, US Rotors pricing) were public by URL;
  `middleware.ts` now redirects anonymous visitors to `/login`, and any signed-in employee or
  admin may use them. Added `/tools/:path*` to the middleware matcher.

### Fixed
- **The admin Router-Cache setting was silently inert in production.** `staleTimes` had been
  moved to the **top level** of `next.config.js` during the 14→15 upgrade on the belief it had
  gone stable — but in Next 15 it's still `experimental.staleTimes`, so a top-level key is
  ignored (confirmed against the installed config schema and the build's "Experiments" banner).
  Moved it back under `experimental`, so `staleTimes.dynamic: 0` takes effect again (pairs with
  `RefreshOnNavigate`). Also set `outputFileTracingRoot: __dirname` so Next stops walking up to
  the stray repo-root `package-lock.json` when inferring the workspace root.
- **Troubleshooting CS-alert email** now links the live `/admin/troubleshooting` queue instead
  of the stale "a dedicated admin view is coming in Phase 2" copy.

### Added
- **Playwright smoke suite** (`e2e/smoke.spec.ts`, `playwright.config.ts`, `npm run test:e2e`):
  non-mutating checks that public entry points load, anonymous auth boundaries redirect, and the
  new `/tools/*` gate holds. Read-only by design (the dev server talks to prod Supabase).

### Removed
- **Dead code:** the legacy `/admin/test` design-preview dashboard (503 lines) and the no-op
  `/api/admin/auth` stub (login is client-side Supabase now). Nothing referenced either.

## 2026-06-24 — Employee Forms tab added to `/admin`

The "Employee Forms" library (the JotForms brought into the portal) is now available
in the admin portal as well, not just `/employee`. Admins are also employees — this
lets them fill out and submit the same forms (PTO, etc.) without leaving `/admin`.
Code-only change; no migration, no env vars.

### Added
- **`/admin/employee-forms`** — the same fillable forms library employees see: active
  forms grouped by category, category tabs, rows open the `StepFormModal` to submit.
  Distinct from `/admin/forms`, which remains the form *builder/manager* (create, edit,
  QR, embed, toggle active, approval).
- **"Employee Forms" sidebar item** under the admin **Employees** section, plus a matching
  ⌘K command-palette entry.

### Changed
- Promoted the employee `ResourcesFormsView` to a shared `components/EmployeeFormsView.tsx`
  so `/employee/resources` and `/admin/employee-forms` render from one component (added an
  optional `eyebrow` prop; employee output unchanged). No behavior change for employees.

## 2026-06-24 — Customer Portal (Phase 1) — external customer logins

A customer-facing portal at `/customer`. A company that has bought units from IAT
gets a login to track their equipment, build & shipping status, warranty, and
support — branded to IAT. Provisioned by staff from the equipment record, optionally
by scanning a Submittal PDF. Requires migration `026_customer_portal.sql`.

### Added
- **New `customer` role** (`profiles.role`) + `profiles.customer_id`. New tables
  `customers` (one per company) and `equipment_milestones` (staff-updated build→ship
  timeline); `equipment.customer_id` links units to a customer. All service-role only —
  `/customer` reads run server-side scoped to the session's customer, so the browser
  never queries those tables and customers can't see each other's data.
- **`/customer` dashboard** — unit cards (serial / model / warranty), a build & shipping
  tracker, KB + start-up guide, the existing support forms, and "My Requests" (their
  tickets + troubleshooting intakes, now behind a real login). IAT Assistant panel is a
  Phase-3 placeholder.
- **Admin "Customer Portal" card** on `/admin/equipment/[id]`: invite a customer (creates
  the login, links the unit, seeds the tracker, emails a set-password link) + a build &
  shipping milestone editor. Invite can **scan a Submittal PDF** (Claude document
  extraction) to pre-fill company/contact.
- New routes: `POST /api/admin/customers/invite`, `POST /api/admin/customers/extract-submittal`,
  `POST|PATCH /api/admin/equipment/[id]/milestones`; new `/customer/welcome` set-password page.
- Helpers: `lib/customer.ts` (milestone model), `lib/customer-auth.ts` (`getCustomerUser`),
  `lib/resend-customer.ts` (welcome email).

### Changed
- **`middleware.ts`** resolves the session role once and routes the `customer` role to
  `/customer` (and keeps customers out of `/admin`, `/employee`, `/learn`).
  Existing admin/employee routing preserved; `/login` and `/auth/callback` are role-aware.

### Deploy notes
- Run `supabase/migrations/026_customer_portal.sql` (applied 2026-06-24).
- Add `${APP_URL}/auth/callback` to Supabase Auth → URL allowlist (set-password redirect).
- Customer email sends from `onboarding@resend.dev` until a Resend domain is verified; the
  invite dialog shows a copyable set-password link as a fallback. No new env vars. `tsc` clean.

## 2026-06-15 — List-view fixes: kebab clipping + forms column alignment

### Fixed
- **Kebab menu options clipped** on the top rows of Submissions & Tickets — the shared
  `BODY_BOX` had `overflow-hidden` that clipped the vertically-centered dropdown. Removed it;
  rows now self-round their outer corners (`rowCx` → `first:rounded-t-xl last:rounded-b-xl`).
  Shared-kit fix, so it covers Equipment & Employees lists too.
- **Forms list column misalignment** (header labels vs row Status/Subs/Actions) in the flat
  category view — header and rows are separate grids and the template ended in `auto`, which
  sized differently in each. Actions column is now a fixed `232px` so both grids align.

## 2026-06-15 — Detail pages redesigned to the dashboard language

`/admin/submissions/[id]` and `/admin/tickets/[id]` now match the operations
dashboard (zinc surfaces, rounded-xl cards, emerald accents, sticky breadcrumb).

### Changed
- **Submissions detail is now two-column** (was a single scroll-heavy column): a main
  **Responses** card + a sticky right rail with a **Details** summary and **Internal Notes**.
  `section_header` fields render as subheading bands; answered/total count in the header.
- **Tickets detail** restyled to the same language — every section is a titled icon card;
  back button → breadcrumb. Structure and all behavior unchanged.
- New `components/admin/detail-ui.tsx` (`DetailShell`, `DetailTopBar`, `Card`, `CardHead`,
  `MetaRow`) shared by both pages so they stay consistent. Restyled `SubmissionStatus`,
  `SubmissionNotes`, and the PDF-download button to the emerald/zinc palette.

No behavior changes (status picker, PDF, notes, ticket save + resolution-reason gate,
attachment upload all preserved). `tsc` clean.

## 2026-06-15 — Fix: audit log wasn't capturing status changes / form creation

Resolving submissions and creating forms produced no audit entries — those paths
bypassed the instrumented API routes.

### Fixed
- **Server actions weren't logged.** Submission status (`updateSubmissionStatus`) and
  ticket status (`updateTicket`) are Next server actions writing straight to Supabase;
  they now call `logAudit` (`submission.status` / `ticket.status`, only on a real
  transition).
- **Form create/activate/pause weren't logged.** Added `form.create` to `POST /api/forms`
  and `form.activate` / `form.pause` to the `is_active` branch of `PUT /api/forms/[id]`
  (logged only when the active state actually flips).
- Verified the `audit_log` write path was healthy via a live insert/read/delete self-test;
  the table was empty only because nothing had hit a logged path.

### Changed (security)
- `updateSubmissionStatus` and `updateTicket` had **no explicit admin guard** (service-role
  writes relying on middleware alone). Both now call `getAdminUser()` and refuse non-admins.

### Added
- Audit viewer: **Tickets** filter + icons/colors for the new action types; dashboard
  "Admin Activity" dot colors extended to tickets.

## 2026-06-15 — Audit coverage + dashboard Admin Activity feed

Follow-on to the audit log shipped the same day.

### Added
- **Six more audited actions** (10 total): `submission.status`, `employee.invite`,
  `employee.deactivate`, `employee.reactivate`, `accrual.adjust`, `accrual.run` — each with
  before→after metadata.
- **Grouped prefix filters** on `/admin/audit` (Forms / Employees / Accrual) + per-action
  icons and colors for the new types.
- **"Admin Activity" card** in the dashboard right rail — 6 most recent audit entries, read
  in the dashboard server query (degrades to empty if the table is missing).

### Changed
- `/api/submissions/[id]`, `/api/employees/invite`, `/api/employees/[id]`, and
  `/api/admin/run-accrual` now resolve the acting admin via `getAdminUser()` (was a boolean
  `isAdminAuthenticated()` check) so audit entries name who acted. Same admin-only gate.

## 2026-06-15 — Admin: Executive Briefing, Command Palette, Audit Log

Three upgrades to make the admin portal feel like a finished product.

### Added
- **AI Executive Briefing** (`/admin`) — a card where Claude writes a short plain-English
  read of the operation from live metrics. `app/admin/ExecutiveBriefing.tsx` (client) +
  `app/api/admin/briefing/route.ts` (gathers metrics, calls `claude-sonnet-4-6`, **caches
  in-module for 1 hour**; `?refresh=1` bypasses). Never called inline — the dashboard is
  `force-dynamic`, so the card fetches after mount.
- **Command palette** — press **⌘K / Ctrl+K** anywhere in the admin. `components/admin/CommandPalette.tsx`
  (mounted in `app/admin/layout.tsx`): static destinations + actions, plus live search of
  forms/employees/tickets via `app/api/admin/search/route.ts`. Full keyboard nav. A ⌘K chip
  in the dashboard search box opens it (`commandk:open` window event).
- **Audit log** — append-only `audit_log` table (`supabase/migrations/020_audit_log.sql`,
  RLS on / service-role only) + `lib/audit.ts` `logAudit()` (best-effort, never throws),
  wired into the role-change, form-approve, form-delete, and time-off-review routes. Viewer
  at `/admin/audit` with action filters; new **System** section in the sidebar.

### Operational notes
- **Run migration `020_audit_log.sql`** in the Supabase SQL editor (done 2026-06-15).
- The role route now uses `getAdminUser()` (was `requireAdminAuth()`) to capture the acting
  admin — same admin-only gate, returns 403 for non-admins.
- `ANTHROPIC_API_KEY` (already set for the AI form builder) powers the briefing too.

## 2026-06-15 — IAT Learn (Phase 1)

Added **IAT Learn**, an internal training portal that replaces Trainual, served at
`/learn` inside the forms portal with shared Supabase auth (no second login).

### Added
- **`/learn` route group** — searchable category grid, numbered module steppers, and a
  lesson reader with per-module progress and mark-complete.
- **Admin** (`/learn/admin`) — full content tree with publish toggles and a TipTap
  rich-text lesson editor. Gated to `profiles.role = 'admin'`.
- **API** (`/api/learn/*`) — progress upsert (user id taken from the session, never the
  request body), plus admin-only lesson/module CRUD.
- **Migrations**
  - `014_learn_system.sql` — schema (`learn_categories`, `learn_modules`, `learn_lessons`,
    `learn_progress`) + indexes, `updated_at` trigger, `is_learn_admin()` helper, and RLS.
  - `015_learn_seed.sql` — seed of 5 categories, 14 subjects, **357 lessons** imported from
    the Trainual PDF exports. Idempotent (`ON CONFLICT DO NOTHING`). Split into
    `015a`–`015f` chunk files for pasting into the Supabase SQL editor (the combined file
    exceeds the editor's paste limit).
- `middleware.ts` — `/learn` auth gate (admin-gating handled in the `/learn/admin` layout).
- `app/globals.css` — `.learn-prose` reading styles + missing-image placeholder styling.
- `scripts/gen-learn-seed.mjs` — regenerates the seed (and chunk files) from
  `iat-learn/_import/*.json`.

### Known gaps (tracked for follow-up)
- **81 of 357 lessons are heading-only stubs** — those Trainual PDFs exported without body
  text (notably Safety Procedures: 21 of 23). Fill via the admin editor or re-import from a
  higher-fidelity export.
- **154 image/video placeholders** flagged for re-upload via the admin editor.
- Creating categories/modules from the UI isn't built yet (they come from the seed).
- Phase 2 (gamification: points, leaderboards, streaks, badges, quizzes) is deferred; the
  schema is ready for it.

### Operational notes
- Migrations are applied by hand in the Supabase SQL editor (no Supabase CLI wired up),
  same as prior migrations. For this release, run `014` then `015a`–`015f` in order.
- Full build detail lives in `../LEARN_BUILD_NOTES.md`.
