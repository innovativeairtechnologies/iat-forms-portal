/**
 * Update the Performance Review form's data to match the 2026-06 changes.
 * RUN MIGRATION 028 FIRST (adds form_fields.show_when_field / show_when_value).
 *
 *   Dry-run:  node scripts/update-performance-review.mjs
 *   Apply:    node scripts/update-performance-review.mjs --commit
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotent. Does three things:
 *   1. Removes the 5 first-page / doc fields (position title, supervisor name,
 *      review period, position description, position description document).
 *   2. Swaps every rating field's options to Superstar / Rockstar / Star / Performer.
 *   3. Gates each Department-Specific field to show only for its Department
 *      (show_when_field = 'Department', show_when_value = the dept).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim())),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const COMMIT = process.argv.includes('--commit')
const NEW_SCALE = ['Superstar', 'Rockstar', 'Star', 'Performer']
const REMOVE_LABELS = [
  'Position Title',
  'Supervisor Name',
  'Review Period',
  'Position Description',
  'Position Description Document',
]
const DEPTS = ['Office', 'Engineering', 'Sales', 'Marketing', 'Production', 'Management']

function detectDept(label) {
  const L = label.toLowerCase()
  for (const d of DEPTS) if (L.includes(d.toLowerCase())) return d
  return null
}

async function main() {
  console.log(COMMIT ? '— APPLYING changes —\n' : '— DRY RUN (pass --commit to apply) —\n')

  const { data: forms, error: fe } = await supabase
    .from('forms')
    .select('id, title')
    .ilike('title', '%performance review%')
  if (fe) throw fe
  if (!forms?.length) {
    console.error('No form matching "performance review".')
    process.exit(1)
  }
  if (forms.length > 1) {
    console.error('Multiple matching forms — narrow the title:', forms.map((f) => f.title))
    process.exit(1)
  }
  const form = forms[0]
  console.log(`Form: "${form.title}" (${form.id})`)

  const { data: fields, error: ge } = await supabase
    .from('form_fields')
    .select('id, label, field_type, options, sort_order, show_when_field, show_when_value')
    .eq('form_id', form.id)
    .order('sort_order')
  if (ge) {
    console.error('\nCould not read fields. Did you run migration 028 first (show_when_* columns)?\n', ge.message)
    process.exit(1)
  }

  // 1. Removals
  const toRemove = fields.filter((f) => REMOVE_LABELS.includes(f.label))
  console.log(`\n1. Remove ${toRemove.length} field(s): ${toRemove.map((f) => f.label).join(', ') || '(none)'}`)

  // 2. Rating options → new scale
  const toRescale = fields.filter(
    (f) =>
      f.field_type === 'radio' &&
      Array.isArray(f.options) &&
      (f.options.includes('Performance Gap') || f.options.includes('Rockstar')) &&
      JSON.stringify(f.options) !== JSON.stringify(NEW_SCALE),
  )
  console.log(`\n2. Re-scale ${toRescale.length} rating field(s) → ${NEW_SCALE.join(' / ')}`)

  // 3. Department conditions (the fields inside the "Department-Specific" section)
  const conditions = [] // { id, label, dept }
  let inDeptSection = false
  let currentDept = null
  for (const f of fields) {
    if (REMOVE_LABELS.includes(f.label)) continue
    if (f.field_type === 'section_header') {
      inDeptSection = f.label.toLowerCase().includes('department-specific')
      currentDept = null
      continue
    }
    if (!inDeptSection) continue
    if (f.field_type === 'radio') {
      currentDept = detectDept(f.label)
      if (currentDept) conditions.push({ id: f.id, label: f.label, dept: currentDept })
      else console.warn(`   ! could not detect a department for: ${f.label}`)
    } else if (currentDept) {
      // explanation textarea inherits the dept of the rating above it
      conditions.push({ id: f.id, label: f.label, dept: currentDept })
    }
  }
  console.log(`\n3. Gate ${conditions.length} department-specific field(s) by Department:`)
  for (const c of conditions) console.log(`   [${c.dept}] ${c.label.slice(0, 72)}`)

  if (!COMMIT) {
    console.log('\nDry run complete. Re-run with --commit to apply.')
    return
  }

  if (toRemove.length) {
    const { error } = await supabase.from('form_fields').delete().in('id', toRemove.map((f) => f.id))
    if (error) throw error
  }
  for (const f of toRescale) {
    const { error } = await supabase.from('form_fields').update({ options: NEW_SCALE }).eq('id', f.id)
    if (error) throw error
  }
  for (const c of conditions) {
    const { error } = await supabase
      .from('form_fields')
      .update({ show_when_field: 'Department', show_when_value: c.dept })
      .eq('id', c.id)
    if (error) throw error
  }

  console.log('\n✓ Applied. The other ~40 forms are untouched.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
