/**
 * IAT Forms Portal — seed a REMOVABLE *test* org chart so the /org-chart and
 * employee /directory views show real branching without using real names.
 *
 * Placeholder names on the real job titles from the company org chart, wired
 * with manager_id. Inserts via the service role (no emails fire). Every row is
 * marked '@orgtest.iat.test' and removed by clear-orgchart-test.mjs.
 *
 * To keep the chart uncluttered it also HIDES existing employees from the chart
 * (sets org_visible = false — reversible; only affects the org-chart views, not
 * the legacy directory or any other feature). clear-orgchart-test.mjs restores
 * them. NOTE: org_visible is new and unused before this, so every real employee
 * was visible (default true) — the remover safely re-shows them all.
 *
 * Run with:    node scripts/seed-orgchart-test.mjs
 * Remove with: node scripts/clear-orgchart-test.mjs
 * ⚠️ Must be cleared before the org chart goes live (removes test rows + un-hides real staff).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const MARK = '@orgtest.iat.test'
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

// [test name, real title (from the chart), department, manager index | null]
const ROLES = [
  ['Avery Sloane',   'President',                       'Leadership',    null], // 0
  ['Morgan Reyes',   'Director of Operations',          'Leadership',    0],    // 1
  ['Jordan Mills',   'Director of Engineering',         'Engineering',   0],    // 2
  ['Casey Donovan',  'Inside Sales Manager',            'Sales',         0],    // 3
  ['Riley Frost',    'Marketing Team Lead',             'Marketing',     0],    // 4
  ['Sydney Vaughn',  'Director of Technology',          'Technology',    0],    // 5
  ['Dakota Pierce',  'Purchasing & Shipping Manager',   'Purchasing',    0],    // 6
  ['Reese Calloway', 'Production Manager',              'Production',    1],    // 7
  ['Emerson Wade',   'Field Service Manager',           'Field Service', 1],    // 8
  ['Alex Tran',      'Production Team',                 'Production',    7],    // 9
  ['Sam Ortiz',      'Production Team',                 'Production',    7],    // 10
  ['Drew Patel',     'Production Team',                 'Production',    7],    // 11
  ['Jamie Cole',     'Production Team',                 'Production',    7],    // 12
  ['Quinn Harper',   'Compact Assembly Tech',          'Production',    7],    // 13
  ['Devin Park',     'Electrical',                     'Production',    7],    // 14
  ['Cameron Reid',   'Electrical',                     'Production',    7],    // 15
  ['Logan Pruitt',   'Fabrication Team',               'Production',    7],    // 16
  ['Parker Lyle',    'Director of Engineering',         'Production',    7],    // 17 (duplicate title as drawn)
  ['Hayden Ross',    'Refrigeration Tech',             'Production',    7],    // 18
  ['Rowan Estes',    'Pressbrake Operator',            'Production',    7],    // 19
  ['Sage Bennett',   'Operations Support',             'Production',    7],    // 20
  ['Finley Marsh',   'Field Service Tech',             'Field Service', 8],    // 21
  ['Reagan Holt',    'OLA',                            'Field Service', 8],    // 22
  ['Marlowe Kent',   'SAA',                            'Field Service', 8],    // 23
  ['Sutton Blair',   'CAD Designer',                   'Engineering',   2],    // 24
  ['Emery Walsh',    'Mech Engineer',                  'Engineering',   2],    // 25
  ['Tatum Fields',   'Mech Engineer',                  'Engineering',   2],    // 26
  ['Kai Lawson',     'Elec Controls Eng',             'Engineering',   2],    // 27
  ['Blake Sutton',   'Inside Sales Representative',     'Sales',         3],    // 28
  ['Sloan Mercer',   'Multimedia Specialist',          'Marketing',     4],    // 29
  ['Reid Calhoun',   'Compact Team Lead',              'Technology',    5],    // 30
  ['Nico Barrett',   'Compact Assembly Tech',          'Technology',    30],   // 31
  ['Harlow Quinn',   'Inventory / Shipping',           'Purchasing',    6],    // 32
  ['Wren Sullivan',  'Inventory Assistant',            'Purchasing',    6],    // 33
]

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
  console.log('Clearing any stale test-org rows first…')
  await sb.from('employees').delete().like('email', '%' + MARK)
  const staleUsers = await deleteOrgtestAuthUsers()
  if (staleUsers) console.log(`  removed ${staleUsers} stale test auth users`)

  // Hide existing employees from the chart so only the test org shows (reversible).
  const { data: hidden, error: hideErr } = await sb
    .from('employees').update({ org_visible: false }).not('email', 'like', '%' + MARK).select('id')
  if (hideErr) console.log('  hide existing: ERR ' + hideErr.message)
  else console.log(`  hid ${hidden?.length ?? 0} existing employees from the chart (reversible)`)

  // Create an auth user per role (employees.id FK → auth.users), collect id map.
  const idMap = {}
  for (let i = 0; i < ROLES.length; i++) {
    const [name] = ROLES[i]
    const email = `${slug(name)}.${i}${MARK}`
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      password: 'OrgTest!' + randomUUID(),
      email_confirm: true,
      user_metadata: { org_test: true, name },
    })
    if (error || !created?.user) { console.log(`  auth err (${name}): ${error?.message}`); continue }
    idMap[i] = { id: created.user.id, email }
  }
  console.log(`created ${Object.keys(idMap).length}/${ROLES.length} test auth users`)

  // Insert employee rows (manager_id null first to satisfy the self-FK on insert).
  const empRows = ROLES.map(([name, title, dept], i) => idMap[i] && ({
    id: idMap[i].id, email: idMap[i].email, name, job_title: title, department: dept,
    is_admin: false, is_active: true, org_visible: true, manager_id: null,
  })).filter(Boolean)
  const { error: insErr } = await sb.from('employees').upsert(empRows, { onConflict: 'id' })
  console.log(insErr ? 'employees: ERR ' + insErr.message : `employees: inserted ${empRows.length}`)

  // Wire manager_id now that every row exists.
  let wired = 0
  for (let i = 0; i < ROLES.length; i++) {
    const mgr = ROLES[i][3]
    if (mgr == null || !idMap[i] || !idMap[mgr]) continue
    const { error } = await sb.from('employees').update({ manager_id: idMap[mgr].id }).eq('id', idMap[i].id)
    if (!error) wired++; else console.log(`  manager wire err (${ROLES[i][0]}): ${error.message}`)
  }
  console.log(`wired ${wired} reporting lines`)

  console.log('\nDone. View it on the org chart. Remove with:  node scripts/clear-orgchart-test.mjs')
}
run()
