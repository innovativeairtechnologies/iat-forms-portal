/**
 * READ-ONLY audit — which ACTIVE form-builder forms (/forms/[slug]) lack a
 * required Name and/or Email field to identify the submitter?
 *
 * The anonymous builder forms only capture contact if the form's author added
 * those fields; nothing enforces it. This lists the gaps so we can decide which
 * forms to add a required Contact block to. Purely SELECTs — mutates nothing.
 *
 * Run: node scripts/audit-form-contact.mjs
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
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
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME_RE = /\b(full\s*name|your\s*name|contact\s*name|name)\b/i
const EMAIL_RE = /\be-?mail\b/i

const { data: forms, error } = await supabase
  .from('forms')
  .select('id, title, slug, is_active')
  .eq('is_active', true)
  .order('title')

if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

const rows = []
for (const f of forms || []) {
  const { data: fields } = await supabase
    .from('form_fields')
    .select('label, field_type, is_required')
    .eq('form_id', f.id)
  const fs = fields || []
  const isEmail = (x) => x.field_type === 'email' || EMAIL_RE.test(x.label || '')
  const isName = (x) => NAME_RE.test(x.label || '')
  rows.push({
    title: f.title,
    slug: f.slug,
    fields: fs.length,
    reqName: fs.some((x) => x.is_required && isName(x)),
    reqEmail: fs.some((x) => x.is_required && isEmail(x)),
    anyEmail: fs.some(isEmail),
    anyName: fs.some(isName),
  })
}

const gaps = rows.filter((r) => !(r.reqName && r.reqEmail))
console.log(`\nActive builder forms: ${rows.length}`)
console.log(`Missing a required Name AND/OR Email: ${gaps.length}\n`)
console.log('flag  form  [slug]  fields  reqName  reqEmail  (anyName/anyEmail present)')
console.log('─'.repeat(90))
for (const r of rows) {
  const ok = r.reqName && r.reqEmail
  console.log(
    `${ok ? 'OK ' : '⚠  '} ${r.title}  [${r.slug}]  n=${r.fields}  reqName=${r.reqName}  reqEmail=${r.reqEmail}` +
      (ok ? '' : `  (has name=${r.anyName}, email=${r.anyEmail})`),
  )
}
console.log('')
