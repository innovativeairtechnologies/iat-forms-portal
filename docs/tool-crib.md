# Tool Crib — barcode tool check-out / check-in

Warehouse tools are shared, they walk off, and nobody knows who took what. Tool
Crib gives every tool a QR label and a permanent custody record: **who has it
right now**, and **who had it before**.

Built 2026-07-16, migration `050_tool_crib.sql` (applied). Live in the admin
**Operations** nav (between Equipment and SRV Form). Tool **photos** and
**photograph-the-label auto-fill** added 2026-07-17.

> **Not to be confused with "Internal Apps"** (`/admin/tools`, `/tools/*`, the
> `tools` perm, `lib/tools.ts`). That's the internal-app launcher — burner
> selection guide, duct traverse, calculators. It was renamed from "Tools & Apps"
> to **Internal Apps** on 2026-07-20 specifically to end this same-word confusion;
> the route and `tools` perm are unchanged. Tool Crib is `tool_crib` and `crib_*`.

---

## How it works on the floor

**No barcodes were purchased.** The portal prints its own QR labels
(`qrcode.react`, already a dependency). The code is minted by the database when
the tool is added, so there's no "assign a barcode" step.

There are **two scan paths**, and both ship.

### Path A — the phone's own Camera app (the reliable floor)

The label encodes `https://<portal>/t/IAT-0042`. The employee points their
built-in Camera at it, taps the notification, lands on the tool page already
signed in via the session cookie, and taps one big button.

**No scanner library is involved anywhere in this path.** That's the point: if
the decoder breaks, or iOS changes the camera rules again, this still works.

### Path B — the in-app continuous scanner (`/tool-crib/scan`)

Camera stays on for taking several tools at once. Purely additive — if it fails,
Path A is untouched.

### Typed codes

Both pages accept a typed code, for a scratched or oil-caked label. That same
focused input is also why a $30 USB wedge scanner would work at a kiosk later
with **zero code changes** — it just types the code and hits Enter.

`normalizeTagCode` accepts `IAT-0042`, `iat 42`, bare `42`, or a whole scanned
URL.

---

## Identity — why "who took it" is trustworthy

The **logged-in Supabase session is the identity**. The actor is resolved
server-side in `requireCribActor()` from the session cookie and is **never** read
from the request body. A client cannot claim to be someone else.

Any signed-in staff member can scan, including the base `production` role who
hold no admin perms at all — the person grabbing the drill is the person
scanning it. The `tool_crib` perm gates only the admin registry.

---

## Photos (added 2026-07-17)

Each tool carries up to **4 photos**. The first is the thumbnail in the list
(`IdentityCell`'s `leading` slot → `components/admin/ToolThumb.tsx`), an enlarged
hero on the detail page, and the profile image on the phone scan page. No photo →
a wrench-chip fallback.

Stored as storage **paths** in the private `crib-photos` bucket (migration 050),
in `crib_tools.photo_urls text[]`. Because the bucket is private, an `<img src>`
can't hit it directly — it points at **`GET /api/tool-crib/photo?path=…`**, which
gates the viewer (any authenticated non-customer, so the employee scan page works)
and **307-redirects to a short-lived signed URL**. Same trick as the ticket
attachment download route. The path is shape-validated
(`^\d{10,}-[a-z0-9]+\.(png|jpe?g|webp|gif)$`) so it can't escape the bucket; no
per-image DB lookup (the list renders many thumbnails — a query each would be
waste, and every object in the bucket is a tool photo every staff viewer may see).

Uploads: the browser resizes the photo (`lib/image-resize.ts`, ≤1600px) then
uploads **direct to Storage** via a signed upload URL from
`POST /api/admin/tool-crib/photo-url` — the bytes never transit the function
(Vercel's ~4.5MB body cap).

`components/admin/ToolPhotos.tsx` is the add/remove editor and is a **controlled**
component — it renders straight off its `paths` prop and keeps no once-seeded copy.
That's load-bearing: an earlier uncontrolled version drifted from the parent, so a
save that failed (and reverted the parent) left the grid showing the un-saved
state and the next save silently committed it. The detail page rolls back
`photos` on a PATCH failure, and because the editor is controlled, the revert
flows back into the grid.

## Photograph-the-label auto-fill (added 2026-07-17)

"Scan the tool's label" in the Add Tool modal photographs the nameplate and
prefills name / make / model / serial + a category snapped onto the fixed list.
`POST /api/admin/tool-crib/scan-nameplate` — admin-gated, cloned from the
equipment nameplate scanner (`/api/ocr-label`): the client resizes the photo to a
base64 data URL, Claude vision (`claude-haiku-4-5`) reads it, and we prompt-and-
parse a flat JSON object (the house pattern — no tool-use).

**Prefill-then-edit, never blocks.** It only fills fields the scan actually
returned (`scanned || prev`), so a blank read can't wipe a typed value, and
everything stays editable. A category the model returns that isn't on
`CRIB_CATEGORIES` is dropped rather than shoved into the `<select>`. The extracted
strings flow into the same create POST that validates everything else.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/t/<code>` | any staff | The **only** URL a label encodes. Redirect stub → `/tool-crib/<code>` |
| `/tool-crib` | any staff | "My checked-out tools" + typed-code field |
| `/tool-crib/<code>` | any staff | Path A target — one big Check Out / Check In button |
| `/tool-crib/scan` | any staff | Path B continuous scanner |
| `/admin/tool-crib` | `tool_crib` | Registry, $-on-floor / $-missing tiles. In the **Operations** nav group. |
| `/admin/tool-crib/<id>` | `tool_crib` | Detail, history timeline, force return, transfer |
| `/admin/tool-crib/labels` | `tool_crib` | Avery 5520 print sheet |

**The scan surface is top-level, NOT under `/employee/*`.** `middleware.ts`'s
`/employee` block bounces every admin-surface role to `/admin` — which includes
`production_manager`, the person who runs the crib. It would have failed as a
silent redirect, not an error.

### Why `/t/<code>` and not `/tool-crib/<code>`

A label is glued to a drill and can never be reprinted. `/t/` is a semantically
empty stub with nothing to outgrow — rename "Tool Crib" or move the routes in
2027 and only the redirect target changes. Every sticker keeps working.

---

## Data model

`crib_tools` — one row per physical tool, keyed by `tag_code` (`IAT-0042`, minted
by the `crib_tag_seq` sequence — the DB mints it so two concurrent creates can't
race into the same code).

`crib_events` — append-only custody history. Never updated, never deleted.

### The custody invariant — read this before touching the code

Current custody is **denormalized** onto `crib_tools` (`status`, `held_by`,
`held_since`). `crib_events` is the log. **The row is a cache of the log.**

Denormalized because "who has it right now" renders on every list row — deriving
it from the latest event means a lateral join per row over a table that only
grows, and there'd be nothing to lock against a double-scan.

The duty this buys:

> **Every custody write goes through the `crib_*` SQL functions**, which update
> the row and append the event in the same transaction. **No route may write
> `crib_tools.status` or `held_by` directly.** The `PATCH` route refuses to; so
> should anything you add.

### Name snapshots

`crib_events.actor_name` / `subject_name` are copies taken at write time. They
look redundant next to `actor_id` — they aren't. The FKs are `ON DELETE SET
NULL`, and `/admin/reset` hard-deletes accounts. Without the snapshots, deleting
an account would erase the record of who took what, which is the one question
this feature exists to answer.

### Assigning tools (admin, migration `064`)

Not everyone scans. When someone just *takes* tools and keeps them, the crib
shows those tools "available" when they aren't — so an admin needs to assign them
to that person. **Assign is the missing sibling of transfer:** transfer moves an
*already-checked-out* tool between people; assign issues an **available** tool to
someone on their behalf (and can reassign a checked-out one).

Two SQL functions (migration `064`, same SECURITY INVOKER + revoke/grant posture
as the rest):
- `crib_assign(tag, actor, to, reason?)` — one tool. Locked read + single
  transaction, refuses maintenance/lost/retired, logs an `'assign'` event with
  actor = the admin and subject = the assignee. Reason optional (it's an
  issuance, not an override of someone's custody).
- `crib_assign_all(actor, to, reason?, include_held)` — assigns every available
  tool to one person in a single transaction; `include_held` (opt-in) also sweeps
  up tools currently checked out to *others*. Its `WHERE` pre-filters exactly the
  rows `crib_assign` accepts, so no loop iteration can raise and abort the batch.

UI: a **"Assign tools"** button on the registry (bulk, with the count preview and
the include-held toggle → `POST /api/admin/tool-crib/assign-bulk`), and a per-tool
**"Assign to…"** on the detail page shown **only when the tool is available**
(checked-out tools use Transfer). Both are `tool_crib`-gated (admin +
production_manager); the recipient is validated active + non-customer server-side;
the actor comes from the session, never the body.

### Double-scan concurrency

Two people scan the same drill at the same instant. The guard is a conditional
UPDATE inside the SQL function:

```sql
UPDATE crib_tools SET status='checked_out', held_by=p_actor
 WHERE tag_code = p_tag AND status = 'available'
```

The predicate takes the row lock. Under `READ COMMITTED` the second UPDATE blocks,
re-evaluates against the newly committed row, matches **zero** rows, and raises
`TOOL_NOT_AVAILABLE`. Exactly one scan wins, enforced by the storage engine — not
by the UI.

`crib_force_check_in`, `crib_transfer` and `crib_set_status` use `SELECT … FOR
UPDATE` before reading `held_by`, so a concurrent scan can't cause the *wrong
person* to be written into permanent history.

### Security posture

RLS on, **no policies** — service-role only, same as `equipment` (016).

The SQL functions are **`SECURITY INVOKER`** (the default) with `EXECUTE` revoked
from `public`/`anon`/`authenticated` and granted explicitly to `service_role`.

> **Never make them `SECURITY DEFINER`.** Postgres grants EXECUTE to PUBLIC on
> new functions and PostgREST exposes public-schema functions as browser-callable
> RPCs — a definer function would let any signed-in user move custody straight
> from the browser, bypassing the API guards *and* the RLS posture.

The explicit `GRANT … TO service_role` is the counterweight to the revokes: EXECUTE
is normally held *via* PUBLIC, so revoking PUBLIC could otherwise strip the one
role the entire feature runs as.

---

## Labels

**Avery 5520** — weatherproof laser, 1" × 2⅝", 30-up (the 5160 grid in poly
stock). Paper will not survive oil and abrasion.

Print at **100% scale** — "fit to page" shifts every label. Calibrate against one
real sheet before mass-printing: print onto plain paper and hold it over a label
sheet against a window.

**Layout (settled 2026-07-17, per Jacob — the QR is hugged on three sides):**
the **item code** (`IAT-0008`, bold mono) centered on top; the **QR** (58px /
~0.6") in the middle; the **descriptor** (`Meter kit`) running **top-to-bottom**
just off the QR's right edge; and **"Innovative Air Technologies"** along the
bottom, stretched to *exactly* the QR width via SVG `textLength` +
`lengthAdjust` so it sits flush and never overhangs. The whole block is centered
in the wide cell (the side whitespace is fine — nothing runs over an edge).

Mechanics worth knowing:
- The descriptor is **absolutely positioned** (`left: 100%` of the QR) so it
  doesn't widen the block — that's what keeps the code and company centered over
  the QR rather than over QR-plus-descriptor.
- Its height is pinned to the QR and it's `overflow: hidden`, so it physically
  can't run past the code. Belt: the input, the server, and the render all cap it
  at `CRIB_SHORT_LABEL_MAX` (14 chars — the most that fits vertically at a
  readable size). Change that one constant to retune all three.
- The QR shrank from 72→58px to make vertical room for the code above and company
  below within the 1" height. Still fine for a phone at close range.
- `box-sizing: border-box` keeps the cell padding inside the 2.625×1" track.

The descriptor comes from **`crib_tools.short_label`** (migration `057`) — a
hand-authored sticker name, distinct from `name` because `name` can be the full
manufacturer string ("Fluke 87V-MAX Digital Multimeter") too long for a 1" label.
Set it in Add Tool or on the tool's detail page ("Sticker label" card). Blank
falls back to `name`, sliced to `CRIB_SHORT_LABEL_MAX` so the fallback fits too.

> The `IAT-0042` code is **back on the label** (it was briefly removed earlier the
> same day), so the hand-readable fallback for a damaged QR is restored — see the
> damage-tolerance section.

### Damage tolerance — the corners are what matter

Measured 2026-07-16 by rendering the exact QR the sheet draws, rasterizing it at
real print size (0.85" @ 300dpi) and decoding it back with the same ZXing build
the scanner uses:

| Damage | Result |
|---|---|
| none | scans |
| **corner** (finder pattern), 1.4% of the label | **FAILS** |
| centre (data), up to ~7.5% | scans |
| centre (data), 12.5% | fails |
| bottom edge strip, 7.8% | **FAILS** (clips the bottom-left finder) |

So "level M tolerates ~15% damage" is misleading — that budget is for **data
modules only**. The three big corner squares are *finder patterns*: a scanner uses
them to locate the code at all, and **no** error-correction level protects them.
Bumping to Q or H would not change any row above.

Practical consequences:

- **Protect the corners, not the middle.** Place the label on a flat face, away
  from edges, grips and anything that rubs. A gouged corner is a dead label.
- **Laminate or use poly stock** — this is physical, not an encoding problem.
- **The printed `IAT-0042` code is on the label** (removed briefly, then restored
  2026-07-17 when the descriptor layout landed). When a corner goes and the QR is
  unrecoverable, the code is still readable by hand — type it into the app
  (`normalizeTagCode` even accepts a bare `42`).

### `NEXT_PUBLIC_LABEL_ORIGIN` — what gets baked into every sticker

Label printing is **hard-gated** on this var being an `https://` origin.

It is deliberately **not** `NEXT_PUBLIC_APP_URL`, which is `http://localhost:3000`
on a dev box. Printing from dev with the ambient var would glue localhost URLs to
real tools, and we'd find out when someone scanned one on the floor.

Because it's a separate var, the label origin is **decoupled from where you're
browsing**: a dev box with `NEXT_PUBLIC_LABEL_ORIGIN=https://iatportal.vercel.app`
prints labels that point at production. That's intentional and useful.

**Current value: `https://iatportal.vercel.app`** (decided 2026-07-16). The
`dehumidifiers.com` domain was bought on Namecheap but GoDaddy put the transfer on
a 60-day hold, so we're not waiting on it.

This is a **safer choice than it looks** — most likely these labels never need
reprinting:

- Vercel keeps serving `<project>.vercel.app` after you add a custom domain; it
  isn't retired.
- Even if the custom domain is later made primary and Vercel redirects the
  `.vercel.app` to it, that redirect **preserves the path** — so
  `iatportal.vercel.app/t/IAT-0042` still lands on the right tool. This is
  precisely what the `/t/` stub buys.
- Old and new labels can coexist. There's no flag day.

> ⚠️ **The Vercel project must not be renamed.** Verified 2026-07-16: the project
> is literally named **`iatportal`**, it has **no custom domain attached**, and all
> three of its hostnames are auto-generated (`iatportal.vercel.app`,
> `iatportal-iat-s-projects.vercel.app`, `iatportal-git-main-…`). So
> `iatportal.vercel.app` **is derived from the project name** — renaming the
> project to anything else silently kills every printed label, with no error and
> no warning, discovered only when someone scans one on the floor.
>
> This is now an operational constraint on the Vercel project, not a preference.
> (If a custom domain is later added and made primary, that's fine — the
> `.vercel.app` keeps resolving. It's the *rename* that's fatal.)

If you do move to a custom domain later and want new labels to carry it, just
change this var — mixed fleets are fine, both resolve.

---

## The scanner library

`barcode-detector` (Sec-ant), **ponyfill** subpath — not the polyfill, which
registers itself on `globalThis`.

Native `BarcodeDetector` on Android Chrome; ZXing-C++ WebAssembly on iOS, where
**no browser implements the Barcode Detection API** (they're all WebKit
underneath, so "use Chrome" is not a workaround).

### The wasm is self-hosted — keep it that way

`zxing-wasm` hardcodes a **jsDelivr CDN URL** as the default location for its
`.wasm` (grep `fastly.jsdelivr.net` in `node_modules/zxing-wasm/dist/es/share.js`).
Left alone, every scan in the warehouse would depend on a third-party CDN being
reachable from the shop floor — failing at the point of use, on a phone, mid-job.

`scripts/sync-zxing-wasm.mjs` copies the binary into `public/wasm/` and runs on
`prebuild`, so bumping `zxing-wasm` can't leave a stale binary behind (a wasm/JS
version mismatch fails at runtime, not build). The copy is committed so a skipped
postinstall can't ship a broken scanner. `lib/tool-crib-scanner.ts` points
`locateFile` at it.

The decoder is **lazily imported** — `/tool-crib/scan` is 4.17 kB / 110 kB first
load, so Path A never pays for it.

### iOS camera rules, all load-bearing

- HTTPS required. `localhost` counts; **`http://192.168.x.x` does not** — a LAN
  IP is not a secure context, so Path B can't be tested over plain LAN http.
  (Path A can — it's the native Camera app opening a URL.)
- `getUserMedia` **must** be called from a user gesture. Hence "Start camera" is
  a tap, never on mount. Failing this looks identical to a permission denial.
- `<video>` needs `playsinline` **and** `muted` or Safari refuses to play inline.
- Stop every track on unmount or the camera indicator stays lit.

---

## Adding a permission — the trap

**Editing `DEFAULT_ROLE_PERMS` in `lib/roles.ts` does nothing on its own.**

Once `role_permissions` has any rows, `getPermMatrix()` seeds every scoped role to
`[]` and fills from the DB, so `matrix[role]` is always non-nullish and
`hasPermission`'s `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never falls
through. The code list is only the fallback for an errored/empty table.

A new grant must **also** be inserted into `role_permissions` by a migration —
see the `INSERT` at the bottom of `050`.

Also required, or the page is silently unreachable:
- `ADMIN_PATH_PERMS` in `lib/roles.ts` — unmapped `/admin/*` paths fall back to
  `dashboard` (admin-only) and 302 scoped roles **with no error**.
- `NAV_PARENTS` in `components/admin/AdminSidebar.tsx`.

---

## Not in v1 (deliberate)

- **Due dates / overdue nudges.** `due_at` exists and is nullable; no UI, no
  cron, no email. v1 answers "who has it" — it does not prompt a return. Adding
  it later is a UI + cron change, no migration.
- **Consumables.** `kind` / `quantity` are reserved. v1 is unique-only: one label
  = one tool = one row.
