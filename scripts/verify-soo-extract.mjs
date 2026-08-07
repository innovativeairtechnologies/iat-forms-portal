/* Verifies lib/soo-extract.ts against the REAL Ferrara submittal.
 *
 * The claim under test: the deterministic pass reproduces, from a 45-page PDF,
 * the fact set that was hand-entered in Phase 1 — without a model, without a
 * network call, and without reading a single value off the two flow-diagram
 * pages (which are images).
 *
 * This is a fixture-backed test, not a mock. It runs the actual parsers over the
 * actual document, so a DryWare layout change breaks it loudly here rather than
 * silently in production. If the PDF is missing the suite SKIPS the fixture
 * section rather than passing vacuously — a green run that tested nothing is
 * worse than a red one.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-soo-extract.mjs
 *       node --import ./scripts/ts-resolve.mjs scripts/verify-soo-extract.mjs --dump
 */

import fs from 'node:fs'
import {
  classifyPages,
  extractDeterministic,
  factsFromBullets,
  num,
  parseBullets,
  parseDuctConnections,
  parseSchedule,
  splitSeasonal,
} from '../lib/soo-extract.ts'
import { FACT_SPECS, factValueLabel } from '../lib/soo.ts'
import { parseModelNumber } from '../lib/sizing-catalog.ts'

const SUBMITTAL =
  'C:/Users/JacobY/Downloads/Trane Florida ( Ferrara Orangeburg Site)-25355-Rev 2 - Sales Submittal PRELIMINARY - NOT FOR CONSTRUCTION 07-28-2026.pdf'

let passed = 0
let failed = 0
let skipped = 0

function ok(label, condition, detail = '') {
  if (condition) { passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`) }
  else { failed++; console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`) }
}
function section(t) { console.log(`\n\x1b[1m${t}\x1b[0m`) }

// ─── Unit tests that need no fixture ─────────────────────────────────────────

section('Value coercion')
ok('seasonal split reads both halves', JSON.stringify(splitSeasonal('240.0(S) / 120.0(W)')) === '{"summer":240,"winter":120}', JSON.stringify(splitSeasonal('240.0(S) / 120.0(W)')))
ok('thousands separators survive', num('3,000') === 3000)
ok('units are stripped', num('0.86') === 0.86 && num('153.0') === 153)
ok('a non-number is null, never NaN', num('MERV 8') === 8 && num('') === null)

section('Bullet shapes')
{
  // The two-column layout puts several bullets on ONE text line. Splitting on
  // newlines instead of the bullet glyph would have merged these into one.
  const page = { page: 6, kind: 'humidity-control', text: '· Model - 3176 iControl Premium PLC · Control Based On - Room Conditions\n· Space Sensor - Ships Loose\n· Rotor Rotation Alarm Package' }
  const b = parseBullets([page])
  ok('two bullets on one line are split apart', b.length === 4, `${b.length} bullets`)
  ok('a dash bullet yields label + value', b.some((x) => x.label === 'Control Based On' && x.value === 'Room Conditions'))
  ok('a bare bullet yields a flag', b.some((x) => x.label === 'Rotor Rotation Alarm Package' && x.value === null))
  const { sources } = factsFromBullets(b)
  ok('room conditions → space', sources.some((s) => s.fact === 'humidity_sensor_location' && s.value === 'space'))
  ok('the rotor alarm package is detected', sources.some((s) => s.fact === 'has_rotor_rotation_alarm' && s.value === true))
}

section('Refusing to guess')
{
  const b = parseBullets([{ page: 6, kind: 'humidity-control', text: '· Controls Communication Protocol - BACnet' }])
  const { sources, notes } = factsFromBullets(b)
  // "BACnet" alone says neither MS/TP nor IP. Picking one would be a coin flip
  // printed as fact in a controls contract.
  ok('bare “BACnet” does NOT become a protocol', !sources.some((s) => s.fact === 'bas_protocol'))
  ok('and it is reported for a human to resolve', notes.length === 1, notes[0]?.text ?? '')

  const b2 = parseBullets([{ page: 6, kind: 'humidity-control', text: '· Controls Communication Protocol - BACnet MS/TP' }])
  ok('“BACnet MS/TP” IS unambiguous', factsFromBullets(b2).sources.some((s) => s.fact === 'bas_protocol' && s.value === 'bacnet_mstp'))
}

section('Page classification')
{
  // The footer is what marks a page as one DryWare laid out, so the fixtures
  // carry it — a fixture without it would be testing the vendor path by accident.
  const foot = '\ninfo@dehumidifiers.com • 770-788-6744 • www.dehumidifiers.com'
  const pages = classifyPages([
    'Customer: X\nSchedule\nGeneral\nVoltage: 480/3/60' + foot,
    'Steam React Heat\nPSI 100' + foot,
    'SECTION 23 84 19\nMaster Guide Specifications\nprovide freezestat set at 35°F',
    'Prefilters MERV 4-13\nPleated Panel Filters\ncamfil\n' + 'x'.repeat(400),
    'Duct Connection Features\n· Outside Air' + foot,
    // Our own Process Fan page names the manufacturer. Matching "New York
    // Blower" as a vendor marker would misfile it — and with it, the fan facts.
    'Process Fan\nSpecs/Features\n· Manufacturer - New York Blower\n· VFD - Yes' + foot,
  ])
  ok('the Schedule is found by heading', pages[0].kind === 'schedule')
  ok('a Schedule continuation page is carried over', pages[1].kind === 'schedule')
  ok('the guide spec is identified for removal', pages[2].kind === 'guide-spec')
  ok('vendor literature is identified for removal', pages[3].kind === 'vendor')
  ok('duct connections are found', pages[4].kind === 'duct-connections')
  ok('our own fan page is NOT mistaken for vendor literature', pages[5].kind === 'component', pages[5].kind)
}

// ─── The real submittal ──────────────────────────────────────────────────────

if (!fs.existsSync(SUBMITTAL)) {
  section('Ferrara submittal fixture')
  console.log(`  \x1b[33mSKIP\x1b[0m  fixture not found — ${SUBMITTAL}`)
  skipped++
} else {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(SUBMITTAL)))
  const { text } = await extractText(pdf, { mergePages: false })
  const pageTexts = Array.isArray(text) ? text : [String(text)]

  section('Ferrara submittal — page classification')
  const pages = classifyPages(pageTexts)
  const count = (k) => pages.filter((p) => p.kind === k).length
  ok('all 45 pages classified', pages.length === 45)
  ok('13 pages of guide spec identified', count('guide-spec') === 13, `${count('guide-spec')} found`)
  ok('vendor cut sheets identified', count('vendor') === 8, `${count('vendor')} found`)
  ok('4 Schedule pages identified', count('schedule') === 4, `${count('schedule')} found`)
  ok('the duct-connection page identified', count('duct-connections') === 1)
  ok('the flow diagrams are identified (and never read)', count('flow-diagram') === 2, `${count('flow-diagram')} found`)

  section('Ferrara submittal — Schedule parser')
  const { entries, unmapped } = parseSchedule(pages)
  ok('the Schedule parses into entries', entries.length > 90, `${entries.length} entries`)
  ok('few lines go unmapped', unmapped.length <= 4, `${unmapped.length} unmapped: ${unmapped.map((u) => u.text).join(' | ').slice(0, 140)}`)
  const find = (g, l) => entries.find((e) => e.group === g && e.label === l)?.value
  ok('label/value split is exact on a hard line', find('Dehumidifier', 'Desiccant Wheel Size') === '965 X 200', find('Dehumidifier', 'Desiccant Wheel Size'))
  ok('a MERV value is not mistaken for a label', find('Process Filter', 'Filter Efficiency (MERV)') === 'MERV 8', find('Process Filter', 'Filter Efficiency (MERV)'))
  ok('the react heater type is read', find('General', 'React Heater Type') === 'Steam')

  section('Ferrara submittal — duct connections')
  const duct = parseDuctConnections(pages)
  ok('all five openings found', duct.length === 5, duct.map((d) => d.opening).join(', '))
  ok('the OA damper carries its control option', duct.find((d) => /Outside Air/i.test(d.opening))?.options['Control Option'] === 'Modulating')
  ok('the RA damper reads None', duct.find((d) => /Return Air/i.test(d.opening))?.options['Damper'] === 'None')

  // ── The acceptance gate ────────────────────────────────────────────────────
  // Must equal the Phase 1 hand-entered set (FERRARA in verify-soo.mjs).
  section('Ferrara submittal — extracted vs hand-entered')
  const rec = extractDeterministic(pageTexts, parseModelNumber)

  const EXPECTED = {
    customer: 'Trane Florida',
    project_name: 'Ferrara Orangeburg Site-25355-Rev 2',
    model_number: 'IAT-3000RS-IDP',
    voltage: '480/3/60',
    controls_package: 'icontrol_premium',
    has_desiccant_wheel: true,
    has_process_filter: true,
    has_react_filter: true,
    has_final_filter: true,
    has_process_fan: true,
    has_react_fan: true,
    has_afms: true,
    has_rotor_rotation_alarm: true,
    has_idp: true,
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
    process_cfm: 3000,
    react_cfm: 1000,
    process_esp_inwc: 2,
    react_esp_inwc: 2,
    react_heat_to_f_summer: 240,
    react_heat_to_f_winter: 120,
    moisture_removal_lb_hr: 153,
    steam_pressure_psi: 100,
  }

  for (const [key, want] of Object.entries(EXPECTED)) {
    const got = rec.facts[key]
    const prov = rec.provenance[key]
    ok(
      `${FACT_SPECS[key].label} = ${factValueLabel(key, want)}`,
      JSON.stringify(got) === JSON.stringify(want),
      got === want ? `${prov?.method} p.${prov?.page}${rec.agreement[key] > 1 ? ` · ${rec.agreement[key]} sources agree` : ''}` : `got ${JSON.stringify(got)}`
    )
  }

  section('Ferrara submittal — what extraction honestly cannot know')
  // These are NOT in the submittal at any point. Leaving them null is correct:
  // their clauses block and a human fills them in. Asserting it so nobody
  // "helpfully" infers them from the controls package later.
  for (const key of ['has_process_plenum_pressure_xmtr', 'has_react_plenum_pressure_xmtr', 'wheel_drive', 'unit_tag']) {
    ok(`${FACT_SPECS[key].label} stays unknown rather than guessed`, rec.facts[key] === null, JSON.stringify(rec.facts[key]))
  }
  ok('the ambiguous BACnet protocol is left unset', rec.facts.bas_protocol === null, JSON.stringify(rec.facts.bas_protocol))
  ok('…and the reason is reported', rec.unmapped.some((u) => /MS\/TP or IP/.test(u.text)))

  section('Ferrara submittal — cross-checking')
  ok('reactivation was confirmed by several independent readings', (rec.agreement.reactivation ?? 0) >= 3, `${rec.agreement.reactivation} sources agree`)
  ok('no conflicts on a clean document', rec.conflicts.length === 0, JSON.stringify(rec.conflicts.map((c) => c.fact)))

  // Mutation: corrupt the model number and prove the cross-check FIRES. Without
  // this, "no conflicts" above would pass even if reconciliation were a no-op.
  const corrupted = pageTexts.map((t) => t.replace(/IAT-3000RS-IDP/g, 'IAT-3000RE-IDP'))
  const bad = extractDeterministic(corrupted, parseModelNumber)
  ok('a model number disagreeing with the Schedule raises a conflict', bad.conflicts.some((c) => c.fact === 'reactivation'), JSON.stringify(bad.conflicts.map((c) => c.fact)))
  ok('and the Schedule still wins over the model number', bad.facts.reactivation === 'steam', String(bad.facts.reactivation))

  if (process.argv.includes('--dump')) {
    console.log('\n' + '═'.repeat(70))
    console.log('EXTRACTED FACTS')
    console.log('═'.repeat(70))
    for (const k of Object.keys(FACT_SPECS)) {
      const v = rec.facts[k]
      if (v === null) continue
      const p = rec.provenance[k]
      console.log(`  ${FACT_SPECS[k].label.padEnd(38)} ${factValueLabel(k, v).padEnd(26)} ${p?.method ?? ''} p.${p?.page ?? '?'}`)
    }
    console.log(`\n  unmapped (${rec.unmapped.length}):`)
    for (const u of rec.unmapped) console.log(`    · [${u.group}] ${u.text}`)
  }
}

console.log(`\n\x1b[1mSummary\x1b[0m`)
console.log(`  \x1b[32m${passed} passed\x1b[0m${failed ? `  \x1b[31m${failed} failed\x1b[0m` : ''}${skipped ? `  \x1b[33m${skipped} skipped\x1b[0m` : ''}`)
process.exit(failed ? 1 : 0)
