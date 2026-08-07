import { NextRequest, NextResponse } from 'next/server'
// zod/v4 — the SDK's zodOutputFormat is typed against Zod 4 internals, and the
// installed zod@3.25 ships v4 under this subpath. Nothing else in the repo
// imports zod, so this is scoped to the extractor.
import { z } from 'zod/v4'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'
import { extractPdfText } from '@/lib/kb-extract'
import { parseModelNumber } from '@/lib/sizing-catalog'
import { FACT_KEYS, FACT_SPECS, coerceFactValue, type FactKey } from '@/lib/soo'
import {
  FACT_BEARING,
  classifyPages,
  extractDeterministic,
  reconcile,
  type ClassifiedPage,
  type FactSource,
} from '@/lib/soo-extract'

/* Read a submittal into proposed UnitFacts.
 *
 * ── This route WRITES NO FACTS ─────────────────────────────────────────────
 * It returns a proposal. A human confirms it in the review table, and the PATCH
 * route is what commits. Same posture as KnowledgeReactorClient.analyzeOne():
 * analyze is free to re-run and changes nothing, so nobody hesitates to re-run
 * it. The one thing it does persist is `submittal_path` — recording where the
 * evidence lives is true regardless of whether the facts are accepted.
 *
 * ── Two readers, on purpose ────────────────────────────────────────────────
 * The deterministic parsers in lib/soo-extract.ts do most of the work and are
 * fully tested against the real 45-page document. The model runs as a REDUNDANT
 * SECOND READER over the same filtered pages.
 *
 * That is not belt-and-braces. With a single source, a wrong fact is
 * indistinguishable from a right one and the reviewer has nothing but a page
 * citation to go on. With two or three, the review table can mark a fact
 * "Schedule + model number agree" (green, skim) versus "only the model saw
 * this" (amber, read it) — and that triage is what makes a fifty-row table get
 * reviewed instead of rubber-stamped. It also converts a parser breakage from a
 * silent pile of nulls into a visible pile of conflicts.
 *
 * `PRECEDENCE` in lib/soo-extract.ts puts `llm` last: the model can add a fact
 * the parsers missed and can disagree loudly, but it never overrides them.
 */

export const dynamic = 'force-dynamic'
// Download (up to 25MB) + unpdf + one Opus call. The call is the long pole.
export const maxDuration = 120

const BUCKET = 'soo-submittals'

// Structured outputs — the model cannot return anything but this shape, which
// removes "was it valid JSON" as a failure mode entirely. `value` is a string
// for every fact regardless of its real type: a union per fact would balloon
// the schema, and coerceFactValue already holds human edits to the same
// standard, so a junk value lands as null (= unknown → the clause blocks)
// rather than as a confident wrong answer.
const Finding = z.object({
  fact: z.enum(FACT_KEYS as [FactKey, ...FactKey[]]),
  value: z.string(),
  page: z.number().int(),
  quote: z.string(),
})
const Extraction = z.object({ findings: z.array(Finding) })

function factCatalogue(): string {
  return (Object.keys(FACT_SPECS) as FactKey[])
    .filter((k) => FACT_SPECS[k].kind !== 'object')
    .map((k) => {
      const s = FACT_SPECS[k]
      const type = s.kind === 'enum' ? `one of: ${s.options?.join(' | ')}` : s.kind === 'boolean' ? 'true | false' : s.kind
      return `- ${k} (${type})${s.unit ? ` [${s.unit}]` : ''} — ${s.label}`
    })
    .join('\n')
}

const SYSTEM = `You read one IAT (Innovative Air Technologies) desiccant dehumidifier Sales Submittal and report the unit's configuration.

You are the SECOND reader. A deterministic parser has already read the same pages. Your value is independence: read the document yourself and report what it says, so a disagreement between us is visible to a human. Do not try to guess what the parser found.

Rules:
- Report ONLY what the document states about THIS unit. If a value is not stated, omit that fact entirely. An omission is a good answer; a guess is not.
- Never infer a value from what is typical, standard, or implied by another field. If the submittal does not say whether a plenum pressure transmitter is fitted, do not report one.
- Every finding needs the page number it came from and a short verbatim quote from that page. If you cannot quote it, do not report it.
- Ambiguity is not a coin flip. "BACnet" alone does not say MS/TP or IP — omit bas_protocol rather than pick one.
- The pages you are given are only this unit's data sheets. Any generic specification language you may recall from such documents is not part of this input.

Facts you may report:
${factCatalogue()}`

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { path?: string } | null
  const path = typeof body?.path === 'string' ? body.path : null
  if (!path) return NextResponse.json({ error: 'Missing the uploaded file path.' }, { status: 400 })

  const { data: doc } = await supabaseAdmin.from('soo_documents').select('id, status').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.status === 'approved') {
    return NextResponse.json({ error: 'This sequence is approved. Reopen it before re-reading the submittal.' }, { status: 409 })
  }

  // Server-side download: the file reached Storage via a signed upload URL, so
  // Vercel's inbound body limit never applies to these bytes.
  const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (dlErr || !file) {
    console.error('[soo/extract] download error:', dlErr)
    return NextResponse.json({ error: 'Could not read the uploaded submittal.' }, { status: 400 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())

  // ── 1. Text layer ─────────────────────────────────────────────────────────
  // Fail loudly. A DryWare submittal is born-digital; no text layer means the
  // wrong file, or a scan, and 45 pages of vision is not the answer to either.
  const text = await extractPdfText(bytes)
  if (!text.ok) {
    return NextResponse.json(
      {
        error: `That PDF has no usable text layer (${text.wordsPerPage} words/page). A DryWare submittal should be born-digital — check it is the right file and not a scan.`,
        reason: text.reason,
      },
      { status: 422 },
    )
  }
  const pageTexts = text.text.split(/^===== PAGE \d+ =====$/m).slice(1).map((s) => s.trim())

  // ── 2. Deterministic pass ─────────────────────────────────────────────────
  const record = extractDeterministic(pageTexts, parseModelNumber)
  const pages = classifyPages(pageTexts)

  // ── 3. The model, over the FILTERED pages only ────────────────────────────
  // The 13-page guide spec is dropped here, in code. It is generic boilerplate
  // ("provide freezestat set at 35°F") written for a hypothetical unit, and it
  // is the single worst extraction hazard in the document: plausible,
  // authoritative-sounding, on-topic and wrong. Removing the pages is
  // verifiable; asking a model to ignore thirteen pages of them is not.
  const relevant = pages.filter((p) => FACT_BEARING.has(p.kind))
  const llmSources: FactSource[] = []
  let modelNote: string | null = null

  try {
    const response = await anthropic.beta.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // Structured extraction with a fixed schema — the reasoning is shallow
      // and the win is fidelity, not depth. `high` is the API default anyway;
      // stated explicitly so the choice is visible.
      output_config: { effort: 'high', format: zodOutputFormat(Extraction) },
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPagesPrompt(relevant) }],
    })

    // stop_reason FIRST — on a refusal or a truncation the parsed output is
    // absent or partial, and reading it would look like a successful read of a
    // unit with fewer options than it has.
    if (response.stop_reason === 'refusal') {
      modelNote = 'The second reader declined this document; the deterministic parse is shown on its own.'
    } else if (response.stop_reason === 'max_tokens') {
      modelNote = 'The second reader was cut off mid-answer, so its findings were discarded. The deterministic parse is unaffected.'
    } else {
      for (const f of response.parsed_output?.findings ?? []) {
        if (!(f.fact in FACT_SPECS)) continue
        const value = coerceFactValue(f.fact, f.value)
        if (value === null) continue
        llmSources.push({
          method: 'llm',
          fact: f.fact,
          value,
          page: f.page,
          snippet: f.quote.slice(0, 300),
        })
      }
    }
  } catch (e) {
    // The deterministic parse already stands on its own — losing the second
    // reader costs cross-checking, not the extraction.
    console.error('[soo/extract] second reader failed:', e)
    modelNote = 'The second reader could not be reached, so nothing was cross-checked. The deterministic parse is shown on its own.'
  }

  // ── 4. Reconcile ──────────────────────────────────────────────────────────
  const merged = reconcile(
    [...sourcesOf(record), ...llmSources],
    record.unmapped,
    pages,
  )

  // Recording WHERE the evidence lives is true whether or not the reader
  // accepts these facts, so it is the one thing this route persists.
  await supabaseAdmin.from('soo_documents').update({ submittal_path: path }).eq('id', id)

  return NextResponse.json({
    record: merged,
    modelNote,
    pageCount: text.pageCount,
    dropped: {
      guideSpec: pages.filter((p) => p.kind === 'guide-spec').length,
      vendor: pages.filter((p) => p.kind === 'vendor').length,
    },
  })
}

/**
 * Re-derive the deterministic FactSources from the record so they can be merged
 * with the model's. `extractDeterministic` already reconciled them internally;
 * feeding its winners back in with their original method preserves precedence
 * (schedule > duct > bullet > model_number > llm) while letting the model's
 * findings either agree — raising the agreement count — or conflict.
 */
function sourcesOf(record: ReturnType<typeof extractDeterministic>): FactSource[] {
  const out: FactSource[] = []
  for (const key of Object.keys(record.provenance) as FactKey[]) {
    const p = record.provenance[key]
    const value = (record.facts as Record<string, unknown>)[key]
    if (!p || value === null || value === undefined) continue
    out.push({ method: p.method, fact: key, value, page: p.page, snippet: p.snippet })
  }
  return out
}

function buildPagesPrompt(pages: ClassifiedPage[]): string {
  const body = pages
    .map((p) => `===== PAGE ${p.page} (${p.kind}) =====\n${p.text}`)
    .join('\n\n')
  return `Below are the data-sheet pages of one submittal. Vendor literature and the generic master specification have already been removed.\n\n${body}`
}
