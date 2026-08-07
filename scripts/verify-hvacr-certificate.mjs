/* Checks the seeded HVAC/R course against production: that every lesson body's
   interactive markers resolve to a real widget, and that the certificate route's
   data logic works for a real user without a browser session.
 *
 *     node --env-file=.env.local --import ./scripts/ts-resolve.mjs \
 *       scripts/verify-hvacr-certificate.mjs
 *
 * The route itself only adds `supabase.auth.getUser()` on top of this. What is
 * worth checking here is the part a 401 hides: that the PostgREST embed shape is
 * valid, that the quiz-gate helpers agree with the library's, and that a learner
 * with no progress is reported as NOT eligible with every subject outstanding —
 * the failure that would matter is a certificate handed out by accident.
 */

import { supabaseAdmin } from '../lib/supabase-admin.ts'
import {
  getAttemptSummaries,
  getPublishedModuleQuizzes,
  subjectIsComplete,
} from '../lib/learn-quiz.ts'
import { splitLessonHtml } from '../lib/learn-interactive.ts'
import { INTERACTIVE_BLOCKS } from '../lib/learn-blocks.ts'
import { KEY_TERMS } from '../lib/hvacr/terms.ts'

const CATEGORY_SLUG = 'refrigeration-hvacr'
const EXCLUDED_MODULE_SLUG = 'course-completion'

let failed = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const { data: category } = await supabaseAdmin
  .from('learn_categories')
  .select('id, name')
  .eq('slug', CATEGORY_SLUG)
  .maybeSingle()

console.log('1. Category')
check('category exists', !!category, category?.name)

// The exact embed the route uses — an invalid relationship 400s here.
const { data: modules, error: modErr } = await supabaseAdmin
  .from('learn_modules')
  .select('id, slug, title, learn_lessons(id, is_published)')
  .eq('category_id', category.id)
  .eq('is_published', true)

console.log('\n2. The nested select the route depends on')
check('learn_modules → learn_lessons embed resolves', !modErr, modErr?.message ?? '')

const subjects = (modules ?? []).filter((m) => m.slug !== EXCLUDED_MODULE_SLUG)
check('teaching subjects found', subjects.length === 17, `${subjects.length} (expected 17)`)
check(
  'closing subject is excluded from the requirement',
  (modules ?? []).length - subjects.length === 1,
)

const lessonIds = subjects.flatMap((m) =>
  (m.learn_lessons ?? []).filter((l) => l.is_published).map((l) => l.id),
)
check('published lessons across those subjects', lessonIds.length === 153, `${lessonIds.length}`)

console.log('\n3. Quiz gating')
const [quizzes, _] = await Promise.all([getPublishedModuleQuizzes(), Promise.resolve(null)])
const gated = subjects.filter((m) => quizzes.has(m.id))
check('every teaching subject is quiz-gated', gated.length === 17, `${gated.length} of 17`)

const { data: capstone } = await supabaseAdmin
  .from('learn_quizzes')
  .select('id')
  .eq('scope_type', 'category')
  .eq('scope_id', category.id)
  .eq('is_published', true)
  .maybeSingle()
check('published category capstone exists', !!capstone)

console.log('\n4. A learner with no progress must NOT be eligible')
// A real account, so the employees lookup and the attempt read run for real.
const { data: someone } = await supabaseAdmin
  .from('employees')
  .select('id, name')
  .eq('is_active', true)
  .limit(1)
  .maybeSingle()
check('found a real account to test with', !!someone, someone?.name ?? '')

const attempts = await getAttemptSummaries(someone.id)
const { data: progress } = await supabaseAdmin
  .from('learn_progress')
  .select('lesson_id, completed_at')
  .eq('user_id', someone.id)
  .not('completed_at', 'is', null)
  .in('lesson_id', lessonIds)

const doneLessons = new Set((progress ?? []).map((p) => p.lesson_id))
const outstanding = subjects.filter((m) => {
  const published = (m.learn_lessons ?? []).filter((l) => l.is_published)
  const done = published.filter((l) => doneLessons.has(l.id)).length
  return !subjectIsComplete(done, published.length, quizzes.get(m.id), attempts)
})

const capstonePassed = !capstone || !!attempts.get(capstone.id)?.passed
const eligible = outstanding.length === 0 && capstonePassed

check('not eligible', eligible === false)
check(
  'every unfinished subject is listed as outstanding',
  outstanding.length === 17,
  `${outstanding.length} outstanding`,
)
check('capstone not passed', capstonePassed === false)

console.log('\n5. Every marker in a seeded lesson body resolves to a real widget')
/* The gap a unit test cannot close: the splitter is tested against fixtures, and
   the seed is generated from a catalogue — but only the rows that actually
   landed in the database prove the two agree. A marker naming a widget that
   isn't registered renders "isn't available" to a learner, silently. */
const { data: bodies } = await supabaseAdmin
  .from('learn_lessons')
  .select('id, title, content, learn_modules!inner(slug, learn_categories!inner(slug))')
  .eq('learn_modules.learn_categories.slug', CATEGORY_SLUG)
  .like('content', '%data-interactive%')

check('lessons carrying a marker', (bodies ?? []).length === 53, `${(bodies ?? []).length}`)

const catalogue = new Set(INTERACTIVE_BLOCKS.map((b) => b.name))
const found = new Set()
const unknown = []
let markerCount = 0
for (const row of bodies ?? []) {
  for (const seg of splitLessonHtml(row.content)) {
    if (seg.kind !== 'interactive') continue
    markerCount++
    found.add(seg.name)
    if (!catalogue.has(seg.name)) unknown.push(`${row.title}: ${seg.name}`)
  }
}
check('markers parsed out of those bodies', markerCount === 55, `${markerCount}`)
check('all resolve to a catalogued widget', unknown.length === 0, unknown.slice(0, 5).join(', '))
check('distinct widgets used', found.size === 24, `${found.size}`)

// A params typo is invisible until a learner opens the lesson and sees an empty
// drill, so the sets are checked against the real datasets too.
const badParams = []
for (const row of bodies ?? []) {
  for (const seg of splitLessonHtml(row.content)) {
    if (seg.kind !== 'interactive') continue
    const spec = INTERACTIVE_BLOCKS.find((b) => b.name === seg.name)
    for (const p of spec?.params ?? []) {
      const value = seg.params[p.key]
      if (!value) continue
      if (p.options && !p.options.some((o) => o.value === value)) {
        badParams.push(`${row.title}: ${seg.name} data-${p.key}="${value}"`)
      }
    }
    if (seg.name === 'hvacr-flashcards' && !KEY_TERMS[seg.params.module]) {
      badParams.push(`${row.title}: flashcards for unknown subject "${seg.params.module}"`)
    }
  }
}
check('all marker params are valid', badParams.length === 0, badParams.slice(0, 5).join(', '))

console.log(`\n${failed ? `FAIL — ${failed} check(s) failed` : 'PASS — all checks passed'}`)
process.exit(failed ? 1 : 0)
