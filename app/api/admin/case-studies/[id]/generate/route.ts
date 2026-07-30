import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { requireCaseStudiesAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildFacts, checkNumbers, findDisclosureLeaks, missingForGenerate, SECTION_KEYS,
  type CaseStudy, type CaseStudyUnit, type Claim, type Gap, type Sections,
} from '@/lib/case-studies'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Claude drafting a full study can take a while

const MODEL = 'claude-sonnet-4-6'

// The anti-fabrication contract. The FACTS object is the model's ENTIRE world:
// the customer/equipment rows never reach it directly, and in anonymized mode
// the company name and serials are structurally absent (see buildFacts).
// Server-side, checkNumbers() then verifies every digit-run in the prose traces
// back to FACTS — so the "no invented numbers" rule is enforced twice, once by
// instruction and once mechanically.
const SYSTEM_PROMPT = `You write customer case studies for IAT (Innovative Air Technologies), a manufacturer of industrial desiccant dehumidifiers. Sales gives you structured FACTS about a real project; you turn them into a credible, plainly-written case study.

THE ONE RULE — you may not introduce any fact that is not in FACTS:
- No numbers of any kind (percentages, savings, temperatures, dollar figures, timelines, counts) unless that exact figure appears in FACTS. Do not write numbers as words to get around this.
- No customer quotes or testimonials. Ever.
- No competitor names or comparisons to other manufacturers.
- No energy-savings, ROI, or payback claims unless FACTS states them.
- No invented people, dates, places, or events.
- If FACTS.customer.disclosure is "anonymized", never guess or imply the customer's name; describe them by industry/region (e.g. "a Southeast US pharmaceutical manufacturer").

When a section would normally need a fact you don't have, do NOT approximate it — write around it and record it in "gaps" so a human can supply the input. A shorter, fully-grounded study is correct; a fuller study with invented details is a failure.

Style: plain, specific, engineering-credible. Short sentences. No marketing superlatives ("cutting-edge", "world-class", "revolutionary"). Write like a competent engineer explaining a job well done. US spelling.

Return ONLY a valid JSON object. No markdown fences, no commentary. Exact structure:
{
  "sections": {
    "title": string,      // one line, factual, no colon-hype
    "summary": string,    // 2-3 sentences: who (per disclosure), what, outcome
    "challenge": string,  // the problem_before, expanded from context — 1-2 paragraphs
    "solution": string,   // what IAT supplied: the units and how they address the challenge — 1-2 paragraphs
    "results": string     // the outcome_after, stated plainly — 1 paragraph
  },
  "claims": [ { "statement": string, "source": string } ],
  "gaps":   [ { "section": string, "need": string } ]
}

"claims": every factual assertion in your prose, each with "source" naming the FACTS path it came from (e.g. "units[0].airflow", "project.outcome_after").
"gaps": each place you wanted a fact FACTS doesn't contain. "section" is one of ${JSON.stringify([...SECTION_KEYS])}; "need" says what a human should add (e.g. "measured RH after startup", "project timeframe").
Newlines inside section strings separate paragraphs.

ANONYMITY (only when FACTS.customer.disclosure is "anonymized"):
The identifying fields are already withheld from you, but the project text a person typed may still name things. Add a fourth key:
"disclosure_risks": [ { "detail": string, "where": string } ]
List any specific detail in FACTS.project or in your own draft that could identify this customer despite the anonymization — a city or street, a facility or brand name, a person's name, a licence number, or a circumstance distinctive enough to single them out. "detail" quotes or names the specific thing; "where" is the field or section it appears in.
Do NOT remove these from your prose and do NOT soften them — write naturally and just list them. A human decides what to cut. Empty array when there is nothing identifying. Omit this key entirely when disclosure is "named".

IF THE INPUTS ARE UNUSABLE, RETURN A BLOCK INSTEAD OF A STUDY.
Sometimes FACTS can't support a case study at all — the project fields describe something other than this customer's project (internal process docs, boilerplate, placeholder text), they contradict the units, or they contain no project narrative. In that case do NOT write a study, do NOT invent one, and do NOT explain yourself in prose. Return exactly this shape instead:
{ "blocked": { "reason": string, "fields": [string] } }
- "reason": one or two plain sentences a salesperson can act on, naming what's wrong and what to put there instead. No preamble.
- "fields": the FACTS paths at fault, e.g. ["project.context", "project.problem_before"].
Use this ONLY for wholesale unusability. A single missing detail is a "gap", not a block.`

/** First `{` to last `}` — rescues valid JSON that arrived wrapped in commentary. */
function sliceOutermostObject(s: string): string | null {
  const open = s.indexOf('{')
  const close = s.lastIndexOf('}')
  return open >= 0 && close > open ? s.slice(open, close + 1) : null
}

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await props.params

  const { data } = await supabaseAdmin
    .from('case_studies')
    .select('*, customers(*), case_study_units(*)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'case_study_units', ascending: true })
    .single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const study = data as CaseStudy
  const units = (study.case_study_units ?? []) as CaseStudyUnit[]

  if (study.status === 'approved') {
    return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to regenerate.' }, { status: 409 })
  }

  // The required-fields gate — the same list the editor shows, enforced where
  // it counts. Generation without grounding inputs is exactly the "just make
  // things up" failure this feature is built to prevent.
  const missing = missingForGenerate(study, units)
  if (missing.length) {
    return NextResponse.json(
      { error: 'Fill the required fields before generating.', missing },
      { status: 400 }
    )
  }

  const facts = buildFacts(study, units)

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      // Five sections + a claim per assertion + gaps runs long; 3000 truncated
      // real studies mid-JSON, which surfaced as an unexplained parse failure.
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `FACTS:\n${JSON.stringify(facts, null, 2)}\n\nWrite the case study from these facts.`,
      }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Truncation is its own failure — without this check a cut-off draft falls
    // through to the prose branch below and shows the user half a sentence.
    if (message.stop_reason === 'max_tokens') {
      console.error('Case study generation hit max_tokens', { id, len: raw.length })
      return NextResponse.json(
        { error: 'The draft ran past its length limit. Trim the inputs (or the number of units) and try again.' },
        { status: 502 }
      )
    }

    let parsed: {
      sections?: Partial<Sections>
      claims?: Claim[]
      gaps?: Gap[]
      disclosure_risks?: { detail?: string; where?: string }[]
      blocked?: { reason?: string; fields?: string[] }
    } | null = null
    const fenced = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    for (const candidate of [fenced, sliceOutermostObject(fenced)]) {
      if (!candidate) continue
      try { parsed = JSON.parse(candidate); break } catch { /* try the next shape */ }
    }

    // Not JSON at all. Empirically this is what a refusal looks like when the
    // model breaks format to explain itself — and its explanation is far more
    // useful to the person than "malformed, try again" (which invites retrying
    // identical bad inputs). Degrade into the blocked path, carrying its words.
    if (!parsed) {
      console.error('Case study generation was not valid JSON:', raw.slice(0, 500))
      const prose = raw.replace(/\s+/g, ' ').trim()
      if (prose.length > 40) {
        return NextResponse.json(
          { error: "Claude wouldn't write a study from these inputs.", blocked: { reason: prose.slice(0, 600), fields: [] } },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: 'The draft came back malformed. Try again.' }, { status: 502 })
    }

    // The structured refusal — inputs that can't support a study at all.
    if (parsed.blocked?.reason) {
      return NextResponse.json(
        {
          error: "Claude wouldn't write a study from these inputs.",
          blocked: { reason: String(parsed.blocked.reason), fields: Array.isArray(parsed.blocked.fields) ? parsed.blocked.fields.map(String).slice(0, 12) : [] },
        },
        { status: 422 }
      )
    }

    // Normalize: every section present as a string, in order.
    const sections = Object.fromEntries(
      SECTION_KEYS.map((k) => [k, typeof parsed.sections?.[k] === 'string' ? parsed.sections![k]!.trim() : ''])
    ) as Sections
    if (!sections.title || !sections.summary) {
      return NextResponse.json({ error: 'The draft came back incomplete. Try again.' }, { status: 502 })
    }

    const claims = Array.isArray(parsed.claims)
      ? parsed.claims
          .filter((c): c is Claim => !!c && typeof c.statement === 'string' && typeof c.source === 'string')
          .slice(0, 100)
      : []
    const gaps: Gap[] = Array.isArray(parsed.gaps)
      ? parsed.gaps
          .filter((g): g is Gap => !!g && typeof g.need === 'string')
          .map((g) => ({ section: String(g.section ?? ''), need: g.need, kind: 'input' as const, resolved: false }))
          .slice(0, 50)
      : []

    // Anonymity risks, from two independent passes that catch different things:
    //  • findDisclosureLeaks — exact matches on identifiers we HOLD (customer
    //    name, site, serials). Mechanical, no false positives.
    //  • disclosure_risks — what only a reader can spot: a city, a person, a
    //    facility name someone typed into the story fields that we have no
    //    record of. The model reads it anyway, so it may as well report it.
    // Neither scrubs anything; both block approval until a human clears them.
    const leaks = findDisclosureLeaks(study, units)
    const reported: Gap[] = (study.customer_disclosure === 'anonymized' && Array.isArray(parsed.disclosure_risks))
      ? parsed.disclosure_risks
          .filter((r): r is { detail: string; where?: string } => !!r && typeof r.detail === 'string' && r.detail.trim().length > 0)
          .map((r) => ({
            section: String(r.where ?? 'Draft'),
            kind: 'disclosure' as const,
            need: `${r.detail.trim()} — identifying detail in an Anonymized study. Edit it out, or switch the study to Named.`,
            resolved: false,
          }))
          .slice(0, 20)
      : []
    // Drop model reports that restate a leak we already caught exactly.
    const leakValues = leaks.map((l) => l.need.toLowerCase())
    const dedupedReported = reported.filter(
      (r) => !leakValues.some((lv) => {
        const quoted = r.need.match(/[“"']([^“”"']{3,})[”"']/)?.[1]?.toLowerCase()
        return quoted ? lv.includes(quoted) : false
      })
    )
    gaps.push(...leaks, ...dedupedReported)

    // The mechanical check the prompt can't fake: every number in the prose
    // must trace to the inputs. Unmatched ones block approval until cleared.
    const flags = checkNumbers(sections, facts)

    const { error: saveErr } = await supabaseAdmin
      .from('case_studies')
      .update({
        draft_sections: sections,
        edited_sections: sections, // working copy starts as the draft
        claims,
        gaps,
        flags,
        model: MODEL,
        generated_by: auth.userId,
        generated_at: new Date().toISOString(),
        // A fresh draft resets any in_review state back to draft for re-review.
        status: 'draft',
      })
      .eq('id', id)
    if (saveErr) {
      console.error('Case study draft save error:', saveErr)
      return NextResponse.json({ error: 'Generated, but could not save the draft. Try again.' }, { status: 500 })
    }

    return NextResponse.json({ sections, claims, gaps, flags })
  } catch (err) {
    console.error('Case study generation error:', err)
    return NextResponse.json({ error: 'Something went wrong generating the draft. Please try again.' }, { status: 500 })
  }
}
