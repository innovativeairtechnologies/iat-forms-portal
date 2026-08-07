/* Verifies lib/soo.ts + lib/soo-master.ts — the Sequence of Operation engine.
 *
 * The load-bearing claim of this feature is: **a clause cannot disappear
 * silently.** Every check below exists to make that claim falsifiable.
 *
 * Two things this suite is deliberately built to catch, because both would look
 * like success from the outside:
 *
 *   1. A clause dropping because a fact is NULL rather than because it does not
 *      apply. Two-valued predicate logic would do this at the first unread
 *      field, and the document would look complete.
 *   2. A test that asserts a rendered slot equals the fact it was copied from —
 *      which passes no matter how wrong the value is. So the assertions here are
 *      LITERALS ("120°F"), and each is followed by a MUTATION proving the
 *      assertion actually moves when the input does.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-soo.mjs
 *       node --import ./scripts/ts-resolve.mjs scripts/verify-soo.mjs --print
 */

import {
  CONTROL_CONSTANTS,
  FACT_SPECS,
  PROJECT_SETPOINTS,
  applyOverrides,
  approvalBlockers,
  assemble,
  blankFacts,
  clauseImpact,
  constantOverrides,
  eachRendered,
  evaluateRequires,
  gatingFactKeys,
  validateLibrary,
} from '../lib/soo.ts'
import { SOO_MASTER_LIBRARY } from '../lib/soo-master.ts'

let passed = 0
let failed = 0

function ok(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  } else {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  }
}

function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`)
}

// ─── The Ferrara unit ────────────────────────────────────────────────────────
// Hand-entered from the Trane Florida / Ferrara Orangeburg submittal
// (IAT-3000RS-IDP, Rev 2, 07-28-2026). Phase 2's extractor must reproduce this
// exact object from the PDF — it is the ground truth for that test too.

const FERRARA = {
  ...blankFacts(),
  customer: 'Trane Florida',
  project_name: 'Ferrara Orangeburg Site-25355-Rev 2',
  model_number: 'IAT-3000RS-IDP',
  unit_tag: null,
  voltage: '480/3/60',
  controls_package: 'icontrol_premium',
  bas_protocol: 'bacnet_mstp',

  has_desiccant_wheel: true,
  has_process_filter: true,
  has_react_filter: true,
  has_final_filter: true,
  has_process_fan: true,
  has_react_fan: true,
  has_afms: true,
  has_rotor_rotation_alarm: true,
  has_idp: true,
  has_process_plenum_pressure_xmtr: true,
  has_react_plenum_pressure_xmtr: true,
  dirty_filter_alarms: true,

  reactivation: 'steam',
  pre_cool_medium: 'chilled_water',
  post_cool_medium: 'chilled_water',
  post_heat_medium: 'hot_water',
  humidity_sensor_location: 'space',
  space_sensor_ships_loose: true,
  oa_damper: 'motorized_modulating',
  ra_damper: 'none',
  react_outlet_damper: 'manually_set',
  process_fan_drive: 'vfd',
  react_fan_drive: 'vfd',
  wheel_drive: 'vfd',

  process_cfm: 3000,
  react_cfm: 1000,
  outside_air_cfm: 1500,
  return_air_cfm: 1500,
  process_esp_inwc: 2.0,
  react_esp_inwc: 2.0,
  react_heat_to_f_summer: 240,
  react_heat_to_f_winter: 120,
  moisture_removal_lb_hr: 153,
  steam_pressure_psi: 100,
  weather: { station: 'COLUMBIA OWENS, SC', elevation_ft: 179, design_db_f: 97.1, design_wb_f: 78.6, heating_db_f: 25.7 },
}

/** Flat list of every included clause key, in document order. */
function keysOf(result) {
  const out = []
  eachRendered(result, (c) => out.push(c.key))
  return out
}

function textOf(result, key) {
  let found = null
  eachRendered(result, (c) => {
    if (c.key === key) found = c.text
  })
  return found
}

function has(result, key) {
  return keysOf(result).includes(key)
}

function excludedKeys(result) {
  return result.excluded.map((e) => e.key)
}

function blockedKeys(result) {
  return result.blocked.map((b) => b.key)
}

const base = assemble(SOO_MASTER_LIBRARY, FERRARA)

// ─── 1. Library integrity ────────────────────────────────────────────────────

section('Library integrity')

ok('the master library validates', validateLibrary(SOO_MASTER_LIBRARY) === null, validateLibrary(SOO_MASTER_LIBRARY) ?? '')
ok('every section produced clauses for the Ferrara unit', base.sections.length === 4, `${base.sections.length} sections`)
ok('nothing is blocked for a fully-specified unit', base.blocked.length === 0, blockedKeys(base).join(', '))
ok('nothing is uncovered for a fully-specified unit', base.uncovered.length === 0, base.uncovered.map((u) => u.fact).join(', '))
ok('no project setpoint is left unset', base.unsetSetpoints.length === 0, base.unsetSetpoints.join(', '))

// validateLibrary must reject each way a library can silently break.
const bad = (mutate, label) => {
  const clone = structuredClone(SOO_MASTER_LIBRARY)
  mutate(clone)
  const err = validateLibrary(clone)
  ok(label, err !== null, err ?? 'accepted a library it should have rejected')
}

bad((l) => {
  l.sections[0].clauses[0].requires = [{ fact: 'reactivaton', is: 'steam' }]
}, 'rejects a typo\'d fact key (the silent-drop bug)')
bad((l) => {
  l.sections[0].clauses[0].requires = [{ fact: 'process_cfm', is: 3000 }]
}, 'rejects gating on a design condition')
bad((l) => {
  l.sections[0].clauses[0].requires = [{ fact: 'reactivation', is: 'diesel' }]
}, 'rejects an enum value outside the fact\'s options')
bad((l) => {
  l.sections[1].clauses[0].key = l.sections[0].clauses[0].key
}, 'rejects a duplicate clause key')
bad((l) => {
  l.sections[0].clauses[0].body = 'Uses {{ghost}} with no binding.'
}, 'rejects an unbound {{placeholder}}')
bad((l) => {
  // ADD an orphan rather than replacing `slots` — replacing would also orphan
  // {{protocol}}, and the test would pass for the wrong reason.
  l.sections[0].clauses[0].slots.orphan = { from: 'literal', text: 'x' }
}, 'rejects a slot binding with no placeholder')
bad((l) => {
  l.sections[0].clauses.push({
    key: 'depth_a', order: 999, body: 'a',
    children: [{ key: 'depth_b', order: 1, body: 'b', children: [{ key: 'depth_c', order: 1, body: 'c', children: [{ key: 'depth_d', order: 1, body: 'd' }] }] }],
  })
}, 'rejects nesting deeper than 3 levels')

// ─── 2. Control constants render as literals ─────────────────────────────────

section('Control constants — literal assertions, then mutations')

const wheelCond = textOf(base, 'wheel_cond_react_temp')
ok('react permissive renders as 120°F', wheelCond === 'The React Plenum temperature is above 120°F.', wheelCond ?? 'clause missing')

const reactMode = textOf(base, 'react_mode_manual')
ok('react ceiling renders as 300°F', (reactMode ?? '').includes('maximum temperature setpoint is 300°F.'), '')

const stage1 = textOf(base, 'pre_cooling_freeze_stage1')
ok('freeze Stage 1 renders 40°F / 100% / 50%', (stage1 ?? '').includes('default 40°F') && (stage1 ?? '').includes('opens to 100%') && (stage1 ?? '').includes('reduced to 50%'), '')

const stage2Heat = textOf(base, 'post_heating_freeze_stage2')
ok('post-heat Stage 2 renders 35°F', (stage2Heat ?? '').includes('default 35°F'), stage2Heat ?? 'clause missing')

// MUTATION: change the constant, prove every rendering moves. Without this the
// assertions above would pass against a hard-coded string in the clause body.
{
  const original = CONTROL_CONSTANTS.react_permissive_f.value
  CONTROL_CONSTANTS.react_permissive_f.value = 137
  const mutated = assemble(SOO_MASTER_LIBRARY, FERRARA)
  const sites = ['wheel_cond_react_temp', 'dehum_satisfied', 'shutdown_react_purge']
  const moved = sites.every((k) => (textOf(mutated, k) ?? '').includes('137°F'))
  const noneStale = sites.every((k) => !(textOf(mutated, k) ?? '').includes('120°F'))
  CONTROL_CONSTANTS.react_permissive_f.value = original
  ok('changing the permissive constant moves all three of its uses', moved && noneStale, sites.join(', '))
}

ok('every control constant carries a rationale', Object.values(CONTROL_CONSTANTS).every((c) => c.rationale.trim().length > 20))

// ─── 3. Three-valued predicates: null ≠ false ────────────────────────────────

section('Three-valued predicates — the silent-omission guard')

{
  const unknown = { ...FERRARA, reactivation: null }
  const r = assemble(SOO_MASTER_LIBRARY, unknown)
  ok('an unknown fact BLOCKS its clauses', blockedKeys(r).includes('react_heat_steam'), blockedKeys(r).join(', '))
  ok('an unknown fact does NOT exclude its clauses', !excludedKeys(r).includes('react_heat_steam'))
  ok('the block names the fact a human must resolve', r.blocked.find((b) => b.key === 'react_heat_steam')?.needs.includes('reactivation') === true)
  ok('a blocked clause is absent from the document body', !has(r, 'react_heat_steam'))
}

{
  const known = { ...FERRARA, reactivation: 'gas' }
  const r = assemble(SOO_MASTER_LIBRARY, known)
  ok('a known non-matching fact EXCLUDES, not blocks', excludedKeys(r).includes('react_heat_steam') && !blockedKeys(r).includes('react_heat_steam'))
  ok('the exclusion says why in plain English', /Reactivation type is Steam — unit is Gas/.test(r.excluded.find((e) => e.key === 'react_heat_steam')?.why ?? ''), r.excluded.find((e) => e.key === 'react_heat_steam')?.why ?? '')
}

{
  // A definitive false beats an unknown: the gas clause is genuinely N/A on a
  // steam unit even if some other fact in its predicate is still null.
  const mixed = { ...blankFacts(), reactivation: 'steam' }
  const v = evaluateRequires([{ fact: 'reactivation', is: 'gas' }, { fact: 'has_afms', is: true }], mixed)
  ok('unsatisfied wins over indeterminate', v.verdict === 'unsatisfied', v.verdict)
}

{
  // A fact SLOT that can't be filled must block, never render a gap.
  const noVoltage = { ...FERRARA, bas_protocol: null }
  const r = assemble(SOO_MASTER_LIBRARY, noVoltage)
  ok('a clause whose slot fact is null is blocked, not rendered blank', blockedKeys(r).includes('enable_selector_bas') || !has(r, 'enable_selector_bas'))
  const rendered = keysOf(r).map((k) => textOf(r, k)).join('\n')
  ok('no rendered text contains an unresolved {{placeholder}}', !rendered.includes('{{'), '')
}

// ─── 4. Coverage — "not written yet" ≠ "not applicable" ──────────────────────

section('Coverage')

{
  const gas = { ...FERRARA, reactivation: 'gas' }
  const r = assemble(SOO_MASTER_LIBRARY, gas)
  ok('a gas unit reports uncovered reactivation', r.uncovered.some((u) => u.fact === 'reactivation'), JSON.stringify(r.uncovered))
  const doc = { ...blankDoc(), facts: gas, assembled: r }
  ok('uncovered reactivation blocks approval', approvalBlockers(doc).some((b) => b.includes('reactivation heat sequence')), approvalBlockers(doc).join(' | '))
}

{
  const r = assemble(SOO_MASTER_LIBRARY, FERRARA)
  ok('steam reactivation is covered', !r.uncovered.some((u) => u.fact === 'reactivation'))
}

// ─── 4b. The 2026-08-07 regression unit ──────────────────────────────────────
// Jacob's first hand-built test configuration. It found three holes the Ferrara
// unit could not, because Ferrara happens to be fully covered by the library:
//   · gas reactivation      → no heat sequence, and the PRINT view dropped the
//                             warning, so the PDF read as complete
//   · no rotor alarm pkg    → BOTH wheel-start clauses excluded; the wheel never
//                             started, and nothing flagged it
//   · DX pre-cooling        → no pre-cooling sequence, yet a pre-cooling pilot
//                             light, sensor and valve all still referenced
// Kept as a permanent case: any of these regressing is a field-safety problem.

const TEST_UNIT_20260807 = {
  ...blankFacts(),
  customer: 'IAT', project_name: 'Test', model_number: '5000-25', unit_tag: 'Test', voltage: '250',
  controls_package: 'icontrol_premium', bas_protocol: 'bacnet_mstp',
  has_desiccant_wheel: true, has_process_filter: true, has_react_filter: true, has_final_filter: false,
  has_process_fan: true, has_react_fan: true, has_afms: true, has_rotor_rotation_alarm: false,
  has_idp: true, has_process_plenum_pressure_xmtr: false, has_react_plenum_pressure_xmtr: true,
  dirty_filter_alarms: false,
  reactivation: 'gas', pre_cool_medium: 'dx', post_cool_medium: 'chilled_water',
  post_heat_medium: 'hot_water', humidity_sensor_location: 'space', space_sensor_ships_loose: true,
  oa_damper: 'two_position', ra_damper: 'motorized_modulating', react_outlet_damper: 'manually_set',
  process_fan_drive: 'vfd', react_fan_drive: 'vfd', wheel_drive: 'vfd',
}

section('Regression — the 2026-08-07 test unit')

{
  const r = assemble(SOO_MASTER_LIBRARY, TEST_UNIT_20260807)
  const text = keysOf(r).map((k) => textOf(r, k)).join(' ')

  ok('the desiccant wheel starts even without the rotor alarm package', has(r, 'wheel_start_vfd'), keysOf(r).filter((k) => k.startsWith('wheel')).join(', '))
  ok('the rotation proving switch is correctly absent', !has(r, 'wheel_rotation_proving'))
  ok('gas reactivation is reported uncovered', r.uncovered.some((u) => u.fact === 'reactivation'))
  ok('DX pre-cooling is reported uncovered', r.uncovered.some((u) => u.fact === 'pre_cool_medium'), JSON.stringify(r.uncovered.map((u) => u.fact)))
  ok('a sensor clause alone does NOT satisfy coverage', r.uncovered.some((u) => u.fact === 'pre_cool_medium') && has(r, 'device_pre_cool_lat'))

  // The document must never instruct anyone to operate a component the unit
  // does not have — least of all inside a freeze-protection sequence.
  ok('nothing tells you to open a pre-cooling VALVE on a DX unit', !/pre-cooling (chilled water )?valve/i.test(text), (text.match(/[^.]*pre-cooling (chilled water )?valve[^.]*\./i) ?? [''])[0])
  ok('shutdown does not close valves the unit lacks', !has(r, 'shutdown_pre_cool_valve') && has(r, 'shutdown_post_cool_valve'))
  ok('an uncovered unit cannot be approved', approvalBlockers({ ...blankDoc(), facts: TEST_UNIT_20260807, assembled: r }).length > 0)
  ok('the excluded receipt carries readable names, not clause keys', r.excluded.every((e) => e.summary && !/^[a-z0-9_]+$/.test(e.summary)), r.excluded.map((e) => e.summary).filter((s) => /^[a-z0-9_]+$/.test(s)).join(', '))
}

// A fully-covered unit must stay clean — the guards above must not fire on Ferrara.
ok('the Ferrara unit reports nothing uncovered', base.uncovered.length === 0, JSON.stringify(base.uncovered))
ok('the Ferrara wheel still starts and is still proven', has(base, 'wheel_start_vfd') && has(base, 'wheel_rotation_proving'))

// ─── 5. Conditional inclusion — mutation-tested ──────────────────────────────

section('Conditional inclusion')

const cases = [
  {
    // Freeze Stage 2 is now a lead-in plus one conditional action per bullet,
    // so the dampers gate themselves instead of needing a variant per pairing.
    label: 'no return-air damper → the RA action drops out of every freeze Stage 2',
    facts: FERRARA,
    present: ['pre_cooling_freeze_stage2', 'pre_cooling_fs2_oa', 'post_cooling_fs2_oa', 'post_heating_fs2_oa'],
    absent: ['pre_cooling_fs2_ra', 'post_cooling_fs2_ra', 'post_heating_fs2_ra', 'shutdown_ra_damper', 'run_ra_damper_modulating'],
  },
  {
    label: 'a return-air damper adds the RA action to every freeze Stage 2',
    facts: { ...FERRARA, ra_damper: 'motorized_modulating' },
    present: ['pre_cooling_fs2_ra', 'post_cooling_fs2_ra', 'post_heating_fs2_ra', 'shutdown_ra_damper', 'run_ra_damper_modulating'],
    absent: [],
  },
  {
    // The bug this restructure fixed: a safety clause naming a component the
    // unit does not have.
    label: 'DX pre-cooling removes the pre-cooling valve from post-cooling freeze Stage 2',
    facts: { ...FERRARA, pre_cool_medium: 'dx' },
    present: ['post_cooling_fs2_post_valve', 'post_cooling_fs2_alarm'],
    absent: ['post_cooling_fs2_pre_valve', 'post_heating_fs2_pre_valve', 'shutdown_pre_cool_valve'],
  },
  {
    label: 'no AFMS drops the ventilation-flow clause and its instrument',
    facts: { ...FERRARA, has_afms: false },
    present: ['run_oa_damper_modulating'],
    absent: ['run_oa_afms', 'device_afms'],
  },
  {
    label: 'no dirty-filter alarms drops all three filter transmitters',
    facts: { ...FERRARA, dirty_filter_alarms: false },
    present: ['device_react_temp'],
    absent: ['device_process_filter_pt', 'device_final_filter_pt', 'device_react_filter_pt'],
  },
  {
    label: 'no pre-cooling coil drops the whole pre-cooling sequence',
    facts: { ...FERRARA, pre_cool_medium: 'none' },
    present: ['post_cooling', 'post_heating'],
    absent: ['pre_cooling', 'pre_cooling_freeze_stage1', 'device_pre_cool_freezestat', 'pilot_light_pre_cool'],
  },
  {
    label: 'leaving-air humidity control swaps the control basis',
    facts: { ...FERRARA, humidity_sensor_location: 'post_desiccant' },
    present: ['humidity_basis_leaving'],
    absent: ['humidity_basis_space'],
  },
  {
    label: 'no BAS drops the interface section and the protocol wording',
    facts: { ...FERRARA, bas_protocol: 'none' },
    present: ['enable_selector_local'],
    absent: ['enable_selector_bas', 'bas_interface', 'bas_protocol_line', 'humidity_setpoint_bas'],
  },
  {
    label: 'a factory-fitted space sensor drops the ships-loose wording',
    facts: { ...FERRARA, space_sensor_ships_loose: false },
    present: ['device_space_sensor_fitted', 'hcm_mode_space_installed'],
    absent: ['device_space_sensor_loose', 'hcm_mode_space', 'bas_space_sensor_inputs'],
  },
  {
    label: 'an across-the-line process fan drops the VFD speed wording',
    facts: { ...FERRARA, process_fan_drive: 'across_line' },
    present: ['run_process_fan_direct'],
    absent: ['run_process_fan_vfd'],
  },
]

for (const c of cases) {
  const r = assemble(SOO_MASTER_LIBRARY, c.facts)
  const keys = keysOf(r)
  const missing = c.present.filter((k) => !keys.includes(k))
  const leaked = c.absent.filter((k) => keys.includes(k))
  ok(c.label, missing.length === 0 && leaked.length === 0, [missing.length ? `missing ${missing.join(',')}` : '', leaked.length ? `leaked ${leaked.join(',')}` : ''].filter(Boolean).join(' · '))
}

// A parent that dies takes its children with it — structurally, not by rule.
{
  const r = assemble(SOO_MASTER_LIBRARY, { ...FERRARA, pre_cool_medium: 'none' })
  ok('a dead parent takes its children with it', !has(r, 'pre_cooling_freeze_stage1') && !has(r, 'pre_cooling_modulate'))
}

// ─── 6. Exclusions are reported, not silent ──────────────────────────────────

section('Exclusion receipts')

{
  const r = assemble(SOO_MASTER_LIBRARY, { ...FERRARA, pre_cool_medium: 'none', post_heat_medium: 'none' })
  ok('excluded clauses are reported', r.excluded.length > 0, `${r.excluded.length} excluded`)
  ok('every exclusion carries a human-readable reason', r.excluded.every((e) => e.why.trim().length > 10))
  ok('every exclusion names its section', r.excluded.every((e) => e.section.trim().length > 0))
  ok('the pre-cooling exclusion is listed', excludedKeys(r).includes('pre_cooling'))
}

// ─── 7. Project setpoints ────────────────────────────────────────────────────
// The master library binds none (the source document commits to no values), so
// the machinery is exercised against a synthetic clause rather than left untested.

section('Project setpoints')

const SETPOINT_LIB = {
  version: 99,
  sections: [
    {
      key: 's',
      number: 1,
      title: 'T',
      clauses: [
        {
          key: 'sp',
          order: 1,
          body: 'Maintain {{dp}}.',
          slots: { dp: { from: 'project', key: 'space_dewpoint_setpoint_f', required: true } },
        },
      ],
    },
  ],
}

ok('the synthetic setpoint library validates', validateLibrary(SETPOINT_LIB) === null, validateLibrary(SETPOINT_LIB) ?? '')

{
  const r = assemble(SETPOINT_LIB, blankFacts(), {})
  ok('an unset setpoint renders its placeholder visibly', textOf(r, 'sp') === `Maintain ${PROJECT_SETPOINTS.space_dewpoint_setpoint_f.placeholder}.`, textOf(r, 'sp') ?? '')
  ok('an unset setpoint is reported', r.unsetSetpoints.includes('space_dewpoint_setpoint_f'))
  ok('an unset setpoint blocks approval', approvalBlockers({ ...blankDoc(), facts: blankFacts(), assembled: r }).some((b) => b.includes('TBD')))
}

{
  const r = assemble(SETPOINT_LIB, blankFacts(), { space_dewpoint_setpoint_f: 52 })
  ok('a set setpoint renders its value', textOf(r, 'sp') === 'Maintain 52°F.', textOf(r, 'sp') ?? '')
  ok('a set setpoint no longer blocks', r.unsetSetpoints.length === 0)
}

// ─── 8. Overrides + constant-edit notes ──────────────────────────────────────

section('Human overrides')

{
  const overrides = [{ clause_key: 'wheel_cond_react_temp', text: 'The React Plenum temperature is above 150°F.' }]
  const applied = applyOverrides(base, overrides)
  ok('an override replaces the clause text', textOf(applied, 'wheel_cond_react_temp') === 'The React Plenum temperature is above 150°F.')
  ok('an override to a constant-bearing clause is detected', constantOverrides(base, overrides).length === 1)
  const doc = { ...blankDoc(), facts: FERRARA, assembled: base, overrides }
  ok('an un-noted constant override blocks approval', approvalBlockers(doc).some((b) => b.includes('needs a note')), approvalBlockers(doc).join(' | '))
  const noted = [{ ...overrides[0], note: 'Site steam header runs hot; agreed with the controls contractor 2026-08-06.' }]
  ok('a noted constant override does not block', !approvalBlockers({ ...doc, overrides: noted }).some((b) => b.includes('needs a note')))
}

{
  const overrides = [{ clause_key: 'note_hmi_help', text: 'Reworded.' }]
  ok('an override to a clause with no constant needs no note', constantOverrides(base, overrides).length === 0)
}

// ─── 9. Review-table support ─────────────────────────────────────────────────

section('Review table support')

{
  const gating = gatingFactKeys(SOO_MASTER_LIBRARY)
  ok('gating facts are identified', gating.length > 10, `${gating.length} gating facts`)
  ok('design conditions never gate', !gating.some((k) => FACT_SPECS[k].group === 'design'), gating.filter((k) => FACT_SPECS[k].group === 'design').join(','))

  const impact = clauseImpact(SOO_MASTER_LIBRARY, FERRARA, 'reactivation')
  ok('clause impact counts what a fact switches on', impact.on >= 2, JSON.stringify(impact))

  const raImpact = clauseImpact(SOO_MASTER_LIBRARY, FERRARA, 'ra_damper')
  ok('clause impact counts what a fact switches off', raImpact.off >= 3, JSON.stringify(raImpact))
}

// ─── 10. Approval gate ───────────────────────────────────────────────────────

section('Approval gate')

function blankDoc() {
  return {
    id: 'x', title: 't', customer_name: 'c', project_name: 'p', unit_tag: null, status: 'draft',
    facts: null, provenance: null, conflicts: null, setpoints: null, assembled: null, overrides: null,
    library_version: null, submittal_path: null, assembled_at: null, submitted_at: null,
    approved_at: null, approved_by: null, review_notes: null, created_at: '', updated_at: '',
  }
}

ok('a fully-specified Ferrara document has no blockers', approvalBlockers({ ...blankDoc(), facts: FERRARA, assembled: base }).length === 0, approvalBlockers({ ...blankDoc(), facts: FERRARA, assembled: base }).join(' | '))
ok('an unassembled document blocks', approvalBlockers({ ...blankDoc(), facts: FERRARA }).length > 0)
ok('unconfirmed facts block', approvalBlockers({ ...blankDoc(), assembled: base }).some((b) => b.includes('not been confirmed')))
{
  const r = assemble(SOO_MASTER_LIBRARY, { ...FERRARA, reactivation: null })
  ok('a blocked clause blocks approval', approvalBlockers({ ...blankDoc(), facts: FERRARA, assembled: r }).some((b) => b.includes('could not be resolved')))
}
{
  const doc = { ...blankDoc(), facts: FERRARA, assembled: base, conflicts: [{ fact: 'reactivation' }] }
  ok('an unresolved extraction conflict blocks approval', approvalBlockers(doc).some((b) => b.includes('conflict')))
}

// ─── 11. Determinism ─────────────────────────────────────────────────────────

section('Determinism')

ok('the same inputs produce byte-identical output', JSON.stringify(assemble(SOO_MASTER_LIBRARY, FERRARA)) === JSON.stringify(assemble(SOO_MASTER_LIBRARY, FERRARA)))
ok('assembly does not mutate the facts', JSON.stringify(FERRARA) === JSON.stringify({ ...FERRARA }))

// ─── The generated document ──────────────────────────────────────────────────

function renderPlain(result) {
  const lines = []
  for (const s of result.sections) {
    lines.push('', `${s.title}:`, '')
    const walk = (clauses) => {
      for (const c of clauses) {
        if (c.heading) lines.push(c.heading)
        if (c.text.trim()) lines.push(`${'    '.repeat(c.depth)}${c.depth > 0 ? '• ' : ''}${c.text}`)
        walk(c.children)
      }
    }
    walk(s.clauses)
  }
  return lines.join('\n')
}

if (process.argv.includes('--print')) {
  console.log('\n' + '═'.repeat(78))
  console.log('GENERATED SEQUENCE OF OPERATION — Ferrara Orangeburg, IAT-3000RS-IDP')
  console.log('═'.repeat(78))
  console.log(renderPlain(base))
  console.log('\n' + '─'.repeat(78))
  console.log(`Not applicable to this unit: ${base.excluded.length} clauses`)
  for (const e of base.excluded) console.log(`  · ${e.key} — ${e.why}`)
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const included = keysOf(base).length
console.log(`\n\x1b[1mSummary\x1b[0m`)
console.log(`  ${included} clauses included · ${base.excluded.length} not applicable · ${base.blocked.length} blocked`)
console.log(`  \x1b[32m${passed} passed\x1b[0m${failed ? `  \x1b[31m${failed} failed\x1b[0m` : ''}`)
process.exit(failed ? 1 : 0)
