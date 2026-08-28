#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
   check-pp-columns.mjs — does every column the Post-Production code WRITES
   actually exist?

   Why this exists: migration 099 dropped `pp_walkarounds.unit_serial`, and two
   routes were left still writing it. Nothing caught it —

     • `tsc` does not type supabase-js insert payloads against the live schema,
     • `next build` runs no queries (these pages are force-dynamic),
     • and the test suite inserted rows through PostgREST directly rather than
       through the route, so it exercised a payload the route never sends.

   The result was PGRST204 ("Could not find the 'unit_serial' column … in the
   schema cache") at runtime, on the main capture path, in production.

   ── Offline by design ──────────────────────────────────────────────────────
   Columns come from the MIGRATION FILES, not from a live connection — same
   philosophy as check-perm-seed.mjs. A build that fails because Supabase
   hiccupped is worse than the bug it is guarding against.

   Run: node scripts/check-pp-columns.mjs
   ──────────────────────────────────────────────────────────────────────────── */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TABLES = /^pp_/

// ── 1. Build each table's column set by replaying the migrations in order ────
function columnsFromMigrations() {
  const dir = path.join(ROOT, 'supabase', 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const cols = new Map()

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8')

    // CREATE TABLE [IF NOT EXISTS] <name> ( … );
    const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\n\);/gi
    for (const m of sql.matchAll(create)) {
      const [, table, body] = m
      if (!TABLES.test(table)) continue
      const set = cols.get(table) ?? new Set()
      for (const line of body.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('--')) continue
        // Skip table-level constraints, which are not columns.
        if (/^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b/i.test(t)) continue
        const name = t.match(/^(\w+)\s+/)?.[1]
        if (name) set.add(name)
      }
      cols.set(table, set)
    }

    // ALTER TABLE <name> ADD COLUMN [IF NOT EXISTS] <col>
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)) {
      const [, table, col] = m
      if (!TABLES.test(table)) continue
      cols.set(table, (cols.get(table) ?? new Set()).add(col))
    }

    // ALTER TABLE <name> DROP COLUMN [IF EXISTS] <col>  ← the case that bit
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(\w+)/gi)) {
      const [, table, col] = m
      if (!TABLES.test(table)) continue
      cols.get(table)?.delete(col)
    }
  }
  return cols
}

// ── 2. Find every column the code writes ────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

/* Comments and strings must go before any key extraction.
 *
 * The first version of this script skipped that and reported 22 failures, every
 * one of them a false positive: prose from its own explanatory comments
 * ("NB: …", "NULL: …") read as object keys. A checker that cries wolf gets
 * switched off, so it is worth more care than the thing it checks.
 *
 * Replaced with spaces rather than removed, so every index still lines up with
 * the original source and the reported positions stay true. */
function strip(src) {
  let out = ''
  let i = 0
  const blank = s => ' '.repeat(s.length).replace(/ /g, ' ')
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      out += blank(src.slice(i, stop)); i = stop
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      // Keep newlines so line structure survives.
      out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i]
      let j = i + 1
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++ }
      out += ' '.repeat(Math.min(j + 1, src.length) - i); i = j + 1
    } else {
      out += src[i]; i++
    }
  }
  return out
}

/** Top-level keys of the object literal starting at `open` (its '{').
 *
 *  A key only counts when the previous meaningful character is '{' or ',' —
 *  which is what separates `note: x` from the `null` in `cond ? null : y`. The
 *  first version missed that and reported every ternary in the file. */
function topLevelKeys(src, open) {
  const keys = []
  let depth = 0
  let prev = ''
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '{' || c === '[' || c === '(') { depth++; prev = c; continue }
    if (c === '}' || c === ']' || c === ')') { depth--; if (depth === 0) break; prev = c; continue }
    if (/\s/.test(c)) continue
    if (depth === 1 && (prev === '{' || prev === ',') && /[A-Za-z_]/.test(c)) {
      const m = src.slice(i).match(/^(\w+)\s*:/)
      if (m) { keys.push(m[1]); i += m[0].length - 1; prev = ':'; continue }
    }
    prev = c
  }
  return keys
}

function writesFromCode() {
  const found = []
  for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))]) {
    const raw = fs.readFileSync(file, 'utf8')
    const src = strip(raw)
    // `.from('pp_x')` string literals are blanked by strip(), so the table names
    // are read from the ORIGINAL and the offsets used against the stripped copy
    // — the two are the same length by construction.
    const froms = [...raw.matchAll(/\.from\(\s*['"](pp_\w+)['"]\s*\)/g)]

    for (const [n, m] of froms.entries()) {
      const table = m[1]
      // The chain ends where the NEXT .from() begins. A fixed lookahead window
      // was the third false-positive source: it ran past the end of one query
      // and attributed the next query's columns to this table.
      const end = froms[n + 1]?.index ?? src.length
      const region = src.slice(m.index, end)
      const call = region.match(/\.(insert|update|upsert)\(\s*\{/)
      if (!call) continue
      const open = m.index + call.index + call[0].length - 1
      for (const key of topLevelKeys(src, open)) {
        found.push({ table, key, file: path.relative(ROOT, file), op: call[1] })
      }
    }
  }
  return found
}

// ── 3. Diff ─────────────────────────────────────────────────────────────────
const schema = columnsFromMigrations()
const writes = writesFromCode()

if (!schema.size) {
  console.error('check-pp-columns: parsed no pp_* tables from the migrations — the parser is wrong, not the code.')
  process.exit(1)
}
if (!writes.length) {
  console.error('check-pp-columns: found no pp_* writes in the code — the extractor is wrong, not the code.')
  process.exit(1)
}

const bad = writes.filter(w => {
  const cols = schema.get(w.table)
  return cols && !cols.has(w.key)
})

for (const [t, c] of [...schema].sort()) {
  console.log(`  ${t}: ${c.size} columns`)
}
console.log(`  checked ${writes.length} written columns across ${new Set(writes.map(w => w.file)).size} files`)

if (bad.length) {
  console.error('\ncheck-pp-columns FAILED — these columns are written but do not exist:\n')
  for (const b of bad) {
    console.error(`  ${b.file}`)
    console.error(`    .${b.op}({ ${b.key}: … })  →  ${b.table} has no column "${b.key}"`)
  }
  console.error('\nThis is a runtime PGRST204 on the write path. Fix the code or add the column.')
  process.exit(1)
}

console.log('\ncheck-pp-columns: every written column exists.')
