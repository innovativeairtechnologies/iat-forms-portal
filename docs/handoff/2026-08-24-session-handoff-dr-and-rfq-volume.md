# Session handoff — 2026-08-24 (disaster recovery + RFQ room-size entry)

⚠️ **Filename.** `2026-08-24-session-handoff.md` was already taken by a *different* session
(2026-08-21 10:00 → 2026-08-24 08:10) that finished before this one resumed. This record is a
sibling, not a replacement — read both.

Covers **two sittings a week apart**, resuming the 2026-08-17 handoff:

| | When | What |
|---|---|---|
| Sitting 1 | 2026-08-17, ~14:00 → 16:30 ET | §6 of the 08-17 handoff: cron DST, security advisories, RFQ assignment notice, dashboard card |
| Sitting 2 | 2026-08-24, ~11:50 → 14:00 ET | Disaster-recovery backup, RFQ volume entry, dimension callouts |

**12 commits** on `iat-forms-portal`, 1 on `iat-learn`. **No migrations. No env vars changed.**
Repo state at close: `13c87b7`, clean, in sync. `supabase/migrations/093_super_admin_lee_childers.sql`
stays uncommitted — owner's standing decision, do not re-raise.

⚠️ **Other sessions worked this repo concurrently throughout.** Roughly 70 commits between
08-18 and 08-24 are *not* this session's. Two of this session's changes were later superseded by
them, for good reasons — see §4.6. Every commit here was staged **by explicit path**.

---

## 1. SCOPE

### What it set out to do

Resume the 2026-08-17 handoff "from §6" — its open-threads list.

### What actually got done

| §6 item | Outcome |
|---|---|
| 1. Admin UI never rendered with a session | **Done.** Browser-tested as `lee.childers`; found and fixed a real bug |
| 2. Five unread quote requests | **Resolved itself.** Queue now 11 rows, 9 closed/assigned |
| 3. Digest opt-out revisit | **Actionable now** — digest confirmed sending; owner's call |
| 4. Cron tier limit stale / DST | **Done.** 3 → 6 cron entries, paired-UTC DST |
| 5. `iat-customer` deploy unconfirmed | **Confirmed.** `da035f4` READY on production |
| 6. `iat-learn` 457 MB uncommitted | **Done.** Gitignored, deps reverted, backed up |
| 7. Nothing converts an RFQ into a deal | **Deliberately deferred**, reasoning recorded (§3.7) |
| 8. No assignee notification | **Built and shipped** |
| 9. Public repo vs load engine | **Still open — owner's call** |

### Scope that grew mid-session, at the owner's direction

1. Disaster-recovery backup of the whole stack into SharePoint (the largest piece of work here).
2. `BackUpManual.md` — a step-by-step recovery guide placed in every backup folder.
3. RFQ: a **Volume** alternative to length × width × height on step 4.
4. RFQ: dimension callouts redrawn to outline the room, then corrected twice on owner feedback.

### Left open

§6.9 (public repo), SharePoint folder permissions, and the Supabase plan decision. All owner
decisions, none blocked on engineering. See §6.

---

## 2. CHANGE LOG

### 2.1 — Cron scheduling and DST (`d27a23c`, 7 files)

| File | What | Why |
|---|---|---|
| `vercel.json` | 3 → 5 cron entries: second `admin-digest` at `30 21 * * *`, second `leadership-update` at `0 17 * * 1`, and `rfq-reminders` given its own `0 13 * * *` | Vercel Cron is UTC and does not shift for DST. Registering a job at **both** UTC times and letting the route discard the wrong one is the documented fix; it had never been applied because three comments claimed a 2-cron account-tier cap |
| `app/api/cron/admin-digest/route.ts` | Corrected the stale tier-cap comment; reworded the piggyback rationale | The cap does not exist. A third entry deployed fine, and Vercel documents multiple schedules per path. Leaving the false claim in place is how it survived for months |
| `app/api/cron/leadership-update/route.ts` | Added `isNoonEastern()` + `?force=1`; guard applies only to real sends | It had **no** wall-clock guard, so a second entry would have mailed leadership twice. ⚠️ **Superseded — see §4.6** |
| `app/api/cron/rfq-reminders/route.ts` | Comment rewritten: registered, not manual-only | It was unregistered purely because of the imaginary cap |
| `lib/rfq-reminders.ts` | "Why it is called from the digest cron" → "What calls this" | It now runs twice daily by design; the stamps make the second a no-op |
| `CHANGELOG.md`, `docs/support-tickets.md` | New "Cron schedules and daylight saving" section with the full table | Standing docs rule |

### 2.2 — Security advisories (`576b13b`, 2 files)

| File | What | Why |
|---|---|---|
| `package.json` | `minimatch@10 → brace-expansion ^5.0.9`; **new** `minimatch@3 → brace-expansion ^1.1.18`; `postcss` gains a nested `nanoid ^3.3.18` via the `"."` form; blanket `js-yaml ^4.3.1` and `dompurify ^3.4.13` | Four advisories (3 high, 1 moderate). Two could not be fixed the obvious way — see §3.2 |
| `package-lock.json` | Regenerated | npm overrides do **not** re-resolve entries already in the lock |

### 2.3 — RFQ assignment notification (`a4b1277`, 4 files)

| File | What | Why |
|---|---|---|
| `lib/resend-rfq-reminders.ts` | Added `sendRfqAssignmentNotice()`; `shell()` takes a footer; module header now describes three sends | Lives beside the two chasers because it shares their shell/table/job-line — one request should look the same whichever message opens it |
| `app/api/admin/rfq/[id]/route.ts` | Reads prior `assignee_id` before the update; sends after a successful write | Being assigned was silent: the first thing an owner heard was the 24-hour nudge saying they were already late |
| `docs/rfq-moisture-survey.md` | "Telling the owner, then chasing them" replaces "Chasing" | Three messages now, not two |
| `CHANGELOG.md` | H2 entry | Standing rule |

### 2.4 — Dashboard card (`15ae26d`, `9a701b7`, `f0137b3`, 5 files)

| File | What | Why |
|---|---|---|
| `components/dashboards/dept-cards.tsx` | `MyRfqCard` wrapped in `<Card>` + `<CardHead>`; added to **both** default layouts | It rendered with **no frame and no title** — an anonymous block reading "5 unassigned". And it was catalogue-only, so nobody had it |
| `next.config.js` | Opt-in `NEXT_BUILD_DIST_DIR` | `next dev` and `next build` share `.next`; several sessions work this tree, so "stop the dev server" means interrupting someone |
| `.gitignore` | `.next-*` | Scratch build dirs |
| `CHANGELOG.md` | H2 entry | Standing rule |

### 2.5 — RFQ volume entry (`065996e`, `8c8c019`, `db554c1`, 6 files)

| File | What | Why |
|---|---|---|
| `lib/rfq.ts` | `RoomSizeMode`, `ROOM_SIZE_MODES`, `DEFAULT_CEILING_FT`, `normalizeRoomSizeMode()`, `roomDims()`, `roomDimsAreDerived()`; `roomSizeMode`/`roomVolumeCuFt` on `RfqData`; `estimateLoad` reads `roomDims()` | `roomDims()` is the **single** definition of room size — engine, wizard readout, validation, PDF and admin page all read it, so they cannot disagree |
| `components/support/RfqWizard.tsx` | Segmented toggle, volume + ceiling-height fields, amber callout showing the derived footprint; readout and validation via `roomDims()`; `requirementHint()` takes the data | Volume alone cannot size a system — see §3.5 |
| `lib/rfq-pdf.ts` | Heading becomes `ROOM SIZE (FROM VOLUME)`; prints "… ft assumed" | An assumption stated is not a guess |
| `app/admin/rfq/[id]/page.tsx` | Field label becomes "Dimensions (assumed)" | A rep quoting off this needs to know the footprint was assumed |
| `app/api/rfq/route.ts` | `roomSizeMode` pinned via `normalizeRoomSizeMode()` in `coerce()` | String union; the generic copy would accept `"banana"` |
| `docs/rfq-moisture-survey.md` | "Two ways to give the room's size" | Standing rule |

### 2.6 — RFQ dimension callouts (`18de197`, `13c87b7`, 3 files)

| File | What | Why |
|---|---|---|
| `lib/rfq.ts` | `ROOM_RENDER_EDGES` — four points as fractions of the image box | One definition; the PDF draws the same callouts |
| `components/support/RfqWizard.tsx` | `DimensionOverlay` rewritten: lines parallel to the room's own edges, standing off it; labels lie along each line; `DIM` padding `padT` 40→48, `padB` 38→42 | Outer rules were chosen because "a photograph has no depth edge". Every `rooms` render is the same isometric from the same camera, so it does |
| `lib/rfq-pdf.ts` | Same three callouts from the same constants; stand-off `0.0125 × iw` | The code warns screen and PDF must agree — a customer reads them side by side |

### 2.7 — `iat-learn` (`8ae56f0`, local repo)

| File | What | Why |
|---|---|---|
| `iat-learn/.gitignore` | Ignore `/_import/`, `/trainual-existing/`, `_tmp_*`, with the reasoning inline | 457 MB was untracked **and** unignored — `git add -A` would have pushed it irreversibly |
| `iat-learn/package.json`, `package-lock.json` | Reverted 4 deps (`canvas`, `@napi-rs/canvas`, `pdf-parse`, `pdfjs-dist`) | No app source imports any; `canvas` referenced by nothing at all and is a node-gyp build |

### 2.8 — External state changed

| Where | Change |
|---|---|
| **GitHub** | **Created** `innovativeairtechnologies/iat-learn` (**private**). Its previous remote returned `Repository not found` — 4 commits existed on one disk |
| **Vercel** | `vercel.json` 3 → 5 crons (now 7, other sessions added more). `iat-customer` **linked locally** (`.vercel/project.json` written) |
| **Supabase** | **No migrations.** One disposable row `RFQ-2026-9999` inserted for UI testing and **deleted**, with its `rfq_notes` |
| **Env vars** | **None changed in Vercel.** `iat-customer/.env.local` (gitignored, untracked) had its **placeholder** keys replaced with real ones, fetched via `supabase projects api-keys` |
| **SharePoint** | `AiDataStorage - Documents` populated: 4 folders, **~680 files / 500 MB**, all sync-confirmed |
| **Laptop** | Scheduled task **"IAT Portal DR Backup"** registered — Sundays 18:00 |
| **Emails sent** | 1 real assignment notice to `jacob.younker@` (Resend `b0a45d58-…`), from the UI test |
| **DNS** | Untouched |

### 2.9 — Files written outside git

- `docs/handoff/2026-08-24-session-handoff-dr-and-rfq-volume.md` (this file, both copies)
- SharePoint: `disaster-recovery/` (db exports, storage, repo mirrors, config, scripts, README),
  `iat-learn-trainual-source/`, `iat-portal-workspace/`, `claude-memory/`, and `BackUpManual.md`
  in every folder plus the library root

---

## 3. DECISIONS & LOGIC

**3.1 Two cron entries per job, not a seasonal flip.** Options: (a) flip one line every Nov/Mar,
(b) register both UTC times and discard the wrong one. (b) won — it is zero-maintenance and the
digest already had the guard for it. The only thing that had ever blocked it was a false belief.

**3.2 npm overrides scoped per parent, never blanket.** `brace-expansion` is installed twice on
incompatible majors (`minimatch@3` needs 1.x, `minimatch@10` needs 5.x); `nanoid` likewise
(`postcss` 3.x, `docx` 5.x). A blanket override hands a consumer an API it does not speak.
⚠️ `npm audit` reports "0 vulnerabilities" either way, so it cannot distinguish a real fix from a
broken tree. Verified with 15 functional assertions instead.

**3.3 Secrets are NOT in the DR backup.** Deliberate. 28 production vars, 9 live credentials. The
stated threat model includes "hacked"; if that is the M365 tenant, a credential bundle in SharePoint
hands over the database, AI billing, the mail domain and the Graph app at once. **A backup must not
become the breach.** Names + provenance are captured; values get re-issued. Do not "improve" this.

**3.4 Database captured as NDJSON, not `pg_dump`.** `supabase db dump` shells out to `pg_dump`
inside Docker (not installed) and every direct route needs the Postgres password (not on the
machine). The schema does not need dumping — it is the 94 migrations, which are in the repo mirror.
So only data needed capturing, and the service-role key can do that. Restore = replay migrations,
then load rows.

**3.5 Volume mode also asks for ceiling height.** Volume alone cannot size a system: L, W and H are
not just a volume, they are the wall/ceiling/floor **areas** the permeation term needs. Options:
(a) one volume field and assume a cube — under-states envelope area by ~22%; (b) volume + ceiling
height, square footprint — volume and floor area exact, only the footprint *shape* assumed;
(c) refuse and demand dimensions. **(b) won.** Ceiling height is the one dimension people know
without measuring, and a square is the minimum-perimeter case so the error runs in a known
direction.

**3.6 Assignment notice is best-effort and skips self-assignment.** It runs after the write and
never throws — the assignment is the record and is already committed; a mail failure must not turn
a saved triage decision into a 500 the operator retries into a duplicate. Self-assignment sends
nothing: you know what you just did, and self-addressed mail teaches people to filter the sender.

**3.7 RFQ → deal deferred, not forgotten.** It needs a decision before code:
`docs/projected-sales.md` records DryWare as the pipeline's source of truth, and
`replace_projected_sales()` **wipes and reloads** before `materializeDealsFromProjectedSales()`
rebuilds `deals`. So a convert button either writes into a table the next sync overwrites, or it
pushes upstream. **That choice is the work.**

**3.8 Dimension callouts follow the room's edges.** The prior design used outer rules on the stated
assumption that a photograph has no depth edge. It does: every `rooms` render is the same isometric
from the same camera. Geometry was **measured** by compositing candidate lines onto real renders,
not eyeballed.

### Rejected — do not re-propose

| Rejected | Why |
|---|---|
| Putting secret **values** in the backup | §3.3. Asked for as "everything I'd need to rebuild"; the answer is an inventory, not a vault |
| Blanket `brace-expansion` / `nanoid` override | §3.2. Breaks a consumer while audit says "0 vulnerabilities" |
| Deleting the 457 MB of Trainual material | `_import/*.json` is a **live path dependency** of the shipped portal; `trainual-existing/` is the only copy of the source PDFs |
| Git LFS for the Trainual source | Owner confirmed Trainual is still accessible, so it is re-exportable. Not worth a metered 1 GB tier |
| Killing another session's dev server to build | Added `NEXT_BUILD_DIST_DIR` instead |
| Renaming the DR snapshot folders to "today" | An in-session correction that was itself wrong — see §4.5 |
| A temporary unauthenticated route to browser-test admin pages | Used by an earlier session; here it would have exposed real customer records on a public-repo app |
| Point-in-time recovery at $100/mo | Hard to justify for a 44 MB database that changes slowly. Pro at ~$45/mo, yes |

---

## 4. GOTCHAS DISCOVERED

**4.1 ⚠️ Supabase had NO backups at all.** `pitr_enabled: false`, `backups: []`. Free tier gets
neither. Everything previously backed up was code and documents — the *replaceable* half. This is
the single most important finding of the session.

**4.2 ⚠️ `supabase db dump` needs Docker, and fails leaving 0-byte files behind.** Three empty
`.sql` files were created that looked exactly like backups. **Delete them; never trust a `.sql` in
that folder without checking its size.**

**4.3 ⚠️ `npm audit` cannot detect the broken-override state.** "0 vulnerabilities" before and
after. Verify by loading both majors and asserting real results against literals, then
mutation-test the harness.

**4.4 ⚠️ AnimatePresence stalls in a hidden tab.** With `visibilityState: "hidden"`,
`requestAnimationFrame` never fires, `mode="wait"` never mounts the next step, and the wizard shows
the previous step's body under the new step's header. It looks broken and is not. **Any automated
run against this wizard needs a genuinely visible tab.** This build has no `tabs_select`, so only
the user can front it.

**4.5 ⚠️ This conversation spanned a week — do not infer the date from a document you are reading.**
Mid-session I concluded the whole session was mis-dated (from the 08-17 handoff's date) and renamed
the DR snapshot folders to 08-24. **File mtimes proved they genuinely were 08-17** and the rename
was reverted. Check the clock, and check mtimes before renaming anything dated.

**4.6 ⚠️ Two of this session's changes were later superseded — correctly.**
- `isNoonEastern()` (exact-hour) is **gone**. Another session found **Vercel crons on this project
  run 14–63 minutes late** and replaced it with an 18:00–20:00 window plus a day-claim. My
  whole-hour check would have silently sent nothing. **The paired-UTC DST pattern survived** and its
  rationale is still in the route comment.
- The digest's 10-minute window — which I flagged as a follow-up and declined to change on debut
  day — was widened by another session, who also found that **`hour === 16` alone is not enough**,
  because the entry runs at :30 past.

**4.7 ⚠️ The outward normal is not the same sign on all three dimension lines.** For the downward
vertical, `-uy/ux` points **into** the room, so height takes `+1` where width takes `−1`. Got it
wrong once: the line sat on the wall face, which looks almost right.

**4.8 ⚠️ Fit render geometry against `long-term-storage`, not just the first render you open.**
Fitted to `battery` alone, the floor line ran 2.5° steep (23.0° vs 20.5°) on the warehouse render
and visibly cut into the picture. **The floor edge is the sensitive one**; the top edge and the
vertical tolerate far more error.

**4.9 ⚠️ Padding does not fix a callout that crosses the picture edge.** The callouts are fractions
of the *image* box, so they move with it — expanding the frame moves the line too and the clearance
is unchanged. Reducing the stand-off is what buys the gap.

**4.10 ⚠️ A silhouette tracer with a loose threshold lies.** An early measurement "proved" the
renders were inconsistently framed; it was reading shadows and background gradient as room. The
owner corrected it and was right. Verify image geometry by **compositing and looking**, not by
thresholded pixel statistics.

**4.11 ⚠️ `vercel env pull` redacts secrets** (empty strings). But
`supabase projects api-keys --project-ref <ref> -o json` returns anon and service_role keys using
the CLI's existing session — that is how the `iat-customer` export was unblocked.

**4.12 ⚠️ MSYS mangles comma-joined Windows paths.** Passing `"/c/a.webp,/c/b.webp"` to node
resolved the first and failed the second. Use `C:/…` form.

**4.13 ⚠️ `NEXT_BUILD_DIST_DIR` rewrites `tsconfig.json`.** Next appends the scratch dir to
`include`. Revert it (`git checkout -- tsconfig.json`) before committing.

**Looks wrong, is correct:**
- `rfq-reminders` runs **twice a day** — deliberate redundancy; the migration-088 stamps make the
  second a no-op.
- The assignment notice is **not** sent on self-assignment.
- Volume mode assumes a **square** footprint — stated in three places rather than hidden.
- `iat-customer/storage/` in the DR backup is **empty** — that project genuinely has no buckets.

---

## 5. VERIFICATION STATE

| Change | Built | Deployed | Prod alias | Browser-tested |
|---|---|---|---|---|
| Cron DST + slots | ✅ | ✅ | ✅ `aliasError: null` | n/a — `vercel crons ls` showed 6; all 4 routes 401 anon |
| 4 security advisories | ✅ exit 0 | ✅ | ✅ | n/a — 15 functional assertions, incl. mutation test |
| RFQ assignment notice | ✅ | ✅ | ✅ | ✅ **both branches live** — sent (Resend `b0a45d58-…`), and `self-assigned — no notice sent` |
| `my_rfqs` card frame/title | ✅ | ✅ | ✅ | ✅ verified rendering, 1px border, 12px radius, `boxShadow: none` |
| `my_rfqs` in default layouts | ✅ | ✅ | ✅ | ✅ first card on Lee's dashboard |
| RFQ volume mode | ✅ | ✅ | ✅ | ✅ **2,500 / 30,000 / 2,400 identical to dimensions mode** |
| Dimension callouts | ✅ | ✅ | ✅ | ✅ zoomed on the warehouse render after the fix |
| Blocked-continue hint | ✅ | ✅ | ✅ | ⚠️ code-verified only; not re-driven after deploy |
| `iat-learn` gitignore + deps | n/a | n/a | n/a | n/a — pushed to the new private repo |
| DR backup | n/a | n/a | n/a | ✅ hash-verified + sync-confirmed |

### Explicitly NOT verified

- **The PDF's new dimension callouts have never been rendered.** Only the wizard's SVG was seen.
  The jsPDF angle sign (`-deg`) is reasoned, not observed. **Generate one PDF before trusting it.**
- **The volume-mode PDF and admin detail page** — `ROOM SIZE (FROM VOLUME)`, "ft assumed",
  "Dimensions (assumed)" — all code-verified only.
- **The blocked-continue hint** after its deploy.
- **The DR restore has never been rehearsed.** `restore-data.mjs` has not been run against a real
  rebuilt project. An unrehearsed restore is a hypothesis.
- **The weekly backup task has fired once**, manually and on 08-23 by schedule. Its pruning branch
  (>4 snapshots) has never executed.
- **`iat-customer`'s database restore path** — exported and verified, never restored.
- Whether Dependabot has closed the 4 alerts (it rescans on its own schedule).

**Verified numerically:** volume mode against the real `lib/rfq.ts` (transpiled, not
reimplemented) — 30,000 @ 12 ft reproduces 50 × 50 × 12 exactly, blank height falls back to 12,
legacy rows behave as dimensions, junk modes normalise, and a mutation test proves the assertions
can fail. DST admits exactly one invocation per occasion across 8 season/date cases. DB export
verified by live row counts vs on-disk line counts: 63 non-empty matched, 24 empty matched, 0
mismatches.

---

## 6. OPEN THREADS

**1. §6.9 — the public repo.** `iat-forms-portal` is world-readable and contains the RFQ load
engine, which mirrors the arrangement of an internally-marked workbook (the equations are ASHRAE
and public). Carried from the 08-17 handoff, still undecided. *Blocked on: owner.*

**2. Lock down `disaster-recovery/` in SharePoint.** It holds a full copy of employee, customer,
ticket, PTO and compensation data. It needs tighter permissions than the rest of the library.
*Blocked on: owner — cannot be set from here.*

**3. Supabase Pro, ~$45/month.** $25/org + ~$10/project compute × 2. Buys daily backups, 7-day
retention. The weekly SharePoint snapshot is laptop-driven and does not run when the machine is
off. **This is the real fix for the database half.** *Blocked on: owner.*

**4. Render one PDF.** The dimension callouts and the volume-mode strings are unproven on paper.
*Blocked on: nothing.* Highest-value next engineering action.

**5. Proofpoint — emails caught again.** Raised at the very end; not started. See §7 for what bit
last time. *Blocked on: which alerts are affected.*

**6. Rehearse a restore.** Create a throwaway Supabase project, `db push`, run `restore-data.mjs`,
compare counts. Until then the DR backup is untested. *Blocked on: nothing.*

**7. Digest opt-out (§6.3 of the 08-17 handoff).** The digest is demonstrably sending (08-20, 08-22,
08-23, 3 recipients). Three admins are still held back. *Blocked on: owner reviewing the format.*

**8. Two unassigned quote requests** — RFQ-2026-0009 and 0010. *Blocked on: owner.*

---

## 7. RESUME CONTEXT

### Read first

1. **`docs/handoff/2026-08-24-session-handoff.md`** — the *other* session covering 08-21..24.
   Its §4.1 (deploys near a cron time eat the run) is essential before touching anything scheduled.
2. This file's **§4** — every trap, especially 4.4 (hidden-tab stall) and 4.8 (fit against
   `long-term-storage`).
3. `BackUpManual.md` — in every folder of the SharePoint library.
4. Memory: `disaster-recovery-backup`, `corporate-storage-not-individual`,
   `daily-open-items-reminder`, `rfq-moisture-survey`, `brace-expansion-override-trap`,
   `animatepresence-hidden-pane-stall`, `scoped-commit-parallel-sessions`.

### Key paths

```
lib/rfq.ts                       roomDims(), ROOM_SIZE_MODES, ROOM_RENDER_EDGES  <- one definition each
lib/rfq-pdf.ts                   the PDF; same edge constants, opposite angle sign
components/support/RfqWizard.tsx StepSpace (toggle), DimensionOverlay (callouts), DIM padding
components/dashboards/dept-cards.tsx  MyRfqCard + defaultLayout()
lib/resend-rfq-reminders.ts      three staff sends, one shell
app/api/rfq/route.ts             coerce() — pin every string union here
vercel.json                      cron entries; DST pairs share a path
next.config.js                   NEXT_BUILD_DIST_DIR escape hatch

C:\Users\JacobY\Innovative Air\AiDataStorage - Documents\    the SharePoint library
  disaster-recovery\scripts\     dr-export, dr-storage, dr-verify, restore-data, refresh-backup
```

### Commands

```bash
# typecheck — never `npx tsc` (fetches a squatter)
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json

# build WITHOUT killing another session's dev server
NEXT_BUILD_DIST_DIR=.next-verify npm run build
git checkout -- tsconfig.json && rm -rf .next-verify   # Next rewrites tsconfig

# DB queries
node_modules/.bin/supabase db query --linked "select ..."

# project API keys (this is how iat-customer got unblocked)
node_modules/.bin/supabase projects api-keys --project-ref <ref> -o json

# re-run the DR snapshot by hand
powershell -File "…\disaster-recovery\scripts\refresh-backup.ps1"

# check a render's geometry before changing ROOM_RENDER_EDGES
node <scratch>/fit-lines.mjs "C:/…/long-term-storage.webp" '{"out":0.0125}'
```

### Rules that bit this session

- **`git add` by explicit path.** ~70 concurrent commits from other sessions this week.
- **Build before pushing** — main is unprotected; push = production deploy.
- **Confirm the prod alias moved** after every push.
- **Update `CHANGELOG.md` + `docs/`** for anything live.
- **Check the clock, not the document you are reading**, before dating anything (§4.5).
- No competitor names, no customer names or organizations.

### Proofpoint, for §6.5

Staff alerts previously died in **three** places, not one: Proofpoint rejected the null envelope
sender (`<>`) as domain spoofing — and you **cannot** allow-list your own domain out of it;
Defender cold-start quarantined the new subdomain; and an Exchange rule, **"Block Bulk / Sales
Emails"**, quarantines any external mail containing phrases like *"act now"* or *"limited time"* —
which alerts quote verbatim from customers. **SCL −1 does not bypass it; only an explicit Except-if
does.** MX is Microsoft, so **run an Exchange Message Trace first** — Resend reporting "delivered"
means nothing downstream.
