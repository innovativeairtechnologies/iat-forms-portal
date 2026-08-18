# Every automated email the portal sends

One page, because "who gets told what, and when" was previously spread across six
files and nobody could answer it without reading all of them.

Two rules govern the whole table:

- **Staff mail is never gated.** Reminders, escalations and desk alerts go out
  regardless of `CUSTOMER_TICKET_EMAILS`. They are the mechanism that stops work
  going quiet; suppressing them would defeat the point.
- **Customer mail is gated** behind `CUSTOMER_TICKET_EMAILS === "on"` (currently
  **on**). One switch turns every customer-facing send off together, rather than
  leaving quote requests able to mail people while tickets stay silent.

---

## Support tickets

| # | Trigger | Who is told | When |
|---|---|---|---|
| 1 | A ticket is submitted | Support desk (`SUPPORT_NOTIFICATION_EMAIL` → `iatsupport@`) | Immediately |
| 2 | A ticket is submitted | The customer — confirmation + AI first-checks | Immediately |
| 3 | Staff post a **public** note | The customer — a copy of the reply | Immediately |
| 4 | A customer writes back on `/support/status` | Support desk | Immediately |
| 5 | Status changes (not terminal) | The customer — what it changed to | Immediately |
| 6 | Status changes to **Resolved** or **Closed** | The customer — the engineer's closing notes, verbatim | Immediately |
| 7 | A customer marks their own ticket resolved | Support desk — *verify before closing* | Immediately |
| 8 | Assigned, no activity for **24h** | The assignee, one email covering all their stalled tickets | Daily 13:00 UTC |
| 9 | Unassigned for **24h** | Support desk | Daily 13:00 UTC |
| 10 | Unassigned for **24h** | **Leadership** — Kacy and Crystal, individually | Daily 13:00 UTC |

**Internal notes never reach the customer.** Only notes explicitly marked public
do (#3). This is the single most important line on this page.

**"No activity" means no note** (#8), not "the status has not moved". A ticket
someone is working leaves a trail, even "waiting on parts". Keying on status
would let a ticket sit in *In Progress* forever and count as alive — the exact
failure being chased.

## Quote requests (RFQ)

| # | Trigger | Who is told | When |
|---|---|---|---|
| 11 | An RFQ is submitted | Sales desk (`RFQ_NOTIFICATION_EMAIL` → `SUPPORT_NOTIFICATION_EMAIL` → `iatsupport@`) | Immediately |
| 12 | An RFQ is submitted | The customer — receipt with their reference | Immediately |
| 13 | An RFQ is assigned to someone | The new owner. **Not** sent on self-assignment | Immediately |
| 14 | A customer writes back on `/support/status` | The assignee, or the desk if unassigned — never both | Immediately |
| 15 | Assigned, still `new` after **24h** | The owner, one email covering all their stalled rows | Daily 13:00 UTC |
| 16 | Unassigned after **24h** | Sales desk, subject prefixed `REMINDER:` | Daily 13:00 UTC |
| 17 | Unassigned after **24h** | **Leadership** — Kacy and Crystal, individually | Daily 13:00 UTC |

## Everything else

| # | Trigger | Who is told | When |
|---|---|---|---|
| 18 | Daily admin digest | Admin roster, minus `DIGEST_OPT_OUT_DEFAULT` | Daily 16:30 ET |
| 19 | Weekly leadership update | `LEADERSHIP_UPDATE_EMAIL` → currently **lee.childers@** only | **Mondays 17:00 ET** |
| 20 | PTO accrual run | — (no mail; a scheduled data job) | Mondays 08:00 UTC |
| 21 | Form submissions, PTO requests, approvals | Per-form recipients | Immediately |

The weekly update covers one **edition** — a Monday-to-Sunday work week named
after its Monday (`lib/edition.ts`), e.g. **Edition 8.17.26** for 17–23 August.
Sent Monday evening, it reports the edition that closed the night before; that
Monday's own work belongs to the edition just starting and appears next week.
Rebuild any past week with `?edition=8.17.26` (or `2026-08-17`) — any date inside it resolves to
that week's Monday.

---

## The escalation ladder

Three steps, each existing because the one before it can fail:

1. **Desk sweep** → the shared mailbox. *A mailbox can go unread.*
2. **Owner nudge** → the person holding it. *Requires someone to be holding it.*
3. **Leadership escalation** → Kacy and Crystal, by name.

Step 3 fires precisely when neither of the first two can help: an unassigned row
has nobody to nudge, and the desk has already been told once. It covers **tickets
and quote requests in one email**, because they need the same decision — hand it
to a person — and two emails minutes apart would be merged by hand anyway.

**Individual sends, not a shared `To:` line.** A message addressed to two people
is a message addressed to nobody; each assumes the other has it, which is the
exact failure this email exists to break. Override the pair with
`LEADERSHIP_ESCALATION_EMAIL` (comma-separated) — a name changing must not need
a commit.

**Repeat cadence: 48 hours.** Assigning an owner stops everything for that row.
Nothing can go permanently quiet, and nothing arrives daily.

## Idempotency — why timestamps, not flags

Every sweep is a cron re-running against the same rows, so *"have we already
chased this one?"* has to survive between invocations. One column per reminder
kind, stamped when mail goes out and checked before the next send:

| Column | Table | Set by |
|---|---|---|
| `assigned_at` | `tickets`, `rfq_requests` | The moment an owner is set |
| `assignee_nudged_at` | both | The owner nudge |
| `unclaimed_reminded_at` | both | The desk reminder |
| `escalated_at` | both | The leadership escalation |

**Deliberately not stamped when a send throws**, so a failure is retried on the
next run rather than silently swallowed. An in-memory flag would not outlive a
serverless invocation.

## Closing a ticket

Both terminal states — **Resolved** and **Closed** — require closing notes from
the employee, at least 10 characters, enforced in the UI *and* in the server
action. Those notes are written to the ticket thread as a public note and emailed
to the customer word for word.

The resolution-reason dropdown does not satisfy this. It is fifteen fixed phrases
chosen for reporting, and *"Replacement part installed"* tells the person whose
machine broke nothing about their machine.

**A customer marking their own ticket resolved does not close it.** They must say
what changed (same 10-character floor), it lands on the thread, and the desk is
emailed to go and verify. "It seems fine now" and "the fault is gone" are
different claims; only the second belongs in the record.

⚠️ The bridge endpoint `/api/bridge/ticket-resolve` — used by the separate
`iat-customer` app — takes the note as **optional**, because enforcing a field
that app's UI does not send would break marking-resolved there rather than
improving it. It does send the desk alert. Add `note` to that app's request
first, then tighten the endpoint; in that order.

## Cron auth — fail closed, always

Every cron route guards with `if (!CRON_SECRET || auth !== ...)`. **Never relax
this to `if (SECRET && ...)`** — that form skips the check entirely when the
variable is unset, and an anonymous GET has already run a sweep and sent real
mail once because of it.

`CRON_SECRET` was itself unset in production until 2026-08-17, which meant every
scheduled job had been 401ing since it was built. Verify from the outside after
touching any of this: anonymous → 401, wrong secret → 401, correct secret → 200.
