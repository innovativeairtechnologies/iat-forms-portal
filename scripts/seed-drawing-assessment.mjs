/**
 * IAT Forms Portal — Electrical Drawing Assessment (Drawing No. 4103-R0)
 * Run with: node scripts/seed-drawing-assessment.mjs
 * Requires .env.local to be populated with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const FORM = {
  category: 'Applications',
  title: 'Electrical Drawing Assessment — Drawing No. 4103-R0',
  slug: 'electrical-drawing-assessment-4103-r0',
  description: 'Review Drawing No. 4103-R0 (AIT-300RG-IDP, Project 4103) and answer the following questions. Reference the drawing carefully before responding. Power input: 480V/3Ph/60Hz | Total FLA: 77A | MCA: 77A | MOCP: 122A | Largest Motor: 5HP.',
  successMessage: 'Thank you for completing the Electrical Drawing Assessment. Your responses have been received and will be reviewed by the engineering team.',
  fields: [
    {
      label: 'Candidate Name',
      field_type: 'text',
      placeholder: 'Your full name',
      is_required: true,
      sort_order: 0,
      options: null,
    },
    {
      label: 'Candidate Email',
      field_type: 'email',
      placeholder: 'your@email.com',
      is_required: true,
      sort_order: 1,
      options: null,
    },
    {
      label: 'Q1. Total FLA Calculation',
      field_type: 'textarea',
      placeholder: 'Referring to the incoming power line (480VAC, 3 Phase, 60Hz), what is the total FLA? List each load contributing to the total and show how you arrived at your answer.',
      is_required: true,
      sort_order: 2,
      options: null,
    },
    {
      label: 'Q2. MCB1 Disconnect Size',
      field_type: 'textarea',
      placeholder: 'What is the correct disconnect size for MCB1 based on the total FLA? Reference the applicable NEC article and show your sizing calculation.',
      is_required: true,
      sort_order: 3,
      options: null,
    },
    {
      label: 'Q3. CB1 Circuit Breaker Size',
      field_type: 'textarea',
      placeholder: 'What should be the correct size for CB1 based on the motor FLA? VFD1 feeds a Process Fan Motor rated 5.0 HP, 7.6 FLA. Show your calculation and NEC reference.',
      is_required: true,
      sort_order: 4,
      options: null,
    },
    {
      label: 'Q4. CB3 Circuit Breaker Size',
      field_type: 'textarea',
      placeholder: 'What should be the correct size for CB3? CB3 is a 2-pole breaker feeding the 480VAC primary of transformer TXMR1 (500VA, 480x120VAC, 1.0A x 4.2A). Show your sizing reasoning.',
      is_required: true,
      sort_order: 5,
      options: null,
    },
    {
      label: 'Q5. Control Wiring Color Code',
      field_type: 'textarea',
      placeholder: 'Using the Control Wiring Color Code Table, what should be the wire colors landed at Terminal 1 and Terminal 2 on CB4? Explain why based on the color code standard.',
      is_required: true,
      sort_order: 6,
      options: null,
    },
  ],
}

async function run() {
  console.log('Fetching categories...')
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')

  if (catError) {
    console.error('Failed to fetch categories:', catError.message)
    process.exit(1)
  }

  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))
  console.log('Categories found:', Object.keys(catMap).join(', '))

  const categoryId = catMap[FORM.category]
  if (!categoryId) {
    console.error(`No category found for "${FORM.category}"`)
    process.exit(1)
  }

  const { data: existing } = await supabase
    .from('forms')
    .select('id')
    .eq('slug', FORM.slug)
    .single()

  if (existing) {
    console.log(`Form with slug "${FORM.slug}" already exists — skipping.`)
    console.log('To re-seed, delete the existing form from the admin panel first.')
    process.exit(0)
  }

  const { data: form, error: formError } = await supabase
    .from('forms')
    .insert({
      title: FORM.title,
      description: FORM.description,
      category_id: categoryId,
      slug: FORM.slug,
      is_active: true,
      success_message: FORM.successMessage,
    })
    .select()
    .single()

  if (formError || !form) {
    console.error('Failed to create form:', formError?.message)
    process.exit(1)
  }

  console.log(`✓ Form created: "${FORM.title}" (id: ${form.id})`)

  const fieldRows = FORM.fields.map((f, i) => ({
    form_id: form.id,
    label: f.label,
    field_type: f.field_type,
    placeholder: f.placeholder || null,
    is_required: f.is_required,
    sort_order: i,
    options: f.options || null,
  }))

  const { error: fieldsError } = await supabase
    .from('form_fields')
    .insert(fieldRows)

  if (fieldsError) {
    console.error('Failed to insert fields:', fieldsError.message)
    process.exit(1)
  }

  console.log(`✓ ${fieldRows.length} fields inserted`)
  console.log(`\nForm live at: ${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${FORM.slug}`)
}

run().catch(console.error)
