/**
 * IAT Forms Portal — seed REMOVABLE demo data so the admin list pages look
 * populated for design review. Inserts directly via the service role (NOT the
 * APIs), so no customer/staff emails fire and no accrual runs on insert.
 *
 * Run with:   node scripts/seed-demo.mjs
 * Remove with: node scripts/clear-demo.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Every row is marked (see clear-demo.mjs). ⚠️ Demo data must be cleared before go-live.
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

// ── helpers ───────────────────────────────────────────────────────────────────
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const rint = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo
const chance = (p) => Math.random() < p
const daysAgoISO = (d) => new Date(Date.now() - d * 864e5).toISOString()
const daysAgoDate = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

// Demo employees need an auth user (employees.id FK → auth.users). These are
// marked @demo.iat.test and removed by clear-demo.mjs.
async function deleteDemoAuthUsers(sb) {
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

const FIRST = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Karen','Chris','Sarah','Daniel','Nancy','Matthew','Lisa','Anthony','Betty','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Josh','Carol','Kenneth','Michelle','Kevin','Amanda','Brian','Melissa','George','Deborah','Ed','Stephanie','Ronald','Rebecca','Tim','Hector','Priya','Wei','Diego','Amara','Sven','Yusuf','Nadia','Omar']
const LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Patel','Okafor','Novak','Ahmed','Kowalski']
const COMPANIES = ['Cargill Foods','Tyson Fresh Meats','Nestlé Purina','Frito-Lay','General Mills','Kraft Heinz','Smithfield Foods','Pfizer','Eli Lilly','Merck Biologics','3M Industrial','Boeing Composites','Lockheed Martin','Owens Corning','Georgia-Pacific','International Paper','Coca-Cola Bottling','PepsiCo','Anheuser-Busch','Dairy Farmers of America','Land O\'Lakes','Hershey','Mars Wrigley','Conagra Brands','Hormel Foods','JBS USA','Perdue Farms','Sanderson Farms','Blue Diamond Growers','Ocean Spray']
const DEPTS = ['Field Services','QC & Production','Production','Sales & External','IT & Facilities','HR & Time Off','Engineering','Applications']
const TITLES = ['Field Service Technician','HVAC Technician','Senior Service Tech','Production Lead','QC Inspector','Assembly Technician','Sales Engineer','Account Manager','Applications Engineer','Controls Engineer','IT Administrator','Facilities Coordinator','HR Coordinator','Operations Manager','Project Engineer','Shipping Lead','Procurement Specialist','Warranty Administrator']
const MODELS = ['USR-200-R1','USR-200-15RPH','USR-400-8RPH','USR-100-STD','USR-100-LRG','IAT-1500-D','IAT-3000-D','IAT-DesiccantPro','HoneyComb-460','HoneyComb-230']
const VOLTS = ['230V','460V','575V','208V']
const PROBLEMS = [
  'Unit not reaching target dewpoint; reactivation heater cycling.',
  'High process outlet humidity after rotor seal replacement.',
  'Reactivation blower tripping on overload intermittently.',
  'Rotor not turning — suspect drive belt or motor failure.',
  'Purge section airflow imbalance; cassette pressure drop high.',
  'Control panel throwing E-04 sensor fault on startup.',
  'Condensate carryover into process supply ductwork.',
  'Desiccant wheel showing channeling / reduced capacity.',
  'Heater elements not energizing in reactivation circuit.',
  'VFD fault on process fan; unit shuts down after 20 min.',
  'Seals worn — air bypass between process and reactivation.',
  'Unit short-cycling; setpoint never satisfied.',
]
const FORM_NAMES = ['Accident Report','Time Off Request','Equipment Inspection','Start-Up Readiness Verification','Customer Visit Report','Expense Reimbursement','Safety Incident','Vehicle Mileage Log','New Hire Onboarding','Quality Hold Notice']

async function run() {
  console.log('Clearing any existing demo rows first…')
  // Inline clear (keep this script self-contained)
  const { data: oldSubs } = await sb.from('submissions').select('id, data').limit(10000)
  const oldDemo = (oldSubs || []).filter(s => s.data && s.data.__demo === true).map(s => s.id)
  if (oldDemo.length) await sb.from('submissions').delete().in('id', oldDemo)
  await sb.from('tickets').delete().like('ticket_number', 'DEMO-%')
  await sb.from('equipment').delete().like('serial_number', 'DEMO-%')
  await sb.from('employees').delete().like('email', '%@demo.iat.test')
  const removedUsers = await deleteDemoAuthUsers(sb)
  if (removedUsers) console.log(`  removed ${removedUsers} stale demo auth users`)

  // Reference real forms (for submission FK + realistic titles)
  const { data: forms } = await sb.from('forms').select('id, title').limit(40)
  const formPool = (forms || []).length ? forms : [{ id: null, title: 'Accident Report' }]

  // ── Employees (auth user + employee row) ─────────────────────────────────────
  const empRows = []
  const usedEmail = new Set()
  for (let i = 0; i < 25; i++) {
    const first = pick(FIRST), last = pick(LAST)
    let email = `${slug(first + ' ' + last)}@demo.iat.test`
    while (usedEmail.has(email)) email = `${slug(first + ' ' + last)}.${rint(1, 99)}@demo.iat.test`
    usedEmail.add(email)
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: 'Demo!' + randomUUID(),
      email_confirm: true,
      user_metadata: { demo: true, name: `${first} ${last}` },
    })
    if (authErr || !created?.user) { console.log('  auth user err:', authErr?.message); continue }
    empRows.push({
      id: created.user.id,
      name: `${first} ${last}`,
      email,
      job_title: pick(TITLES),
      department: pick(DEPTS),
      phone: `(${rint(200, 989)}) ${rint(200, 989)}-${rint(1000, 9999)}`,
      pto_balance: rint(0, 160),
      sick_balance: rint(0, 80),
      pto_accrual_rate: pick([1.54, 2.31, 3.08, 3.85]),
      sick_accrual_rate: 1.54,
      hire_date: daysAgoDate(rint(120, 4200)),
      is_admin: false,
      is_active: chance(0.88),
    })
  }
  // upsert in case an auth trigger pre-creates the employee row
  const { data: insertedEmps, error: empErr } = await sb.from('employees').upsert(empRows, { onConflict: 'id' }).select('id')
  if (empErr) console.log('employees: ERR ' + empErr.message)
  else console.log(`employees: inserted ${insertedEmps.length} (with auth users)`)

  // Owner pool = real employees + demo employees (for the ticket Assignee column)
  const { data: realEmps } = await sb.from('employees').select('id').not('email', 'like', '%@demo.iat.test').limit(10)
  const ownerPool = [...(realEmps || []).map(e => e.id), ...((insertedEmps || []).map(e => e.id))]

  // ── Equipment ────────────────────────────────────────────────────────────────
  const eqRows = []
  for (let i = 0; i < 45; i++) {
    const company = pick(COMPANIES)
    // ship_date: mix of recent (in warranty), old (out), and null (no date)
    const shipRoll = Math.random()
    const ship = shipRoll < 0.45 ? daysAgoDate(rint(20, 330))   // in warranty (<12mo)
               : shipRoll < 0.85 ? daysAgoDate(rint(400, 2600)) // out of warranty
               : null                                            // no date
    eqRows.push({
      serial_number: `DEMO-${rint(2019, 2025)}-${String(rint(1, 9999)).padStart(4, '0')}`,
      model_number: pick(MODELS),
      voltage: pick(VOLTS),
      customer_company: company,
      customer_name: `${pick(FIRST)} ${pick(LAST)}`,
      customer_email: `${slug(company)}@demo.iat.test`,
      ship_date: ship,
      warranty_months: 12,
      status: chance(0.92) ? 'active' : 'decommissioned',
    })
  }
  const { error: eqErr } = await sb.from('equipment').insert(eqRows)
  console.log(eqErr ? 'equipment: ERR ' + eqErr.message : `equipment: inserted ${eqRows.length}`)

  // ── Tickets ──────────────────────────────────────────────────────────────────
  const tkRows = []
  for (let i = 0; i < 50; i++) {
    const company = pick(COMPANIES)
    const cust = `${pick(FIRST)} ${pick(LAST)}`
    tkRows.push({
      ticket_number: `DEMO-${String(1000 + i)}`,
      customer_name: cust,
      customer_company: company,
      customer_email: `${slug(cust)}@demo.iat.test`,
      customer_phone: `(${rint(200, 989)}) ${rint(200, 989)}-${rint(1000, 9999)}`,
      serial_number: `DEMO-${rint(2019, 2025)}-${String(rint(1, 9999)).padStart(4, '0')}`,
      model_number: pick(MODELS),
      voltage: pick(VOLTS),
      problem_description: pick(PROBLEMS),
      status: pick(['open', 'open', 'in_progress', 'in_progress', 'resolved', 'resolved', 'closed']),
      priority: pick(['low', 'med', 'med', 'high', 'high']),
      owner_id: chance(0.7) && ownerPool.length ? pick(ownerPool) : null,
      created_at: daysAgoISO(rint(0, 75)),
    })
  }
  const { error: tkErr } = await sb.from('tickets').insert(tkRows)
  console.log(tkErr ? 'tickets: ERR ' + tkErr.message : `tickets: inserted ${tkRows.length}`)

  // ── Submissions ──────────────────────────────────────────────────────────────
  const subRows = []
  for (let i = 0; i < 60; i++) {
    const first = pick(FIRST), last = pick(LAST)
    const form = pick(formPool)
    subRows.push({
      form_id: form.id,
      form_title: form.title || pick(FORM_NAMES),
      submitted_at: daysAgoISO(rint(0, 60)),
      is_read: chance(0.6),
      status: pick(['open', 'open', 'open', 'in_progress', 'resolved']),
      data: {
        __demo: true,
        'Employee Name': `${first} ${last}`,
        'Employee Email': `${slug(first + ' ' + last)}@demo.iat.test`,
        'Notes': pick(['Submitted from the shop floor.', 'Follow-up needed.', 'Routine submission.', 'Flagged for review.', '']),
      },
    })
  }
  let subErr = (await sb.from('submissions').insert(subRows)).error
  if (subErr && /form_id/.test(subErr.message)) {
    // Retry without form_id if the column/FK rejects it
    subErr = (await sb.from('submissions').insert(subRows.map(({ form_id, ...r }) => r)).then(r => r)).error
  }
  console.log(subErr ? 'submissions: ERR ' + subErr.message : `submissions: inserted ${subRows.length}`)

  console.log('\nDone. Remove anytime with:  node scripts/clear-demo.mjs')
}
run()
