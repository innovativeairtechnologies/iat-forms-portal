# Post-Production (`/admin/engineering/post-production`)

_Requires migration `098_post_production.sql`._

A unit passes test, gets released to shipment, and the team walks it — the engineer, the
person who built it, the electrician who wired it, the tester. Everything they would have
done differently gets captured at the unit, on a phone, and then **assigned, dated and
answered**.

## Why the capture half is not the point

This process already existed and already failed. Somebody wrote the findings down and put
them in a spreadsheet; in the words of the meeting it was rebuilt from, that spreadsheet
"went off to die" — hundreds of opportunities, no owner, no clock, nothing closed.

So the capture surface is the easy half. Three things make this different from the
spreadsheet, and if any of them is ever removed the feature is back to being a spreadsheet:

| | What it does |
|---|---|
| **Assign it** | Every finding has an owner and a due date, exactly like a service ticket. The response window is **14 calendar days** — "it needs to be responded to within two weeks on what the solution is." |
| **Notice repeats** | `pp_themes` groups findings that are the same underlying issue, so "we have brought this up twelve times" becomes a number somebody can check. |
| **Feed it forward** | The pre-production checklist carries every still-open recurring issue into the next job's kickoff, generated rather than authored. |

## The three screens

### Walkaround — `/post-production/walk`

The phone surface. Type the four-digit **serial** — which is also the job number; they are the same number,
confirmed 2026-08-27 — then talk, photograph or film your way around the unit.

- **Voice.** Tap once, talk, tap again. `MediaRecorder` captures the audio; the Web Speech
  API transcribes **live** where the device supports it (Android Chrome, iOS Safari 14.5+),
  so words appear in the note as they are spoken. Dictated text is **appended** to whatever
  is already typed, never substituted for it.
- **Photo / video.** `capture="environment"` opens the rear camera on a phone and falls back
  to a file picker on a desktop. Photos are downscaled to 2000px before upload; video is
  capped at 135MB — roughly two minutes at 1080p — with a message that blames the recording
  quality rather than the length, because that is the setting the person can actually change.
  Anything large enough to be worth waiting for shows a **real progress bar** and, if the
  connection drops, a **one-tap retry** that keeps the note and re-sends only the file.
  🔴 **A retry is offered only when retrying could work.** An over-limit or wrong-type file is
  refused permanently, and pressing "try again" would re-run the same check, fail instantly and
  redraw an identical message — a button that works perfectly and does nothing, which nobody
  can tell apart from a broken one. Those get **"Choose a different clip"**, which reopens the
  camera. `uploadMedia` returns `permanent: true` for them; only a dropped connection or a 5xx
  gets a real retry.
- **Area and severity.** Nine areas, three severities. `Little thing` is load-bearing: most
  of what a walk produces is a small observation, and forcing every one to look like a defect
  is how the old spreadsheet reached hundreds of untriageable rows.

**Everything saves as it happens.** The walkaround row exists before the first photo and each
finding row exists before it has any words in it, so every action is a small write against
something already on the server. Shop wifi drops; a dropped connection costs the last action,
never the walk. Reopening the page picks up whatever the signed-in person left open.

**Handing over is a separate, deliberate act.** Until then the findings are drafts with no
dates and they nag nobody. Handing over is the moment the two-week clock starts on each one.

### Findings queue — `/post-production`

Where engineering works. Tabs are the four questions people actually ask: what is mine, what
is late, what does nobody own, what is waiting on me to accept. Read-only — every row links
to the finding, because a list that is also an editor is a list people change while reading
it, and this one carries dates other people are chased against.

`answered` is a separate state from `closed` **on purpose**. An engineer writing "we changed
the bracket" does not also get to decide the matter is settled; it goes back to whoever raised
it, who accepts or reopens. A queue whose owner is also its judge is a queue that empties
itself.

**Bulk select and delete work exactly like Tickets and RFQ**, because they are the same
components — `useBulkSelect` / `SelectBox` / `BulkBar` / `BulkDeleteButton` from
`components/admin/bulk-select.tsx`, over `POST /api/admin/bulk-delete` with the
`post_production` entity. A second implementation would drift; this one inherits every fix
the others have already had. The queue is paginated for the same reason.

Three constraints come with that kit and none is optional:

- ⛔ **`SelectBox`'s input is decorative, `pointer-events` off.** The boxes sit inside the
  row's `<a>`, so the wrapper must `preventDefault()` — which on a real checkbox also reverts
  the browser's own toggle, leaving a row selected in state and unticked on screen. Do not
  "simplify" it back into an interactive input. See `list-checkbox-in-row-link`.
- ⚠️ **Select-all is PAGE-scoped** via `togglePage()`. Computing it from the whole filtered
  set ticks the header, visibly checks the rows on screen, and silently adds every off-screen
  row to a selection that has Delete on it.
- **Delete is FULL-ADMIN only**, resolved server-side into `canDelete`. This page is gated on
  `engineering_jobs`, which engineering and production_manager hold; rendering Delete for
  them would offer a button that 403s. A finding is somebody's recorded criticism of a build
  with a clock on it — removing one is a narrower grant than working it.

**What a delete does and does not touch.** The finding row goes. The **walkaround survives**
even when its last finding is deleted: it records that a named person walked a named unit on
a date, which stays true, and `ON DELETE CASCADE` would take any sibling findings with it.
Storage objects are **left orphaned** rather than cascaded — invisible and harmless, and a
mis-click must not destroy the only recording of what somebody said at a unit. Every bulk
delete is audit-logged with the entity, the count and the number requested.

### Walks in progress — the band above the queue

_Added 2026-08-31, from live data rather than a hunch._

Two walkarounds were sitting in `walking` — Lee on unit 1234 for three days, Kacy Orr on 4454
for two — each holding a real finding, neither ever handed over. **Nothing anywhere said so.**

🔴 **That gap was the other half of "drafts nag nobody".** A draft deliberately raises no alarm:
it must not chase an engineer about something nobody submitted. But only that half was built,
so an unfinished walk was invisible to **everyone, including the person who left it**. Being
interrupted mid-walk on a shop floor is normal; silently losing the work afterwards is not.

So it is shown, and it still does not nag — **no email, no red, no nav badge**. A band above the
queue, where the people who run this look daily, with the age doing the talking.

- **Zero-finding walks are excluded.** A Start button pressed by somebody who then walked away
  has nothing in it to lose, and listing those would bury the ones that matter.
- **Amber only past a day.** A walk twenty minutes old is somebody standing at a unit *right
  now*; flagging that as stranded would be wrong and would teach people to ignore the band.
- **Oldest first** — the one most likely to be forgotten leads.

⚠️ **The band links into a walk that may not be yours.** That is deliberate — it is how stranded
work gets finished — but anything added there is filed under the **original walker's** name,
which is right for the observations they made and wrong to discover afterwards. So the walk
header now reads `WALKING · KACY ORR` rather than just the unit number.

**Chasing was considered and deliberately not built** (Jacob, 2026-08-31). Stale walks do not
email their owner. Revisit only if the band turns out not to be enough.

### Recurring issues — `/post-production/themes`

The board that makes "twelve times" sayable, and the pre-production checklist's source.

A theme is `open`, `resolved` (engineering changed something), or `accepted` (a known
trade-off nobody intends to change). The third one matters: without an honest "we are not
fixing this", people mark things resolved to clear the board.

⚠️ **A resolved theme reopens itself when a new finding lands on it.** A fix that did not take
must not stay green because of a decision made before the recurrence.

#### Deleting a recurring issue — what survives

Both this board and the pre-production list carry the same bulk select + Delete as the findings
queue (full-admin only, `pp_theme` and `pp_preflight` entities).

🔴 **`pp_preflight_items.theme_id` is ON DELETE CASCADE, and the route deliberately does NOT let
it fire.** Without intervention, tidying a theme off this board would silently delete its line
from every pre-production check it had ever been carried into — erasing the record of a
conversation a room actually had. The route nulls `theme_id` on those items **before** deleting
the theme.

`pp_preflight_items.title` is a NOT NULL snapshot of the theme name taken when the check was
held. That is exactly what makes detaching possible, and it is why the snapshot exists: the line
survives, still readable, with its verdict and note, just unlinked.

`pp_findings.theme_id` is already ON DELETE SET NULL, so findings survive and become ungrouped.
**Deleting a grouping must never delete the observations inside it.**

Deleting a **preflight** DOES cascade its items — a check and its lines are one record of one
meeting.

**Verified live 2026-08-31** through the real UI: after deleting a theme that had both a finding
and a completed pre-production line, the finding survived with `theme_id` null, and the
preflight line survived with `theme_id` null and its title, verdict (`addressed`) and note
(`agreed at kickoff`) intact. Deleting the preflight afterwards removed its items. Both
audit-logged.

### Pre-production check — `/post-production/preflight`

Open a check against a job number and its lines are **generated** from every recurring issue
that is still open, has genuinely happened more than once, and has been seen in the last 60
days. Nobody has to remember to add anything, and nobody gets to quietly leave the awkward one
off. Each line gets a verdict — designed around / doesn't apply / **known risk** — and the
accepted risks land in the audit log, because "we knew about this one and built it anyway" is
the sentence a warranty conversation two years from now turns on.

An empty checklist is a **result**, not an error. It is the stated goal: post-production
meetings with nothing much to share.

## Shop-floor tags — walking a unit with no login

_Migration `099_post_production_tags.sql`._

The meeting was about **four perspectives** on a built unit: the engineer, the person who
built it, the electrician who wired it, the person who tested it. Three of those four have
no portal account and are not getting one — so the unit gets a QR sticker.

Manage them at **`/admin/engineering/post-production/tags`**. Two kinds, and the difference
is the point:

| | |
|---|---|
| **Unit tag** — carries a serial | Printed with the job and stuck to that machine. Scan it and you are already walking that unit. **No typing**, which on a shop floor is the difference between a walk happening and not happening. |
| **Standing tag** — no serial | Printed once, taped to the test-bay wall. The scanner types the four digits. Outlives every unit. |

Scanning opens `/walk/<token>`: who are you, how did you work on this unit, then the *same
capture screen* the signed-in walk uses. Both render
`components/post-production/FindingCard`, so a fix to the recorder or the chips lands in
both at once.

### `walked_by_role` is the feature, not a form field

Without it, twelve findings on job 4153 are an undifferentiated list. With it they are a
build review — and *"the person who wired it and the person who tested it both flagged the
same access panel"* becomes a sentence the data can support.

### A tag walk is not second-class

Findings from a sticker go into the same queue, with the same two-week clock and the same
recurrence matching. Routing them into a lesser queue would reproduce the problem the
feature exists to solve. What differs is **provenance**, carried on the row and shown on
every screen: `source='tag'`, `walked_by` NULL, and the name **self-declared**. The queue
marks those rows and the detail page says *"From a shop tag — name self-declared, not
signed in"* in words.

### 🔴 Security posture

**The token is the credential**, exactly as `/board/<token>` (055) already establishes.
43 URL-safe characters, 244 bits, minted by a database column default — never by a route,
which cannot then forget to set one or mint a weak one.

Every rule below is load-bearing, and `lib/pp-tag.ts` is the one place they live:

- **RLS on, no policies.** "Public page" must not become "public table". An anon SELECT
  policy on `pp_tags` would let one `GET /rest/v1/pp_tags` with the publishable key dump
  every row **including every token** — a single request enumerating every sticker.
- **Same 404 for an unknown token and a retired one.** Never confirm which tokens are real.
- **Ownership is re-proved on every write.** `walkForTag()` / `findingForTag()` verify the
  row belongs to *this* tag and is still open. Without them the token would be a
  **universal write key** — the test-bay sticker could edit any walk in the building.
- **The write whitelist is much shorter than the admin route's.** A scanner may write what
  they saw. They may **not** set an assignee, a due date, a status, a resolution or a
  theme. A sticker on a machine must never be able to close its own finding.
- **Upload URLs are not general-purpose.** No signed URL is minted unless the caller names
  a finding that hangs off a walkaround belonging to this tag. Server-generated path,
  extension allowlist, and the same `MAX_UPLOAD_BYTES` ceiling the admin route uses.
- **Media reads are ownership-checked, not shape-checked.** Unlike the admin media route
  (where every viewer may see every object, so bucket membership *is* the authorization),
  this one proves the object is attached to a finding on one of this tag's walkarounds.
- **Rate limits are a backstop, not the control** — `lib/rate-limit` fails open by design.
  Generous, because the whole shop shares one NAT IP. The hard ceilings in `lib/pp-tag.ts`
  (40 findings per walk, 12 attachments per finding) hold even when the limiter is down.
- **Retire or rotate.** Rotating issues a new token and kills every printed QR for that tag
  instantly — that is what it is for, and why it is its own explicit flag rather than
  something a rename could do by accident. Both are audit-logged.

⚠️ **`/walk` is deliberately absent from middleware's matcher**, which is an allowlist.
Adding it would gate the page and silently break every printed sticker in the shop.

⚠️ **The roster is `production_people`, never `employees`.** Migration 055 created that
table for exactly this reason: `employees` is portal accounts, and every **customer invite**
adds a row to it. Listing it here would put customer names on a sticker-gated page.

### Verified

37 assertions against a locally-served production build and the live database, all passing:
token shape; the anon key cannot read `pp_tags` or `pp_walkarounds`; unknown and malformed
tokens refused; missing name/perspective refused; an invented perspective refused; a unit
tag ignores a posted job number in favour of its own; **tag B cannot add to, edit, delete or
hand over tag A's walk**; no upload URL without an owned finding, or for another tag's
finding; an SVG cannot be uploaded as a photo; an over-limit clip refused; paths are
server-generated; an unowned media path 404s; status / assignee / due date / resolution /
theme are all un-writable from a tag while the note itself writes; a retired tag is refused
with the same message as an unknown one.

The page was also loaded with **no session at all** — it renders, does not redirect, and a
bad token 404s.

## 🔴 How the counting works, and why it is split

**Postgres retrieves. Claude judges. A person confirms. Numbers are SQL.**

1. `match_pp_findings()` (098) shortlists prior findings by IDF-weighted keyword overlap —
   the same shape as `match_kb_chunks` in 030, and for the same reason: requiring every term
   matches nothing, while any-term lets "the" and "unit" drag in the whole table.
2. Claude reads that shortlist and says whether any of them is the same underlying issue.
   That is the part that genuinely needs judgement: *"big gap between the filter and the
   wheel"* and *"the wheel could have come further down"* are the same finding written by two
   people and share almost no words.
3. The answer is stored as a **suggestion** (`theme_source = 'ai'`) and displayed as one.
4. **Every count on the themes board is `COUNT(*)` over links a person confirmed.**
   Un-reviewed matches are carried alongside as "N to review" and are never added in.

If those were summed, the first time an engineer opened a theme and found two unrelated
findings in it, the number would stop being believed — and it would deserve to. The model is
never asked how many times something has happened; it cannot count rows it was not shown, and
it would produce a confident number anyway.

There is also **no count column**. Every figure is live.

Matching never blocks a save. If Claude is slow, down, or answers with something unparseable,
the findings are simply un-grouped and a person can link them by hand.

## ⚠️ Transcription is not configured

As of 2026-08-27 the portal has **one AI key** (`ANTHROPIC_API_KEY`) and the Claude API does
not accept audio. `/api/admin/post-production/transcribe` therefore returns **501 with a
sentence a person can read**, and the walkaround page checks the same thing server-side so it
never offers a button that cannot work.

What produces text today is live browser dictation and the phone keyboard's own microphone
key. **The audio file is kept regardless**, and that is the durable record — a transcript is a
machine's guess at what somebody said next to a running unit, and it gets things wrong
fluently enough that nobody notices reading it back. An engineer who disagrees with a finding
can play the recording. The detail page labels a dictated note as dictated for exactly this
reason. **Never drop the audio once text exists.**

⚠️ **BUILT BUT DORMANT — no speech-to-text provider is connected, so none of this is
live.** The control is wired end to end and waiting on one environment variable.

**Where it is:** the finding detail page, under each voice note. With no provider configured
it renders **nothing** — no greyed-out button and no upgrade nag on a page engineers open
daily. Add a key and it appears on its own, including for recordings captured long before.

**What it does:** transcribes that one recording and stores the text **on the media entry**,
beside the audio — never silently into the note. Merging it into the note is a separate,
deliberate click that stamps `note_source = 'transcribed'`. The note is what the walker said;
a transcript is a machine's second opinion on the same audio, and anyone weighing a finding
has to be able to tell which one they are reading.

**The route persists the result itself**, in the same request that spends the money. If it
only returned text and left the client to save it, a dropped connection would mean paying
for a transcript and losing it — and the obvious fix (retry) pays again. On the one path it
cannot fix (transcribed, save failed) it hands the text back with `saved: false` and the UI
says so rather than pretending.

**Verified 2026-08-28, both directions:** with no key the server renders
`transcriptionConfigured: false` and the control is absent; with a key present it renders
`true`. That flag is computed server-side by `isTranscriptionConfigured()` and is the single
switch the whole feature hangs on. **Clicking the button end to end is NOT verified** — that
needs a real key, an authenticated session and a real recording, and is the first thing to
check on the day a provider is added.

To make the endpoint functional, set **one** of these in Vercel:

| Variable | Service | Model the code asks for |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | `whisper-1` |
| `DEEPGRAM_API_KEY` | Deepgram | `nova-3` |

⚠️ **Check the vendor's current pricing yourself.** An earlier draft of this file printed
"~$0.006 / minute" for Whisper. That figure was recalled, not looked up, and it is the kind
of number that gets quoted in a budget conversation — so it is removed rather than left
sitting there looking authoritative. Both are billed per minute of audio and a walkaround
voice note is seconds to a couple of minutes, so the order of magnitude is small either way.

`lib/transcribe.ts` picks whichever exists, downloads the object with the service role and
forwards it. It takes a storage **path**, never bytes — a Vercel function caps its request
body at ~4.5MB and that cap is enforced before route code runs.

## Access

**No new permission.** `/admin/engineering/post-production` sits under the `/admin/engineering`
prefix, so `ADMIN_PATH_PERMS` already maps it to **`engineering_jobs`** — held by `engineering`
and `production_manager`. Every page re-checks the perm itself; an unmapped `/admin/*` path
falls back to `dashboard`, which every scoped role holds, so the second check is what makes a
future matcher edit fail closed rather than putting photographs of customers' units in front
of HR and marketing.

Asserted against the compiled `lib/roles.ts` on 2026-08-27: all six post-production paths
resolve to `engineering_jobs`, and only `admin`, `engineering` and `production_manager` pass.

Widening it to the shop floor — the electrician and the tester, the other two perspectives the
meeting was originally about — would need either the perm granted per person from
`/admin/permissions`, or a token-based no-login capture page in the shape of `/board/<token>`.
That was scoped and deferred.

## A "dead" button is usually one of three things

All three were reported together from a phone on 2026-09-01, and only two were real. Worth
separating, because the diagnosis differs:

1. **It genuinely does nothing.** "Walk another unit" called `router.push()` with the URL the
   page was already on. Next treats that as a no-op, so the component never remounted and the
   handed-over screen stayed up. ⚠️ **A same-route push is not a reset.** Where a screen's state
   lives in the client (here `handover`, inside `Walking`), returning to the start means
   *clearing that state* — the discard path already did exactly this, and the fix was to reuse
   its shape rather than invent one.
2. **It works and accomplishes nothing.** "Try that clip again" on a 184MB video re-ran a
   client-side size check that cannot pass. Instant, identical message, no visible change.
   **Never offer an action whose only possible outcome is the error already on screen.**
3. **It works and you cannot tell yet.** "See them in the queue" was fine — the queue is
   force-dynamic and simply slow to answer on shop wifi. Sitting directly beneath a genuinely
   dead button, it inherited the verdict. It now shows "Opening the queue…" on press.

🔎 **The method mattered more than any of the fixes.** The first guess — an invisible overlay
swallowing taps, which `bg-ink/40` on a semantic token could plausibly have caused
(see the token-opacity note) — was wrong. `document.elementFromPoint()` at each button's own
centre returned the button itself, `pointer-events` was `auto`, nothing was disabled, and the
console was clean. Only then did clicking it in a real browser reproduce the failure in one
press. **Reproduce before theorising**; the phone was never the variable.

## Storage

Private bucket `post-production`, **135MB** per object.

**Three limits sit in a line, and the smallest wins.** `MAX_UPLOAD_BYTES` in
`lib/post-production.ts` (135MB), the bucket's own `file_size_limit` (135MB), and the
*project's* global upload limit (150MB). The global was 50MB on the Free plan and was the
real ceiling until 2026-08-31 — raising the bucket alone would have done nothing visible, and
phone videos would have failed at the network layer with no useful message. Raise the global
first, then the bucket, then the constant. Lower them in the opposite order.

⚠️ **Resumable (TUS) uploads are not usable here, and this was settled by probing the live
project, not by reading the docs.** The resumable endpoint refuses the signed-upload token
with *"new row violates row-level security policy"*; service-role returns 201, the anon key
403s, and the signed token 403s too. There is no signed-URL equivalent for resumable. Making
it work would mean either granting the anon key — which ships in every browser bundle — write
access to this bucket, or proxying every chunk through our own routes and back into the ~4.5MB
function body cap. **A progress bar and a retry button buy nearly all of the benefit for none
of that**, so that is what shipped: `components/post-production/upload.ts` uses `XMLHttpRequest`
rather than `fetch` for exactly one reason — `fetch` cannot report upload progress and
`xhr.upload.onprogress` can. At 50MB that was a nicety; at 135MB, a silent two-minute wait on
shop wifi is indistinguishable from a hang, and people reload and lose the walk.

### Every bucket now carries an explicit limit

Nothing inherits the global any more. Raising it to 150MB for the walkaround videos had
silently raised the ceiling on **every** bucket that had no setting of its own — including the
one the public support forms write to.

| Bucket | Public | Limit | Why |
|---|---|---|---|
| `post-production` | no | 135MB | two minutes of 1080p from a phone |
| `kb-uploads` | no | 50MB | matches `KB_MAX_UPLOAD_BYTES` |
| `ticket-attachments` | no | 25MB | matches the cap the attachments route already applied |
| `ticket-photos` | **yes** | **20MB** | see below |
| `soo-submittals` | no | 25MB | |
| `admin-submittals`, `proposal-docs` | no | 20MB | |
| `crib-photos`, `form-uploads`, `render-assets` | mixed | 10MB | |
| `rfq-pdfs` | no | 5MB | generated server-side |
| `presentation-assets` | yes | 5MB | |

🔴 **`ticket-photos` is the one that matters.** It is public *and* anonymously writable,
because the support form and the troubleshooting checklist are **open links with no login** —
unlike the admin portal, which is behind an MFA sign-in. It is therefore the widest-open write
surface the portal has, and it is held tighter than the engineer-facing buckets on that basis
alone, not because the files are different.

Two things make the number load-bearing rather than decorative:

- **The browser does not shrink what it uploads.** `fileToResizedDataUrl` in
  `EquipmentTicketForm` resizes a *copy* to feed the nameplate OCR scan; the file that reaches
  storage is the original off the phone. (The post-production path *does* downscale — that is
  `resizeImage` in `components/post-production/upload.ts`, a different code path.)
- **Until 2026-08-31 there was no server-side size check on it at all** beyond the project
  global. Three of its four writers had no client-side check either.

`lib/photo-limits.ts` is now the single definition, imported by all four writers (both
customer forms, the admin equipment gallery, and — already self-limiting at 10MB — the support
reference manager). It screens at **pick** time so an oversize file is named while the person
is still looking at the file picker. The bucket limit is the one that actually binds; the
browser check exists so the customer gets *"IMG_0042.heic is over 20MB"* instead of a generic
upload failure they can only respond to by retrying the same file forever. If the two drift,
the bucket wins and the message goes generic — so raise the bucket first.

Uploads go **directly** from the browser with a service-role-minted signed URL; reads go
through `/api/admin/post-production/media`, which 307s to a five-minute signed URL so an
`<img>`, a `<video>` and an `<audio>` all just work. That read route is gated on
`engineering_jobs` — deliberately tighter than the tool-crib equivalent, because these are
photographs of a customer's unit and recordings of people criticising each other's work.

## Reminders

The morning sweep runs inside the **existing** `/api/cron/eng-reminders` entry (07:00 and
08:00 UTC — 3am Eastern on both sides of the DST line) rather than registering its own.

That is an operational choice, not laziness: **a deploy landing on a cron minute eats that
run** — ten deploys across one Friday evening killed four — so every extra entry is another
minute a routine push can silently swallow. The two sweeps are run and caught separately, so a
failure in one still lets the other send.

Two passes, mirroring `lib/eng-reminders.ts`: nudge each owner once for everything of theirs
due within three days or already past, then roll up to the leads what is late, what nobody
owns, and what keeps recurring.

⚠️ **`nudged_at` is a claim that a send did not throw.** It is not evidence anybody was told.
A Resend "delivered" is not an inbox either — two filters sit between here and one, and the
way to check is an Exchange Message Trace.

⚠️ **Finding text never goes in an email body.** An Exchange transport rule quarantines any
external mail containing "act now", "limited time", "special offer" or "buy now", and SCL -1
does not protect against it. These messages would otherwise carry arbitrary dictated speech
straight into a word-match filter. The mail carries the job number, the area, the count and a
link; the words live on the page.

## Schema

| Table | What it is |
|---|---|
| `pp_walkarounds` | One person's lap of one unit. Not unique per job — two people walking the same unit make two walks, and neither overwrites the other. |
| `pp_findings` | The accountable unit. Everything else exists to make these get answered. Carries `job_number` denormalised so the queue, the themes board and the sweep can read one without a join. |
| `pp_themes` | The recurring issue behind N findings. **No count column.** |
| `pp_preflights` / `pp_preflight_items` | One pre-production meeting; one line per theme carried in. Item titles are **snapshots** — re-titling a theme later must not rewrite what the room agreed to. |

`job_id` is nullable throughout. The job number is what everyone says out loud and what gets
typed at the unit; if a matching `eng_jobs` row exists the walk links to it and inherits the
customer and model, and if it does not, the walk still happens. A capture surface that can
refuse to capture is a capture surface people stop opening. The nameplate serial is a separate,
optional field for the same reason — "sometimes it might not be on there yet."

🔴 **`pp_findings` has THREE foreign keys to `employees`** (`assignee_id`, `resolved_by`,
`created_by`), so every embed must name its key. A bare `employees(name)` returns **PGRST201
and zero rows for the whole request** — not a warning, not a partial result. It compiles,
`next build` passes, and nothing catches it, because these pages are force-dynamic and no
query runs at build time. Verified live on 2026-08-27: the named embed returns 200, the bare
one returns 300/PGRST201.

## What was verified, and what was not

Verified on 2026-08-27, against the live database:

- All five tables, the RPC and the bucket exist. The bucket's limit read back as 52428800 on
  that date; it is **141557760 (135MB)** since 2026-08-31.
- 17 assertions over seeded rows: the joined walker/customer/assignee names flatten correctly,
  `media` round-trips with its `duration_ms`, `match_pp_findings` shortlists a **paraphrase**
  that shares almost no wording, confirmed and suggested counts stay separate, three runs of
  the checklist generator produce one item, the CHECK constraints reject invented values, and
  findings cascade with their walkaround. All seed rows removed afterwards; the tables are empty.
- The permission matrix, asserted against compiled `lib/roles.ts`.
- No service-role key and no `supabase-admin` reference in any of the 472 client chunks, with
  a positive control proving the scan can see a key.

Verified on 2026-09-01, against live Storage:

- Every bucket reads back an explicit `file_size_limit`; none inherits the global.
- An **anonymous** upload to `ticket-photos` — apikey plus anon bearer, exactly as the support
  form sends it — is accepted at 4MB and refused at 30MB with `413 EntityTooLarge`. The probe
  objects were deleted afterwards. ⚠️ An earlier run of this probe omitted the `Authorization`
  header, so *both* sizes failed identically with a 400 and the result proved nothing; the
  header is what makes it a real test of the size rule rather than of the auth rule.
- `screenPhotos` against real `File` objects: 4MB accepted, exactly 20MB accepted (the boundary
  is `>`, not `>=`), one byte over rejected by name, a 60MB `.mov` rejected as not-an-image
  before size is considered, and a mixed pick keeping the good files while naming only the bad
  one. Plus an assertion that the client constant equals the bucket's limit, so the two cannot
  drift silently.

**Not verified:** nobody has driven the walkaround in a real browser, because signing in is not
something this build process does. The camera, the microphone, live dictation, the upload path
and the recorder's browser-specific behaviour are all **unclicked**. The first walk on a real
phone is the test that matters.

`eng_jobs` is currently **empty**, so the unit picker offers no suggestions yet — typing a job
number always works, and suggestions appear as jobs are entered in the Engineering section.
