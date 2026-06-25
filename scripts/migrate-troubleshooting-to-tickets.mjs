/**
 * IAT Forms Portal — migrate legacy `troubleshooting_intakes` rows into `tickets`.
 *
 * Background: the customer "Troubleshooting Checklist" was merged into the Equipment
 * Support form (one pipeline → `tickets`). The old intakes were left in their own
 * table. This backfills them into `tickets` so they show in the unified queue.
 *
 * Mapping is lossless — migration 027 made the two tables shape-compatible. Each
 * intake's original `TSC-…` reference becomes the ticket_number, which makes this:
 *   - idempotent  → an intake whose TSC- ref already exists in tickets is skipped
 *   - reversible  → undo with: DELETE FROM tickets WHERE ticket_number LIKE 'TSC-%'
 *   - traceable   → the TSC- prefix flags the origin in the queue
 * The source `troubleshooting_intakes` rows are LEFT IN PLACE as a backup (retire
 * the table in a later cleanup once the migration is confirmed).
 *
 * DRY RUN BY DEFAULT — prints what it would do and writes nothing.
 *   node scripts/migrate-troubleshooting-to-tickets.mjs            # dry run
 *   node scripts/migrate-troubleshooting-to-tickets.mjs --commit   # actually insert
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const COMMIT = process.argv.includes('--commit')

// troubleshooting status → ticket status
const STATUS_MAP = { new: 'open', reviewed: 'in_progress', closed: 'closed' }

const arrOrNull = (v) => (Array.isArray(v) && v.length ? v : null)

// Map one troubleshooting_intakes row → a tickets insert row. Mirrors the column
// set that app/api/tickets/route.ts inserts (so no required column is missed);
// fields the checklist never captured are null, brand defaults to 'iat'.
function toTicket(t) {
  return {
    ticket_number: t.reference_number,              // keep the TSC-… ref as-is
    customer_name: t.customer_name,
    customer_company: t.customer_company || null,
    customer_email: t.customer_email,
    customer_phone: t.customer_phone || null,
    serial_number: t.serial_number,
    model_number: t.model_number || null,
    voltage: t.voltage || null,
    problem_description: t.problem_description,
    // cooling / airflow-balance / react-heat / seals_good: never captured by the checklist
    pre_cooling: null, pre_cooling_type: null, pre_cooling_working: null,
    post_cooling: null, post_cooling_type: null, post_cooling_working: null,
    airflow_balanced: null,
    process_airflow_cfm: t.process_airflow_cfm || null,
    react_airflow_cfm: t.react_airflow_cfm || null,
    react_heat_working: null, react_heat_setpoint: null,
    react_temp_f: t.react_temp_f || null,
    seals_good: null,
    // merged-in checklist fields (migration 027)
    problem_started: t.problem_started || null,
    onset: t.onset || null,
    what_changed: t.what_changed || null,
    unit_running: typeof t.unit_running === 'boolean' ? t.unit_running : null,
    has_alarms: typeof t.has_alarms === 'boolean' ? t.has_alarms : null,
    alarm_details: t.alarm_details || null,
    wheel_rotating: t.wheel_rotating || null,
    seal_light_leakage: t.seal_light_leakage || null,
    external_factors: arrOrNull(t.external_factors),
    photo_urls: arrOrNull(t.photo_urls),
    ai_recommendations: arrOrNull(t.ai_recommendations),
    viewed_kb_articles: null,
    brand: 'iat',
    status: STATUS_MAP[t.status] || 'open',
    priority: 'med',
    created_at: t.created_at,                        // preserve the original timeline
  }
}

async function run() {
  console.log(`\n=== Migrate troubleshooting_intakes → tickets  (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`)

  const { data: intakes, error: e1 } = await sb
    .from('troubleshooting_intakes').select('*').order('created_at', { ascending: true })
  if (e1) { console.error('Failed to read troubleshooting_intakes:', e1.message); process.exit(1) }

  console.log(`troubleshooting_intakes rows: ${intakes.length}`)
  if (!intakes.length) { console.log('Nothing to migrate. Done.'); return }

  // status breakdown
  const byStatus = intakes.reduce((m, t) => ((m[t.status] = (m[t.status] || 0) + 1), m), {})
  console.log('  by status:', JSON.stringify(byStatus))

  // already migrated? (idempotency) — match on the preserved TSC- ticket_number
  const refs = intakes.map(t => t.reference_number)
  const { data: existing, error: e2 } = await sb
    .from('tickets').select('ticket_number').in('ticket_number', refs)
  if (e2) { console.error('Failed to check existing tickets:', e2.message); process.exit(1) }
  const already = new Set((existing || []).map(r => r.ticket_number))

  const todo = intakes.filter(t => !already.has(t.reference_number))
  console.log(`already in tickets (skip): ${already.size}`)
  console.log(`to migrate: ${todo.length}\n`)
  if (!todo.length) { console.log('All intakes already migrated. Done.'); return }

  // sample preview (first row, mapped)
  console.log('--- sample mapped ticket (first to migrate) ---')
  const sample = toTicket(todo[0])
  console.log(JSON.stringify(sample, null, 2))
  console.log('--- end sample ---\n')

  if (!COMMIT) {
    console.log(`DRY RUN — would insert ${todo.length} ticket(s). Re-run with --commit to write.`)
    return
  }

  let ok = 0, fail = 0
  for (const t of todo) {
    const { error } = await sb.from('tickets').insert(toTicket(t))
    if (error) { fail++; console.error(`  FAIL ${t.reference_number}: ${error.message}`) }
    else { ok++; console.log(`  ok   ${t.reference_number}  (${t.status} → ${STATUS_MAP[t.status] || 'open'})`) }
  }
  console.log(`\nInserted ${ok} ticket(s); ${fail} failed.`)
  console.log('Source troubleshooting_intakes left intact as backup.')
  console.log('Undo with: DELETE FROM tickets WHERE ticket_number LIKE \'TSC-%\';')
}
run()
