import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'
import { anthropic } from '@/lib/anthropic'
import {
  AI_SECTION_KEYS,
  allowedTokens,
  buildFacts,
  checkDigits,
  missingForGenerate,
  type Claim,
  type Gap,
  type Sections,
} from '@/lib/proposals'

/* Draft the cover letter and scope of work.
 *
 * Claude writes PROSE ONLY. It is handed a FACTS object containing qualitative
 * descriptors and no figure whatsoever (see lib/proposals.ts buildFacts), so it
 * has no number available to misplace, and every digit it writes is flagged.
 *
 * The response ladder follows the lesson the case-study tool paid for: a
 * refusal is NOT a malformed response. When the model declines, its own words
 * come back as a 422 `blocked` payload, because a generic "try again" invites
 * the user to retry identical inputs and land in exactly the same place.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You write equipment proposals for Innovative Air Technologies (IAT), which
builds industrial desiccant dehumidification systems.

THE ONE RULE — YOU MAY NOT WRITE A NUMBER.

Not a numeral, not a figure spelled as a word. No airflows, temperatures, humidities, dimensions,
capacities, weights, voltages, lead times, prices, percentages, dates or quantities. The reader is
looking at a performance table on the same page that carries every figure, templated directly from
the engineering selection — your prose sits above it.

The ONLY exceptions are strings handed to you verbatim in FACTS: the model number, and the
customer/site/job names. Reproduce those exactly as given. Never build a new number out of them.

Where you would naturally reach for a figure, name the quantity instead: "the design airflow",
"the specified humidity", "the selected capacity". This reads as deliberate, not evasive.

OTHER RULES
- Introduce no fact that is not in FACTS. No invented people, sites, dates or history.
- No competitor names, ever.
- No energy-savings, ROI, payback or efficiency claims.
- No warranty, delivery or payment terms — a human writes those.
- Do not promise performance. Describe what is being supplied and what it is designed to do.
- If something needed for a section is missing, write around it and record it in gaps. A shorter,
  fully-grounded proposal is correct; a fuller one with invented detail is a failure.

STYLE
Plain, direct, professional. Short sentences. US spelling. No marketing superlatives, no
"cutting-edge", no "we are pleased to". Address the customer as "you". Write as IAT ("we").

RETURN ONLY a valid JSON object. No markdown fences, no commentary.

{
  "cover_letter": "string — 2 to 3 short paragraphs, addressed to the customer, stating what is being proposed and why it suits the application",
  "scope": "string — what IAT supplies and what it is designed to do. Prose or short paragraphs, not a bulleted parts list.",
  "claims": [{ "statement": "a claim you made", "source": "the FACTS field it came from" }],
  "gaps": [{ "section": "cover_letter | scope", "need": "what you needed and did not have" }]
}

IF THE INPUTS ARE UNUSABLE, RETURN A BLOCK INSTEAD:
{ "blocked": { "reason": "why, in your own words", "fields": ["what would fix it"] } }
Use this ONLY for wholesale unusability. A single missing detail is a gap, not a block.`

function sliceOutermostObject(s: string): string {
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  return a >= 0 && b > a ? s.slice(a, b + 1) : s
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (proposal.status === 'approved') {
    return NextResponse.json(
      { error: 'This proposal is approved. Reopen it to regenerate.' },
      { status: 409 },
    )
  }

  const missing = missingForGenerate(proposal)
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'This proposal needs more before it can be drafted.', missing },
      { status: 400 },
    )
  }

  const facts = buildFacts(proposal)

  let message
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `FACTS:\n${JSON.stringify(facts, null, 2)}\n\nWrite the proposal from these facts.`,
        },
      ],
    })
  } catch (e) {
    console.error('Proposal generate error:', e)
    return NextResponse.json({ error: 'The drafting service is unavailable right now.' }, { status: 502 })
  }

  // Checked BEFORE parsing, so truncation never masquerades as malformed JSON.
  if (message.stop_reason === 'max_tokens') {
    return NextResponse.json(
      { error: 'The draft ran long and was cut off. Trim the application and requirements, then try again.' },
      { status: 502 },
    )
  }

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const fenced = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()

  let parsed: Record<string, unknown> | null = null
  for (const candidate of [fenced, sliceOutermostObject(fenced)]) {
    try {
      const p = JSON.parse(candidate)
      if (p && typeof p === 'object') { parsed = p as Record<string, unknown>; break }
    } catch { /* try the next shape */ }
  }

  if (!parsed) {
    // Not JSON at all. If there is real prose here the model is talking to us —
    // almost always a refusal — and its own words are the only useful thing to
    // show. Retrying identical inputs would land here again.
    const prose = fenced.replace(/\s+/g, ' ').trim()
    if (prose.length > 40) {
      return NextResponse.json(
        {
          error: 'Claude would not draft a proposal from these inputs.',
          blocked: { reason: prose.slice(0, 600), fields: [] },
        },
        { status: 422 },
      )
    }
    return NextResponse.json({ error: 'The draft came back malformed.' }, { status: 502 })
  }

  const blocked = parsed.blocked as { reason?: unknown; fields?: unknown } | undefined
  if (blocked && typeof blocked.reason === 'string') {
    return NextResponse.json(
      {
        error: 'Claude would not draft a proposal from these inputs.',
        blocked: {
          reason: blocked.reason.slice(0, 600),
          fields: Array.isArray(blocked.fields) ? blocked.fields.map(String).slice(0, 12) : [],
        },
      },
      { status: 422 },
    )
  }

  const aiSections: Partial<Sections> = {}
  for (const key of AI_SECTION_KEYS) {
    const v = parsed[key]
    aiSections[key] = typeof v === 'string' ? v.trim() : ''
  }
  if (!aiSections.cover_letter || !aiSections.scope) {
    return NextResponse.json({ error: 'The draft came back incomplete.' }, { status: 502 })
  }

  // Keep whatever a human already wrote in the human-only sections — a redraft
  // must never silently discard hand-written exclusions.
  const existing = (proposal.edited_sections ?? {}) as Partial<Sections>
  const sections: Sections = {
    cover_letter: aiSections.cover_letter,
    scope: aiSections.scope,
    exclusions: existing.exclusions ?? '',
    notes: existing.notes ?? '',
  }

  const claims: Claim[] = Array.isArray(parsed.claims)
    ? (parsed.claims as unknown[])
        .filter((c): c is Claim =>
          !!c && typeof c === 'object' &&
          typeof (c as Claim).statement === 'string' && typeof (c as Claim).source === 'string')
        .slice(0, 100)
    : []

  const gaps: Gap[] = Array.isArray(parsed.gaps)
    ? (parsed.gaps as unknown[])
        .filter((g): g is Gap => !!g && typeof g === 'object' && typeof (g as Gap).need === 'string')
        .map((g) => ({ section: String(g.section ?? ''), need: g.need, resolved: false }))
        .slice(0, 50)
    : []

  const flags = checkDigits(sections, allowedTokens(proposal))

  const { error: saveErr } = await supabaseAdmin
    .from('proposals')
    .update({
      draft_sections: sections,
      edited_sections: sections,
      claims,
      gaps,
      flags,
      model: MODEL,
      generated_by: auth.userId,
      generated_at: new Date().toISOString(),
      status: 'draft',
    })
    .eq('id', id)

  if (saveErr) {
    console.error('Proposal draft save error:', saveErr)
    return NextResponse.json({ error: 'Drafted, but could not save it.' }, { status: 500 })
  }

  return NextResponse.json({ sections, claims, gaps, flags })
}
