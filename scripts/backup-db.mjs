#!/usr/bin/env node
/**
 * Off-Supabase logical backup of the linked project.
 *
 * Writes a timestamped schema + data dump under ./backups (GITIGNORED — dumps
 * contain live customer data and this is a PUBLIC repo, so they must NEVER be
 * committed). This is redundancy ON TOP of Supabase's managed daily backups /
 * PITR (see docs/backup-restore.md) — a portable copy you control.
 *
 * Usage:  node scripts/backup-db.mjs
 * Needs:  the Supabase CLI linked (npx supabase link), the DB password available
 *         (set SUPABASE_DB_PASSWORD, or run once interactively), AND Docker
 *         Desktop running — `supabase db dump` runs pg_dump in a container to
 *         match the server's Postgres version. No Docker? Run a native pg_dump
 *         against the pooler connection string instead (see docs/backup-restore.md).
 *         Note: Layer 1 (Supabase managed backups + PITR) is the primary — this
 *         dump is belt-and-suspenders.
 *
 * Restore + restore-test steps: docs/backup-restore.md
 */
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // 2026-07-22T14-30-00
const dir = join('backups', stamp)
mkdirSync(dir, { recursive: true })

const dump = (args, outFile) => {
  const out = join(dir, outFile)
  const cmd = `npx --yes supabase db dump --linked ${args} -f "${out}"`
  console.log(`  ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

console.log(`\nBacking up the linked Supabase project → ${dir}\n`)
dump('', 'schema.sql') // roles + schema (default)
dump('--data-only', 'data.sql') // table data
console.log(`\n✓ Backup written to ${dir}`)
console.log(`  Store it somewhere safe — do NOT commit it. Restore: docs/backup-restore.md\n`)
