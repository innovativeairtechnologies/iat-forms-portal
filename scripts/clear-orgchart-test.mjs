/**
 * IAT Forms Portal — remove the test org chart seeded by seed-orgchart-test.mjs
 * and restore the real employees to the chart.
 *
 * Run with: node scripts/clear-orgchart-test.mjs
 *
 * Test rows are marked  employees.email LIKE '%@orgtest.iat.test'  (+ their auth
 * users). Real employees that the seed hid (org_visible = false) are re-shown —
 * safe because org_visible was unused/true before the seed.
 * ⚠️ Run this before the org chart goes to production.
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

const MARK = '@orgtest.iat.test'

async function deleteOrgtestAuthUsers() {
  const ids = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    for (const u of data.users) if ((u.email || '').endsWith(MARK)) ids.push(u.id)
    if (data.users.length < 200) break
  }
  for (const id of ids) await sb.auth.admin.deleteUser(id)
  return ids.length
}

async function run() {
  const { data: removed, error: delErr } = await sb
    .from('employees').delete().like('email', '%' + MARK).select('id')
  console.log(`employees: removed ${removed?.length ?? 0}${delErr ? ' ERR ' + delErr.message : ''}`)

  const removedUsers = await deleteOrgtestAuthUsers()
  console.log(`auth users: removed ${removedUsers}`)

  // Re-show the real employees the seed hid.
  const { data: restored, error: resErr } = await sb
    .from('employees').update({ org_visible: true }).not('email', 'like', '%' + MARK).select('id')
  console.log(`employees re-shown: ${restored?.length ?? 0}${resErr ? ' ERR ' + resErr.message : ''}`)

  console.log('Done.')
}
run()
