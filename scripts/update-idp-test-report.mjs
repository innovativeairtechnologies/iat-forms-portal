/**
 * Rebuild the "IDP Pre/Post Test Report & QC" form to match the live JotForm
 * (form.jotform.com/232424923646155), which had drifted far past the 18 flat
 * fields seeded by seed-forms.mjs.
 *
 *   Dry-run:  node scripts/update-idp-test-report.mjs
 *   Apply:    node scripts/update-idp-test-report.mjs --commit
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent: replaces the form's fields wholesale each run. Submissions are keyed
 * by label in their own JSON and carry no FK to form_fields, so existing
 * submissions survive untouched (they keep rendering their original answers).
 *
 * Three things the portal's form model can't take verbatim from JotForm:
 *
 *  1. Answers are keyed by field LABEL (see lib/forms.ts), and the JotForm reuses
 *     labels heavily — "Notes" x12, "FLA" x5, "Control Type" x4. Every label here
 *     is therefore section-qualified. LABEL_UNIQUENESS is asserted before writing.
 *  2. JotForm can show a field for several values of a controlling field; the
 *     portal expresses that as a pipe-separated show_when_value ("Electric|Natural Gas").
 *  3. JotForm's control_matrix has no portal equivalent, so the PXR controller
 *     table is flattened to 4 rows x 9 fields, gated on Controller Type = PXR.
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
const SLUG = 'idp-pre-post-test-report'
const DESCRIPTION =
  'Pre/post test report and QC checklist for an IDP (Integrated Dehumidification Package).'

// ── DSL ───────────────────────────────────────────────────────────────────────
const when = (field, value) => ({ show_when_field: field, show_when_value: value })
const S = (label, description = null, cond = {}) =>
  ({ field_type: 'section_header', label, placeholder: description, ...cond })
const F = (field_type) => (label, opts = {}) => {
  const { hint = null, req = false, options = null, ...cond } = opts
  return { field_type, label, placeholder: hint, options, is_required: req, ...cond }
}
const T = F('text'), TA = F('textarea'), N = F('number'), D = F('date'), E = F('email')
const FILE = F('file')
const YN = (label, opts = {}) => F('radio')(label, { ...opts, options: ['Yes', 'No'] })
const SEL = (label, options, opts = {}) => F('select')(label, { ...opts, options })
const CHK = (label, options, opts = {}) => F('checkbox')(label, { ...opts, options })

// ── Controlling values ────────────────────────────────────────────────────────
const HEAT = 'Heat Type'
const ELECTRIC = when(HEAT, 'Electric')
const GAS = when(HEAT, 'Natural Gas')
const STEAM = when(HEAT, 'Steam')
const HOTWATER = when(HEAT, 'Hot Water')
const ELECTRIC_OR_GAS = when(HEAT, 'Electric|Natural Gas')

const SETPOINT_HINT = 'Typically 285F, on the touchscreen or react heat controller (typically labeled 1TC)'
const AIRFLOW_HINT = 'If airflows are too high react heat might not be attainable. Confirm react airflows are correct (see flow diagram).'

const COIL_CHECKPOINTS = [
  'Coil properly fastened', 'Piping properly supported', 'Proper insulation',
  'Grommets properly sealing', 'Pressure tested for leaks',
]
const PXR_COLS = ['Name', 'P-SL', 'P-SU', 'P', 'P-N1', 'P-N2', 'SV', 'AL1', 'ALn1']
const PXR = when('Controller Type', 'PXR')
const CAREL = when('Controller Type', 'Carel')

// Flattened control_matrix: one section + 9 fields per controller row.
const pxrControllerRows = () =>
  [1, 2, 3, 4].flatMap((r) => [
    S(`PXR Controller ${r}`, null, PXR),
    ...PXR_COLS.map((c) => T(`Controller ${r} ${c}`, PXR)),
  ])

// ── The form ──────────────────────────────────────────────────────────────────
const FIELDS = [
  D('Date', { req: true }),
  T('Testing Performed By', { req: true }),
  E('Email', { req: true }),
  T('Customer Name', { req: true }),
  T('Serial # of Dehumidifier', { req: true }),
  T('Model # of Dehumidifier', { req: true }),
  YN('UL Dehumidifier'),
  SEL('Voltage', [
    '115-1-60', '120-1-60', '120-3-60', '208-1-60', '208-3-60', '240-1-60',
    '240-3-60', '380-3-50', '430-3-60', '460-3-60', '480-1-60', '480-3-60',
  ]),
  T('Other Voltage'),

  S('Rotor'),
  T('Rotor Size'),
  T('RPH'),
  YN('Chain Alignment Check'),
  YN('Full 2+ Hour Rotor Run Time'),
  T('Run Time'),

  S('Air Flows — Process Volume', 'Based on inlet duct traverse.'),
  T('Process Duct Size'),
  T('Process Velocity'),
  T('Process CFM'),

  S('Air Flows — React Volume', 'Based on inlet duct traverse.'),
  T('React Duct Size'),
  T('React Velocity'),
  T('React CFM'),

  S('Air Flows — Bypass Volume', 'Based on inlet duct traverse.'),
  T('Bypass Duct Size'),
  T('Bypass Velocity'),
  T('Bypass CFM'),

  S('Air Flows — Pressure Drops'),
  T('Process Pressure Drop-WC'),
  T('React Pressure Drop-WC'),
  TA('Air Flow Notes'),
  FILE('Air Flow Photos'),

  S('Gear Motor'),
  T('Gear Motor VFD Settings'),
  T('Gear Motor Hz Test'),
  T('Gear Motor FLA'),
  FILE('Gear Motor Photos'),

  S('Process Motor'),
  YN('Process Motor VFD'),
  T('Process Motor VFD Settings'),
  T('Process Motor Hz During Test'),
  T('Process Motor FLA'),
  TA('Process Motor Notes'),
  FILE('Process Motor Photos'),

  S('React Motor'),
  YN('React Motor VFD'),
  T('React Motor VFD Settings'),
  T('React Motor Hz During Test'),
  T('React Motor FLA'),
  TA('React Motor Notes'),
  FILE('React Motor Photos'),

  S('React Heat',
    'React heat is the primary source of regenerating the desiccant wheel. If the reactivation heat is not high enough (typically 285F), then leaving air humidity will suffer.'),
  SEL(HEAT, ['Electric', 'Natural Gas', 'Steam', 'Hot Water']),

  // Electric
  N('How many stages of react heat?', { hint: 'Typically 2-3', ...ELECTRIC }),
  T('Stage 1 FLA', ELECTRIC),
  T('Stage 2 FLA', ELECTRIC),
  T('Stage 3 FLA', ELECTRIC),
  YN('Amps?', ELECTRIC),
  CHK('If no amps, check the following:', [
    'Are the circuit breakers in the on position?',
    'Is the contactor in the on position?',
    'What is the voltage of the coil for the heater contactor?',
    'What is the line voltage entering the circuit breaker, leaving the circuit breaker?',
    'What is the line voltage entering the heater contactor, leaving the heater contactor?',
    'Check react pressure switch',
    'Check voltage',
    'If above checks out, heater might be bad, turn off system and check ohms of each heater measuring between all 3 legs.',
  ], when('Amps?', 'No')),
  T('React Heat Set Point — Electric', { hint: SETPOINT_HINT, ...ELECTRIC }),
  CHK('If heaters have proper amps, and airflows are correct, then react heat should be achieved. If not achieved:', [
    'What are the react airflows?',
    'If airflows are too high, react heat might not be attainable.',
    'Confirm react airflows are correct. (see flow diagram for proper airflows)',
  ], ELECTRIC),

  // Electric + Natural Gas
  T('React Heat Control Type', ELECTRIC_OR_GAS),
  T('Port B&C - WC', ELECTRIC_OR_GAS),
  T('Port A&C - WC', ELECTRIC_OR_GAS),

  // Natural Gas
  SEL('Guillotine Position (Open)', ['0', '1/4', '1/2', '3/4', '1'], GAS),
  YN('Flame at end of burner', GAS),
  YN('Is the gas supply valve in the ON position?', GAS),
  T('What is the inlet pressure of the inlet gas supply?', { hint: 'Should be 7-14" WC', ...GAS }),
  YN('Is the burner controller on?', GAS),
  YN('Is react airflow meeting pressure switch confirmation?', GAS),
  T('React Heat Set Point — Natural Gas', { hint: SETPOINT_HINT, ...GAS }),
  YN('Is react heat achieved?', GAS),
  T('React Airflow If Not Achieved — Natural Gas', { hint: AIRFLOW_HINT, ...GAS }),

  // Steam
  T('Current inlet steam pressure?', { hint: 'Typically 5-100 PSI', ...STEAM }),
  YN('Is the steam regulated by a control valve/actuator?', STEAM),
  YN('Is the steam actuator operating/opening correctly?', STEAM),
  T('React Heat Set Point — Steam', { hint: SETPOINT_HINT, ...STEAM }),
  T('React Airflows — Steam', { hint: AIRFLOW_HINT, ...STEAM }),

  // Hot Water
  T('What is the current inlet water temperature?', { hint: 'Typically 180F', ...HOTWATER }),
  YN('Is the water regulated by a control valve/actuator?', HOTWATER),
  YN('Is the water actuator operating/opening correctly?', HOTWATER),
  T('React Heat Set Point — Hot Water', { hint: SETPOINT_HINT, ...HOTWATER }),
  T('React Airflows — Hot Water', { hint: AIRFLOW_HINT, ...HOTWATER }),

  TA('React Heat Notes'),

  S('Filters'),
  T('Process Inlet Filter'),
  T('Process Inlet Filter Quantity'),
  YN('Process Inlet Filter Orientated Correctly'),
  T('React Inlet Filter'),
  T('React Inlet Filter Quantity'),
  YN('React Inlet Filter Orientated Correctly'),
  T('Final Filter Size'),
  T('Final Filter Quantity'),
  T('Final Filter Model #'),
  YN('Face & Bypass'),
  T('Filter Control Type'),
  T('Filter Operation Description'),
  TA('Filters Notes'),

  S('Electrical'),
  T('Electrical FLA'),
  TA('Electrical Notes'),

  S('Controllers'),
  SEL('Controller Type', ['PXR', 'Carel', 'Automation Direct', 'Siemens', 'Allen Bradley']),
  T('Controller Serial Number', CAREL),
  T('MAC Address', CAREL),
  T('UID', CAREL),
  T('Tera Registration #', CAREL),
  ...pxrControllerRows(),
  S('Controllers — Notes & Photos'),
  TA('Controllers Notes'),
  FILE('Controllers Photos'),

  S('Performance'),
  T('Inlet Temperature', { req: true }),
  T('Inlet Grains/lb', { req: true }),
  T('Outlet Temperature', { req: true }),
  T('Outlet Grains/lb', { req: true }),
  T('Reactivation Temperature Set Point'),
  TA('Performance Notes'),
  FILE('Performance Photos'),

  S('Pre-Cooling Coil',
    'Pre Cooling is typically provided as fresh air conditioning components that not only temper the dry bulb temperature of outdoor air, but also removes moisture in the form of condensation. Typical fresh air inlet temperature setpoints include: 55F/50F/45F/40F'),
  YN('Pre-Cooling Coil'),
  SEL('Pre-Cooling Coil Type', ['DX', 'CW'], when('Pre-Cooling Coil', 'Yes')),

  // Pre-Cooling — chilled water
  T('Pre-Cooling Water Inlet Temperature', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Valve by IAT', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Valve Operating Properly', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Coil Providing Proper Leaving Air Temps?', when('Pre-Cooling Coil Type', 'CW')),
  T('Pre-Cooling Current Leaving Air Temp', when('Pre-Cooling Coil Type', 'CW')),
  T('Pre-Cooling Airflow Across The Coil', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Actuator', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Piped by IAT', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Wired by IAT', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Tested Operation', when('Pre-Cooling Coil Type', 'CW')),
  YN('Pre-Cooling Pressure Tested', when('Pre-Cooling Coil Type', 'CW')),
  CHK('Pre-Cooling Coil Checkpoints', COIL_CHECKPOINTS, when('Pre-Cooling Coil Type', 'CW')),
  T('Pre-Cooling Pressure Test PSI', { hint: 'If pressure tested', ...when('Pre-Cooling Pressure Tested', 'Yes') }),
  TA('Pre-Cooling Coil Notes', when('Pre-Cooling Coil Type', 'CW')),
  FILE('Pre-Cooling Coil Photos', when('Pre-Cooling Coil Type', 'CW')),

  // Pre-Cooling — direct expansion
  YN('Is the pre-cooling condensing unit operating currently?', when('Pre-Cooling Coil Type', 'DX')),
  T('Model # of Pre-Cooling condensing unit', when('Pre-Cooling Coil Type', 'DX')),
  FILE('Photo of pre-cooling condensing unit', when('Pre-Cooling Coil Type', 'DX')),
  T('FLA of Pre-Cooling condensing unit', when('Pre-Cooling Coil Type', 'DX')),
  YN('Is the pre-cooling coil providing proper leaving air temperature?', when('Pre-Cooling Coil Type', 'DX')),
  T('Pre-Cooling DX Current Leaving Air Temperature', when('Pre-Cooling Coil Type', 'DX')),
  T('Pre-Cooling DX Airflow Across The Coil', when('Pre-Cooling Coil Type', 'DX')),

  S('Post-Cooling Coil'),
  YN('Post-Cooling Coil'),
  SEL('Post-Cooling Coil Type', ['DX', 'CW'], when('Post-Cooling Coil', 'Yes')),
  YN('Post-Cooling Valve'),
  YN('Post-Cooling Actuator'),
  YN('Post-Cooling Piped by IAT'),
  YN('Post-Cooling Wired by IAT'),
  YN('Post-Cooling Tested Operation'),
  YN('Post-Cooling Pressure Tested'),
  CHK('Post-Cooling Coil Checkpoints', COIL_CHECKPOINTS),
  T('Post-Cooling Pressure Test PSI', { hint: 'If pressure tested', ...when('Post-Cooling Pressure Tested', 'Yes') }),
  TA('Post-Cooling Coil Notes'),
  FILE('Post-Cooling Coil Photos'),

  S('Pre-Cooling Condensing Unit'),
  YN('Pre-Cooling Condensing'),
  T('Pre-Cooling Condensing Model #', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Condensing Serial #', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Compressor Model #', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Compressor Serial #', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Condensing FLA', when('Pre-Cooling Condensing', 'Yes')),
  CHK('Pre-Cooling Condensing By IAT', ['Piped', 'Charged', 'Controlled'], when('Pre-Cooling Condensing', 'Yes')),
  YN('Pre-Cooling Hot Gas', when('Pre-Cooling Condensing', 'Yes')),
  N('Pre-Cooling Number of Condensors', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling TXV', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Refrigerant Type', when('Pre-Cooling Condensing', 'Yes')),
  T('Pre-Cooling Weight of Refrigerant Charged', when('Pre-Cooling Condensing', 'Yes')),
  TA('Pre-Cooling Condensing Notes', when('Pre-Cooling Condensing', 'Yes')),
  FILE('Pre-Cooling Condensing Photos', when('Pre-Cooling Condensing', 'Yes')),

  S('Post-Cooling Condensing Unit'),
  YN('Post-Cooling Condensing'),
  T('Post-Cooling Condensing Model #', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Condensing Serial #', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Compressor Model #', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Compressor Serial #', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Condensing FLA', when('Post-Cooling Condensing', 'Yes')),
  CHK('Post-Cooling Condensing By IAT', ['Piped', 'Charged', 'Controlled'], when('Post-Cooling Condensing', 'Yes')),
  YN('Post-Cooling Hot Gas', when('Post-Cooling Condensing', 'Yes')),
  N('Post-Cooling Number of Condensors', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling TXV', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Refrigerant Type', when('Post-Cooling Condensing', 'Yes')),
  T('Post-Cooling Weight of Refrigerant Charged', when('Post-Cooling Condensing', 'Yes')),
  TA('Post-Cooling Condensing Notes', when('Post-Cooling Condensing', 'Yes')),
  FILE('Post-Cooling Condensing Photos', when('Post-Cooling Condensing', 'Yes')),

  S('Pre Heat'),
  YN('Pre Heat'),
  T('Pre Heat Type', when('Pre Heat', 'Yes')),
  T('Pre Heat FLA', when('Pre Heat', 'Yes')),
  T('Pre Heat Control Type', when('Pre Heat', 'Yes')),

  S('Post Heat'),
  YN('Post Heat'),
  T('Post Heat Type', when('Post Heat', 'Yes')),
  T('Post Heat FLA', when('Post Heat', 'Yes')),
  T('Post Heat Control Type', when('Post Heat', 'Yes')),

  S('Noise Level (DB) from 3ft.'),
  T('Noise Level Process Inlet'),
  T('Noise Level React Inlet'),
  T('Noise Level Front'),
  T('Noise Level Back'),

  S('Electrical Checkpoints'),
  CHK('Electrical Panel Checkpoints', [
    'Labels on panel', 'Grounding lug mounted with label', 'Voltage labels applied',
    'Wire track installed',
  ]),
  CHK('UL Checkpoints (if applicable)', [
    'UL label applied', 'UL description label with largest motor size',
    'Torque label above distribution block', 'Job number updated on UL serial log book',
    'Zip ties correctly cut', 'Conduit fittings tight', 'Conduit properly fastened',
  ]),
  TA('Electrical Checkpoints Notes'),

  S('Rotors/IDP Checkpoints'),
  CHK('Coil Checkpoints', [
    'Coil properly fastened', 'Piping Supported Properly', 'Proper Insulation',
    'Grommets Properly Sealing Pipe from Ambient Conditions', 'Pressure Tested for Leaks',
  ]),
  CHK('Unit Checkpoints', [
    'Unit labels', 'Logo label', 'Model # label', 'Unit cleaned prior to crating',
    'unit on pallet', 'wrap unit', 'shipping labels on box/crate (do not slack)',
    'IOM shipped with unit', 'Proper fastening of wires', 'Seals in proper alignment',
    'Wheels rotate freely', 'Balance wheels', 'Wire track cover installed', 'Safeties set',
    'Temperature reading', 'Dewpoints settings', 'Cycle Unit on/off',
    'All handles rotate correctly', 'Paint quality acceptable', 'Filters installed',
    'General appearance',
  ]),
  TA('Rotor/IDP Checkpoints Notes'),

  S('Final Comments'),
  TA('List additional items shipped with unit'),
  TA('Final Notes'),
  FILE('Additional Photos'),
]

// ── Guards ────────────────────────────────────────────────────────────────────
function assertSpec() {
  const problems = []

  // Answers are keyed by label, so any duplicate among data-carrying fields is a
  // silent data-loss bug.
  const seen = new Map()
  for (const f of FIELDS) {
    if (f.field_type === 'section_header') continue
    seen.set(f.label, (seen.get(f.label) || 0) + 1)
  }
  for (const [label, n] of seen) if (n > 1) problems.push(`duplicate label x${n}: "${label}"`)

  // Every condition must point at a field that exists, or it can never be true.
  const labels = new Set(FIELDS.filter((f) => f.field_type !== 'section_header').map((f) => f.label))
  for (const f of FIELDS) {
    if (!f.show_when_field) continue
    if (!labels.has(f.show_when_field)) {
      problems.push(`"${f.label}" is gated on missing field "${f.show_when_field}"`)
    }
  }

  // A controlling field must actually offer the value(s) being tested for.
  const byLabel = new Map(FIELDS.map((f) => [f.label, f]))
  for (const f of FIELDS) {
    if (!f.show_when_field) continue
    const ctrl = byLabel.get(f.show_when_field)
    if (!ctrl?.options) continue
    for (const v of String(f.show_when_value).split('|')) {
      if (!ctrl.options.includes(v)) {
        problems.push(`"${f.label}" waits for ${f.show_when_field}="${v}", not an option of it`)
      }
    }
  }

  if (problems.length) {
    console.error('\n✗ Spec is invalid:\n' + problems.map((p) => `   - ${p}`).join('\n'))
    process.exit(1)
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  assertSpec()
  console.log(COMMIT ? '— APPLYING changes —\n' : '— DRY RUN (pass --commit to apply) —\n')

  const { data: form, error: fe } = await supabase
    .from('forms').select('id, title, description').eq('slug', SLUG).single()
  if (fe) throw fe
  console.log(`Form: "${form.title}" (${form.id})`)

  const { data: existing, error: ge } = await supabase
    .from('form_fields').select('id, label').eq('form_id', form.id)
  if (ge) throw ge

  const { count: subs } = await supabase
    .from('submissions').select('*', { count: 'exact', head: true }).eq('form_id', form.id)

  const sections = FIELDS.filter((f) => f.field_type === 'section_header')
  const conditional = FIELDS.filter((f) => f.show_when_field)
  console.log(`
  fields:      ${existing.length} → ${FIELDS.length}  (${sections.length} sections, ${FIELDS.length - sections.length} inputs)
  conditional: ${conditional.length}
  required:    ${FIELDS.filter((f) => f.is_required).length}
  submissions: ${subs} (kept — no FK to form_fields, answers live in their own JSON)
  description: ${form.description === DESCRIPTION ? '(unchanged)' : `"${form.description}"\n            → "${DESCRIPTION}"`}
`)

  if (!COMMIT) {
    console.log('Section order:')
    for (const s of sections) console.log(`   § ${s.label}${s.show_when_field ? `   [if ${s.show_when_field}=${s.show_when_value}]` : ''}`)
    console.log('\nDry run complete. Re-run with --commit to apply.')
    return
  }

  const { error: de } = await supabase.from('form_fields').delete().eq('form_id', form.id)
  if (de) throw de

  const rows = FIELDS.map((f, i) => ({
    form_id: form.id,
    label: f.label,
    field_type: f.field_type,
    placeholder: f.placeholder ?? null,
    options: f.options ?? null,
    is_required: f.is_required ?? false,
    sort_order: i,
    show_when_field: f.show_when_field ?? null,
    show_when_value: f.show_when_value ?? null,
  }))
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('form_fields').insert(rows.slice(i, i + 100))
    if (error) throw error
  }

  const { error: ue } = await supabase
    .from('forms').update({ description: DESCRIPTION }).eq('id', form.id)
  if (ue) throw ue

  console.log(`✓ Applied — ${rows.length} fields. The other forms are untouched.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
