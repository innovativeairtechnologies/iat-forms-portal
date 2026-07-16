/**
 * Add the missing 'Department' select to the Performance Review forms.
 *
 *   Dry-run:  node scripts/add-perf-review-department-field.mjs
 *   Apply:    node scripts/add-perf-review-department-field.mjs --commit
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent: a form that already has a field labeled 'Department' is skipped.
 *
 * THE BUG THIS FIXES
 * scripts/update-performance-review.mjs (2026-06) gated 22 department-specific
 * rating/explanation fields with show_when_field='Department' — but no field labeled
 * 'Department' has ever existed on these forms (they were hand-built in the form
 * builder, so there was no seed to add one to). Conditions resolve by LABEL against a
 * submission's answers (lib/forms.ts), so answers['Department'] was always undefined and
 * all 22 fields were PERMANENTLY HIDDEN — the gate didn't gate, it erased.
 *
 * It's a regression, and it's dated: the 2026-07-07 submission answered two of the
 * now-hidden fields ("Office: Accuracy and organization…" = "Superstar"), because before
 * that script every department's questions showed to everyone and the reviewer filled in
 * the relevant ones. That submission has no 'Department' key for the same reason.
 *
 * The option list is NOT a free choice — it's dictated by the questions each form
 * actually has. OPTION_COVERAGE below asserts that every value the gated fields wait for
 * is offered by the select; otherwise this script would reintroduce the exact bug it
 * fixes, just for a subset of departments. (Other portal forms use different, wider
 * department lists — Shipping/Receiving, Administration, Quality Control, IT. This form
 * has no questions for those, so offering them would only strand reviewers on an empty
 * section. That gap is a content decision, tracked separately.)
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
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const COMMIT = process.argv.includes('--commit')
const SLUGS = ['performance-review-form', 'perf-new']
const LABEL = 'Department'
// Mirrors DEPTS in scripts/update-performance-review.mjs, which is what set the
// show_when_value on the 22 gated fields.
const DEPT_OPTIONS = ['Office', 'Engineering', 'Sales', 'Marketing', 'Production', 'Management']

async function fixForm(form) {
  const { data: fields, error } = await supabase
    .from('form_fields')
    .select('id, label, field_type, options, sort_order, show_when_field, show_when_value')
    .eq('form_id', form.id)
    .order('sort_order')
  if (error) throw error

  console.log(`\n${'─'.repeat(72)}\n"${form.title}" (${form.slug}) — ${fields.length} fields`)

  if (fields.some((f) => f.label === LABEL)) {
    console.log(`  → already has a "${LABEL}" field. Skipping.`)
    return
  }

  const gated = fields.filter((f) => f.show_when_field === LABEL)
  if (!gated.length) {
    console.log(`  → nothing gated on "${LABEL}". Skipping.`)
    return
  }

  // The guard whose absence caused this bug: a gated field waiting on a value the
  // controlling select doesn't offer can never be reached.
  const awaited = [...new Set(gated.map((f) => f.show_when_value))].sort()
  const unreachable = awaited.filter((v) => !DEPT_OPTIONS.includes(v))
  if (unreachable.length) {
    console.error(`  ✗ ${unreachable.length} value(s) awaited by gated fields are not offered by the select:`)
    unreachable.forEach((v) => console.error(`      "${v}"`))
    console.error(`    Those fields would stay permanently hidden. Fix DEPT_OPTIONS.`)
    process.exit(1)
  }
  const questionless = DEPT_OPTIONS.filter((o) => !awaited.includes(o))
  if (questionless.length) {
    console.warn(`  ! offered but has no questions behind it: ${questionless.join(', ')}`)
    console.warn(`    Picking one lands the reviewer on an empty Department-Specific section.`)
  }

  // Sit at the end of the first section — i.e. immediately before the second section
  // header — so Department is captured with the employee's other details.
  const headers = fields.filter((f) => f.field_type === 'section_header')
  if (headers.length < 2) {
    console.error(`  ✗ expected at least 2 section headers, found ${headers.length}.`)
    process.exit(1)
  }
  const insertAt = headers[1].sort_order
  const toShift = fields.filter((f) => f.sort_order >= insertAt)

  console.log(`  gated on "${LABEL}": ${gated.length}   awaited values: ${awaited.join(', ')}`)
  console.log(`  insert at sort_order ${insertAt}, after "${fields[insertAt - 1]?.label}" and before "${headers[1].label}"`)
  console.log(`  shifts ${toShift.length} field(s) down by 1`)
  console.log(`  new field: [select]* "${LABEL}" ${JSON.stringify(DEPT_OPTIONS)}`)

  if (!COMMIT) return

  // Shift highest-first so no two rows ever hold the same sort_order mid-flight, in case
  // a unique index exists (form_fields was created outside migrations, so its constraints
  // aren't readable from the repo).
  for (const f of [...toShift].sort((a, b) => b.sort_order - a.sort_order)) {
    const { error: se } = await supabase
      .from('form_fields').update({ sort_order: f.sort_order + 1 }).eq('id', f.id)
    if (se) throw se
  }

  const { error: ie } = await supabase.from('form_fields').insert({
    form_id: form.id,
    label: LABEL,
    field_type: 'select',
    placeholder: null,
    options: DEPT_OPTIONS,
    is_required: true,
    sort_order: insertAt,
    show_when_field: null,
    show_when_value: null,
  })
  if (ie) throw ie

  // Prove it landed: re-read and confirm every gated field is now reachable.
  const { data: after } = await supabase
    .from('form_fields').select('label, options, sort_order, show_when_field, show_when_value')
    .eq('form_id', form.id).order('sort_order')
  const ctrl = after.find((f) => f.label === LABEL)
  const stillUnreachable = after
    .filter((f) => f.show_when_field === LABEL)
    .filter((f) => !ctrl.options.includes(f.show_when_value))
  const orders = after.map((f) => f.sort_order)
  const contiguous = new Set(orders).size === orders.length
  console.log(`  ✓ inserted at sort_order ${ctrl.sort_order}; ${after.length} fields; ` +
    `unique sort_order=${contiguous}; unreachable gated fields=${stillUnreachable.length}`)
  if (stillUnreachable.length || !contiguous) {
    console.error('  ✗ post-write verification FAILED')
    process.exit(1)
  }
}

async function main() {
  console.log(COMMIT ? '— APPLYING changes —' : '— DRY RUN (pass --commit to apply) —')
  const { data: forms, error } = await supabase
    .from('forms').select('id, title, slug, is_active').in('slug', SLUGS)
  if (error) throw error
  if (!forms.length) { console.error('No matching forms.'); process.exit(1) }

  for (const form of forms.sort((a, b) => SLUGS.indexOf(a.slug) - SLUGS.indexOf(b.slug))) {
    await fixForm(form)
  }
  console.log(`\n${COMMIT ? '✓ Applied.' : 'Dry run complete. Re-run with --commit to apply.'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
