/* Verifies lib/learn-interactive.ts — the lesson-body splitter.
 *
 * The stake here is the 357 lessons already in production. `LessonContent` used
 * to be one unconditional `dangerouslySetInnerHTML`; it now asks this module
 * whether a body contains an interactive marker first. If that guard is ever
 * wrong, every existing lesson changes its render path at once.
 *
 * So section 1 is the important one: a body with no marker must come back as a
 * single run holding the BYTE-IDENTICAL original string.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-learn-interactive.mjs
 */

import {
  hasInteractive,
  interactiveMarker,
  splitLessonHtml,
} from '../lib/learn-interactive.ts'

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
function eq(label, actual, want) {
  if (JSON.stringify(actual) === JSON.stringify(want)) return ok(label)
  fail(label, `    expected: ${JSON.stringify(want)}\n    actual:   ${JSON.stringify(actual)}`)
}

/* Real shapes from production lesson bodies — a plain lesson, one carrying a
   Trainual image placeholder, and one with an inline data attribute that is
   NOT ours. None of these may take the new path. */
const PLAIN = '<h2>Welcome to IAT</h2>\n<p>We make <strong>desiccant</strong> dehumidifiers.</p>'
const WITH_FIGURE =
  '<p>Intro.</p><figure class="img-missing"><figcaption>📷 Image from Trainual: airflow diagram — re-upload via admin editor</figcaption></figure><p>After.</p>'
const OTHER_DATA_ATTR = '<p data-foo="bar">Nothing to do with us.</p><div data-role="note">Hi</div>'

console.log('\n1. Bodies without a marker are passed through untouched')
for (const [label, body] of [
  ['a plain lesson', PLAIN],
  ['a lesson with an img-missing figure', WITH_FIGURE],
  ['a lesson with unrelated data- attributes', OTHER_DATA_ATTR],
  ['an empty body', ''],
]) {
  eq(`${label} → one run`, splitLessonHtml(body), [{ kind: 'html', html: body }])
  const same = splitLessonHtml(body)[0].html === body
  if (same) ok(`${label} → byte-identical`)
  else fail(`${label} → byte-identical`)
  eq(`${label} → hasInteractive false`, hasInteractive(body), false)
}
eq('null body → hasInteractive false', hasInteractive(null), false)

console.log('\n2. A marker splits the body around it')
eq(
  'prose, exercise, prose',
  splitLessonHtml(
    '<p>Before.</p><div data-interactive="cpco-sim" data-scenario="bacnet-instance"></div><p>After.</p>',
  ),
  [
    { kind: 'html', html: '<p>Before.</p>' },
    { kind: 'interactive', name: 'cpco-sim', params: { scenario: 'bacnet-instance' } },
    { kind: 'html', html: '<p>After.</p>' },
  ],
)

eq(
  'marker with no params',
  splitLessonHtml('<div data-interactive="cpco-sim"></div>'),
  [{ kind: 'interactive', name: 'cpco-sim', params: {} }],
)

eq(
  'marker at the very start',
  splitLessonHtml('<div data-interactive="cpco-sim"></div><p>After.</p>'),
  [
    { kind: 'interactive', name: 'cpco-sim', params: {} },
    { kind: 'html', html: '<p>After.</p>' },
  ],
)

eq(
  'two markers back to back',
  splitLessonHtml(
    '<div data-interactive="a" data-guided="true"></div><div data-interactive="b"></div>',
  ),
  [
    { kind: 'interactive', name: 'a', params: { guided: 'true' } },
    { kind: 'interactive', name: 'b', params: {} },
  ],
)

eq(
  'whitespace inside the marker is tolerated',
  splitLessonHtml('<div data-interactive="cpco-sim">\n  </div>'),
  [{ kind: 'interactive', name: 'cpco-sim', params: {} }],
)

eq(
  'single-quoted attributes parse',
  splitLessonHtml("<div data-interactive='cpco-sim' data-scenario='mac-for-tera'></div>"),
  [{ kind: 'interactive', name: 'cpco-sim', params: { scenario: 'mac-for-tera' } }],
)

console.log('\n3. Things that are NOT markers stay in the HTML')
// A div carrying the attribute but holding real content is somebody else's
// markup. Swallowing it would delete visible lesson text.
const WITH_CHILDREN = '<div data-interactive="cpco-sim"><p>Real content</p></div>'
eq('a div with children is left alone', splitLessonHtml(WITH_CHILDREN), [
  { kind: 'html', html: WITH_CHILDREN },
])

console.log('\n4. The marker builder and the splitter agree')
const built = interactiveMarker('cpco-sim', { scenario: 'plan-address', guided: 'true' })
eq('builder output', built, '<div data-interactive="cpco-sim" data-scenario="plan-address" data-guided="true"></div>')
eq('round-trips through the splitter', splitLessonHtml(built), [
  { kind: 'interactive', name: 'cpco-sim', params: { scenario: 'plan-address', guided: 'true' } },
])
eq('empty params are dropped', interactiveMarker('cpco-sim', { scenario: '' }), '<div data-interactive="cpco-sim"></div>')

console.log('\n5. HTML runs reassemble to the original')
const MIXED = `<h2>Set the device instance</h2><p>Try it.</p>${interactiveMarker('cpco-sim', { scenario: 'bacnet-instance' })}<p>Done.</p>`
const rebuilt = splitLessonHtml(MIXED)
  .map(s => (s.kind === 'html' ? s.html : interactiveMarker(s.name, s.params)))
  .join('')
eq('split then rejoin is lossless', rebuilt, MIXED)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks} checks, ${failures} failed\n`)
process.exit(failures === 0 ? 0 : 1)
