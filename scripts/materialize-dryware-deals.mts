/**
 * One-time cutover + reusable: materialize the deals table from the current
 * projected_sales (DryWare) snapshot. Same function the sync route runs, so a
 * manual run here matches what every future sync does.
 *
 *   npx tsx scripts/materialize-dryware-deals.mts
 *
 * Reads projected_sales (already populated by the last DryWare sync), upserts
 * deals by dryware_key (DryWare owns facts, portal workflow preserved), prunes
 * projects that fell off the feed. Idempotent.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { materializeDealsFromProjectedSales } from '../lib/dryware-deals'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const stats = await materializeDealsFromProjectedSales(db)
console.log('Materialized deals from projected_sales:')
console.log(`  projects (deduped): ${stats.projects}`)
console.log(`  inserted:           ${stats.inserted}`)
console.log(`  updated:            ${stats.updated}`)
console.log(`  pruned (gone):      ${stats.pruned}`)
