# Migrations without the Supabase CLI (`scripts/db.mjs`)

_Added 2026-08-31._

> ## ✅ STATUS: the CLI works again (2026-08-31, later the same day)
>
> Jacob turned **Smart App Control off**, and `npx supabase` runs again — verified
> (`--version` → 2.111.0, and a live `db query` returns rows). ⚠️ That switch is **one-way**:
> it cannot be re-enabled without reinstalling Windows. **Bitdefender Endpoint Security Tools**
> is installed and active on this machine, which is why Windows Defender reports itself off —
> normal handoff, not a second problem.
>
> **So this script is no longer a necessity.** Keep it for two reasons and use the CLI for the
> rest:
>
> 1. 🔴 **`push` refuses to apply what you did not name.** `supabase db push` still applies
>    EVERY pending migration, which is why shipping has always meant moving `093` out of the
>    folder first and hoping nobody forgot. That footgun is unchanged in the CLI.
> 2. It is a fallback if an unsigned binary gets blocked again — nothing prevents a future
>    Bitdefender or Windows update doing what Smart App Control did.
>
> ⚠️ **This script has never applied a real migration.** Its offline logic is tested; a live
> `push` is not. The CLI has years of use behind it. Prefer the CLI unless the hold-list
> safety is what you want.

## The problem it was built for

On 2026-08-31 Windows **Smart App Control** began blocking
`node_modules/@supabase/cli-windows-x64/bin/supabase.exe`:

```
Program 'supabase.exe' failed to run: An Application Control policy has blocked this file
```

Confirmed, not guessed:

| Check | Result |
|---|---|
| `HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy` → `VerifiedAndReputablePolicyState` | `1` — Smart App Control **enforced** |
| `Get-AuthenticodeSignature` on the binary | **NotSigned** (122 MB Go binary) |
| `Microsoft-Windows-CodeIntegrity/Operational` | events **3077 / 3033**, policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}` |
| Windows edition | **11 Home** — so no domain policy, no Intune, no IT to escalate to |

**Nothing local changed.** The binary was written 6 August and ran fine on the 27th and 28th;
every block event is from the morning of the 31st. Smart App Control uses cloud-delivered
reputation, so Microsoft's verdict on that unsigned file changed on its own. **It can happen
again, to this or any other unsigned developer tool.**

**What was advised, and what happened.** The recommendation at the time was *not* to turn
Smart App Control off — it cannot be turned back on without reinstalling Windows, it has **no
per-app allowlist** so there is no narrower version of the change, and this machine holds the
service-role key, Vercel tokens and a signed-in admin browser session. Jacob turned it off
anyway, which is his call to make and did resolve it; see the status box at the top.

Recorded here because the reasoning still applies to **the next** unsigned tool that gets
blocked: the switch is already spent, so it cannot be spent again, and whatever comes next
needs a different answer. This script is that answer.

## Setup, once — and the four things to know first

Get the string from Supabase → **Project Settings → Database → Connection string → Session
mode** (host ends `.pooler.supabase.com`, port **5432**).

⚠️ **Session mode, port 5432 — not the transaction pooler on 6543.** That one does not hold a
session across statements, which DDL and advisory locks both need.

### Where to put it — environment variable, not the file

`connectionString()` reads `process.env.SUPABASE_DB_URL` **first**, then falls back to
`.env.local`. Prefer the environment variable:

> System Properties → Environment Variables → **New** (under *User variables*)
> Name `SUPABASE_DB_URL`, value the connection string.

⚠️ Use that dialog rather than `setx` on the command line, or the password lands in shell
history. Only new terminals pick it up.

### The four challenges, honestly

**1. 🔴 `vercel env pull` REWRITES `.env.local`.** Verified from its own help: *"Pull all
Development Environment Variables from the cloud and write to a file [.env.local]"*.
`SUPABASE_DB_URL` is not in Vercel, so pulling silently deletes it and the "not set" message
comes back looking like a new fault. **This is the main reason to use the environment variable
instead.**

**2. It is a strictly more powerful credential than what is already on disk.** `.env.local`
already holds `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS and can read or write every table
through PostgREST. A direct Postgres connection as the `postgres` role adds **DDL and arbitrary
SQL** — dropping tables, altering schema. Not a category change, but a real widening of what a
leak of that file would mean.

**3. The repo is PUBLIC.** `.env.local` is gitignored — verified, `.gitignore:30` matches
`.env*.local` — so it will not be committed by accident. But on a public repo the cost of a
`git add -f` or an over-broad `git add -A` is higher than usual, which is another point in
favour of keeping the credential outside the repo folder entirely.

**4. Rotation.** Resetting the database password in Supabase leaves this stale. The failure is
loud and readable (`Could not connect: …`), never silent.

Not a challenge, but worth knowing: `scripts/backup-db.mjs` already expects a database password
(`SUPABASE_DB_PASSWORD`, or interactive), so a DB credential is already part of this workflow —
just under a different name and not currently stored.

Nothing in this script prints the URL or the password, including on failure — verified by
running it against a bogus URL containing a known string and grepping the output for it.

## Commands

```bash
npm run db -- doctor            # connection, tracking-table shape, what is pending
npm run db -- list              # local migrations vs applied
npm run db -- query "select 1"  # ad-hoc SQL — READ-ONLY unless --write
npm run db -- query -f x.sql
npm run db -- push 100          # apply exactly migration 100
npm run db -- push --all        # apply every pending one (asks first)
```

**`query` is read-only by default**, enforced by `set transaction read only` rather than by
inspecting the SQL. The CLI's `db query` was read-only and a lot of muscle memory assumes it;
letting the same verb write silently would be a nasty surprise. `--write` opts in.

## What it does differently from the CLI, on purpose

**`push` will not apply anything you did not name.** `supabase db push` applied *every* pending
migration, which is why shipping anything meant moving `093_super_admin_lee_childers.sql` out
of the folder first and hoping nobody forgot. That is a footgun, not a workflow.

⛔ **Held migrations.** `HOLD` at the top of `scripts/db.mjs` names versions that must not be
applied, each with its reason. `--all` skips them and says so; applying one takes `--force-hold`
*and* naming its exact version. `093` is in there — the deferred second super-admin grant. If
that decision changes, remove it from `HOLD` in the same commit that applies it, so the reason
travels with the change.

**Each migration runs in its own transaction**, and the row in
`supabase_migrations.schema_migrations` is written **inside that same transaction**. If the
insert were separate and failed, the schema would be changed with nothing recording it, and the
next run would replay it.

**The whole file goes over as one statement.** node-postgres sends a multi-statement string in
simple query mode, which is what lets `$$ … $$` function bodies through untouched — and this
repo has several (`match_pp_findings`, `pp_tag_token`). Splitting on `;` would corrupt every one
of them. Consequently `statements` is stored as a single-element array rather than the CLI's
per-statement split: splitting SQL correctly is a parser problem, nothing reads that column back
(`migration list` compares versions), and faking it would be worse than documenting it.

## 🔴 The version regex, and the bug the tests caught

A migration's version is `/^(\d+)_/` — **digits followed by an underscore**.

The first draft used `/^(\d+)/`, which matches `015` inside `015a_setup.sql`. That silently
turned six already-applied files (`015a`–`015f`) into migrations, all colliding on version
`015`, any of which `push` might have picked. `scripts/db.test.mjs` caught it before it touched
a database — it asserts both that those files are ignored *and* that no two files claim the
same version.

Those lettered files are why this matters at all: the CLI has always skipped them
("file name must match pattern") and they are long since applied. Treating them as pending
would replay six migrations against production.

## Tests

```bash
npm run db:test
```

Eleven assertions, **no database required** — version parsing, ordering (`100` after `099`,
numerically not lexically), the lettered-file exclusion, duplicate detection, and that the hold
list carries a reason rather than a bare flag. Deliberately runnable without a password, because
the logic deciding *what gets applied* is the part worth checking before anyone connects.

## What is not verified

**Nothing has been run against the live database through this script**, because the database
password is not on this machine — it lives in the Supabase dashboard. The offline logic is
tested and the failure paths are tested; the connection, the read-only enforcement, and an
actual `push` are **not**. Run `npm run db -- doctor` first once `SUPABASE_DB_URL` is set: it
connects, prints the tracking table's real column names, and lists what is pending, without
writing anything.
