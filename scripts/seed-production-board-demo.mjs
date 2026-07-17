/**
 * Seed the Production board with a lifelike two-project demo (migration 056):
 * two builds that share the same 6-day task list but track separately — exactly
 * the "two use cases coming up for Production" scenario.
 *
 *   • Roster       — a few names so the pickers and crew tags have something.
 *   • Standing     — a couple of every-day duties (project_id null).
 *   • Acme Unit A  — the 6-day build, phased Day 1…Day 6, due dates on workdays.
 *   • Beta Unit B  — the same task list, no dates yet (a fresh duplicate).
 *
 * Idempotent: skips anything already present (projects by name, tasks by
 * project+phase+title, people by name). Also clears the OLD 055 single-list demo
 * (day labels that lived in the deprecated `project` text with no project_id) so
 * it doesn't linger as phantom standing duties.
 *
 * Remove the whole demo:  node scripts/seed-production-board-demo.mjs --clear
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const shopToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

function workdayOffset(startYmd, n) {
  const d = new Date(`${startYmd}T12:00:00Z`)
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return d.toISOString().slice(0, 10)
}

// Jacob's real build sequence, verbatim (capitalization only).
const PLAN = [
  ['Finish frame', 'Rotor', 'Outer react'],
  ['Finish outer react', 'Blockings', 'Cut inner skins'],
  ['Cut rest of inner skins', 'Ductwork', 'Build and install'],
  ['Insulate', 'Start outer skin'],
  ['Finish outer skin', 'Silicone'],
  ['Install control box', 'Complete vestibule', 'Paint'],
]

const ROSTER = ['Nate Lynch', 'James Pope', 'Lee Childers', 'Mia Torres']
const STANDING = [
  { title: 'Morning safety walk', detail: 'Walk your bay before the first cut.', cadence: 'daily' },
  { title: 'Sweep your bay at end of shift', cadence: 'daily' },
]
const PROJECTS = [
  { name: 'Acme Unit A', type: 'IDP-4000, dual-wheel', people: ['Nate Lynch', 'James Pope'], dated: true },
  { name: 'Beta Unit B', type: 'IDP-4000, dual-wheel', people: ['Lee Childers', 'Mia Torres'], dated: false },
]

const { data: dept, error: deptErr } = await sb
  .from('production_departments')
  .select('id, name, token')
  .eq('name', 'Production')
  .single()
if (deptErr || !dept) {
  console.error('Production department not found — has migration 055/056 been applied?', deptErr?.message)
  process.exit(1)
}

if (process.argv.includes('--clear')) {
  // Projects cascade their tasks away on delete (056 FK).
  await sb.from('production_projects').delete().eq('department_id', dept.id).in('name', PROJECTS.map((p) => p.name))
  await sb.from('production_tasks').delete().eq('department_id', dept.id).is('project_id', null).in('title', STANDING.map((s) => s.title))
  console.log('Cleared the Production two-project demo (projects, their tasks, and the seeded standing duties).')
  process.exit(0)
}

// ── Clean up the OLD 055 single-list demo, if it's still around ───────────────
// Those rows had the day label in the deprecated `project` text and no
// project_id, so post-056 they'd show as standing duties. Remove them.
const OLD_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6']
const { count: oldCount } = await sb
  .from('production_tasks')
  .delete({ count: 'exact' })
  .eq('department_id', dept.id)
  .is('project_id', null)
  .in('project', OLD_DAYS)
if (oldCount) console.log(`Cleared ${oldCount} legacy 055 day-tasks.`)

// ── Roster ───────────────────────────────────────────────────────────────────
{
  const { data: have } = await sb.from('production_people').select('name').eq('department_id', dept.id)
  const known = new Set((have ?? []).map((p) => p.name))
  let order = (have ?? []).length * 10
  for (const name of ROSTER) {
    if (known.has(name)) continue
    order += 10
    await sb.from('production_people').insert({ department_id: dept.id, name, sort_order: order })
  }
}

// ── Standing duties ──────────────────────────────────────────────────────────
{
  const { data: have } = await sb
    .from('production_tasks')
    .select('title')
    .eq('department_id', dept.id)
    .is('project_id', null)
    .is('archived_at', null)
  const known = new Set((have ?? []).map((t) => t.title))
  let order = 0
  for (const s of STANDING) {
    order += 10
    if (known.has(s.title)) continue
    await sb.from('production_tasks').insert({
      department_id: dept.id,
      title: s.title,
      detail: s.detail ?? null,
      cadence: s.cadence,
      sort_order: order,
    })
  }
}

// ── Projects + their task lists ──────────────────────────────────────────────
const start = shopToday()
let projOrder = 0
for (const spec of PROJECTS) {
  projOrder += 10

  let { data: project } = await sb
    .from('production_projects')
    .select('id')
    .eq('department_id', dept.id)
    .eq('name', spec.name)
    .is('archived_at', null)
    .maybeSingle()

  if (!project) {
    const { data: created, error } = await sb
      .from('production_projects')
      .insert({
        department_id: dept.id,
        name: spec.name,
        type: spec.type,
        people: spec.people,
        sort_order: projOrder,
      })
      .select('id')
      .single()
    if (error) { console.error(`create ${spec.name} failed:`, error.message); process.exit(1) }
    project = created
  }

  const { data: existing } = await sb
    .from('production_tasks')
    .select('phase, title')
    .eq('project_id', project.id)
    .is('archived_at', null)
  const have = new Set((existing ?? []).map((t) => `${t.phase}::${t.title}`))

  let sort = 0
  let inserted = 0
  for (let day = 0; day < PLAN.length; day++) {
    const phase = `Day ${day + 1}`
    const due = spec.dated ? workdayOffset(start, day) : null
    for (const title of PLAN[day]) {
      sort += 10
      if (have.has(`${phase}::${title}`)) continue
      const { error } = await sb.from('production_tasks').insert({
        department_id: dept.id,
        project_id: project.id,
        phase,
        title,
        cadence: 'once',
        due_date: due,
        sort_order: sort,
      })
      if (error) { console.error(`insert ${spec.name}/${phase}/${title} failed:`, error.message); process.exit(1) }
      inserted++
    }
  }
  console.log(`  ${spec.name.padEnd(14)} ${spec.type}  — ${inserted} tasks inserted${spec.dated ? ' (dated)' : ''}`)
  console.log(`     focused board: /board/${dept.token}?project=${project.id}`)
}

console.log(`\nDepartment board: /board/${dept.token}`)
console.log('Done. Both projects share the 6-day list; check off Acme without touching Beta.')
