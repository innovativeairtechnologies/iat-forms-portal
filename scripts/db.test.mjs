#!/usr/bin/env node
/* Offline checks for scripts/db.mjs — the parts that decide WHAT gets applied.
 *
 * These need no database, which is the point: the version parsing and the hold
 * list are what stand between "apply migration 100" and "replay every file in
 * the folder", and they should be verifiable without a password in hand.
 *
 * Run: node scripts/db.test.mjs
 */

import fs from 'fs'
import path from 'path'
import { localMigrations, HOLD } from './db.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
let pass = 0, fail = 0
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        got: ${JSON.stringify(got)}`) }
}

const found = localMigrations()
const files = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter(f => f.endsWith('.sql'))

console.log('-- version parsing --')
ok('finds migrations at all', found.length > 50, found.length)
ok('every entry has a numeric version', found.every(m => /^\d+$/.test(m.version)), found.filter(m => !/^\d+$/.test(m.version)))

/* 🔴 The 015a–015f files must be IGNORED. The CLI has always skipped them
 * ("file name must match pattern") and they are long since applied; treating
 * them as pending would replay six migrations against a live database. */
const lettered = files.filter(f => /^\d+[a-z]_/.test(f))
ok('there ARE lettered files to be careful about', lettered.length > 0, lettered)
ok('none of the lettered files is treated as a migration',
  !found.some(m => lettered.includes(m.file)), found.filter(m => lettered.includes(m.file)).map(m => m.file))

console.log('\n-- ordering --')
const versions = found.map(m => m.version)
const sorted = [...versions].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
ok('returned in ascending version order', JSON.stringify(versions) === JSON.stringify(sorted), versions.slice(0, 5))
ok('099 sorts after 098, not before', versions.indexOf('099') > versions.indexOf('098'), null)
ok('100 would sort after 099 (numeric, not lexical)',
  ['098', '099', '100'].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join() === '098,099,100', null)

console.log('\n-- the hold list --')
ok('093 is held', Boolean(HOLD['093']), Object.keys(HOLD))
ok('the hold carries a reason, not just a flag', (HOLD['093'] ?? '').length > 30, HOLD['093'])
const held093 = found.find(m => m.version === '093')
ok('093 has a real file behind it (a stale hold would be worse than none)',
  Boolean(held093), found.map(m => m.version).filter(v => v.startsWith('09')))

console.log('\n-- duplicates --')
const dupes = versions.filter((v, i) => versions.indexOf(v) !== i)
ok('no two files claim the same version', dupes.length === 0, dupes)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
