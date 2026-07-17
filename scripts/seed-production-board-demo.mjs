/**
 * Seed the Production board with Jacob's real 6-day unit-build sequence
 * (2026-07-17) so the team sees a lifelike board, not lorem ipsum.
 *
 * The board groups by `project`, so each day is a project group ("Day 1" …
 * "Day 6") — that mirrors how the plan was written and how the floor reads it.
 * `due_date` carries the actual calendar day (workdays only, weekend skipped),
 * so tasks age into the Overdue pill honestly as the week goes on.
 *
 * Idempotent: skips any task whose (department, project, title) already exists,
 * so re-running never duplicates. Remove the demo with:
 *   node scripts/seed-production-board-demo.mjs --clear
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

// Day 1 = the shop-local date this is seeded; days advance over WORKDAYS only
// (a 6-day build plan means six days on the floor, not a Saturday shift).
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

// Jacob's list, verbatim wording (capitalization only).
const PLAN = [
  ['Finish frame', 'Rotor', 'Outer react'],
  ['Finish outer react', 'Blockings', 'Cut inner skins'],
  ['Cut rest of inner skins', 'Ductwork', 'Build and install'],
  ['Insulate', 'Start outer skin'],
  ['Finish outer skin', 'Silicone'],
  ['Install control box', 'Complete vestibule', 'Paint'],
]

const { data: dept, error: deptErr } = await sb
  .from('production_departments')
  .select('id, name, token')
  .eq('name', 'Production')
  .single()
if (deptErr || !dept) {
  console.error('Production department not found — has migration 055 been applied?', deptErr?.message)
  process.exit(1)
}

if (process.argv.includes('--clear')) {
  const projects = PLAN.map((_, i) => `Day ${i + 1}`)
  const { error } = await sb
    .from('production_tasks')
    .delete()
    .eq('department_id', dept.id)
    .in('project', projects)
  if (error) { console.error('clear failed:', error.message); process.exit(1) }
  console.log('Cleared the Day 1–6 demo tasks from the Production board.')
  process.exit(0)
}

const { data: existing } = await sb
  .from('production_tasks')
  .select('project, title')
  .eq('department_id', dept.id)
  .is('archived_at', null)
const have = new Set((existing ?? []).map((t) => `${t.project}::${t.title}`))

const start = shopToday()
let inserted = 0, skipped = 0, sort = 0
for (let day = 0; day < PLAN.length; day++) {
  const project = `Day ${day + 1}`
  const due = workdayOffset(start, day)
  for (const title of PLAN[day]) {
    sort += 10
    if (have.has(`${project}::${title}`)) { skipped++; continue }
    const { error } = await sb.from('production_tasks').insert({
      department_id: dept.id,
      title,
      project,
      cadence: 'once',
      priority: 'normal',
      due_date: due,
      sort_order: sort,
    })
    if (error) { console.error(`insert failed (${project} / ${title}):`, error.message); process.exit(1) }
    inserted++
  }
  console.log(`  ${project}  due ${due}  — ${PLAN[day].join(', ')}`)
}

console.log(`\n${inserted} inserted, ${skipped} already present (idempotent skip).`)
console.log(`Board: /board/${dept.token}`)
