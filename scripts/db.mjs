#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
   scripts/db.mjs — migrations and ad-hoc SQL without the Supabase CLI.

   WHY THIS EXISTS. On 2026-08-31 Windows Smart App Control began blocking
   `node_modules/@supabase/cli-windows-x64/bin/supabase.exe` — an unsigned
   122MB Go binary — with CodeIntegrity 3077/3033. Nothing had changed locally:
   the file was written 6 August and ran fine on the 27th and 28th. Smart App
   Control uses cloud-delivered reputation, so Microsoft's verdict on that
   unsigned file simply changed.

   The only way to run it again is to turn Smart App Control OFF, which cannot
   be undone without reinstalling Windows, on a machine holding the portal's
   service-role key and a signed-in admin browser. That is a bad trade for one
   CLI, so the dependency goes instead. Everything the CLI did for this repo is
   plain Postgres.

   ── Commands ───────────────────────────────────────────────────────────────
     node scripts/db.mjs doctor            what am I connected to, and is the
                                           tracking table the shape I expect
     node scripts/db.mjs list              local migrations vs applied
     node scripts/db.mjs query "select 1"  ad-hoc SQL, READ-ONLY unless --write
     node scripts/db.mjs query -f x.sql    the same, from a file
     node scripts/db.mjs push 100          apply exactly migration 100
     node scripts/db.mjs push --all        apply every pending one (asks first)

   ── Connection ─────────────────────────────────────────────────────────────
   Set SUPABASE_DB_URL in .env.local to the SESSION POOLER connection string
   (Supabase → Project Settings → Database → Connection string → Session mode,
   port 5432). Not the transaction pooler on 6543: that one does not keep a
   session across statements, which DDL and advisory locks both need.

   This file never prints the URL or the password, including in errors.
   ──────────────────────────────────────────────────────────────────────────── */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import pg from 'pg'

const ROOT = path.resolve(import.meta.dirname, '..')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

/* ⛔ MIGRATIONS THAT MUST NOT BE APPLIED, and why.
 *
 * The Supabase CLI's `db push` applies EVERY pending migration, which is why
 * shipping anything meant `mv 093 …` out of the folder first and hoping nobody
 * forgot. That is a footgun, not a workflow, so this tool refuses by name
 * instead — `--all` skips these and says so, and applying one takes an explicit
 * `--force-hold` plus naming its exact version.
 *
 * 093 grants a second super-admin. Jacob deferred it deliberately; it is not
 * committed and it is not to be applied as a side effect of shipping something
 * else. If that decision changes, remove it from here in the same commit that
 * applies it, so the reason travels with the change. */
const HOLD = {
  '093': 'Second super-admin grant — deferred by Jacob, deliberately unapplied. Do not apply as a side effect.',
}

// ── Connection ──────────────────────────────────────────────────────────────

function connectionString() {
  // .env.local is not loaded for a bare node script, so read it here. Same
  // parser shape as the other scripts in this folder.
  let url = process.env.SUPABASE_DB_URL
  if (!url) {
    const p = path.join(ROOT, '.env.local')
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        if (!line.includes('=') || line.trim().startsWith('#')) continue
        const i = line.indexOf('=')
        if (line.slice(0, i).trim() === 'SUPABASE_DB_URL') {
          url = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
        }
      }
    }
  }
  if (!url) {
    console.error(`
SUPABASE_DB_URL is not set. Looked in the environment, then .env.local.

Get it from: Supabase → Project Settings → Database → Connection string →
"Session mode" (host ends .pooler.supabase.com, PORT 5432 — NOT the transaction
pooler on 6543, which does not hold a session across statements).

Then EITHER, preferred — a Windows user environment variable, which lives
outside the repo:

  System Properties → Environment Variables → New (under User variables)
    Name:  SUPABASE_DB_URL
    Value: postgresql://postgres.<ref>:<password>@<host>:5432/postgres

  ⚠️ Set it through that dialog rather than \`setx\` on the command line, or the
  password lands in your shell history. Only new terminals see it.

OR — a line in .env.local:

  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres

  ⚠️ \`vercel env pull\` REWRITES .env.local from Vercel's variables and this one
  is not there, so it will silently disappear and this message will come back.
  That is why the environment variable is preferred.

.env.local is gitignored (.gitignore: .env*.local), and nothing in this script
ever prints the URL or the password — including on failure.`)
    process.exit(1)
  }
  return url
}

async function connect() {
  const client = new pg.Client({
    connectionString: connectionString(),
    // Supabase terminates TLS at the pooler with a certificate this client has
    // no local root for. The connection IS encrypted; what is skipped is chain
    // verification, which is the same posture the CLI used.
    ssl: { rejectUnauthorized: false },
    // A migration that hangs should fail loudly rather than sit there.
    statement_timeout: 5 * 60_000,
    connectionTimeoutMillis: 30_000,
  })
  try {
    await client.connect()
  } catch (e) {
    // ⚠️ Never echo the URL — it carries the password.
    console.error(`Could not connect: ${e.message}`)
    console.error('Check SUPABASE_DB_URL is the SESSION pooler (port 5432) and the password is current.')
    process.exit(1)
  }
  return client
}

// ── Local migrations ────────────────────────────────────────────────────────

/** Every `<version>_<name>.sql` in supabase/migrations, in version order.
 *
 *  ⚠️ Files whose name does not start with digits are IGNORED, exactly as the
 *  CLI ignores them — this repo has 015a_setup.sql through 015f_products.sql,
 *  which the CLI has always skipped with "file name must match pattern". They
 *  are already applied; treating them as pending would replay them. */
function localMigrations() {
  return fs.readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    /* 🔴 The `_` is load-bearing. `/^(\d+)/` alone matches "015" inside
       `015a_setup.sql`, so all six of those files became version 015 — six
       entries colliding on one version, any of which `push` might pick. Caught
       by scripts/db.test.mjs before this ever touched a database. Digits, then
       an underscore, is the CLI's own rule. */
    .map(f => ({ file: f, version: (f.match(/^(\d+)_/) || [])[1] ?? null }))
    .filter(m => m.version)
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
}

/** The CLI's tracking table. Read rather than assumed: if its shape ever
 *  changes, `doctor` reports it instead of this tool writing something the CLI
 *  cannot read back. */
async function trackingShape(client) {
  const { rows } = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
    order by ordinal_position`)
  return rows
}

async function appliedVersions(client) {
  const { rows } = await client.query(
    'select version from supabase_migrations.schema_migrations order by version')
  return rows.map(r => r.version)
}

const ask = (q) => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(q, a => { rl.close(); res(a.trim()) })
})

// ── Commands ────────────────────────────────────────────────────────────────

async function doctor() {
  const client = await connect()
  try {
    const { rows: [v] } = await client.query('select version(), current_database() db, current_user usr')
    console.log('connected  :', v.usr, '@', v.db)
    console.log('server     :', v.version.split(' on ')[0])

    const shape = await trackingShape(client)
    if (!shape.length) {
      console.log('\n⚠️  supabase_migrations.schema_migrations does NOT exist.')
      console.log('   `push` would create it. Expected columns: version, name, statements.')
    } else {
      console.log('\ntracking table supabase_migrations.schema_migrations:')
      for (const c of shape) console.log(`  ${c.column_name.padEnd(12)} ${c.data_type}`)
      const expected = ['version', 'statements', 'name']
      const missing = expected.filter(e => !shape.some(c => c.column_name === e))
      console.log(missing.length
        ? `\n⚠️  missing expected column(s): ${missing.join(', ')} — check before pushing.`
        : '\n✓ shape is what this tool writes.')
    }

    const applied = await appliedVersions(client)
    const local = localMigrations()
    console.log(`\nlocal migration files: ${local.length}`)
    console.log(`applied (remote)     : ${applied.length}`)
    const pending = local.filter(m => !applied.includes(m.version))
    console.log(`pending              : ${pending.length}${pending.length ? ' → ' + pending.map(p => p.version).join(', ') : ''}`)
    for (const p of pending) {
      if (HOLD[p.version]) console.log(`  ⛔ ${p.version} is HELD: ${HOLD[p.version]}`)
    }
  } finally { await client.end() }
}

async function list() {
  const client = await connect()
  try {
    const applied = new Set(await appliedVersions(client))
    const local = localMigrations()
    const known = new Set(local.map(m => m.version))
    console.log('  VERSION  STATUS    FILE')
    for (const m of local) {
      const held = HOLD[m.version] ? '  ⛔ HELD' : ''
      console.log(`  ${m.version.padEnd(8)} ${(applied.has(m.version) ? 'applied' : 'PENDING').padEnd(9)} ${m.file}${held}`)
    }
    // Applied remotely with no local file — a real condition worth surfacing,
    // not an error: it usually means a migration was applied then the file was
    // renamed or removed.
    const orphans = [...applied].filter(v => !known.has(v))
    if (orphans.length) console.log(`\n⚠️  applied remotely with no local file: ${orphans.join(', ')}`)
  } finally { await client.end() }
}

async function query(args) {
  const write = args.includes('--write')
  const fileIdx = args.indexOf('-f')
  const sql = fileIdx >= 0
    ? fs.readFileSync(path.resolve(args[fileIdx + 1]), 'utf8')
    : args.find(a => !a.startsWith('-'))

  if (!sql) { console.error('Nothing to run. Pass SQL, or -f <file>.'); process.exit(1) }

  const client = await connect()
  try {
    /* READ-ONLY BY DEFAULT, enforced by Postgres rather than by inspecting the
       SQL. The CLI's `db query` was read-only and a lot of muscle memory
       assumes that; silently allowing writes through the same verb would be a
       nasty surprise. `--write` opts in explicitly. */
    if (!write) await client.query('begin; set transaction read only')
    const res = await client.query(sql)
    const sets = Array.isArray(res) ? res : [res]
    for (const r of sets) {
      if (r.rows?.length) console.log(JSON.stringify(r.rows, null, 2))
      else console.log(`${r.command ?? 'OK'}${r.rowCount != null ? ` — ${r.rowCount} row(s)` : ''}`)
    }
    if (!write) await client.query('rollback')
  } catch (e) {
    if (!write) await client.query('rollback').catch(() => {})
    console.error('SQL failed:', e.message)
    if (!write && /read-only transaction/i.test(e.message)) {
      console.error('→ This statement writes. Re-run with --write if that is intended.')
    }
    process.exitCode = 1
  } finally { await client.end() }
}

async function push(args) {
  const all = args.includes('--all')
  const forceHold = args.includes('--force-hold')
  const yes = args.includes('--yes')
  const named = args.filter(a => !a.startsWith('-'))

  const client = await connect()
  try {
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text
      )`)

    const applied = new Set(await appliedVersions(client))
    const local = localMigrations()
    let targets = all
      ? local.filter(m => !applied.has(m.version))
      : local.filter(m => named.includes(m.version))

    if (!all && named.length === 0) {
      console.error('Name the migration(s) to apply, or pass --all.')
      process.exit(1)
    }
    const unknown = named.filter(n => !local.some(m => m.version === n))
    if (unknown.length) { console.error(`No migration file for: ${unknown.join(', ')}`); process.exit(1) }

    // ⛔ The held ones. --all silently skipping them is the point; naming one
    // explicitly still requires --force-hold, so it cannot happen by reflex.
    const held = targets.filter(m => HOLD[m.version])
    if (held.length && !forceHold) {
      for (const h of held) console.log(`⛔ skipping ${h.version} — ${HOLD[h.version]}`)
      targets = targets.filter(m => !HOLD[m.version])
      if (!all && targets.length === 0) {
        console.error('\nThat migration is held. Pass --force-hold if you genuinely mean to apply it.')
        process.exit(1)
      }
    }

    const already = targets.filter(m => applied.has(m.version))
    for (const a of already) console.log(`· ${a.version} is already applied — skipping`)
    targets = targets.filter(m => !applied.has(m.version))

    if (!targets.length) { console.log('Nothing to apply.'); return }

    console.log('\nWould apply:')
    for (const t of targets) console.log(`  ${t.version}  ${t.file}`)

    if (!yes) {
      const a = await ask(`\nApply ${targets.length} migration(s)? [y/N] `)
      if (a.toLowerCase() !== 'y') { console.log('Cancelled.'); return }
    }

    for (const t of targets) {
      const sql = fs.readFileSync(path.join(MIGRATIONS, t.file), 'utf8')
      process.stdout.write(`\nApplying ${t.file} … `)
      try {
        /* One transaction per migration, so a failure half way leaves nothing
           behind. node-postgres sends a multi-statement string in simple query
           mode, which is what lets a whole file — dollar-quoted function bodies
           and all — go over as-is. Splitting on ';' would break every `$$ … $$`
           body in this repo. */
        await client.query('begin')
        await client.query(sql)
        /* Recorded inside the SAME transaction as the DDL. If the insert failed
           separately, the schema would be changed with nothing saying so, and
           the next run would replay it. */
        await client.query(
          `insert into supabase_migrations.schema_migrations (version, name, statements)
           values ($1, $2, $3)
           on conflict (version) do update set name = excluded.name, statements = excluded.statements`,
          // The CLI stores each statement separately. This stores the file as
          // one element: splitting SQL correctly is a parser problem, and
          // nothing reads `statements` back — `migration list` compares
          // versions. Documented rather than faked.
          [t.version, t.file.replace(/^\d+_/, '').replace(/\.sql$/, ''), [sql]],
        )
        await client.query('commit')
        console.log('done')
      } catch (e) {
        await client.query('rollback').catch(() => {})
        console.log('FAILED')
        console.error(`  ${e.message}`)
        if (e.position) console.error(`  at character ${e.position}`)
        console.error('\nRolled back. Nothing from this migration was applied.')
        process.exitCode = 1
        return
      }
    }
    console.log('\nAll applied.')
  } finally { await client.end() }
}

// ── Entry ───────────────────────────────────────────────────────────────────

/* Exported so the pure parts can be tested without a database — see
 * scripts/db.test.mjs. The CLI below only runs when this file is INVOKED, not
 * when it is imported, or importing it would execute a command. */
export { localMigrations, HOLD }

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (!invokedDirectly) {
  // Imported for its exports; do not run the CLI.
} else {

const [cmd, ...rest] = process.argv.slice(2)
const commands = { doctor, list, query: () => query(rest), push: () => push(rest) }

if (!cmd || !commands[cmd]) {
  console.log(`Usage: node scripts/db.mjs <command>

  doctor                     connection, tracking-table shape, pending list
  list                       local migrations vs applied
  query "<sql>" [--write]    ad-hoc SQL; READ-ONLY unless --write
  query -f <file> [--write]
  push <version…> [--yes]    apply exactly those migrations
  push --all [--yes]         apply every pending one (held ones are skipped)
             [--force-hold]  apply a held migration — read HOLD in this file first
`)
  process.exit(cmd ? 1 : 0)
}

await commands[cmd]()

}
