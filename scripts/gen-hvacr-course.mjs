/* Regenerates the Refrigeration & HVAC/R course seed migrations from the
   source data in scripts/hvacr-course/.

       node scripts/gen-hvacr-course.mjs

   Writes supabase/migrations/085_hvacr_course_seed.sql (category, 18 subjects,
   ~155 lessons) and 086_hvacr_course_quizzes.sql (17 subject quizzes + the
   category capstone).

   Same reason as gen-learn-seed.mjs: creating categories and subjects still has
   no admin UI, so a course arrives as a seed. Generated rather than hand-written
   because the bodies are 176k characters of prose — a hand-edit would drift from
   the source and could not be diffed against it.

   The lesson bodies carry interactive markers (lib/learn-interactive.ts) that
   the registry in components/learn/InteractiveBlockView.tsx turns into real
   components. Marker names are asserted against that file at the bottom of this
   script, so a rename on either side fails the run instead of shipping a lesson
   that renders "isn't available". */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(HERE, 'hvacr-course')
const MIGRATIONS = path.join(HERE, '..', 'supabase', 'migrations')

const modules = JSON.parse(fs.readFileSync(path.join(DATA, 'modules.json'), 'utf8'))
const quick = JSON.parse(fs.readFileSync(path.join(DATA, 'quick.json'), 'utf8'))

const CATEGORY_SLUG = 'refrigeration-hvacr'
const CATEGORY_NAME = 'Refrigeration & HVAC/R'

/* Which interactive block opens each subject, and which exercises close it.
   Every name here must exist in the InteractiveBlockView registry. */
const WIDGETS = {
  safety: {
    hero: ['hvacr-ppe-matcher', {}],
    practice: [['hvacr-sequence', { set: 'loto' }]],
  },
  thermodynamics: {
    hero: ['hvacr-phase-particles', {}],
    practice: [['hvacr-classify', { set: 'sensible-latent' }]],
    inline: { 0: ['hvacr-temp-converter', {}] },
  },
  'refrigeration-cycle': {
    hero: ['hvacr-cycle-3d', {}],
    practice: [
      ['hvacr-label', { set: 'cycle' }],
      ['hvacr-sequence', { set: 'cycle' }],
    ],
  },
  'refrigerants-regulations': {
    hero: ['hvacr-molecule-3d', {}],
    practice: [['hvacr-classify', { set: 'ashrae' }]],
  },
  compressors: {
    hero: ['hvacr-compressor-3d', {}],
    practice: [['hvacr-label', { set: 'compressor' }]],
  },
  condensers: {
    hero: ['hvacr-coil-3d', { coil: 'condenser' }],
    practice: [['hvacr-label', { set: 'condenser' }]],
  },
  'metering-devices': {
    hero: ['hvacr-txv-3d', {}],
    practice: [['hvacr-calc-classify', { set: 'superheat' }]],
  },
  evaporators: {
    hero: ['hvacr-coil-3d', { coil: 'evaporator' }],
    practice: [['hvacr-calc-classify', { set: 'heat-load' }]],
  },
  'system-components': {
    hero: ['hvacr-component-map', {}],
    practice: [['hvacr-label', { set: 'components' }]],
  },
  'electrical-fundamentals': {
    hero: ['hvacr-control-circuit', {}],
    practice: [
      ['hvacr-label', { set: 'circuit' }],
      ['hvacr-classify', { set: 'capacitor' }],
    ],
  },
  'controls-safety-devices': {
    hero: ['hvacr-control-sequence', {}],
    practice: [['hvacr-label', { set: 'safety-devices' }]],
  },
  'psychrometrics-dehumidification': {
    hero: ['hvacr-psychrometric-chart', {}],
    practice: [['hvacr-classify', { set: 'dehumidify' }]],
  },
  'system-types-applications': {
    hero: ['hvacr-system-types', {}],
    practice: [['hvacr-classify', { set: 'system-type' }]],
  },
  'installation-practices': {
    hero: ['hvacr-micron-gauge', {}],
    practice: [['hvacr-sequence', { set: 'install' }]],
  },
  'troubleshooting-diagnostics': {
    hero: ['hvacr-diagnostic-quadrant', {}],
    practice: [['hvacr-branch', {}]],
  },
  maintenance: {
    hero: ['hvacr-pm-checklist', {}],
    practice: [['hvacr-classify', { set: 'pm' }]],
  },
  'codes-certification': {
    hero: ['hvacr-epa-tools', {}],
    practice: [['hvacr-classify', { set: 'recovery' }]],
  },
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`)

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function marker(name, params = {}) {
  const extra = Object.entries(params)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => ` data-${k}="${v}"`)
    .join('')
  return `<div data-interactive="${name}"${extra}></div>`
}

/** Unique slug within one subject — headings repeat across modules, not inside. */
function uniqueSlug(base, taken) {
  let s = base || 'lesson'
  let n = 2
  while (taken.has(s)) s = `${base}-${n++}`
  taken.add(s)
  return s
}

/* ── lesson bodies ────────────────────────────────────────────────────────── */

function overviewBody(m, widget) {
  const objectives = m.objectives.map((o) => `<li>${o}</li>`).join('')
  return [
    `<p>${m.title} takes about <strong>${m.estMinutes} minutes</strong> to work through, and closes with a knowledge check of ${m.quiz.length} questions that you have to pass to complete the subject.</p>`,
    `<h3>What you'll be able to do</h3>`,
    `<ul>${objectives}</ul>`,
    `<h3>Try it first</h3>`,
    `<p>Work the model below before you read anything. The reading makes far more sense once you have already seen the thing move.</p>`,
    widget ? marker(widget[0], widget[1]) : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function sectionBody(section, quickEntry, inlineWidget) {
  const parts = []
  if (quickEntry && quickEntry.quick && quickEntry.quick.length) {
    parts.push('<h3>At a glance</h3>')
    parts.push(`<ul>${quickEntry.quick.map((b) => `<li>${b}</li>`).join('')}</ul>`)
    parts.push('<h3>The full picture</h3>')
  }
  parts.push(section.html)
  if (inlineWidget) parts.push(marker(inlineWidget[0], inlineWidget[1]))
  return parts.join('\n')
}

function practiceBody(m, exercises) {
  const parts = [
    `<p>Nothing here is graded against your record — work them as many times as you like. They are the fastest way to find out which parts of ${m.title.toLowerCase()} you only <em>think</em> you know.</p>`,
  ]
  for (const ex of exercises) parts.push(marker(ex[0], ex[1]))
  return parts.join('\n')
}

function keyTermsBody(m) {
  return [
    `<p>Tap a card to flip it. These are the terms the knowledge check draws on, and the vocabulary a customer or an inspector will expect you to use precisely.</p>`,
    marker('hvacr-flashcards', { module: m.id }),
  ].join('\n')
}

/* ── build ────────────────────────────────────────────────────────────────── */

const lines = []
const usedMarkers = new Set()

function recordMarkers(html) {
  for (const m of html.matchAll(/data-interactive="([^"]+)"/g)) usedMarkers.add(m[1])
}

lines.push(`-- ─────────────────────────────────────────────────────────────────────────────
-- 085_hvacr_course_seed.sql — Refrigeration & HVAC/R Technician Training
--
-- GENERATED FILE. Do not hand-edit — run:
--     node scripts/gen-hvacr-course.mjs
-- Source data: scripts/hvacr-course/{modules,quick,branch}.json
--
-- A full technician course: ${modules.length} subjects, ${modules.reduce((a, m) => a + m.sections.length + 3, 0) + 2} lessons, covering refrigeration
-- theory, components, electrical, psychrometrics, installation, troubleshooting
-- and EPA 608. Lesson bodies embed interactive markers
-- (see lib/learn-interactive.ts) that the registry in
-- components/learn/InteractiveBlockView.tsx renders as real components —
-- rotatable 3D models, labelled diagrams, and branching service calls.
--
-- Seeded rather than authored in the UI because creating categories and
-- subjects still has no admin write path (docs/learn.md "Not built yet" §4).
-- Idempotent ON CONFLICT shape, same as 015* and 082.
--
-- Quizzes are 086 — one per subject plus a category capstone.
--
-- Apply via Supabase CLI (npx supabase db push) — run \`migration repair\` first
-- if the CLI claims 059–063 are pending; they are live.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Category ─────────────────────────────────────────────────────────────────
INSERT INTO learn_categories (name, slug, description, icon, accent, display_order)
VALUES (
  ${q(CATEGORY_NAME)},
  ${q(CATEGORY_SLUG)},
  ${q('Refrigeration and HVAC/R technician training — theory, components, electrical, psychrometrics, installation, troubleshooting, and the codes and certifications the trade runs on.')},
  ${q('Snowflake')},
  NULL,
  5
)
ON CONFLICT (slug) DO NOTHING;
`)

let lessonTotal = 0

for (const m of modules) {
  const w = WIDGETS[m.id]
  if (!w) throw new Error(`No widget map for module "${m.id}"`)

  const moduleSlug = slugify(m.title)
  const quickList = quick[m.id] || []

  lines.push(`
-- ═════════════════════════════════════════════════════════════════════════════
-- ${m.number}. ${m.title}
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, ${q(m.title)}, ${q(moduleSlug)},
       ${q(m.objectives[0] + '.')},
       ${m.number}, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = ${q(CATEGORY_SLUG)}
ON CONFLICT (category_id, slug) DO NOTHING;
`)

  const taken = new Set()
  const lessons = []

  lessons.push({
    title: 'Overview and objectives',
    slug: uniqueSlug('overview-and-objectives', taken),
    body: overviewBody(m, w.hero),
    minutes: 5,
  })

  const perSection = Math.max(3, Math.round((m.estMinutes * 0.6) / m.sections.length))
  m.sections.forEach((s, i) => {
    lessons.push({
      title: s.heading,
      slug: uniqueSlug(slugify(s.heading), taken),
      body: sectionBody(s, quickList[i], w.inline && w.inline[i]),
      minutes: perSection,
    })
  })

  lessons.push({
    title: 'Practice',
    slug: uniqueSlug('practice', taken),
    body: practiceBody(m, w.practice),
    minutes: 8,
  })

  lessons.push({
    title: 'Key terms',
    slug: uniqueSlug('key-terms', taken),
    body: keyTermsBody(m),
    minutes: 5,
  })

  lessons.forEach((l, i) => {
    recordMarkers(l.body)
    lessonTotal++
    lines.push(`INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, ${q(l.title)}, ${q(l.slug)}, ${q(l.body)}, ${i}, TRUE, ${l.minutes}
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = ${q(CATEGORY_SLUG)}
WHERE m.slug = ${q(moduleSlug)}
ON CONFLICT (module_id, slug) DO NOTHING;
`)
  })
}

/* ── Closing subject: the capstone + the certificate ──────────────────────── */

const FINAL_SLUG = 'course-completion'
lines.push(`
-- ═════════════════════════════════════════════════════════════════════════════
-- ${modules.length + 1}. Course completion
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO learn_modules (category_id, title, slug, description, display_order, is_published, source_file, import_status)
SELECT c.id, 'Course completion', ${q(FINAL_SLUG)},
       ${q('The cumulative final exam across all ' + modules.length + ' subjects, and your certificate once everything is finished.')},
       ${modules.length + 1}, TRUE, NULL, 'imported'
FROM learn_categories c WHERE c.slug = ${q(CATEGORY_SLUG)}
ON CONFLICT (category_id, slug) DO NOTHING;
`)

const finalLessons = [
  {
    title: 'The final exam',
    slug: 'the-final-exam',
    minutes: 4,
    body: [
      `<p>Each of the ${modules.length} subjects ends with its own knowledge check. The <strong>final exam</strong> is different: it is a single cumulative paper drawn from every subject in the course, and it sits on the category rather than on any one subject.</p>`,
      `<h3>How it is scored</h3>`,
      `<ul>`,
      `<li><strong>${2 * modules.length} questions</strong>, two from each subject.</li>`,
      `<li><strong>80% to pass</strong>, the same bar as every other quiz in the portal.</li>`,
      `<li><strong>Unlimited retakes</strong>, and your best score is the one that is kept.</li>`,
      `<li>Once you have passed, passing again cannot un-pass you.</li>`,
      `</ul>`,
      `<h3>What it does and does not gate</h3>`,
      `<p>A capstone exam is a measure, not a lock: it does <em>not</em> gate the completion of the individual subjects. Each subject completes on its own lessons and its own knowledge check. The final exam is what the certificate on the next page is waiting for.</p>`,
      `<p>Work through the subjects first. The exam draws on all of them, so taking it early mostly tells you which subjects you have not read yet.</p>`,
      `<p><a href="/admin/learn/${CATEGORY_SLUG}/quiz">Open the final exam →</a></p>`,
    ].join('\n'),
  },
  {
    title: 'Your certificate',
    slug: 'your-certificate',
    minutes: 3,
    body: [
      `<p>Finish every subject and pass the final exam, and your certificate appears below with your name and the date you completed it. Until then it shows exactly what is still outstanding.</p>`,
      marker('hvacr-certificate', {}),
    ].join('\n'),
  },
]

finalLessons.forEach((l, i) => {
  recordMarkers(l.body)
  lessonTotal++
  lines.push(`INSERT INTO learn_lessons (module_id, title, slug, content, display_order, is_published, estimated_minutes)
SELECT m.id, ${q(l.title)}, ${q(l.slug)}, ${q(l.body)}, ${i}, TRUE, ${l.minutes}
FROM learn_modules m
JOIN learn_categories c ON c.id = m.category_id AND c.slug = ${q(CATEGORY_SLUG)}
WHERE m.slug = ${q(FINAL_SLUG)}
ON CONFLICT (module_id, slug) DO NOTHING;
`)
})

lines.push(`
-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM learn_modules m JOIN learn_categories c ON c.id = m.category_id
--   WHERE c.slug = '${CATEGORY_SLUG}';                                  -- expect ${modules.length + 1}
-- SELECT COUNT(*) FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--   JOIN learn_categories c ON c.id = m.category_id WHERE c.slug = '${CATEGORY_SLUG}';   -- expect ${lessonTotal}
-- SELECT COUNT(*) FROM learn_lessons l JOIN learn_modules m ON m.id = l.module_id
--   JOIN learn_categories c ON c.id = m.category_id
--   WHERE c.slug = '${CATEGORY_SLUG}' AND l.content LIKE '%data-interactive%';           -- expect ${modules.length * 2 + modules.reduce((a, m) => a + WIDGETS[m.id].practice.length, 0) - modules.length + 1 + 1}
`)

fs.writeFileSync(path.join(MIGRATIONS, '085_hvacr_course_seed.sql'), lines.join('\n'), 'utf8')

/* ── 086: quizzes ─────────────────────────────────────────────────────────── */

const qz = []
qz.push(`-- ─────────────────────────────────────────────────────────────────────────────
-- 086_hvacr_course_quizzes.sql — knowledge checks for the HVAC/R course
--
-- GENERATED FILE. Do not hand-edit — run:
--     node scripts/gen-hvacr-course.mjs
--
-- One PUBLISHED quiz per subject (${modules[0].quiz.length} questions each), plus a category capstone
-- of ${2 * modules.length} questions — two drawn from each subject — as the final exam.
--
-- Published on insert, which is safe in exactly one direction: a subject with a
-- published quiz completes only when its lessons are read AND the quiz is
-- passed (subjectIsComplete, lib/learn-quiz.ts). Because the whole course is
-- new, nobody has prior progress that publishing could retroactively
-- un-complete — the hazard that rule exists to prevent.
--
-- The capstone is category-scoped and therefore gates nothing, by design.
--
-- pass_pct is left at the table default (80).
-- ─────────────────────────────────────────────────────────────────────────────
`)

function quizBlock({ scopeType, scopeSelect, title, description, questions, meta }) {
  const out = []
  out.push(`
INSERT INTO learn_quizzes (scope_type, scope_id, title, description, is_published, generated_meta)
SELECT '${scopeType}', ${scopeSelect}, ${q(title)}, ${q(description)}, TRUE, ${q(JSON.stringify(meta))}::jsonb
ON CONFLICT (scope_type, scope_id) DO NOTHING;
`)
  questions.forEach((question, qi) => {
    out.push(`INSERT INTO learn_quiz_questions (quiz_id, prompt, explanation, display_order)
SELECT z.id, ${q(question.q)}, ${q(question.explain)}, ${qi}
FROM learn_quizzes z WHERE z.scope_type = '${scopeType}' AND z.scope_id = (${scopeSelect})
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_questions x WHERE x.quiz_id = z.id AND x.display_order = ${qi}
  );
`)
    question.options.forEach((opt, oi) => {
      out.push(`INSERT INTO learn_quiz_options (question_id, label, is_correct, display_order)
SELECT qq.id, ${q(opt)}, ${oi === question.correct ? 'TRUE' : 'FALSE'}, ${oi}
FROM learn_quiz_questions qq
JOIN learn_quizzes z ON z.id = qq.quiz_id
WHERE z.scope_type = '${scopeType}' AND z.scope_id = (${scopeSelect}) AND qq.display_order = ${qi}
  AND NOT EXISTS (
    SELECT 1 FROM learn_quiz_options x WHERE x.question_id = qq.id AND x.display_order = ${oi}
  );
`)
    })
  })
  return out.join('')
}

for (const m of modules) {
  const moduleSlug = slugify(m.title)
  const scopeSelect = `(SELECT mm.id FROM learn_modules mm JOIN learn_categories cc ON cc.id = mm.category_id AND cc.slug = ${q(CATEGORY_SLUG)} WHERE mm.slug = ${q(moduleSlug)})`
  qz.push(`
-- ── ${m.number}. ${m.title} ──`)
  qz.push(
    quizBlock({
      scopeType: 'module',
      scopeSelect,
      title: `${m.title} — knowledge check`,
      description: `${m.quiz.length} questions covering ${m.title.toLowerCase()}. 80% to pass, unlimited retakes, best score kept.`,
      questions: m.quiz,
      meta: { source: 'hvacr-course-seed', module: m.id, question_count: m.quiz.length },
    }),
  )
}

const capstone = []
for (const m of modules) {
  for (const question of m.quiz.slice(0, 2)) {
    capstone.push({ ...question, q: `(${m.title}) ${question.q}` })
  }
}

const catScope = `(SELECT cc.id FROM learn_categories cc WHERE cc.slug = ${q(CATEGORY_SLUG)})`
qz.push(`
-- ── Capstone: the final exam ──`)
qz.push(
  quizBlock({
    scopeType: 'category',
    scopeSelect: catScope,
    title: 'Refrigeration & HVAC/R — final exam',
    description: `${capstone.length} cumulative questions, two from each of the ${modules.length} subjects. 80% to pass, unlimited retakes, best score kept.`,
    questions: capstone,
    meta: { source: 'hvacr-course-seed', scope: 'capstone', question_count: capstone.length },
  }),
)

qz.push(`
-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM learn_quizzes z
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed';            -- expect ${modules.length + 1}
-- SELECT COUNT(*) FROM learn_quiz_questions qq JOIN learn_quizzes z ON z.id = qq.quiz_id
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed';            -- expect ${modules.reduce((a, m) => a + m.quiz.length, 0) + capstone.length}
-- Every question must have exactly one correct option:
-- SELECT qq.id FROM learn_quiz_questions qq JOIN learn_quizzes z ON z.id = qq.quiz_id
--   JOIN learn_quiz_options o ON o.question_id = qq.id
--   WHERE z.generated_meta->>'source' = 'hvacr-course-seed'
--   GROUP BY qq.id HAVING COUNT(*) FILTER (WHERE o.is_correct) <> 1;    -- expect 0 rows
`)

fs.writeFileSync(path.join(MIGRATIONS, '086_hvacr_course_quizzes.sql'), qz.join('\n'), 'utf8')

/* ── Runtime data modules ─────────────────────────────────────────────────── */

/* The branching service calls and the key-term flashcards are rendered by
   client components, so they ship as TS rather than as lesson HTML. Generated
   from the same source JSON as the migrations so the three can never drift. */

const LIB = path.join(HERE, '..', 'lib', 'hvacr')
const branch = JSON.parse(fs.readFileSync(path.join(DATA, 'branch.json'), 'utf8'))

fs.writeFileSync(
  path.join(LIB, 'branch.ts'),
  `/* Branching service-call simulations.
 *
 * GENERATED FILE — run \`node scripts/gen-hvacr-course.mjs\`.
 * Source: scripts/hvacr-course/branch.json
 *
 * A decision tree per scenario. Terminal nodes carry \`correct\`, which is what
 * the learner is graded against on screen — the wrong turns are modelled
 * deliberately, because the point of the exercise is that a plausible-sounding
 * shortcut (recover refrigerant because head pressure is high) leads somewhere
 * expensive.
 */

export type BranchChoice = { label: string; next: string }

export type BranchNode = {
  prompt: string
  choices?: BranchChoice[]
  terminal?: boolean
  correct?: boolean
  resultText?: string
}

export type BranchScenario = {
  id: string
  title: string
  intro: string
  startNode: string
  nodes: Record<string, BranchNode>
}

export const BRANCH_SCENARIOS: BranchScenario[] = ${JSON.stringify(branch, null, 2)}

export const BRANCH_BY_ID: Record<string, BranchScenario> = Object.fromEntries(
  BRANCH_SCENARIOS.map((s) => [s.id, s]),
)
`,
  'utf8',
)

const terms = Object.fromEntries(modules.map((m) => [m.id, m.keyTerms]))
fs.writeFileSync(
  path.join(LIB, 'terms.ts'),
  `/* Key terms per subject, for the flashcard exercise.
 *
 * GENERATED FILE — run \`node scripts/gen-hvacr-course.mjs\`.
 * Source: scripts/hvacr-course/modules.json
 *
 * Keyed by the source module id, which is what the lesson marker's
 * \`data-module\` carries.
 */

export type KeyTerm = { term: string; def: string }

export const KEY_TERMS: Record<string, KeyTerm[]> = ${JSON.stringify(terms, null, 2)}
`,
  'utf8',
)

/* ── Guards ───────────────────────────────────────────────────────────────── */

// Every question must have exactly one correct option, or publishing is refused
// server-side and the seeded quiz would be dead on arrival.
for (const m of [...modules]) {
  for (const [i, question] of m.quiz.entries()) {
    if (typeof question.correct !== 'number' || !question.options[question.correct]) {
      throw new Error(`${m.id} q${i}: correct index ${question.correct} is out of range`)
    }
    if (new Set(question.options).size !== question.options.length) {
      throw new Error(`${m.id} q${i}: duplicate option labels`)
    }
  }
}

/* Fail loudly if a marker name here is not a catalogued block — otherwise the
   lesson ships and quietly renders "isn't available".

   Checked against lib/learn-blocks.ts rather than the registry component,
   because that catalogue is what types the registry: a name present there but
   unwired fails `tsc`, so passing this check plus a green type-check proves the
   marker will actually render. Read by regex because this is a .mjs build
   script and cannot import TypeScript. */
const catalogueSrc = fs.readFileSync(path.join(HERE, '..', 'lib', 'learn-blocks.ts'), 'utf8')
const catalogued = new Set([...catalogueSrc.matchAll(/name:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))
const missing = [...usedMarkers].filter((n) => !catalogued.has(n)).sort()
if (missing.length) {
  throw new Error(
    `These marker names are used by the seed but are not in lib/learn-blocks.ts:\n  ${missing.join('\n  ')}`,
  )
}

console.log(`085_hvacr_course_seed.sql      ${modules.length + 1} subjects · ${lessonTotal} lessons`)
console.log(
  `086_hvacr_course_quizzes.sql   ${modules.length + 1} quizzes · ${modules.reduce((a, m) => a + m.quiz.length, 0) + capstone.length} questions`,
)
console.log(`markers used: ${[...usedMarkers].sort().join(', ')}`)
