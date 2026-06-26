/**
 * Remove the employee signature field from the Performance Review form.
 * Kacy's call (2026-06): the employee signature card isn't needed.
 *
 *   Dry-run:  node scripts/remove-perf-review-signature.mjs
 *   Apply:    node scripts/remove-perf-review-signature.mjs --commit
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotent. Targets signature-type fields on the Performance Review form. By
 * default it only removes ones whose label mentions "employee"; if the form has a
 * single unlabelled signature field it removes that one too. Existing submissions
 * keep whatever signature they already captured — this only changes the live form.
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
    .select('id, label, field_type, sort_order')
    .eq('form_id', form.id)
    .order('sort_order')
  if (ge) throw ge

  const sigFields = fields.filter((f) => f.field_type === 'signature')
  console.log(`\nSignature fields on this form: ${sigFields.length}`)
  for (const f of sigFields) console.log(`   • "${f.label}" (${f.id})`)

  // Prefer the employee signature explicitly; if there's exactly one signature
  // field total, remove it regardless of label.
  let toRemove = sigFields.filter((f) => /employee/i.test(f.label))
  if (toRemove.length === 0 && sigFields.length === 1) toRemove = sigFields

  console.log(`\nWill remove ${toRemove.length} field(s): ${toRemove.map((f) => `"${f.label}"`).join(', ') || '(none)'}`)

  if (!COMMIT) {
    console.log('\nDry run complete. Re-run with --commit to apply.')
    return
  }
  if (toRemove.length === 0) {
    console.log('\nNothing to remove.')
    return
  }

  const { error } = await supabase.from('form_fields').delete().in('id', toRemove.map((f) => f.id))
  if (error) throw error
  console.log('\n✓ Removed. Existing submissions are untouched; the other forms are untouched.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
