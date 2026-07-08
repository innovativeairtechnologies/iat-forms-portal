/**
 * Create a throwaway copy of the Performance Review form for testing in prod.
 *
 *   Dry-run:  node scripts/create-perf-new-test-form.mjs
 *   Apply:    node scripts/create-perf-new-test-form.mjs --commit
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotent: if a form titled "Perf - NEW" (slug "perf-new") already exists it
 * reports it and exits without creating a second one.
 *
 * Faithful copy — unlike the built-in /duplicate route, this also copies each
 * field's show_when_field / show_when_value, so the Department conditionals (and
 * the print page's department selector) keep working. It intentionally does NOT
 * copy notification_rules (so test submissions email no one) and creates the form
 * inactive (hidden from employees; still fully editable + printable in /admin).
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
const NEW_TITLE = 'Perf - NEW'
const NEW_SLUG = 'perf-new'
const SOURCE_TITLE = 'Performance Review Form'

const base = (env.NEXT_PUBLIC_SUPABASE_URL || '').includes('localhost')
  ? 'http://localhost:3000'
  : 'https://iatportal.vercel.app'

async function main() {
  console.log(COMMIT ? '— APPLYING —\n' : '— DRY RUN (pass --commit to apply) —\n')

  // Already there? (idempotent)
  const { data: existing } = await supabase
    .from('forms')
    .select('id, title, slug')
    .or(`slug.eq.${NEW_SLUG},title.eq.${NEW_TITLE}`)
    .maybeSingle()
  if (existing) {
    console.log(`"${existing.title}" already exists (${existing.id}).`)
    console.log(`  Edit:  ${base}/admin/forms/${existing.id}/edit`)
    console.log(`  PDF:   ${base}/print/forms/${existing.id}`)
    console.log('\nNothing to do.')
    return
  }

  // Source form (the real Performance Review).
  const { data: source, error: se } = await supabase
    .from('forms')
    .select('id, title, description, category_id, success_message')
    .eq('title', SOURCE_TITLE)
    .single()
  if (se || !source) {
    console.error(`Could not find source form titled "${SOURCE_TITLE}".`, se?.message || '')
    process.exit(1)
  }

  const { data: fields, error: fe } = await supabase
    .from('form_fields')
    .select('label, field_type, placeholder, options, is_required, sort_order, show_when_field, show_when_value')
    .eq('form_id', source.id)
    .order('sort_order')
  if (fe) throw fe

  const conditionals = fields.filter((f) => f.show_when_field).length
  console.log(`Source: "${source.title}" (${source.id}) — ${fields.length} fields, ${conditionals} conditional.`)
  console.log(`New form: "${NEW_TITLE}" (slug "${NEW_SLUG}", inactive, no email rules)`)

  if (!COMMIT) {
    console.log('\nDry run complete. Re-run with --commit to create it.')
    return
  }

  const { data: newForm, error: ie } = await supabase
    .from('forms')
    .insert({
      title: NEW_TITLE,
      description: source.description,
      category_id: source.category_id,
      slug: NEW_SLUG,
      is_active: false,
      success_message: source.success_message,
    })
    .select()
    .single()
  if (ie || !newForm) {
    console.error('Failed to create form:', ie?.message)
    process.exit(1)
  }

  const rows = fields.map((f) => ({ ...f, form_id: newForm.id }))
  const { error: fie } = await supabase.from('form_fields').insert(rows)
  if (fie) {
    console.error('Form created but fields failed to insert:', fie.message)
    console.error(`Clean up the empty form: id ${newForm.id}`)
    process.exit(1)
  }

  console.log(`\n✓ Created "${NEW_TITLE}" (${newForm.id}) with ${rows.length} fields.`)
  console.log(`  Edit:  ${base}/admin/forms/${newForm.id}/edit`)
  console.log(`  PDF:   ${base}/print/forms/${newForm.id}`)
  console.log('\nHidden from employees (inactive). Find it under Admin › Forms › Inactive.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
