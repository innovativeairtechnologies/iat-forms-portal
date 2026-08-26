# Session handoff records

Business-continuity artifacts. One file per working session that produced enough change to be
worth reconstructing later — written so a fresh session (or a different person) can pick the work
up cold, without the original conversation.

Each record carries, in order:

1. **Scope** — what the session set out to do, and what actually got done vs. left open
2. **Change log** — every file touched, with the reasoning, not just the diff
3. **Decisions & logic** — including options *rejected*, so they aren't re-proposed
4. **Gotchas** — traps, things that lied, and code that looks wrong but is correct on purpose
5. **Verification state** — explicitly naming what was **not** verified
6. **Open threads** — where we stopped and what's next
7. **Resume context** — paths, commands and which docs/memories to read first

## Records

| Date | Session |
|---|---|
| [2026-08-17](2026-08-17-session-handoff.md) | Request for Quote — wizard, PDF, admin queue, triage, chasing, dashboards; `CRON_SECRET` discovery; weekly leadership update |
| [2026-08-19](2026-08-19-session-handoff.md) | Ticket numbers, submissions RLS, edition numbering, RFQ trimming |
| [2026-08-21](2026-08-21-session-handoff.md) | RFQ renders, reports, ticket ownership and alerts |
| [2026-08-24](2026-08-24-session-handoff.md) | Room renders in the survey, Mon/Wed/Fri leadership report, ticket lifecycle — **and the deploys-eat-crons finding** |
| [2026-08-24 (b)](2026-08-24-session-handoff-dr-and-rfq-volume.md) | Disaster-recovery backup of the whole stack; RFQ volume entry; dimension callouts; cron DST |
| [2026-08-26](2026-08-26-session-handoff.md) | RFQ PDF layout, letterhead and brand colours; conveyor + makeup-air physics; the tightness rates were wrong; both scheduled mails re-timed |

> **Two records can share a date.** Sessions run concurrently in this repo, so
> `<YYYY-MM-DD>-session-handoff.md` may already be taken by a session that finished
> earlier the same day. Add a short descriptive suffix rather than overwriting it —
> the existing file is somebody else's continuity record, and a handoff is the one
> artifact that must never be silently replaced.

## Writing a new one

Name it `<YYYY-MM-DD>-session-handoff.md` and follow the seven sections above. The parts that
earn their keep are §3 (rejected options) and §5 (what was NOT verified) — a handoff that only
lists what was done reads as more complete than it is.

Anonymization rule applies here as everywhere: no competitor names, no customer names or
organizations.
