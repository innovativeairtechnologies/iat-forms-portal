# Database backup & restore

The portal's Postgres data lives in one Supabase project (`iat-forms`). Protect it in two
layers — set up **both**.

## Layer 1 — Supabase managed backups (primary)

Supabase runs automated backups of the project database. Confirm/enable them:

1. Supabase dashboard → the **`iat-forms`** project → **Database → Backups**.
2. On the **Pro plan**, daily backups run automatically (7-day retention) — confirm recent ones
   are listed.
3. **Point-in-Time Recovery (PITR)** is a paid add-on that restores to any moment within the
   retention window, not just the nightly snapshot. Enable it on the same Backups page if the plan
   allows — **strongly recommended before handoff**: it's the difference between losing a day and
   losing a few minutes.
4. To restore: Backups page → pick a snapshot (or a PITR timestamp) → **Restore**. This overwrites
   the project database, so only do it in a real recovery.

## Layer 2 — Off-Supabase logical dump (portable redundancy)

A copy you control, independent of the Supabase account, in case that account itself is lost.

```
node scripts/backup-db.mjs
```

Writes `backups/<timestamp>/schema.sql` + `data.sql` via the linked Supabase CLI. The `backups/`
folder is **gitignored** — dumps contain live customer data and this repo is public, so **never
commit them**. Move them somewhere safe (encrypted drive / the company backup location).

Prereqs: the Supabase CLI is linked (`npx supabase link`), and the DB password is available (set
`SUPABASE_DB_PASSWORD`, or run once interactively and let the CLI prompt).

### Restore test (do this at least once, and after any big schema change)

A backup only counts once you've *proven* the restore. Test into a throwaway target — never over
prod:

1. Create a scratch Supabase project (or run a local `npx supabase start`).
2. Apply schema, then data:
   ```
   psql "<scratch-connection-string>" -f backups/<timestamp>/schema.sql
   psql "<scratch-connection-string>" -f backups/<timestamp>/data.sql
   ```
3. Verify row counts against prod for a few key tables:
   ```sql
   select 'tickets' t, count(*) from tickets
   union all select 'submissions', count(*) from submissions
   union all select 'employees',   count(*) from employees
   union all select 'equipment',   count(*) from equipment
   union all select 'deals',       count(*) from deals;
   ```
4. Tear the scratch project down.

If the counts match and the app boots against the scratch DB, the backup is good.

## Cadence

- **Layer 1** (managed daily + PITR): automatic once enabled.
- **Layer 2** (`scripts/backup-db.mjs`): run before any risky migration, plus a weekly manual run,
  until it's automated. (A scheduled dump is a future improvement — it needs a host to run on and a
  safe off-repo place to store the output.)
