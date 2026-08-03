import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { anthropic } from '@/lib/anthropic'
import { logAudit } from '@/lib/audit'
import type { QuizScope } from '@/lib/learn-quiz'

/* POST /api/learn/quizzes/generate  { scopeType, scopeId, questionCount? }
   "Build with AI" — drafts a quiz from the lesson text of a subject or category.

   Produces a DRAFT. Nothing reaches a learner until a human publishes it, the
   same posture as case studies (072) and Jerry's ticket drafts.

   The anti-fabrication story has two layers:

   1. A DETERMINISTIC PRE-FLIGHT. 33 of the 357 live lessons are the literal
      placeholder "Content for this lesson is maintained in Trainual", and they
      cluster: Safety Procedures has 23 lessons but only ~1,900 usable
      characters across 3 of them. Asking a model for ten questions about that
      guarantees invention. So the source is measured BEFORE any API call, and a
      thin scope is refused with the specific lessons that need writing — no
      tokens spent, and an actionable answer.

   2. THE MODEL'S OWN BLOCK. Content can be long enough yet still unquizzable
      (an index page, a list of links). The contract gives Claude a `blocked`
      shape so it can say so in its own words instead of inventing questions,
      and prose replies degrade into that same path rather than "malformed". */

const MODEL = 'claude-sonnet-5'
const DEFAULT_QUESTIONS = 10
const PLACEHOLDER = 'maintained in Trainual'

/** Rough HTML → text. Enough to measure and to feed the model. */
function toText(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<figure class="img-missing"[\s\S]*?<\/figure>/g, ' ')  // "image missing" placeholders carry no content
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

type SourceLesson = { id: string; title: string; text: string; usable: boolean }

const SYSTEM_PROMPT = `You write multiple-choice quizzes for IAT's internal training portal. IAT (Innovative Air Technologies) builds industrial desiccant dehumidification equipment.

You are given the LESSONS of one subject or category. Write questions that test whether someone actually read and understood THIS material.

Return ONLY a JSON object, no prose around it:

{
  "title": string,        // a short quiz title, e.g. "Safety Procedures — knowledge check"
  "questions": [
    {
      "prompt": string,           // the question
      "options": [string, string, string, string],   // EXACTLY 4, one correct
      "correct_index": number,    // 0-3, which option is correct
      "explanation": string,      // 1-2 sentences on WHY, for after they answer
      "source_lesson_id": string  // the id of the lesson this comes from
    }
  ]
}

RULES
- Every question must be answerable from the supplied lesson text ALONE. Do not use outside knowledge of HVAC, desiccants or IAT.
- "source_lesson_id" must be one of the ids given to you. It is how a reviewer checks your answer key, so it must be the lesson that actually contains the answer.
- Exactly 4 options each. Wrong options must be plausible and roughly the same length as the right one — never obviously silly, never "all of the above".
- Vary what you ask across the lessons supplied; do not draw several questions from one paragraph.
- Test understanding, not trivia. Prefer "what should you do when…" over "which word appears in the heading".
- No question about the portal itself, about Trainual, about placeholder text, or about images that are described but not shown.
- Write in plain UK-neutral English, second person where natural.

IF THE MATERIAL CANNOT SUPPORT A QUIZ, RETURN A BLOCK INSTEAD.
Some lessons are headings, link lists, or placeholder text with no teachable content. If you cannot write the requested number of fair questions from what you were given, do NOT pad, do NOT invent, and do NOT explain in prose. Return exactly:
{ "blocked": { "reason": string, "lessons": [string] } }
- "reason": one or two plain sentences naming what is missing and what a human should write.
- "lessons": the titles of the lessons that need real content.`

/** First `{` to last `}` — rescues valid JSON that arrived wrapped in commentary. */
function sliceOutermostObject(s: string): string | null {
  const open = s.indexOf('{')
  const close = s.lastIndexOf('}')
  return open >= 0 && close > open ? s.slice(open, close + 1) : null
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { scopeType?: string; scopeId?: string; questionCount?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const scopeType = body.scopeType as QuizScope
  const scopeId = body.scopeId
  if (scopeType !== 'module' && scopeType !== 'category') {
    return NextResponse.json({ error: 'scopeType must be "module" or "category"' }, { status: 400 })
  }
  if (!scopeId || typeof scopeId !== 'string') {
    return NextResponse.json({ error: 'scopeId required' }, { status: 400 })
  }
  const questionCount = Math.min(20, Math.max(3, Math.round(body.questionCount ?? DEFAULT_QUESTIONS)))

  // ── Gather the source ──────────────────────────────────────────────────────
  let scopeName = ''
  let moduleIds: string[] = []

  if (scopeType === 'module') {
    const { data: m } = await supabaseAdmin
      .from('learn_modules').select('id, title').eq('id', scopeId).single()
    if (!m) return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    scopeName = m.title
    moduleIds = [m.id]
  } else {
    const { data: c } = await supabaseAdmin
      .from('learn_categories').select('id, name').eq('id', scopeId).single()
    if (!c) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    scopeName = c.name
    const { data: mods } = await supabaseAdmin
      .from('learn_modules').select('id').eq('category_id', c.id).eq('is_published', true)
    moduleIds = (mods ?? []).map(m => m.id)
  }

  if (!moduleIds.length) {
    return NextResponse.json(
      { error: 'Nothing to build from', blocked: { reason: 'This category has no published subjects yet.', lessons: [] } },
      { status: 422 },
    )
  }

  const { data: lessonRows } = await supabaseAdmin
    .from('learn_lessons').select('id, title, content, display_order')
    .in('module_id', moduleIds).eq('is_published', true).order('display_order')

  const lessons: SourceLesson[] = (lessonRows ?? []).map(l => {
    const text = toText(l.content)
    const isPlaceholder = (l.content ?? '').includes(PLACEHOLDER)
    return { id: l.id, title: l.title, text, usable: !isPlaceholder && text.length >= 120 }
  })

  const usable = lessons.filter(l => l.usable)
  const usableChars = usable.reduce((n, l) => n + l.text.length, 0)

  // ── Pre-flight: refuse thin material before spending a call ────────────────
  const minChars = questionCount * 300
  const minLessons = Math.max(3, Math.ceil(questionCount / 3))
  if (usable.length < minLessons || usableChars < minChars) {
    const thin = lessons.filter(l => !l.usable).map(l => l.title)
    return NextResponse.json({
      error: 'Not enough written content to build a fair quiz',
      blocked: {
        reason:
          `“${scopeName}” has ${usable.length} lesson${usable.length === 1 ? '' : 's'} with real content ` +
          `(${usableChars.toLocaleString()} characters). A ${questionCount}-question quiz needs at least ` +
          `${minLessons} and about ${minChars.toLocaleString()}. Write the bodies for the lessons below, then try again — ` +
          `generating now would mean inventing questions the material doesn't answer.`,
        lessons: thin.slice(0, 25),
      },
      source: { usableLessons: usable.length, usableChars, totalLessons: lessons.length },
    }, { status: 422 })
  }

  // ── Ask Claude ─────────────────────────────────────────────────────────────
  // Cap the payload so a 73-lesson category can't blow the context window.
  const budget = 60_000
  let spent = 0
  const packed: SourceLesson[] = []
  for (const l of usable) {
    if (spent + l.text.length > budget) continue
    packed.push(l); spent += l.text.length
  }

  const userContent =
    `SUBJECT/CATEGORY: ${scopeName}\n` +
    `WRITE: ${questionCount} questions.\n\n` +
    `LESSONS:\n` +
    packed.map(l => `--- lesson_id: ${l.id}\ntitle: ${l.title}\n${l.text}`).join('\n\n')

  let raw = ''
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
    raw = message.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'The model call failed' },
      { status: 502 },
    )
  }

  const sliced = sliceOutermostObject(raw)
  if (!sliced) {
    // Claude answered in prose. That is nearly always a refusal, and retrying
    // identical inputs fails identically — carry its words instead of a generic
    // "malformed" (the exact lesson the case-studies tool taught).
    return NextResponse.json(
      { error: "Claude wouldn't build a quiz from this material.", blocked: { reason: raw.slice(0, 600), lessons: [] } },
      { status: 422 },
    )
  }

  let parsed: {
    title?: string
    questions?: { prompt?: string; options?: string[]; correct_index?: number; explanation?: string; source_lesson_id?: string }[]
    blocked?: { reason?: string; lessons?: string[] }
  }
  try { parsed = JSON.parse(sliced) } catch {
    return NextResponse.json(
      { error: "Claude's reply wasn't valid JSON.", blocked: { reason: raw.slice(0, 600), lessons: [] } },
      { status: 422 },
    )
  }

  if (parsed.blocked?.reason) {
    return NextResponse.json({
      error: "Claude wouldn't build a quiz from this material.",
      blocked: {
        reason: String(parsed.blocked.reason),
        lessons: Array.isArray(parsed.blocked.lessons) ? parsed.blocked.lessons.map(String).slice(0, 25) : [],
      },
    }, { status: 422 })
  }

  // ── Validate before writing anything ───────────────────────────────────────
  const validIds = new Set(packed.map(l => l.id))
  const questions = (parsed.questions ?? []).filter(q =>
    typeof q.prompt === 'string' && q.prompt.trim().length > 0
    && Array.isArray(q.options) && q.options.length === 4
    && q.options.every(o => typeof o === 'string' && o.trim().length > 0)
    && typeof q.correct_index === 'number' && q.correct_index >= 0 && q.correct_index <= 3,
  )
  if (questions.length < 3) {
    return NextResponse.json(
      { error: 'Claude returned too few usable questions.', blocked: { reason: `Only ${questions.length} of the returned questions were well-formed.`, lessons: [] } },
      { status: 422 },
    )
  }

  // ── Replace any existing DRAFT for this scope ──────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('learn_quizzes').select('id, is_published')
    .eq('scope_type', scopeType).eq('scope_id', scopeId).maybeSingle()

  if (existing?.is_published) {
    return NextResponse.json({
      error: 'A published quiz already exists here. Unpublish it first if you want to rebuild it.',
    }, { status: 409 })
  }
  if (existing) {
    // Questions/options cascade from the quiz row.
    await supabaseAdmin.from('learn_quizzes').delete().eq('id', existing.id)
  }

  const { data: quiz, error: quizErr } = await supabaseAdmin.from('learn_quizzes').insert({
    scope_type: scopeType,
    scope_id: scopeId,
    title: (parsed.title || `${scopeName} — knowledge check`).slice(0, 200),
    pass_pct: 80,
    is_published: false,
    created_by: admin.user.id,
    generated_meta: {
      model: MODEL,
      generated_at: new Date().toISOString(),
      lesson_ids: packed.map(l => l.id),
      source_chars: spent,
      requested: questionCount,
      returned: questions.length,
    },
  }).select('id').single()
  if (quizErr || !quiz) return NextResponse.json({ error: quizErr?.message ?? 'Could not save the quiz' }, { status: 500 })

  for (const [i, q] of questions.entries()) {
    const { data: row, error: qErr } = await supabaseAdmin.from('learn_quiz_questions').insert({
      quiz_id: quiz.id,
      prompt: q.prompt!.trim(),
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : null,
      // Only trust an id we actually supplied — a hallucinated one becomes null
      // rather than a dangling reference.
      source_lesson_id: q.source_lesson_id && validIds.has(q.source_lesson_id) ? q.source_lesson_id : null,
      display_order: i,
    }).select('id').single()
    if (qErr || !row) continue

    await supabaseAdmin.from('learn_quiz_options').insert(
      q.options!.map((label, oi) => ({
        question_id: row.id,
        label: label.trim(),
        is_correct: oi === q.correct_index,
        display_order: oi,
      })),
    )
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.quiz.generate',
    entityType: 'learn_quiz',
    entityId: quiz.id,
    summary: `Generated a ${questions.length}-question draft quiz for ${scopeType === 'module' ? 'subject' : 'category'} “${scopeName}”`,
    metadata: { scopeType, scopeId, model: MODEL, requested: questionCount, returned: questions.length, sourceChars: spent },
  })

  return NextResponse.json({ ok: true, quizId: quiz.id, questions: questions.length })
}
