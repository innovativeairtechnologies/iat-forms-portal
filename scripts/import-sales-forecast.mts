/**
 * IAT Forms Portal — one-off backfill: load a monday.com "Sales Forecasting"
 * export into the `deals` table using the SAME parser the in-app importer
 * uses (lib/deals-import.ts), so script and app can never drift.
 *
 *   npx tsx scripts/import-sales-forecast.mts <file.xlsx>            # dry run
 *   npx tsx scripts/import-sales-forecast.mts <file.xlsx> --commit   # replace board
 *
 * Replace semantics on commit (the export is the whole board). The ongoing
 * path is the in-app "Import from Excel" on /admin/deals — this script exists
 * for the initial backfill and emergencies only.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseSalesForecastXlsx } from '../lib/deals-import'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fileArg = process.argv[2]
const commit = process.argv.includes('--commit')
if (!fileArg) {
  console.error('Usage: npx tsx scripts/import-sales-forecast.mts <file.xlsx> [--commit]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const buf = readFileSync(resolve(fileArg))
const parsed = parseSalesForecastXlsx(new Uint8Array(buf).buffer)

const money = (n: number) => '$' + Math.round(n).toLocaleString()

console.log(`Parsed "${parsed.sheetName}": ${parsed.deals.length} deals in ${parsed.groups.length} groups\n`)
for (const g of parsed.groups) {
  console.log(`  ${g.name.padEnd(10)} ${String(g.count).padStart(4)} deals  ${money(g.totalCost).padStart(14)}  (${money(g.weighted)} weighted)`)
}
const totalCost = parsed.deals.reduce((a, d) => a + d.total_cost, 0)
const totalWeighted = parsed.deals.reduce((a, d) => a + d.total_cost * (d.confidence / 100), 0)
console.log(`  ${'TOTAL'.padEnd(10)} ${String(parsed.deals.length).padStart(4)} deals  ${money(totalCost).padStart(14)}  (${money(totalWeighted)} weighted)`)

if (parsed.warnings.length) {
  console.log(`\nWarnings (${parsed.warnings.length}):`)
  parsed.warnings.forEach((w) => console.log('  ⚠ ' + w))
}

const { count: existing } = await db.from('deals').select('*', { count: 'exact', head: true })
console.log(`\nDeals currently in the table: ${existing ?? 0}`)

if (!commit) {
  console.log('\nDRY RUN — nothing written. Re-run with --commit to REPLACE the board with the rows above.')
  process.exit(0)
}

console.log(`\nREPLACING board: deleting ${existing ?? 0} existing deals…`)
const { error: delErr } = await db.from('deals').delete().gte('created_at', '1970-01-01')
if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1) }

let inserted = 0
for (let i = 0; i < parsed.deals.length; i += 200) {
  const chunk = parsed.deals.slice(i, i + 200)
  const { error } = await db.from('deals').insert(chunk)
  if (error) { console.error(`Insert failed at row ${inserted}:`, error.message); process.exit(1) }
  inserted += chunk.length
  console.log(`  inserted ${inserted}/${parsed.deals.length}`)
}

await db.from('audit_log').insert({
  actor_id: null,
  actor_name: 'import-sales-forecast script',
  action: 'deal.import',
  entity_type: 'deal',
  entity_id: null,
  summary: `Imported ${inserted} deals from "${fileArg.split(/[\\/]/).pop()}" (replace, replaced ${existing ?? 0} existing) — ${parsed.groups.map((g) => `${g.name} ${g.count}`).join(', ')}`,
  metadata: { file: fileArg.split(/[\\/]/).pop(), mode: 'replace', inserted, replaced: existing ?? 0, groups: parsed.groups },
})

console.log(`\nDone. ${inserted} deals imported.`)
