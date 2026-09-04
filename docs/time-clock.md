# Time Clock

Hourly staff punch in from their phone at the shop. Migration `101_time_clock.sql`.

- **Employee screen** — `/admin/me/time-clock` (self-service, under `OPEN_ADMIN_PREFIXES`, no permission)
- **QR target** — `/clock`, a redirect that exists only to keep the printed code short
- **Admin screen** — `/admin/time-clock`, HR group, permission `time_clock`
- **Payroll export** — `/api/admin/time-clock/export?week=YYYY-MM-DD`

## 🔴 The job is not on the punch

The obvious model puts `job_number` on the shift. It is wrong, and it is wrong in a
way that only shows up after go-live: somebody who touches four jobs before lunch
gets all eight hours recorded against whichever job they happened to name at 6:58am.

Job time is a **segment** instead. Segments tile the shift:

```
clock in ─┬─ work (job 1001) ─┬─ lunch ─┬─ work (job 2002) ─┬─ work (no job) ─┬─ clock out
          └── one shift, start to finish ───────────────────────────────────────┘
```

"Switch job" closes the open segment and opens the next. **The clock keeps running** —
it is not a clock-out. Time nobody attributed is a segment with a null `job_number`,
reported as **Unallocated** rather than folded into the last job named, because an
unattributed hour is a question for a supervisor, not a rounding error.

Two database constraints hold the model up, and they are not decoration:

- `time_shifts_one_open_per_employee` — a partial unique index on `(employee_id) WHERE
  ended_at IS NULL`. A double tap on a slow connection, or a second phone, would
  otherwise open two shifts and double-count every hour after that. The route treats
  the resulting `23505` as success, because the person is clocked in, which is what
  they wanted.
- `time_segments_one_open_per_shift` — same idea, so "what am I working on" always has
  exactly one answer.

⚠️ **Totals come from segments, never from clock-out minus clock-in.** The two agree
only when segments tile the shift perfectly, and they will not when a shift is open or
was corrected by hand. Segments are the record of what was being done, so they pay.

## The geofence

`time_clock_settings` holds one row: a pin, a radius, a worst-acceptable fix, and an
enforcement flag. All admin-editable, so tightening it never needs a deploy.

**Where it is enforced, and where it deliberately is not:**

| Action | Fence |
|---|---|
| `clock_in` | **Enforced.** Refused off-site, and the refusal is recorded. |
| `clock_out` | **Recorded, not refused.** |
| lunch / break / switch job | Not checked at all. |

🔴 **Refusing an off-site clock-out is worse than allowing it.** It strands somebody in
an open shift they cannot close, which lands on an admin anyway *and* leaves a running
shift inflating the live board. The distance is stored and the admin board flags it —
supervision, not a lockout. Mid-shift buttons are unfenced because GPS drops behind
roll-up doors, and a Switch Job that fails inside a metal building would make people
stop using the feature that makes the reporting worth having.

**Accuracy is a gate, not a hint.** A fix worse than `max_accuracy_m` is refused: a 5km
accuracy circle "contains" the office from a sofa across town, so accepting it would
make the fence decorative. Within that limit the reported accuracy is *credited* — if
the circle they might be standing in touches the site, they are let in. Refusing
somebody standing at the door because their phone is unsure is how a time clock gets
abandoned.

⚠️ **This is a deterrent, not proof.** Browser geolocation can be spoofed by a
determined person and no client-side check can prevent that. It stops clocking in from
home, which was the actual problem. Nothing here decides the verdict client-side — the
browser reports coordinates and `checkFence()` runs on the server.

⚠️ **The seeded pin is a geocode, not a survey.** `33.6352081,-83.8343350` is
OpenStreetMap's street-address match for the address in `lib/company.ts`, captured
2026-09-04. It lands on the building; the 300m radius is deliberately generous because
phone GPS indoors and beside metal is poor. **Stand on the shop floor and press "Set
from where I'm standing"**, then the radius can come down.

🔎 **Refusals are recorded on purpose.** `time_clock_denials` exists so that a
badly-placed pin is *visible* instead of endured. People refused while standing at the
shop is the signal the fence is wrong — not that they were cheating.

## Reporting and payroll

`/admin/time-clock` shows who is on the clock now, the payroll week per person with a
proportional bar per job, off-site clock-outs, and the most recent refusals.

The CSV is **one row per employee per job per day** — the grain QuickBooks time entries
take. Anything coarser loses the day, and QuickBooks wants the day.

- ⚠️ **Decimal hours, never `hh:mm`.** QuickBooks reads `7.25`; a colon imports as
  something else.
- ⚠️ **Open shifts are excluded**, and the file says so in a header comment. A row
  reading 3.10 hours because somebody is still clocked in would be entered as a
  finished day.
- Job numbers are free text from outside this system, so the export neutralises leading
  `=` `+` `-` `@` (Excel formula injection) and never encodes the job into a composite
  key — any separator is a character some job number is eventually allowed to contain.

**Lunch is unpaid, breaks are paid.** Stated once as `PAID_KINDS` in `lib/time-clock.ts`
rather than assumed at four call sites, because it is the one rule payroll will argue
about and it has to be changeable in one place.

## Permissions

`time_clock` is **admin-only by omission** from the scoped-role defaults — the same
shape as `srv` and `reports` — so it needed no seed migration.

⚠️ Granting it to HR later needs a **migration INSERT** as well as a line in
`DEFAULT_ROLE_PERMS`: that map is dead once `role_permissions` has rows for a role.

⚠️ `/admin/time-clock` **must** stay in `ADMIN_PATH_PERMS`. An unmapped `/admin/*` path
falls back to `dashboard`, which five scoped roles hold — omitting it would have opened
everyone's hours to all of them rather than failing shut.

`/clock` is in the **middleware matcher**. That matcher is a prefix whitelist: an
unlisted top-level route is not session-checked at all.

## Not built yet

- **The scheduled payroll email.** The report and the one-click CSV are here; a cron
  that mails it on a set day is not. Deliberate: emailing payroll out of a clock whose
  fence has not yet been confirmed on the shop floor would be worse than not emailing.
  Confirm the pin, run a real week, then wire it.
- **Admin correction of punches.** `time_shifts` carries `edited_by` / `edit_note` for
  it, and the constraint model supports it, but there is no UI. Today a bad punch is
  fixed in the database.
- **PTO report integration.** Hours and PTO are still two separate pages.
