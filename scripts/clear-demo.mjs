/**
 * IAT Forms Portal — remove ALL seeded demo data.
 * Run with: node scripts/clear-demo.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Demo rows are marked so they can be removed cleanly:
 *   equipment   → serial_number   LIKE 'DEMO-%'
 *   tickets     → ticket_number   LIKE 'DEMO-%'
 *   employees   → email           LIKE '%@demo.iat.test'
 *   submissions → data->>'__demo'  = 'true'
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

async function deleteDemoAuthUsers() {
  const ids = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    for (const u of data.users) if ((u.email || '').endsWith('@demo.iat.test')) ids.push(u.id)
    if (data.users.length < 200) break
  }
  for (const id of ids) await sb.auth.admin.deleteUser(id)
  return ids.length
}

async function run() {
  // submissions: marked in JSON data
  const { data: subs } = await sb.from('submissions').select('id, data').limit(10000)
  const demoSubIds = (subs || []).filter(s => s.data && s.data.__demo === true).map(s => s.id)
  if (demoSubIds.length) {
    const { error } = await sb.from('submissions').delete().in('id', demoSubIds)
    console.log(`submissions: removed ${demoSubIds.length}${error ? ' ERR ' + error.message : ''}`)
  } else console.log('submissions: 0 demo rows')

  // tickets
  {
    const { data, error } = await sb.from('tickets').delete().like('ticket_number', 'DEMO-%').select('id')
    console.log(`tickets: removed ${data?.length ?? 0}${error ? ' ERR ' + error.message : ''}`)
  }
  // equipment
  {
    const { data, error } = await sb.from('equipment').delete().like('serial_number', 'DEMO-%').select('id')
    console.log(`equipment: removed ${data?.length ?? 0}${error ? ' ERR ' + error.message : ''}`)
  }
  // employees (rows first, then their auth users)
  {
    const { data, error } = await sb.from('employees').delete().like('email', '%@demo.iat.test').select('id')
    console.log(`employees: removed ${data?.length ?? 0}${error ? ' ERR ' + error.message : ''}`)
  }
  const removedUsers = await deleteDemoAuthUsers()
  console.log(`auth users: removed ${removedUsers}`)
  console.log('Done.')
}
run()
