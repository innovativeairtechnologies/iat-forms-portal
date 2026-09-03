# Compensation Review (`/admin/comp-review`)

The annual merit-increase sheet, ported from the **Sample Annual Review Spreadsheet**
workbook that previously ran the review off a desktop copy. Migration `078`.

**Read this before changing any formula.** Three of the workbook's behaviors look
like bugs and were deliberately kept — see [What we kept, and why](#what-we-kept-and-why).

---

## The model

One score per person drives everything:

```
score  →  relative score  →  raise figure  →  adjustment  →  applied %  →  new pay
```

| Step | Formula | Workbook cell |
|---|---|---|
| Relative score | `score ÷ average score` | `N` — `=F3/3.5` |
| Raise figure | `relative × raise_pool` | `O` — `=N3*4.1` |
| Adjustment | `relative × raise figure` | `G` — `=N3*O3` |
| Applied % | `adjustment ÷ divisor` | inside `H` — the `/48` |
| Hourly increase | `per_hour × applied%` | `H` — `=C3*(G3/48)` |
| New rate | `per_hour + increase` | `J` — `=C3+H3` |
| New annual | `new rate × hours × weeks` | `I` — `=J3*40*52` |

All of it lives in [`lib/comp-review.ts`](../lib/comp-review.ts), which is pure and
dependency-free so the server page, the API routes and the browser compute
identically. **Nothing computed is stored** — every output is a function of the
inputs plus the cycle constants, so changing the model is one edit there rather
than a backfill (the `rep_scorecards` precedent, migration 075).

Verified by `scripts/verify-comp-review.mjs`, which walks the chain by hand:

```bash
node --import ./scripts/ts-resolve.mjs scripts/verify-comp-review.mjs
```

### Worked example

An exactly-average performer on $25.00/hr, with the shipped constants:

```
relative   3.5 ÷ 3.5      = 1.000
raise      1.000 × 4.1    = 4.10
adjustment 1.000 × 4.10   = 4.10
applied    4.10 ÷ 48      = 8.54%
increase   $25.00 × 8.54% = $2.14
new rate   $25.00 + $2.14 = $27.14
new annual $27.14 × 40 × 52 = $56,442
```

---

## The one thing that changed

The workbook divided by a **hardcoded `3.5`** — its own column header reads
`% of Avg score ()`, with the parentheses left empty where the average was
meant to go — plus a one-row override at `N7` (`=F7/2.47`, Chris Hill).

Here the denominator is the **live mean of every score actually recorded in the
cycle**. Unscored people are excluded rather than counted as zero: "not reviewed
yet" and "scored nothing" are different facts, and averaging the former in would
drag the denominator down and inflate everyone else's raise.

Three consequences, all deliberate:

1. **Every row depends on every other row.** Scoring one person re-calculates
   everybody's raise and every total. The drawer surfaces this — it previews
   against the average the edit *would* produce and says when other people move.
2. **The model is scale-agnostic.** Because the denominator is the mean of the
   same column it divides, scores out of 5, 10 or 100 behave identically. That is
   why `score` has no upper bound in the schema.
3. **Finalizing freezes it.** `status='final'` snapshots the average onto
   `comp_cycles.avg_score_final`, so a signed-off year stops moving. A DB CHECK
   (`comp_cycles_final_has_avg`) makes it impossible to finalize without one, and
   the average is always computed server-side — never accepted from the client,
   which would let anyone re-price the year with a single number.

---

## What we kept, and why

Flagged during the port, reviewed by Jacob on 2026-08-05, and **kept so the
portal reproduces the numbers the spreadsheet produces today.** Do not "fix" these
without asking:

### 1. `H = C × (G ÷ 48)` — the divisor is 48, not 100

`G` is formatted `0.00` — a plain decimal, not a percent cell — so `G = 4.1` reads
as "4.1%" and would normally convert with `÷ 100`. At `÷ 48` every raise is
**~2.08× larger** than the pool figure implies: an average performer receives
**8.54%**, not 4.1%.

### 2. `G = N × O` applies the relative score twice

`O` is already `relative × pool` — a personalized raise percentage. Multiplying by
the relative score again squares it, widening the spread between scorers:

| Score (avg 3.5) | Squared (shipped) | Linear |
|---|---|---|
| 4.5 | 6.78 | 5.27 |
| 3.5 | 4.10 | 4.10 |
| 2.5 | 2.09 | 2.93 |

### 3. The pool is `4.1`, but the column header says `3.4%`

The workbook's `O` header reads `% of 3.4% Raise` over a `4.1` multiplier — the
WorldatWork figure cited in its footer. The benchmark rows it also cites average
**~3.46%**. Those sources are reproduced in the cycle-settings dialog so the
provenance travels with the tool.

All three are **cycle columns, not literals** (`raise_pool`, `divisor`,
`hours_per_week`, `weeks_per_year`), so revisiting any of them is a row update
rather than a deploy — and a past cycle always recomputes with *its own*
constants, so tuning next year never rewrites last year's record.

### Also fixed in passing

`I40 =SUM(I3:I17)` totalled **15 of the 34 people** on the sheet. Totals here span
every line. That was a broken range, not a model decision.

---

## Hourly and salaried

Both `per_hour` and `gross_annual` are optional — employees are one or the other.

- **Hourly** — the workbook chain verbatim. If no annual figure is on file, the
  current annual is derived as `rate × hours × weeks`.
- **Salaried** — `new annual = annual × (1 + applied%)`. Not a workbook formula
  (the sheet has no salaried path; its whole chain hangs off an hourly rate), but
  algebraically the same operation, so a salaried and an hourly employee with the
  same score receive the same percentage. Hourly fields stay blank so the list
  shows honestly who is paid which way.
- **Neither** — the review still stands; there is just nothing to apply it to.
  These are counted in the score average and surfaced in the header rather than
  disappearing.

Bonus is recorded and totalled but **is not part of the raise math** — matching the
workbook, where the second "Bonus" column had a header and no formula.

---

## Access

**Admin and HR only**, via the `compensation` permission.

This page is the most sensitive surface in the portal. The gating has four parts
and all of them are required:

| Where | What |
|---|---|
| `lib/roles.ts` `Perm` | the `compensation` key |
| `lib/roles.ts` `ADMIN_PATH_PERMS` | `/admin/comp-review` → `compensation` |
| `lib/roles.ts` scoped-role defaults | `hr` holds it |
| migration `078` | `INSERT INTO role_permissions ('hr','compensation')` |

⚠️ **The `ADMIN_PATH_PERMS` entry is what makes this fail closed.** An unmapped
`/admin/*` path falls back to the `dashboard` perm, which sales, HR, marketing,
engineering and production_manager *all* hold — so removing that line would open
payroll to every scoped role rather than locking it down.

⚠️ **The migration row is what makes the grant real.** Once `role_permissions` has
any rows the code-side defaults are dead (see `scripts/check-perm-seed.mjs`, which
runs on prebuild and fails the build if the two disagree).

Writes are tiered in `requireCompReviewAuth` ([`lib/api-auth.ts`](../lib/api-auth.ts)):

- **read** — anyone holding `compensation`
- **write** — admin or HR; editing one person's line
- **adminOnly** — cycle constants and finalize, because those re-price everyone at once

Tables are RLS-on with **no policies** — service-role only. Every line edit is
written to the audit log with the before → after values, because "who changed
whose pay, from what to what" is the question anyone will actually ask later.

---

## Data model

```
comp_cycles        one review year + its four constants + the frozen average
comp_review_lines  one person: per_hour, gross_annual, bonus, score, notes
```

`comp_review_lines.employee_id` is **nullable on purpose**: `employees.id` is
FK'd to `auth.users(id)`, so a row there requires a portal login, and the roster
includes people who don't have one (the source workbook listed two by first name
only). `person_name` is always stored — it is the name *as reviewed*, so a later
rename in `employees` can't silently rewrite a past cycle.

Starting a cycle can seed the roster from the staff list. Customers are excluded:
`handle_new_user()` (migration 001) puts **every** auth user in `employees`,
including customer invitees, and they have no business on a payroll sheet.
