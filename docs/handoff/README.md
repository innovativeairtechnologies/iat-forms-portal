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

## Writing a new one

Name it `<YYYY-MM-DD>-session-handoff.md` and follow the seven sections above. The parts that
earn their keep are §3 (rejected options) and §5 (what was NOT verified) — a handoff that only
lists what was done reads as more complete than it is.

Anonymization rule applies here as everywhere: no competitor names, no customer names or
organizations.
