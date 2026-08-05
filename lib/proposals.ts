// ─────────────────────────────────────────────────────────────────────────────
// lib/proposals.ts — the grounding + guard layer for AI-drafted equipment
// proposals. Pure and dependency-free, so both the client editor and the server
// routes import it and scripts/verify-proposals.mjs can exercise it directly.
//
// ── The one design decision everything else follows ─────────────────────────
// Claude is NEVER SHOWN A NUMBER.
//
// A proposal is a higher-stakes document than a case study: a customer may read
// it as a commitment. The case-study tool lets the model write figures and then
// checks them against the inputs — but that check has real holes (a decimal
// splits into two runs that both pass; single digits are always whitelisted
// because `unit: 1..N` is in the corpus; and it only runs at generate time, so
// numbers a human types later are never checked).
//
// Here the model writes only prose, from FACTS containing qualitative
// descriptors alone — "a high-capacity wheel", "electric reactivation", not
// "7.58 gr/lb". Every figure on the finished document is templated directly from
// the frozen sizing snapshot. So the model has no figure available to misplace,
// and the check below becomes complete rather than leaky: **any digit Claude
// writes is a flag**, full stop.
//
// The one remaining hole is the same as the case-study tool's: a number spelled
// as a word ("thirty percent"). The system prompt forbids it and a human reads
// the draft. That is stated rather than papered over.
//
// Related: lib/case-studies.ts (the precedent), lib/sizing.ts + lib/desmod.ts
// (where every real figure comes from).
// ─────────────────────────────────────────────────────────────────────────────

import type { SizingInputs, SizingResult } from './sizing'
import type { SizingVerification } from './desmod'

export type ProposalStatus = 'draft' | 'in_review' | 'approved'

/** Sections Claude drafts. Prose only — see the file header. */
export const AI_SECTION_KEYS = ['cover_letter', 'scope'] as const
/** Sections only a human ever writes. Claude never sees or touches these. */
export const HUMAN_SECTION_KEYS = ['exclusions', 'notes'] as const

export const SECTION_KEYS = [...AI_SECTION_KEYS, ...HUMAN_SECTION_KEYS] as const

export type AiSectionKey = (typeof AI_SECTION_KEYS)[number]
export type SectionKey = (typeof SECTION_KEYS)[number]
export type Sections = Record<SectionKey, string>

export const SECTION_LABELS: Record<SectionKey, string> = {
  cover_letter: 'Cover letter',
  scope: 'Scope of work',
  exclusions: 'Exclusions',
  notes: 'Notes',
}

/** Seeded into a new proposal so the human sections are never blank boilerplate. */
export const DEFAULT_EXCLUSIONS = [
  'Electrical service, disconnects and final power connections by others.',
  'Ductwork, dampers and external piping by others.',
  'Rigging, offloading and setting of equipment by others.',
  'Permits, taxes and bonds are not included.',
  'Field labour, start-up and commissioning quoted separately unless stated above.',
].join('\n')

export type Claim = { statement: string; source: string }
export type Gap = { section: string; need: string; resolved?: boolean }
/** A digit Claude wrote. Must be cleared by a human before approval. */
export type DigitFlag = { token: string; section: string; snippet: string; cleared?: boolean }

export type Proposal = {
  id: string
  deal_id: string | null
  title: string
  customer_name: string
  job_name: string
  site_location: string | null
  prepared_for: string | null
  application_input: string
  requirements_input: string
  status: ProposalStatus
  sizing_inputs: SizingInputs | null
  sizing_result: SizingResult | null
  catalog_source: 'dryware' | 'fallback' | null
  verification: SizingVerification | null
  draft_sections: Sections | null
  edited_sections: Sections | null
  claims: Claim[] | null
  gaps: Gap[] | null
  flags: DigitFlag[] | null
  model: string | null
  generated_at: string | null
  submitted_at: string | null
  approved_at: string | null
  review_notes: string | null
  pdf_path: string | null
  pdf_generated_at: string | null
  created_at: string
  updated_at: string
}

// ─── FACTS — the single grounding input to Claude ────────────────────────────

/**
 * What Claude is given. Note what is absent: airflow, grains, temperatures,
 * pressure drop, kW, dimensions. Every one of those is templated onto the
 * document from the snapshot instead.
 */
export type Facts = {
  customer: { company_name: string; site?: string; attention?: string }
  project: { job_name: string; application: string; requirements: string }
  equipment: {
    /** The model number. Contains digits — the only such token Claude may echo. */
    model_number: string
    /** "one unit" / "three units" — deliberately a word, not a numeral. */
    quantity: string
    wheel: string
    reactivation: string
    /** Qualitative only: 'verified against the manufacturer's performance model'. */
    performance_basis: string
    /** Plain-English notes from the engine, stripped of figures. */
    selection_notes: string[]
  }
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
]

/** Spell a small count so the FACTS object contains no numeral at all. */
export function spellCount(n: number): string {
  const i = Math.max(Math.round(n), 0)
  const word = NUMBER_WORDS[i] ?? String(i)
  return `${word} unit${i === 1 ? '' : 's'}`
}

/**
 * Strip every digit-bearing figure out of an engine sentence, so the rationale
 * can be handed to Claude as context without smuggling numbers in.
 *
 * The engine's rationale strings are templates like
 * `"2,340 CFM required → the 3,000 CFM catalog size is the smallest that covers it."`
 * A sentence containing a figure is DROPPED rather than redacted: a half-redacted
 * sentence reads as though something was hidden, and the useful qualitative
 * lines ("The moisture load governs the airflow, not the circulation rate.")
 * survive intact.
 */
export function qualitativeNotes(rationale: string[]): string[] {
  return rationale.filter((line) => !/\d/.test(line)).map((l) => l.trim()).filter(Boolean)
}

export function buildFacts(p: {
  customer_name: string
  site_location?: string | null
  prepared_for?: string | null
  job_name: string
  application_input: string
  requirements_input: string
  sizing_result: SizingResult | null
  verification: SizingVerification | null
}): Facts {
  const sel = p.sizing_result?.selection
  const react = p.sizing_result?.reactivation

  return {
    customer: {
      company_name: p.customer_name,
      ...(p.site_location ? { site: p.site_location } : {}),
      ...(p.prepared_for ? { attention: p.prepared_for } : {}),
    },
    project: {
      job_name: p.job_name,
      application: p.application_input,
      requirements: p.requirements_input,
    },
    equipment: {
      model_number: sel?.model ?? '',
      quantity: spellCount(sel?.unitsRequired ?? 1),
      wheel:
        sel?.wheel === 'high-capacity'
          ? 'a high-capacity desiccant wheel'
          : 'a standard desiccant wheel',
      reactivation: react?.label ? `${react.label} reactivation` : '',
      performance_basis: p.verification
        ? "verified against the manufacturer's own wheel performance model"
        : 'a preliminary selection using planning coefficients, not yet verified',
      selection_notes: qualitativeNotes(sel?.rationale ?? []),
    },
  }
}

// ─── Readiness ───────────────────────────────────────────────────────────────

/** Human labels for what a draft still needs. Empty array = ready to generate. */
export function missingForGenerate(p: {
  customer_name: string
  job_name: string
  application_input: string
  requirements_input: string
  sizing_result: SizingResult | null
}): string[] {
  const missing: string[] = []
  if (!p.customer_name.trim()) missing.push('Customer name')
  if (!p.job_name.trim()) missing.push('Job name')
  if (!p.application_input.trim()) missing.push('What the space is used for')
  if (!p.requirements_input.trim()) missing.push('What the customer needs')
  if (!p.sizing_result) missing.push('A sizing selection')
  return missing
}

// ─── The digit check ─────────────────────────────────────────────────────────

/**
 * Tokens Claude is allowed to echo even though they contain digits: the model
 * number and the customer-supplied names, which legitimately read like
 * "IAT-3000RE-2100" or "Plant 2".
 *
 * Matching is on the WHOLE TOKEN, never on the digit run inside it. That is the
 * difference between this and the case-study checker: there, `IAT-5000` donated
 * `5000` to a corpus, so a fabricated `$5000` passed. Here the allowed string is
 * removed intact first, so `$5000` still flags.
 */
export function allowedTokens(p: {
  customer_name: string
  job_name: string
  site_location?: string | null
  prepared_for?: string | null
  sizing_result: SizingResult | null
}): string[] {
  return [
    p.sizing_result?.selection.model ?? '',
    p.customer_name,
    p.job_name,
    p.site_location ?? '',
    p.prepared_for ?? '',
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /\d/.test(s))
    // Longest first, so "IAT-3000RE-2100" is consumed before a shorter overlap.
    .sort((a, b) => b.length - a.length)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Flag every digit Claude wrote that is not part of an allowed token.
 *
 * Only the AI sections are scanned — a human typing a figure into Exclusions is
 * doing their job. Note this runs on the CURRENT sections, so unlike the
 * case-study checker it can be (and is) re-run after human edits rather than
 * only at generate time.
 */
export function checkDigits(sections: Partial<Sections>, allowed: string[]): DigitFlag[] {
  const flags: DigitFlag[] = []

  for (const key of AI_SECTION_KEYS) {
    const raw = sections[key]
    if (typeof raw !== 'string' || raw === '') continue

    // Blank out allowed tokens (preserving length, so snippet offsets stay true).
    let masked = raw
    for (const token of allowed) {
      masked = masked.replace(new RegExp(escapeRegExp(token), 'gi'), (m) => ' '.repeat(m.length))
    }

    for (const m of masked.matchAll(/\d+(?:[.,]\d+)*/g)) {
      const at = m.index ?? 0
      flags.push({
        token: m[0],
        section: key,
        snippet: `…${raw.slice(Math.max(0, at - 40), at + m[0].length + 40).trim()}…`,
        cleared: false,
      })
    }
  }
  return flags
}

// ─── Approval ────────────────────────────────────────────────────────────────

/** Empty array = approvable. Mirrored server-side; the UI recomputes it live. */
export function approvalBlockers(p: {
  edited_sections: Sections | null
  gaps: Gap[] | null
  flags: DigitFlag[] | null
}): string[] {
  const blockers: string[] = []

  if (!p.edited_sections) {
    blockers.push('The proposal has not been drafted yet.')
    return blockers
  }
  if (!p.edited_sections.cover_letter?.trim() || !p.edited_sections.scope?.trim()) {
    blockers.push('The cover letter and scope of work must both have content.')
  }

  const openGaps = (p.gaps ?? []).filter((g) => !g.resolved).length
  if (openGaps > 0) {
    blockers.push(`${openGaps} unresolved gap${openGaps === 1 ? '' : 's'} in the draft.`)
  }

  const openFlags = (p.flags ?? []).filter((f) => !f.cleared).length
  if (openFlags > 0) {
    blockers.push(
      `${openFlags} unverified figure${openFlags === 1 ? '' : 's'} written by the model. ` +
        'Every number on a proposal must come from the sizing snapshot.',
    )
  }

  return blockers
}

/**
 * Whether the document may be presented as final engineering.
 *
 * A proposal without a DryWare verification carries planning coefficients that
 * have been measured as materially conservative, so it is marked preliminary on
 * the page and on the PDF regardless of approval status.
 */
export function isEngineeringGrade(p: { verification: SizingVerification | null }): boolean {
  return p.verification != null
}

/** Empty sections, for a fresh proposal. */
export function blankSections(): Sections {
  return { cover_letter: '', scope: '', exclusions: DEFAULT_EXCLUSIONS, notes: '' }
}
