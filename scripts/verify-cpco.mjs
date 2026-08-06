/* Verifies lib/cpco — the c.pCO panel simulator engine.
 *
 * This is the acceptance test for the whole simulator. It walks the exact
 * sequence documented in IAT's "How to setup the BACnet instance" procedure —
 * which captures a real session one screenshot per keystroke — and asserts the
 * LITERAL text the panel should be showing at each step.
 *
 * The literals are typed from the PDF screenshots. They are never read back out
 * of the tree definitions, because a test that compares the tree to itself
 * passes no matter how wrong the tree is. Section 16 exists for the same
 * reason: it proves the scenario grader can still fail.
 *
 * If you change a menu tree and this goes red, the tree drifted from the panel.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-cpco.mjs
 */

import {
  createInitialState,
  DEFAULT_VALUES,
  evaluateScenario,
  iatTree,
  panelReducer,
  renderScreen,
  SCENARIOS_BY_ID,
  TREES,
} from '../lib/cpco/index.ts'

let checks = 0
let failures = 0

function ok(msg) {
  checks++
  console.log(`  ✓ ${msg}`)
}
function fail(msg, extra) {
  failures++
  console.error(`  ✗ ${msg}`)
  if (extra) console.error(extra)
}

let state = createInitialState(iatTree, { ...DEFAULT_VALUES })

const screen = () => TREES[state.treeId].screens[state.screenId]
const rows = () =>
  renderScreen(screen(), {
    values: state.values,
    cursor: state.cursor,
    digit: state.digit,
    selection: state.selection,
    alarms: [],
  })
const text = () => rows().map(r => r.cells.map(c => c.ch).join(''))

function press(button, n = 1) {
  for (let i = 0; i < n; i++) state = panelReducer(state, { type: 'press', button, at: 0 })
}

/** Asserts the visible lines, ignoring trailing whitespace and blank rows. */
function expectScreen(label, expected) {
  const want = expected.map(l => l.replace(/\s+$/, ''))
  const got = text()
    .map(l => l.replace(/\s+$/, ''))
    .slice(0, want.length)
  if (JSON.stringify(got) === JSON.stringify(want)) return ok(label)
  fail(label, `    expected: ${JSON.stringify(want)}\n    actual:   ${JSON.stringify(got)}`)
}

/** Every row is exactly 22 columns, or 16 on a double-height menu row, and the
    whole mask is always 8 body rows tall. */
function expectGrid(label) {
  const bad = rows().filter(r => r.cells.length !== (r.scale === 2 ? 16 : 22))
  const height = rows().reduce((n, r) => n + (r.scale === 2 ? 2 : 1), 0)
  if (bad.length === 0 && height === 8) return ok(label)
  fail(label, `    ${bad.length} mis-sized rows, height ${height}`)
}

function expectCursor(label, row, col) {
  const found = []
  rows().forEach((r, ri) => r.cells.forEach((c, ci) => c.cursor && found.push([ri, ci])))
  if (found.length === 1 && found[0][0] === row && found[0][1] === col) return ok(label)
  fail(label, `    expected cursor at [${row},${col}], found ${JSON.stringify(found)}`)
}

function expectEq(label, actual, want) {
  if (actual === want) return ok(label)
  fail(label, `    expected ${JSON.stringify(want)}, got ${JSON.stringify(actual)}`)
}

console.log('\n1. Main mask')
expectScreen('main mask matches the capture', [
  '02/04/24   Tue   18:31',
  'IAT',
  '',
  'pGDX Temp:        32.0',
  'pGDX Hum:          0.0',
  '',
  'Unit status:',
  'OFF BY KEYBOARD',
])
expectGrid('grid is 22 columns x 8 rows')

console.log('\n2. Prg opens the login, cursor already on the first digit')
press('prg')
expectScreen('login mask', ['Login', '', 'Insert password:  0000'])
expectCursor('cursor on password digit 0', 2, 18)

console.log('\n3. Enter walks the four digits, then opens the Main Menu')
press('enter')
expectCursor('cursor advanced to digit 1', 2, 19)
press('enter', 3)
expectEq('landed on the Main Menu', state.screenId, 'iat.main-menu')
expectScreen('Main Menu at 1/7', [
  'Main Menu          1/7',
  'Manufacturer Password',
  ' A. Device 1',
  ' B. Device 2',
  ' C. Device n',
])

console.log('\n4. Down five times reaches F. Settings at 6/7')
press('down', 5)
expectScreen('Main Menu at 6/7, selection centred', [
  'Main Menu          6/7',
  'Manufacturer Password',
  ' E. Alarm logs',
  ' F. Settings',
  ' G. Logout',
])

console.log('\n5. Settings, then down twice to Communications at 3/7')
press('enter')
expectScreen('Settings Menu at 1/7', [
  'Settings Menu      1/7',
  ' Date/Time',
  ' Language',
  ' Communications',
])
press('down', 2)
expectScreen('Settings Menu at 3/7', [
  'Settings Menu      3/7',
  ' Language',
  ' Communications',
  ' Pwd Change',
])

console.log('\n6. Comm Menu — BMS2 is the second entry')
press('enter')
expectScreen('Comm Menu at 1/6', ['Comm Menu          1/6', ' BMS Card', ' BMS2', ' DisplayPort'])
press('down')
expectScreen('Comm Menu at 2/6', ['Comm Menu          2/6', ' BMS Card', ' BMS2', ' DisplayPort'])

console.log('\n7. BMS2 mask, cursor starts above the first field')
press('enter')
expectScreen('BMS2 mask', [
  'Connectivity - BMS2',
  '',
  'Address:             1',
  'Protocol:         NONE',
  'Error:         NotUsed',
])
expectEq('no cursor yet', state.cursor, -1)

console.log('\n8. Enter twice puts the cursor on Protocol; Up cycles to BACNET')
press('enter', 2)
// "Protocol:" is 9 columns and the value block is 1 + 4, so the gap is 8 and
// the cursor lands at column 17, directly left of NONE.
expectCursor('cursor sits left of the Protocol value', 3, 17)
press('up', 3)
expectScreen('Protocol reads BACNET', [
  'Connectivity - BMS2',
  '',
  'Address:             1',
  'Protocol:       BACNET',
  'Error:         NotUsed',
])

console.log('\n9. Leaving the field raises the reboot prompt')
press('enter')
expectEq('reboot prompt shown', state.screenId, 'iat.reboot')
expectScreen('reboot prompt matches the capture', [
  'Communications',
  '',
  'Is necessary to reboot',
  'to apply the changes',
  '',
  '',
  'Press ENTER to reboot',
  'Press ESC to continue',
])

console.log('\n10. Enter restarts the controller back to the main mask')
press('enter')
expectEq('reboot counted', state.reboots, 1)
expectEq('back on the main mask', state.screenId, 'iat.main')
expectEq('keypad is dead while booting', state.booting, true)
press('prg')
expectEq('Prg ignored during boot', state.screenId, 'iat.main')
state = panelReducer(state, { type: 'bootComplete' })

console.log('\n11. Back in to the BACnet mask')
press('prg')
press('enter', 4)
press('down', 5)
press('enter')
press('down', 2)
press('enter')
press('down', 4)
press('enter')
expectEq('on the BACnet mask', state.screenId, 'iat.bacnet')
expectScreen('BACnet mask matches the capture', [
  'Connectivity - BAC',
  '',
  'BACnet Capture:      0',
  'UDP Port:        47808',
  'ADPU Timeout:     5000',
  'OffLine Timeout: 10000',
  'Device Instance',
  '               0000000',
])

console.log('\n12. Five Enters reach Device Instance, then it walks digit by digit')
press('enter', 5)
expectCursor('cursor on the first of seven digits', 7, 15)
// 2749001, taking the short way round the wrap on each digit.
press('up', 2)
press('enter')
press('down', 3)
press('enter')
press('up', 4)
press('enter')
press('down', 1)
press('enter')
press('enter')
press('enter')
press('up', 1)
expectScreen('Device Instance reads 2749001', [
  'Connectivity - BAC',
  '',
  'BACnet Capture:      0',
  'UDP Port:        47808',
  'ADPU Timeout:     5000',
  'OffLine Timeout: 10000',
  'Device Instance',
  '               2749001',
])
press('enter')
expectEq('cursor wraps back above the fields', state.cursor, -1)

console.log('\n13. Scenario grading')
const scenario = SCENARIOS_BY_ID.get('bacnet-instance')
const result = evaluateScenario(scenario, state)
expectEq('scenario passes', result.passed, true)
expectEq('all three goals met', result.goals.filter(g => g.done).length, 3)
expectEq('shortest path matches the published optimal', result.keystrokes, result.optimalKeystrokes)

console.log('\n14. Esc from the Main Menu returns to the main mask, not the login')
state = createInitialState(iatTree, { ...DEFAULT_VALUES })
press('prg')
press('enter', 4)
press('esc')
expectEq('Esc from Main Menu lands on the main mask', state.screenId, 'iat.main')

console.log('\n15. Alarm+Enter crosses into the CAREL system menu')
state = panelReducer(state, { type: 'systemMenu', at: 0 })
expectEq('switched trees', state.treeId, 'sys')
expectScreen('system menu opens on INFORMATION', [
  '>INFORMATION',
  ' SETTINGS',
  ' APPLICATION',
  ' UPGRADE',
  ' LOGGER',
  ' DIAGNOSTICS',
])
// Manual Fig. 7.a is drawn with SETTINGS selected — one press down.
press('down')
expectScreen('caret on SETTINGS matches Fig. 7.a', [
  ' INFORMATION',
  '>SETTINGS',
  ' APPLICATION',
  ' UPGRADE',
  ' LOGGER',
  ' DIAGNOSTICS',
])
expectGrid('system menu fills the grid')

console.log('\n16. The grader can still fail — these must NOT pass')
expectEq(
  'a fresh panel fails the scenario',
  evaluateScenario(scenario, createInitialState(iatTree, { ...DEFAULT_VALUES })).passed,
  false,
)
expectEq(
  'protocol set but never rebooted still fails',
  evaluateScenario(scenario, {
    ...state,
    values: { ...state.values, 'bms2.protocol': 'BACNET', 'bacnet.deviceInstance': 2749001 },
    reboots: 0,
  }).passed,
  false,
)
expectEq(
  'rebooted with the wrong instance still fails',
  evaluateScenario(scenario, {
    ...state,
    values: { ...state.values, 'bms2.protocol': 'BACNET', 'bacnet.deviceInstance': 2749000 },
    reboots: 1,
  }).passed,
  false,
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks} checks, ${failures} failed\n`)
process.exit(failures === 0 ? 0 : 1)
