/**
 * STATIC CHECK — does lib/roles.ts DEFAULT_ROLE_PERMS agree with what the
 * migrations actually seed into role_permissions?
 *
 * WHY THIS EXISTS: the two lists can silently disagree, and when they do the
 * CODE loses. Once role_permissions holds any rows, lib/permissions.getPermMatrix()
 * seeds every scoped role to [] and fills from the DB, so hasPermission()'s
 * `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never reaches the code default —
 * the defaults are only the fallback for an errored/empty table. So adding a
 * perm to DEFAULT_ROLE_PERMS without a matching migration grants NOTHING, with
 * no error anywhere: the nav entry just stays hidden and the route 302s home.
 * That shipped for real once — 'tools' was in the code list from day one but
 * migration 045 never seeded it, and nobody noticed until migration 051.
 *
 * Repo-only: reads files, never the network or the database. It deliberately
 * does NOT compare against the live table — the matrix is admin-editable from
 * /admin/permissions by design, so prod legitimately drifts from the seed (e.g.
 * Engineering's hand-granted 'tools'). Only code-vs-seed is a bug.
 *
 * Run: node scripts/check-perm-seed.mjs   (exit 0 = agree, 1 = drift)
 */
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROLES_TS = join(ROOT, 'lib', 'roles.ts')
const MIGRATIONS = join(ROOT, 'supabase', 'migrations')

const fail = (msg) => {
  console.error(`\n✗ perm-seed check FAILED\n\n${msg}\n`)
  process.exit(1)
}

// ── 1. the code list ────────────────────────────────────────────────────────
const src = readFileSync(ROLES_TS, 'utf8')
const block = src.match(/DEFAULT_ROLE_PERMS[^=]*=\s*\{([\s\S]*?)\n\}/)
if (!block) fail(`Could not parse DEFAULT_ROLE_PERMS out of lib/roles.ts.\nThe checker's parser needs updating to match its new shape.`)

const code = {}
for (const m of block[1].matchAll(/^\s*(\w+)\s*:\s*\[([^\]]*)\]/gm)) {
  code[m[1]] = new Set(
    m[2].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  )
}
if (Object.keys(code).length === 0) fail('Parsed DEFAULT_ROLE_PERMS but found no roles in it — parser is out of date.')

// ── 2. what the migrations seed ─────────────────────────────────────────────
// Seeds are additive `INSERT ... ON CONFLICT DO NOTHING`. If a migration ever
// DELETEs grants, this model is wrong — bail loudly rather than pass on a lie.
const seed = {}
for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
  const bare = sql.replace(/--[^\n]*/g, '') // strip comments (the docs discuss these rows)

  if (/DELETE\s+FROM\s+role_permissions/i.test(bare)) {
    fail(
      `${file} DELETEs from role_permissions.\n` +
      `This checker assumes seeds are additive-only, so its result would be wrong.\n` +
      `Teach it about deletions before relying on it again.`
    )
  }
  for (const ins of bare.matchAll(/INSERT\s+INTO\s+role_permissions[^;]*?VALUES([\s\S]*?);/gi)) {
    for (const [, role, perm] of ins[1].matchAll(/\(\s*'(\w+)'\s*,\s*'(\w+)'\s*\)/g)) {
      ;(seed[role] ??= new Set()).add(perm)
    }
  }
}
if (Object.keys(seed).length === 0) fail('No role_permissions INSERTs found in supabase/migrations — parser is out of date.')

// ── 3. compare ──────────────────────────────────────────────────────────────
const sorted = (s) => [...s].sort()
const problems = []
for (const role of [...new Set([...Object.keys(code), ...Object.keys(seed)])].sort()) {
  const c = code[role] ?? new Set()
  const s = seed[role] ?? new Set()
  const missingFromSeed = sorted(c).filter((p) => !s.has(p))
  const missingFromCode = sorted(s).filter((p) => !c.has(p))

  if (missingFromSeed.length) {
    problems.push(
      `  ${role}: in DEFAULT_ROLE_PERMS but never seeded → ${missingFromSeed.join(', ')}\n` +
      `    These grant NOTHING in any environment whose role_permissions table has rows.\n` +
      `    Fix: add a migration —\n` +
      `      INSERT INTO role_permissions (role, perm) VALUES\n` +
      `        ${missingFromSeed.map((p) => `('${role}','${p}')`).join(', ')}\n` +
      `      ON CONFLICT (role, perm) DO NOTHING;`
    )
  }
  if (missingFromCode.length) {
    problems.push(
      `  ${role}: seeded by a migration but absent from DEFAULT_ROLE_PERMS → ${missingFromCode.join(', ')}\n` +
      `    The fallback (errored/empty table) would silently drop these.\n` +
      `    Fix: add them to DEFAULT_ROLE_PERMS in lib/roles.ts, or drop the seed row.`
    )
  }
}

if (problems.length) {
  fail(
    `lib/roles.ts DEFAULT_ROLE_PERMS and the role_permissions migration seeds disagree.\n\n` +
    problems.join('\n\n') +
    `\n\nNote: this compares CODE to MIGRATIONS only. Live prod may legitimately\n` +
    `differ — the matrix is editable at /admin/permissions.`
  )
}

const n = Object.values(code).reduce((a, s) => a + s.size, 0)
console.log(`✓ perm-seed check passed — DEFAULT_ROLE_PERMS and the role_permissions seeds agree (${n} grants across ${Object.keys(code).length} roles).`)
