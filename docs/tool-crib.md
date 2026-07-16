# Tool Crib — barcode tool check-out / check-in

Warehouse tools are shared, they walk off, and nobody knows who took what. Tool
Crib gives every tool a QR label and a permanent custody record: **who has it
right now**, and **who had it before**.

Built 2026-07-16. Migration `050_tool_crib.sql`. Nav is `hidden: true` until the
crib is stocked — the routes are live by URL in the meantime.

> **Not to be confused with "Tools & Apps"** (`/admin/tools`, `/tools/*`, the
> `tools` perm, `lib/tools.ts`). That's the internal field-app launcher — duct
> traverse, calculators. Different feature, same word. Tool Crib is `tool_crib`
> and `crib_*`.

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

## Routes

| Route | Who | What |
|---|---|---|
| `/t/<code>` | any staff | The **only** URL a label encodes. Redirect stub → `/tool-crib/<code>` |
| `/tool-crib` | any staff | "My checked-out tools" + typed-code field |
| `/tool-crib/<code>` | any staff | Path A target — one big Check Out / Check In button |
| `/tool-crib/scan` | any staff | Path B continuous scanner |
| `/admin/tool-crib` | `tool_crib` | Registry, $-on-floor / $-missing tiles |
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
