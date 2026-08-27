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

The phone surface. Type the four-digit job number, then talk, photograph or film your way
around the unit.

- **Voice.** Tap once, talk, tap again. `MediaRecorder` captures the audio; the Web Speech
  API transcribes **live** where the device supports it (Android Chrome, iOS Safari 14.5+),
  so words appear in the note as they are spoken. Dictated text is **appended** to whatever
  is already typed, never substituted for it.
- **Photo / video.** `capture="environment"` opens the rear camera on a phone and falls back
  to a file picker on a desktop. Photos are downscaled to 2000px before upload; video is
  capped at 50MB with a message that says what that is in seconds of footage, not in bytes.
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

### Recurring issues — `/post-production/themes`

The board that makes "twelve times" sayable, and the pre-production checklist's source.

A theme is `open`, `resolved` (engineering changed something), or `accepted` (a known
trade-off nobody intends to change). The third one matters: without an honest "we are not
fixing this", people mark things resolved to clear the board.

⚠️ **A resolved theme reopens itself when a new finding lands on it.** A fix that did not take
must not stay green because of a decision made before the recurrence.

### Pre-production check — `/post-production/preflight`

Open a check against a job number and its lines are **generated** from every recurring issue
that is still open, has genuinely happened more than once, and has been seen in the last 60
days. Nobody has to remember to add anything, and nobody gets to quietly leave the awkward one
off. Each line gets a verdict — designed around / doesn't apply / **known risk** — and the
accepted risks land in the audit log, because "we knew about this one and built it anyway" is
the sentence a warranty conversation two years from now turns on.

An empty checklist is a **result**, not an error. It is the stated goal: post-production
meetings with nothing much to share.

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

To turn server-side transcription on, set **one** of these in Vercel — nothing else changes:

| Variable | Service | Rough cost |
|---|---|---|
| `OPENAI_API_KEY` | Whisper (`whisper-1`) | ~$0.006 / minute |
| `DEEPGRAM_API_KEY` | Deepgram `nova-3` | comparable |

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

## Storage

Private bucket `post-production`, 50MB per object.

**50MB is not arbitrary.** Supabase's standard upload endpoint — the one `uploadToSignedUrl`
uses — is capped by the *project's* global upload limit, which is 50MB unless it has been
raised in the dashboard. Setting the bucket higher would silently do nothing and phone videos
would fail at the network layer with no useful message.

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

- All five tables, the RPC and the bucket exist; the bucket's limit reads back as 52428800.
- 17 assertions over seeded rows: the joined walker/customer/assignee names flatten correctly,
  `media` round-trips with its `duration_ms`, `match_pp_findings` shortlists a **paraphrase**
  that shares almost no wording, confirmed and suggested counts stay separate, three runs of
  the checklist generator produce one item, the CHECK constraints reject invented values, and
  findings cascade with their walkaround. All seed rows removed afterwards; the tables are empty.
- The permission matrix, asserted against compiled `lib/roles.ts`.
- No service-role key and no `supabase-admin` reference in any of the 472 client chunks, with
  a positive control proving the scan can see a key.

**Not verified:** nobody has driven the walkaround in a real browser, because signing in is not
something this build process does. The camera, the microphone, live dictation, the upload path
and the recorder's browser-specific behaviour are all **unclicked**. The first walk on a real
phone is the test that matters.

`eng_jobs` is currently **empty**, so the unit picker offers no suggestions yet — typing a job
number always works, and suggestions appear as jobs are entered in the Engineering section.
