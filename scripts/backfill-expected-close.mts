/**
 * IAT Forms Portal — one-off backfill (CRM Phase 1, migration 061): parse the
 * free-text `projected` column ("Q4 2025", "July 2025", "2028", "7.15.24") into
 * the new `expected_close` date column. Unparseable or blank text stays NULL;
 * `projected` itself is never modified. Only fills deals where expected_close
 * is still NULL, so re-running never clobbers hand-set dates.
 *
 *   npx tsx scripts/backfill-expected-close.mts            # dry run
 *   npx tsx scripts/backfill-expected-close.mts --commit
 *
 * Date policy (mirrors lib/deals.ts projectedBuckets' parsing, resolved to a
 * concrete day): explicit m/d/y → that date · month+year → 1st of the month ·
 * quarter → 1st of the quarter's last month · bare year → June 30.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const commit = process.argv.includes('--commit')

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const MONTHS_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
const MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Free-text projected → YYYY-MM-DD, or null when unparseable. */
function parseProjected(p: string): string | null {
  const t = p.trim()
  if (!t) return null

  const q = t.match(/\bQ([1-4])\s*[' ]?(\d{2,4})\b/i)
  if (q) {
    const y = q[2].length === 2 ? 2000 + Number(q[2]) : Number(q[2])
    return iso(y, Number(q[1]) * 3, 1) // last month of the quarter
  }
  const mdY = t.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/)
  if (mdY) {
    const y = mdY[3].length === 2 ? 2000 + Number(mdY[3]) : Number(mdY[3])
    const m = Math.min(12, Math.max(1, Number(mdY[1])))
    const d = Math.min(28, Math.max(1, Number(mdY[2]))) // clamp — never a fake Feb 31
    return iso(y, m, d)
  }
  const mo = t.match(MONTHS_RE)
  const yr = t.match(/\b(20\d{2})\b/)
  if (mo && yr) return iso(Number(yr[1]), MONTH_NUM[mo[1].slice(0, 3).toLowerCase()], 1)
  if (/^\s*20\d{2}\s*$/.test(t)) return iso(Number(t.trim()), 6, 30)
  return null
}

const { data: deals, error } = await db
  .from('deals')
  .select('id, customer, projected, expected_close')
  .is('expected_close', null)
  .not('projected', 'is', null)
if (error) { console.error(error.message); process.exit(1) }

const parsed: { id: string; customer: string; projected: string; date: string }[] = []
const skipped: { customer: string; projected: string }[] = []
for (const d of deals ?? []) {
  const date = parseProjected(d.projected as string)
  if (date) parsed.push({ id: d.id, customer: d.customer, projected: d.projected, date })
  else skipped.push({ customer: d.customer, projected: d.projected })
}

console.log(`${deals?.length ?? 0} deals with projected text and no expected_close`)
console.log(`  parseable:   ${parsed.length}`)
console.log(`  unparseable: ${skipped.length}\n`)
for (const p of parsed.slice(0, 15)) console.log(`  ✓ ${p.customer.slice(0, 32).padEnd(34)} "${p.projected}" → ${p.date}`)
if (parsed.length > 15) console.log(`  … and ${parsed.length - 15} more`)
if (skipped.length) {
  console.log('\nLeft NULL (eyeball these):')
  for (const s of skipped) console.log(`  ✗ ${s.customer.slice(0, 32).padEnd(34)} "${s.projected}"`)
}

if (!commit) {
  console.log('\nDry run — re-run with --commit to write expected_close.')
  process.exit(0)
}

let written = 0
for (const p of parsed) {
  const { error: upErr } = await db.from('deals').update({ expected_close: p.date }).eq('id', p.id)
  if (upErr) console.error(`  failed ${p.customer}: ${upErr.message}`)
  else written++
}
console.log(`\nWrote expected_close on ${written}/${parsed.length} deals.`)
