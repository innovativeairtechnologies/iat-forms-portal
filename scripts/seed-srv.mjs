/**
 * IAT Forms Portal — Start-Up Readiness Verification (SRV)
 * A customer-facing pre-start-up checklist that replaces the legacy Jotform.
 * Designed to capture DATA and PROOF (recorded readings + required photos),
 * not just ticked boxes, so IAT can confirm a site is truly ready before
 * dispatching a start-up technician.
 *
 * Seeds the form as a DRAFT (is_active: false): it will NOT appear on the
 * public homepage and will NOT open at /forms/<slug> until an admin flips it
 * active. Review/edit it in Admin → Forms, then publish when ready.
 *
 * Run with: node scripts/seed-srv.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
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

// ── Field builders ───────────────────────────────────────────────────────────
// `sort_order` is reassigned by array position at insert time, so order here is
// what matters. section_header rows start a new step in the public form.
const sh  = (label) => ({ label, field_type: 'section_header', placeholder: null, is_required: false, options: null })
const t   = (label, ph = null, req = true) => ({ label, field_type: 'text', placeholder: ph, is_required: req, options: null })
const em  = (label, ph = 'name@company.com', req = true) => ({ label, field_type: 'email', placeholder: ph, is_required: req, options: null })
const num = (label, ph = null, req = true) => ({ label, field_type: 'number', placeholder: ph, is_required: req, options: null })
const dt  = (label, req = true) => ({ label, field_type: 'date', placeholder: null, is_required: req, options: null })
const ta  = (label, ph = null, req = false) => ({ label, field_type: 'textarea', placeholder: ph, is_required: req, options: null })
const rad = (label, options, req = true) => ({ label, field_type: 'radio', placeholder: null, is_required: req, options })
const chk = (label, options, req = true) => ({ label, field_type: 'checkbox', placeholder: null, is_required: req, options })
const ph  = (label, req = true) => ({ label, field_type: 'file', placeholder: null, is_required: req, options: null })
const sig = (label, req = true) => ({ label, field_type: 'signature', placeholder: null, is_required: req, options: null })

// Standard per-section honesty gate + exception note.
const GATE = ['Yes — every item above is complete and verified', 'No — one or more items are outstanding']
const gate = (section) => rad(`${section}: Is EVERY item above complete and verified on site?`, GATE, true)
const gateNotes = (section) => ta(`${section}: If anything is NOT complete, list each outstanding item`, 'Be specific — these are the items that cause failed start-ups.', false)
const APPLIES = ['Yes', 'No', 'Not sure']

const FORM = {
  category: 'QC & Production',
  title: 'Start-Up Readiness Verification (SRV)',
  slug: 'start-up-readiness-verification',
  description:
    'IMPORTANT: Start-up services will not be scheduled until this completed form AND all required photos are received by IAT. ' +
    'Submit a minimum of 7 calendar days prior to the requested start-up date. ' +
    'Incomplete submissions may result in delays, additional trip charges, or rescheduling. ' +
    'Tip: each "Is everything complete?" question is an honest attestation — if an item is not done, say so and we will help you resolve it before we mobilize.',
  successMessage:
    'Thank you. Your Start-Up Readiness Verification has been received. IAT will review your responses and photos and confirm your start-up date, or contact you about any outstanding items. Remember: start-up is scheduled only after this review is complete.',
  fields: [
    // ── PROJECT INFORMATION ────────────────────────────────────────────────
    sh('Project Information'),
    t('Project Name', 'e.g. Acme Foods — Line 3 Dehumidifier'),
    t('Customer / Company'),
    t('Unit Model Number', 'As shown on the unit nameplate'),
    t('Unit Serial Number', 'As shown on the unit nameplate'),
    t('Installation Address', 'Street, city, state, ZIP'),
    dt('Date Inspected'),
    t('Inspected By (name)'),
    t('Phone Number', '(555) 555-5555'),
    em('Email Address'),
    rad('Requested start-up timeframe', ['Within 1–2 weeks', 'Within 3–4 weeks', '1–2 months out', 'Date is flexible'], true),

    // ── SECTION 1 — EQUIPMENT CONDITION ────────────────────────────────────
    sh('Section 1 — Equipment Condition'),
    chk('Confirm each equipment-condition item that is complete', [
      'Unit inspected for shipping damage',
      'Any dents, punctures, or damage reported to IAT',
      'Cabinet fully assembled and airtight',
      'Access panels installed and secured',
      'All doors latch properly',
      'Interior clean and free of debris',
      'No tools, packaging, or construction materials left inside the unit',
      'Desiccant wheel rotates freely by hand',
      'All belts properly tensioned',
      'Fans rotate freely',
      'Condensate drains unobstructed',
      'All filters installed correctly',
    ], true),
    gate('Section 1'),
    gateNotes('Section 1'),
    ph('Photo — entire unit'),
    ph('Photo — nameplate (model & serial legible)'),
    ph('Photo — interior access section'),
    ph('Photo — control panel (door closed)'),

    // ── SECTION 2 — DUCTWORK & AIRFLOW ─────────────────────────────────────
    sh('Section 2 — Ductwork & Airflow'),
    chk('Process air ducting — confirm each completed item', [
      'Process inlet duct installed',
      'Process outlet duct installed',
      'Flexible connections installed (if supplied)',
      'Ductwork adequately supported',
      'Ductwork sealed airtight',
      'No temporary openings remain',
    ], true),
    chk('Reactivation ducting — confirm each completed item', [
      'React inlet duct installed',
      'React outlet duct installed',
      'Exhaust termination complete',
      'Exhaust complies with local code',
      'Exhaust path is not blocked',
    ], true),
    chk('Airflow verification — confirm each completed item', [
      'All shipping covers removed',
      'Dampers installed correctly',
      'Dampers open and operational',
      'Fire/smoke dampers installed and functional',
      'Air path free of obstructions',
    ], true),
    gate('Section 2'),
    gateNotes('Section 2'),
    ph('Photo — process inlet connection'),
    ph('Photo — process outlet connection'),
    ph('Photo — react inlet connection'),
    ph('Photo — react outlet connection'),
    ph('Photo — exhaust termination'),

    // ── SECTION 3 — ELECTRICAL POWER ───────────────────────────────────────
    sh('Section 3 — Electrical Power'),
    chk('Incoming power — confirm each completed item', [
      'Permanent power available',
      'Electrical permit complete (if applicable)',
      'Unit wired per IAT drawings',
      'Proper breaker installed',
      'Ground connection installed',
      'Disconnect installed and labeled',
    ], true),
    // Recorded readings — the single highest-value upgrade over the old form.
    num('Measured voltage — L1 to L2 (V)', 'e.g. 478'),
    num('Measured voltage — L2 to L3 (V)', 'e.g. 479'),
    num('Measured voltage — L1 to L3 (V)', 'e.g. 477'),
    num('Measured voltage — L1 to Ground (V)', '', false),
    num('Measured voltage — L2 to Ground (V)', '', false),
    num('Measured voltage — L3 to Ground (V)', '', false),
    chk('Electrical checks — confirm each completed item', [
      'Voltage matches unit nameplate',
      'Phase imbalance less than 2%',
      'Control transformer energized',
      'Control power available',
      'All terminal connections checked and tightened',
      'VFDs powered',
      'No active electrical faults present',
    ], true),
    gate('Section 3'),
    gateNotes('Section 3'),
    ph('Photo — main disconnect (labeled)'),
    ph('Photo — incoming power connections'),
    ph('Photo — control panel interior'),
    ph('Photo — voltage meter reading'),

    // ── SECTION 4 — FAN & MOTOR VERIFICATION ───────────────────────────────
    sh('Section 4 — Fan & Motor Verification'),
    chk('Process fan — confirm each completed item', [
      'Fan rotates freely',
      'Motor securely mounted',
      'VFD powered',
      'Motor overload settings verified',
    ], true),
    chk('React fan — confirm each completed item', [
      'Fan rotates freely',
      'Motor securely mounted',
      'VFD powered',
      'Motor overload settings verified',
    ], true),
    chk('Wheel drive — confirm each completed item', [
      'Drive motor installed',
      'Chain/belt tension verified',
      'Wheel rotates freely',
    ], true),
    gate('Section 4'),
    gateNotes('Section 4'),
    ph('Photo — process fan'),
    ph('Photo — react fan'),
    ph('Photo — wheel drive assembly'),

    // ── SECTION 5 — GAS SYSTEMS (IF APPLICABLE) ────────────────────────────
    sh('Section 5 — Gas Systems (if applicable)'),
    rad('Does this unit include a GAS heat system?', APPLIES, true),
    chk('Gas piping — confirm each completed item (skip if no gas)', [
      'Gas piping complete',
      'Sediment trap installed',
      'Shutoff valve installed',
      'Leak test completed',
      'Regulator installed correctly',
      'Venting complete',
      'Gas type matches nameplate',
      'Gas available at unit',
    ], false),
    num('Gas inlet static pressure (" WC)', 'e.g. 11', false),
    num('Gas inlet dynamic pressure (" WC)', 'e.g. 9', false),
    rad('Inlet pressure is within limits (does NOT exceed 14" WC)?', ['Yes', 'No', 'N/A — no gas'], false),
    gateNotes('Section 5'),
    ph('Photo — gas train', false),
    ph('Photo — regulator', false),
    ph('Photo — sediment trap', false),
    ph('Photo — gas pressure gauge reading', false),

    // ── SECTION 6 — HOT WATER / STEAM / CHILLED WATER (IF APPLICABLE) ───────
    sh('Section 6 — Hot Water / Steam / Chilled Water Coils (if applicable)'),
    rad('Does this unit include hot water, steam, or chilled water coils?', APPLIES, true),
    chk('Water-side piping & system — confirm each completed item (skip if none)', [
      'Piping complete',
      'Correct pipe sizing used',
      'Isolation valves installed',
      'Strainers installed',
      'Control valves installed',
      'Unions installed for serviceability',
      'Freeze protection installed',
      'System filled',
      'System flushed',
      'System purged of air',
      'Pumps operational',
      'Design flow available',
    ], false),
    rad('Is the water/steam system OPERATIONAL and ready for start-up?', ['Yes', 'No', 'N/A — no water/steam coils'], false),
    gateNotes('Section 6'),
    ph('Photo — coil connections', false),
    ph('Photo — control valve assembly', false),
    ph('Photo — strainer installation', false),

    // ── SECTION 7 — REFRIGERATION (IF APPLICABLE) ──────────────────────────
    sh('Section 7 — Refrigeration Systems (if applicable)'),
    rad('Does this unit include a refrigeration / DX system?', APPLIES, true),
    chk('Condensing unit & piping — confirm each completed item (skip if none)', [
      'Condenser installed',
      'Refrigerant piping complete',
      'Proper pipe insulation installed',
      'Oil traps installed as required',
      'System pressure tested',
      'System evacuated',
      'System charged',
      'Condenser power connected',
      'Condenser controls connected',
    ], false),
    rad('Have crankcase heaters been energized for a MINIMUM of 24 hours before start-up?', ['Yes', 'No — not yet', 'N/A — no refrigeration'], false),
    gateNotes('Section 7'),
    ph('Photo — condenser', false),
    ph('Photo — refrigerant piping', false),
    ph('Photo — service valves', false),
    ph('Photo — condenser electrical connections', false),

    // ── SECTION 8 — CONTROLS & INSTRUMENTATION ─────────────────────────────
    sh('Section 8 — Controls & Instrumentation'),
    chk('Sensors & wiring — confirm each completed item', [
      'Temperature sensors installed',
      'Humidity sensors installed',
      'Pressure sensors installed',
      'Sensors wired correctly',
    ], true),
    chk('External controls — confirm each completed item', [
      'Remote enable connected',
      'Fire alarm interlock connected',
      'BAS/BMS wiring complete',
      'BACnet/IP or MSTP complete',
      'Network addressing completed',
    ], true),
    chk('Operator interface — confirm each completed item', [
      'HMI powered',
      'No controller faults present',
      'Control wiring verified',
    ], true),
    rad('Will the BAS / controls contractor be ON SITE during start-up?', ['Yes', 'No', 'N/A — no BAS integration'], true),
    gate('Section 8'),
    gateNotes('Section 8'),
    ph('Photo — HMI screen'),
    ph('Photo — sensors'),
    ph('Photo — BAS connection point', false),

    // ── SECTION 9 — CONDENSATE DRAINAGE ────────────────────────────────────
    sh('Section 9 — Condensate Drainage'),
    chk('Condensate drainage — confirm each completed item', [
      'Drain piping complete',
      'Proper trap installed',
      'Drain pitched correctly',
      'Drain tested with water',
      'No leaks present',
    ], true),
    gate('Section 9'),
    gateNotes('Section 9'),
    ph('Photo — drain connection'),
    ph('Photo — trap'),

    // ── SECTION 10 — SITE READINESS ────────────────────────────────────────
    sh('Section 10 — Site Readiness'),
    chk('Site & access — confirm each completed item', [
      'Unit area accessible',
      'Safe access provided',
      'Lighting available',
      'Internet access available (if required)',
      'Lift equipment available (if required)',
      'Process space is enclosed and construction is complete',
    ], true),
    chk('Trades present / available for start-up — check all that will be on site', [
      'Mechanical contractor present',
      'Electrical contractor present',
      'Controls contractor present',
      'BAS contractor present (if applicable)',
      'Gas contractor available (if applicable)',
    ], true),
    gate('Section 10'),
    gateNotes('Section 10'),

    // ── CUSTOMER CERTIFICATION ─────────────────────────────────────────────
    sh('Customer Certification'),
    t('Printed name'),
    t('Company'),
    em('Certifier email', 'name@company.com'),
    rad(
      'I certify that the items above have been completed and verified, and I understand that incomplete items may result in start-up delays, additional charges, or rescheduling.',
      ['I certify and agree'],
      true
    ),
    sig('Signature'),
    dt('Date signed'),
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

  // Check if slug already exists
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

  // Insert form as a DRAFT (is_active: false) so it stays off the public site
  // until an admin reviews and publishes it.
  const { data: form, error: formError } = await supabase
    .from('forms')
    .insert({
      title: FORM.title,
      description: FORM.description,
      category_id: categoryId,
      slug: FORM.slug,
      is_active: false,
      success_message: FORM.successMessage,
    })
    .select()
    .single()

  if (formError || !form) {
    console.error('Failed to create form:', formError?.message)
    process.exit(1)
  }

  console.log(`✓ Form created (DRAFT): "${FORM.title}" (id: ${form.id})`)

  // Insert fields
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

  const sections = fieldRows.filter(f => f.field_type === 'section_header').length
  const photos = fieldRows.filter(f => f.field_type === 'file').length
  console.log(`✓ ${fieldRows.length} fields inserted — ${sections} sections, ${photos} photo fields, ${fieldRows.filter(f => f.is_required).length} required.`)
  console.log(`\nThis form is a DRAFT and is NOT public yet.`)
  console.log(`Review it in Admin → Forms. To play with the live stepped experience or demo it,`)
  console.log(`open it in the admin form builder, or flip it Active and visit /forms/${FORM.slug}.`)
}

run().catch(console.error)
