/**
 * IAT Forms Portal — seed the org-chart EXAMPLE: the real names + titles from the
 * company org chart, wired into a hierarchy via manager_id, so the /admin/org-chart
 * and employee /directory views show the real structure.
 *
 * Emails are PLACEHOLDERS (slug@orgtest.iat.test) — the real team isn't onboarded
 * yet; real emails/logins get added later. The app hides @*.iat.test emails so no
 * fake contact info shows. Every row is marked '@orgtest.iat.test' and is removable
 * with clear-orgchart-test.mjs (which also un-hides any pre-existing employees).
 *
 * Inserts via the service role (no emails fire). To keep the chart clean it also
 * sets org_visible=false on pre-existing employees (leftover demo rows) so only
 * this org shows. org_visible was unused before, so the remover safely re-shows them.
 *
 * Run with:    node scripts/seed-orgchart-test.mjs
 * Remove with: node scripts/clear-orgchart-test.mjs
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

// Real names + titles from the company org chart. [name, title, department, manager index | null]
const ROLES = [
  ['Kacy Orr',      'President',                       'Leadership',    null], // 0
  ['Crystal Hill',  'Director of Operations',          'Leadership',    0],    // 1
  ['James Pope',    'Director of Engineering',         'Engineering',   0],    // 2
  ['Jacob Reagan',  'Inside Sales Manager',            'Sales',         0],    // 3
  ['Jacob Younker', 'Marketing Team Lead',             'Marketing',     0],    // 4
  ['Lee C',         'Director of Technology',          'Technology',    0],    // 5
  ['Chris H',       'Purchasing & Shipping Manager',   'Purchasing',    0],    // 6
  ['Devon Morgan',  'Production Manager',              'Production',    1],    // 7
  ['Andy S',        'Field Service Manager',           'Field Service', 1],    // 8
  ['Aslan',         'Production Team',                 'Production',    7],    // 9
  ['Jarrad R',      'Production Team',                 'Production',    7],    // 10
  ['Bill J',        'Production Team',                 'Production',    7],    // 11
  ['Jordan',        'Production Team',                 'Production',    7],    // 12
  ['Chris G',       'Compact Assembly Tech',          'Production',    7],    // 13
  ['Jeremy R',      'Electrical',                     'Production',    7],    // 14
  ['Clay',          'Electrical',                     'Production',    7],    // 15
  ['Kyle D',        'Fabrication Team',               'Production',    7],    // 16
  ['Chris M',       'Director of Engineering',         'Production',    7],    // 17 (as drawn — duplicate title)
  ['Wyant',         'Refrigeration Tech',             'Production',    7],    // 18
  ['Wayne',         'Pressbrake Operator',            'Production',    7],    // 19
  ['Steve M',       'Operations Support',             'Production',    7],    // 20
  ['Joseph J',      'Field Service Tech',             'Field Service', 8],    // 21
  ['Robin L',       'OLA',                            'Field Service', 8],    // 22
  ['Jo E',          'SAA',                            'Field Service', 8],    // 23
  ['Eli K',         'CAD Designer',                   'Engineering',   2],    // 24
  ['Rob B',         'Mech Engineer',                  'Engineering',   2],    // 25
  ['Austin F',      'Mech Engineer',                  'Engineering',   2],    // 26
  ['Ahson K',       'Elec Controls Eng',             'Engineering',   2],    // 27
  ['Mike Payton',   'Inside Sales Representative',     'Sales',         3],    // 28
  ['Tyler Bell',    'Multimedia Specialist',          'Marketing',     4],    // 29
  ['Chris M',       'Compact Team Lead',              'Technology',    5],    // 30 (separate box from #17)
  ['Nate',          'Compact Assembly Tech',          'Technology',    30],   // 31
  ['Tommy H',       'Inventory / Shipping',           'Purchasing',    6],    // 32
  ['Kyle R',        'Inventory Assistant',            'Purchasing',    6],    // 33
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
  console.log('Clearing any prior org-chart seed rows first…')
  await sb.from('employees').delete().like('email', '%' + MARK)
  const staleUsers = await deleteOrgtestAuthUsers()
  if (staleUsers) console.log(`  removed ${staleUsers} prior seed auth users`)

  // Hide pre-existing employees from the chart so only this org shows (reversible).
  const { data: hidden, error: hideErr } = await sb
    .from('employees').update({ org_visible: false }).not('email', 'like', '%' + MARK).select('id')
  if (hideErr) console.log('  hide existing: ERR ' + hideErr.message)
  else console.log(`  hid ${hidden?.length ?? 0} pre-existing employees from the chart (reversible)`)

  // Create an auth user per role (employees.id FK → auth.users), collect id map.
  const idMap = {}
  for (let i = 0; i < ROLES.length; i++) {
    const [name] = ROLES[i]
    const email = `${slug(name)}.${i}${MARK}`
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      password: 'OrgSeed!' + randomUUID(),
      email_confirm: true,
      user_metadata: { org_seed: true, name },
    })
    if (error || !created?.user) { console.log(`  auth err (${name}): ${error?.message}`); continue }
    idMap[i] = { id: created.user.id, email }
  }
  console.log(`created ${Object.keys(idMap).length}/${ROLES.length} auth users`)

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

  console.log('\nDone. Remove with:  node scripts/clear-orgchart-test.mjs')
}
run()
