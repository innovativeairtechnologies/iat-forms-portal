// ─────────────────────────────────────────────────────────────────────────────
// lib/case-studies.ts — types + pure helpers for the case-study tool (072).
//
// The anti-fabrication contract lives here:
//   • buildFacts() assembles the ONE structured object the model is allowed to
//     know. Anonymized studies structurally omit the company name and serials —
//     the model can't leak what it never saw.
//   • checkNumbers() is the mechanical guarantee the prompt can't fake: every
//     digit-run in the generated prose must appear somewhere in the inputs;
//     unmatched ones become flags that block approval until a human clears them.
//
// Dependency-free (no server/node APIs) so client components can import the
// types and validators. The Claude call itself lives in the generate route.
// ─────────────────────────────────────────────────────────────────────────────

import type { Customer, Equipment } from './supabase'

export type CaseStudyStatus = 'draft' | 'in_review' | 'approved'
export type CaseStudyDisclosure = 'anonymized' | 'named'

// Ordered section keys — the draft's shape. Order = render order.
export const SECTION_KEYS = ['title', 'summary', 'challenge', 'solution', 'results'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]
export type Sections = Record<SectionKey, string>

export const SECTION_LABELS: Record<SectionKey, string> = {
  title: 'Title',
  summary: 'Summary',
  challenge: 'The Challenge',
  solution: 'The Solution',
  results: 'The Results',
}

/** A factual claim the model made, pointing at the input field it came from. */
export type Claim = { statement: string; source: string }
/**
 * Something a human must look at before this goes out. Two kinds, both blocking:
 *   'input'      — a fact the model wanted and was forbidden to invent (default;
 *                  older rows have no `kind` and read as this).
 *   'disclosure' — identifying detail present in an ANONYMIZED study. Anonymized
 *                  mode omits the customer name/serials/site from FACTS
 *                  structurally, but it cannot strip what a person typed into the
 *                  free-text story fields. We flag those rather than scrubbing
 *                  them: silently deleting detail someone deliberately wrote is
 *                  its own failure mode, so the call stays with the human.
 */
export type Gap = { section: string; need: string; kind?: 'input' | 'disclosure'; resolved?: boolean }
/** A number in the prose that doesn't trace to any input. Blocks approval until cleared. */
export type NumberFlag = { token: string; section: string; snippet: string; cleared?: boolean }

export type CaseStudyUnit = {
  id: string
  case_study_id: string
  equipment_id: string | null
  model_number: string
  serial_number: string | null
  voltage: string | null
  location: string | null
  install_date: string | null
  application: string
  entering_conditions: string
  target_conditions: string
  airflow: string
  notes: string | null
  sort_order: number
  created_at: string
}

/** Editable fields of a unit (what the editor PATCHes; ids minted server-side). */
export type UnitInput = Omit<CaseStudyUnit, 'id' | 'case_study_id' | 'created_at'>

export type CaseStudy = {
  id: string
  customer_id: string | null
  title: string
  customer_disclosure: CaseStudyDisclosure
  industry: string | null
  region: string | null
  context_input: string
  problem_before: string
  outcome_after: string
  status: CaseStudyStatus
  draft_sections: Sections | null
  edited_sections: Sections | null
  claims: Claim[] | null
  gaps: Gap[] | null
  flags: NumberFlag[] | null
  model: string | null
  generated_by: string | null
  generated_at: string | null
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  review_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  customers?: Customer | null
  case_study_units?: CaseStudyUnit[]
}

export const STATUS_LABELS: Record<CaseStudyStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
}

// ─── Required-field validation (shared by the editor UI + the generate route) ─

type RequiredUnitKey = 'model_number' | 'application' | 'entering_conditions' | 'target_conditions' | 'airflow'

const UNIT_REQUIRED: { key: RequiredUnitKey; label: string }[] = [
  { key: 'model_number', label: 'model number' },
  { key: 'application', label: 'application' },
  { key: 'entering_conditions', label: 'entering conditions' },
  { key: 'target_conditions', label: 'target conditions' },
  { key: 'airflow', label: 'airflow' },
]

/**
 * What's still missing before a draft can be generated. Empty array = ready.
 * These are the fields the prose is grounded in — every one is a fact Claude
 * is forbidden to supply on its own, which is exactly why they're required.
 */
export function missingForGenerate(
  study: Pick<CaseStudy, 'context_input' | 'problem_before' | 'outcome_after'>,
  units: Pick<UnitInput, RequiredUnitKey>[]
): string[] {
  const missing: string[] = []
  if (!study.context_input.trim()) missing.push('Project context')
  if (!study.problem_before.trim()) missing.push('The problem before')
  if (!study.outcome_after.trim()) missing.push('The outcome after')
  if (units.length === 0) missing.push('At least one unit')
  units.forEach((u, i) => {
    for (const f of UNIT_REQUIRED) {
      if (!String(u[f.key] ?? '').trim()) missing.push(`Unit ${i + 1}: ${f.label}`)
    }
  })
  return missing
}

// ─── FACTS — the single grounding object sent to the model ────────────────────

export type Facts = {
  customer: {
    disclosure: CaseStudyDisclosure
    company_name?: string // OMITTED entirely when anonymized
    industry?: string
    region?: string
  }
  units: {
    unit: number // 1-based label ("Unit 1")
    model_number: string
    serial_number?: string // omitted when anonymized
    voltage?: string
    location?: string // omitted when anonymized (site can identify the customer)
    install_date?: string
    application: string
    entering_conditions: string
    target_conditions: string
    airflow: string
    notes?: string
  }[]
  unit_count: number
  project: {
    context: string
    problem_before: string
    outcome_after: string
  }
}

/**
 * Assemble the FACTS object. Anonymized mode omits the identifying fields
 * STRUCTURALLY (not by instruction) — the model never receives them.
 */
export function buildFacts(study: CaseStudy, units: CaseStudyUnit[]): Facts {
  const anon = study.customer_disclosure === 'anonymized'
  const customerName = study.customers?.company_name
  return {
    customer: {
      disclosure: study.customer_disclosure,
      ...(anon || !customerName ? {} : { company_name: customerName }),
      ...(study.industry ? { industry: study.industry } : {}),
      ...(study.region ? { region: study.region } : {}),
    },
    units: units.map((u, i) => ({
      unit: i + 1,
      model_number: u.model_number,
      ...(!anon && u.serial_number ? { serial_number: u.serial_number } : {}),
      ...(u.voltage ? { voltage: u.voltage } : {}),
      ...(!anon && u.location ? { location: u.location } : {}),
      ...(u.install_date ? { install_date: u.install_date } : {}),
      application: u.application,
      entering_conditions: u.entering_conditions,
      target_conditions: u.target_conditions,
      airflow: u.airflow,
      ...(u.notes ? { notes: u.notes } : {}),
    })),
    unit_count: units.length,
    project: {
      context: study.context_input,
      problem_before: study.problem_before,
      outcome_after: study.outcome_after,
    },
  }
}

// ─── The disclosure check (anonymized studies only) ──────────────────────────

/**
 * The identifying strings we actually hold on this record — precisely the ones
 * buildFacts omits in anonymized mode. Matching these in free text is exact and
 * false-positive-free, unlike guessing at proper nouns generally (the model
 * handles that half; see the generate route's disclosure_risks).
 */
function knownIdentifiers(study: CaseStudy, units: CaseStudyUnit[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  // 4-char floor keeps short/generic tokens ("Co", "IAT") from matching prose.
  const push = (value: string | null | undefined, label: string) => {
    const v = (value ?? '').trim()
    if (v.length >= 4) out.push({ value: v, label })
  }

  const company = (study.customers?.company_name ?? '').trim()
  push(company, 'the customer’s name')
  // "Acme Pharmaceuticals Inc" also matches a bare "Acme Pharmaceuticals".
  const bare = company
    .replace(/[,.]?\s*\b(inc|llc|l\.l\.c|corp|corporation|co|ltd|limited|company|group|holdings)\b\.?/gi, '')
    .trim()
  if (bare && bare.toLowerCase() !== company.toLowerCase()) push(bare, 'the customer’s name')

  push(study.customers?.location, 'the customer’s location')
  for (const u of units) {
    push(u.serial_number, `a unit serial number`)
    push(u.location, 'a unit’s site location')
  }
  return out
}

/**
 * Free-text story fields that name something anonymized mode is supposed to
 * hide. Returns blocking `disclosure` gaps — never edits the text.
 */
export function findDisclosureLeaks(study: CaseStudy, units: CaseStudyUnit[]): Gap[] {
  if (study.customer_disclosure !== 'anonymized') return []

  const fields: { label: string; text: string }[] = [
    { label: 'Project context', text: study.context_input },
    { label: 'The problem before', text: study.problem_before },
    { label: 'The outcome after', text: study.outcome_after },
  ]
  units.forEach((u, i) => {
    fields.push({ label: `Unit ${i + 1} application`, text: u.application })
    if (u.notes) fields.push({ label: `Unit ${i + 1} notes`, text: u.notes })
  })

  // Longest first, so "Acme Pharmaceuticals Inc" wins over its suffix-stripped
  // twin and the same leak isn't reported twice with different quoting.
  const ids = knownIdentifiers(study, units).sort((a, b) => b.value.length - a.value.length)
  const gaps: Gap[] = []
  for (const f of fields) {
    const hay = (f.text ?? '').toLowerCase()
    if (!hay) continue
    const matched: string[] = []
    for (const id of ids) {
      const needle = id.value.toLowerCase()
      if (!hay.includes(needle)) continue
      // Already covered by a longer identifier matched in this same field.
      if (matched.some((m) => m.includes(needle))) continue
      matched.push(needle)
      gaps.push({
        section: f.label,
        kind: 'disclosure',
        need: `names ${id.label} (“${id.value}”), but this study is Anonymized. Remove it from the input and regenerate, edit it out of the draft, or switch the study to Named.`,
        resolved: false,
      })
    }
  }
  return gaps
}

// ─── The number check ─────────────────────────────────────────────────────────

/** All digit-runs in a string, comma/space-insensitive ("5,000" → "5000"). */
function digitRuns(s: string): string[] {
  return (s.replace(/(\d)[,\s](?=\d)/g, '$1').match(/\d+/g) ?? [])
}

/**
 * Every digit-run in the generated prose must appear as a digit-run somewhere
 * in the inputs (FACTS). Returns a flag for each unmatched one. Deliberately
 * loose on formatting ("5,000 SCFM" matches "5000"; "March 2024" matches
 * "2024-03-15") and strict on substance — a number with no source anywhere in
 * the inputs cannot pass. Spelled-out numbers escape this net; the prompt
 * forbids them separately, and review catches stragglers.
 */
export function checkNumbers(sections: Sections, facts: Facts): NumberFlag[] {
  const corpus = new Set(digitRuns(JSON.stringify(facts)))
  const flags: NumberFlag[] = []
  for (const key of SECTION_KEYS) {
    const text = sections[key] ?? ''
    // Walk matches with positions so each flag carries a readable snippet.
    const normalized = text.replace(/(\d)[,\s](?=\d)/g, '$1')
    for (const m of normalized.matchAll(/\d+/g)) {
      if (corpus.has(m[0])) continue
      const at = m.index ?? 0
      const snippet = normalized.slice(Math.max(0, at - 40), at + m[0].length + 40).trim()
      flags.push({ token: m[0], section: key, snippet: `…${snippet}…`, cleared: false })
    }
  }
  return flags
}

// ─── Approval gate (shared by the status route + the review UI) ───────────────

/** What still blocks approval. Empty array = approvable. */
export function approvalBlockers(study: CaseStudy): string[] {
  const blockers: string[] = []
  if (!study.edited_sections) blockers.push('No draft has been generated yet.')
  const open = (study.gaps ?? []).filter((g) => !g.resolved)
  const openInput = open.filter((g) => g.kind !== 'disclosure')
  const openDisclosure = open.filter((g) => g.kind === 'disclosure')
  if (openInput.length) blockers.push(`${openInput.length} unresolved gap${openInput.length === 1 ? '' : 's'} (missing input the draft needs).`)
  if (openDisclosure.length) blockers.push(`${openDisclosure.length} unresolved anonymity risk${openDisclosure.length === 1 ? '' : 's'}.`)
  const openFlags = (study.flags ?? []).filter((f) => !f.cleared)
  if (openFlags.length) blockers.push(`${openFlags.length} unverified number${openFlags.length === 1 ? '' : 's'} in the prose.`)
  return blockers
}

// ─── Snapshot helper (customer page → new study; equipment → unit row) ────────

/** Snapshot an equipment row into a unit input (identity only — facts stay human-entered). */
export function unitFromEquipment(e: Equipment): UnitInput {
  return {
    equipment_id: e.id,
    model_number: e.model_number ?? '',
    serial_number: e.serial_number || null,
    voltage: e.voltage || null,
    location: e.location || null,
    install_date: e.install_date || null,
    application: '',
    entering_conditions: '',
    target_conditions: '',
    airflow: '',
    notes: null,
    sort_order: 0,
  }
}

/** A blank unit row. */
export function blankUnit(): UnitInput {
  return {
    equipment_id: null,
    model_number: '',
    serial_number: null,
    voltage: null,
    location: null,
    install_date: null,
    application: '',
    entering_conditions: '',
    target_conditions: '',
    airflow: '',
    notes: null,
    sort_order: 0,
  }
}
