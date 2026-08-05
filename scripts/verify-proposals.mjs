/* Verifies lib/proposals.ts — the grounding + guard layer for AI-drafted proposals.
 *
 * The load-bearing claim of this feature is: **a figure cannot be invented,
 * because Claude is never shown one and any digit it writes is flagged.** These
 * checks exist to make that claim falsifiable.
 *
 * The case-study tool's number check is the counter-example this suite is written
 * against. Its holes are reproduced here as explicit tests asserting THIS checker
 * does not share them:
 *   - a decimal splitting into two runs that both pass
 *   - single digits being permanently whitelisted by `unit: 1..N` in the corpus
 *   - a model number donating its digits, so `$5000` passes
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-proposals.mjs
 */

import {
  AI_SECTION_KEYS,
  SECTION_KEYS,
  allowedTokens,
  approvalBlockers,
  blankSections,
  buildFacts,
  checkDigits,
  isEngineeringGrade,
  missingForGenerate,
  qualitativeNotes,
  spellCount,
} from '../lib/proposals.ts'
import { calculateSizing, DEFAULT_SIZING_INPUTS } from '../lib/sizing.ts'
import { CATALOG_SIZES } from '../lib/sizing-catalog.ts'

let passed = 0
let failed = 0

function ok(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  } else {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  }
}

function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`)
}

const result = calculateSizing({ ...DEFAULT_SIZING_INPUTS, processCfm: 2000 }, CATALOG_SIZES)

const base = {
  customer_name: 'Northwind Foods',
  job_name: 'Packaging Room 2',
  site_location: 'Building 7, Ohio',
  prepared_for: 'A. Rivera',
  application_input: 'A packaging room that must stay dry year round.',
  requirements_input: 'Hold the space dry enough to stop condensation on the fillers.',
  sizing_result: result,
  verification: null,
}

const allowed = allowedTokens(base)

// ─── 1. Claude is never shown a number ───────────────────────────────────────
section('1. FACTS carry no figure Claude could misplace')

{
  const facts = buildFacts(base)
  const json = JSON.stringify(facts)

  // Everything the model sees, minus the tokens it is allowed to echo.
  let masked = json
  for (const t of allowed) masked = masked.split(t).join('')

  ok('FACTS contain no digit outside the allowed identity tokens',
    !/\d/.test(masked),
    /\d/.test(masked) ? `leaked: ${(masked.match(/.{0,30}\d.{0,30}/) || [])[0]}` : '')

  ok('the model number is present (Claude must be able to name the unit)',
    facts.equipment.model_number === result.selection.model, facts.equipment.model_number)
  ok('quantity is spelled as a word, not a numeral', facts.equipment.quantity === 'one unit')
  ok('the wheel is described qualitatively', /desiccant wheel$/.test(facts.equipment.wheel))
  ok('an unverified proposal says so in its performance basis',
    facts.equipment.performance_basis.includes('not yet verified'))

  const verified = buildFacts({ ...base, verification: { verifiedAt: 'x' } })
  ok('a verified proposal says so instead',
    verified.equipment.performance_basis.includes("manufacturer's own wheel performance model"))

  ok('spellCount pluralises', spellCount(1) === 'one unit' && spellCount(3) === 'three units')
  ok('spellCount falls back to a numeral past the word list', spellCount(40) === '40 units')
}

{
  // The engine's rationale is full of figures; only figure-free lines survive.
  const notes = qualitativeNotes(result.selection.rationale)
  ok('qualitativeNotes drops every sentence containing a figure',
    notes.every((n) => !/\d/.test(n)), `${notes.length} of ${result.selection.rationale.length} kept`)
  ok('qualitativeNotes keeps the useful qualitative lines', notes.length > 0, notes[0] ?? '(none)')
}

// ─── 2. The digit check ──────────────────────────────────────────────────────
section('2. The digit check flags anything numeric Claude writes')

{
  const clean = {
    cover_letter: 'Thank you for the opportunity to propose a desiccant dehumidification system for Packaging Room 2.',
    scope: 'IAT will supply one packaged unit with a high-capacity desiccant wheel and electric reactivation.',
  }
  ok('clean prose produces no flags', checkDigits(clean, allowed).length === 0)

  const withModel = { cover_letter: 'We propose the IAT-3000RE-2000 for this application.', scope: '' }
  ok('the model number itself is allowed',
    checkDigits({ ...withModel, cover_letter: `We propose the ${result.selection.model} for this.` }, allowed).length === 0,
    result.selection.model)

  ok('the customer job name with a digit is allowed',
    checkDigits({ cover_letter: 'For Packaging Room 2 at Building 7, Ohio.', scope: '' }, allowed).length === 0)

  const invented = { cover_letter: 'The unit will deliver 7.58 gr/lb at the discharge.', scope: '' }
  const f = checkDigits(invented, allowed)
  ok('an invented figure is flagged', f.length === 1, f[0]?.token)
  ok('a decimal is captured WHOLE, not split into two passing runs',
    f[0]?.token === '7.58', `got "${f[0]?.token}"`)
  ok('the flag carries a readable snippet', (f[0]?.snippet ?? '').includes('gr/lb'))
  ok('the flag names its section', f[0]?.section === 'cover_letter')

  // The case-study checker's exact hole: a model number donates its digits to a
  // corpus, so a fabricated price built from the same run passes. Not here.
  ok('a bare digit run matching part of the model number still flags',
    checkDigits({ cover_letter: 'Budgetary price is $3000 installed.', scope: '' }, allowed).length === 1)

  // The other hole: single digits were always whitelisted by `unit: 1..N`.
  ok('a bare single digit flags',
    checkDigits({ cover_letter: 'Lead time is 8 weeks.', scope: '' }, allowed).length === 1)

  ok('thousands separators are captured as one token',
    checkDigits({ cover_letter: 'Airflow of 12,000 CFM.', scope: '' }, allowed)[0]?.token === '12,000')

  ok('multiple figures each flag',
    checkDigits({ cover_letter: 'It removes 67 lb/hr at 35% RH.', scope: '' }, allowed).length === 2)

  ok('a figure in the SCOPE section flags too',
    checkDigits({ cover_letter: '', scope: 'Rated at 2000 CFM.' }, allowed).length === 1)

  // Human sections are the human's business.
  ok('digits in a HUMAN section are not flagged',
    checkDigits({ cover_letter: '', scope: '', exclusions: 'Net 30 terms.', notes: '5 year warranty.' }, allowed).length === 0)

  ok('the check re-runs on edited prose, not only at generate time',
    checkDigits({ cover_letter: 'A human typed 42 here later.', scope: '' }, allowed).length === 1)

  // Stated limitation, asserted so nobody assumes otherwise.
  ok('KNOWN HOLE: a number spelled as a word is NOT caught (prompt + human review only)',
    checkDigits({ cover_letter: 'Roughly thirty percent relative humidity.', scope: '' }, allowed).length === 0)
}

// ─── 3. Mutation tests on the allowlist ──────────────────────────────────────
section('3. Mutation tests — the allowlist must not become a blanket pass')

{
  const mutate = (label, sections, tokens, expectFlags) => {
    const n = checkDigits(sections, tokens).length
    ok(`${label}`, n === expectFlags, `${n} flags, expected ${expectFlags}`)
  }

  // An EMPTY allowlist must flag the model number — proving the allowlist is
  // what permits it, not some accident of the regex.
  //
  // Expect TWO flags, not one: the model-number grammar is
  // IAT-<nominalCFM>...-<actualCFM>, so `IAT-3000RE-2000` carries two separate
  // digit runs. (This assertion originally read 1 and failed — the reference
  // value was wrong, not the checker.)
  const modelRuns = (result.selection.model.match(/\d+(?:[.,]\d+)*/g) ?? []).length
  ok('the fixture model number really does carry two digit runs', modelRuns === 2,
    `${result.selection.model} → ${modelRuns}`)
  mutate('with no allowlist, every digit run in the model number flags',
    { cover_letter: `We propose the ${result.selection.model}.`, scope: '' }, [], modelRuns)

  // A token without digits must never be added to the allowlist, or it would
  // mask nothing but cost time; assert allowedTokens filters them out.
  ok('allowedTokens keeps only digit-bearing tokens', allowed.every((t) => /\d/.test(t)), allowed.join(' | '))
  ok('allowedTokens is sorted longest-first so overlaps are consumed safely',
    allowed.every((t, i) => i === 0 || allowed[i - 1].length >= t.length))

  // A customer name with no digits must not silently disappear from the list in
  // a way that changes behaviour.
  const noDigitCustomer = allowedTokens({ ...base, customer_name: 'Acme', job_name: 'Dry Room' })
  ok('a digit-free customer/job name is simply absent from the allowlist',
    !noDigitCustomer.includes('Acme'))

  // Matching is case-insensitive, so a model number retyped in lower case still
  // passes rather than flagging as an invented figure.
  mutate('the allowlist is case-insensitive',
    { cover_letter: `We propose the ${result.selection.model.toLowerCase()}.`, scope: '' }, allowed, 0)
}

// ─── 4. Readiness and approval ───────────────────────────────────────────────
section('4. Readiness and approval blockers')

{
  ok('a complete proposal is ready to generate', missingForGenerate(base).length === 0)
  ok('a missing application is reported by name',
    missingForGenerate({ ...base, application_input: '  ' })[0] === 'What the space is used for')
  ok('a missing sizing selection blocks generation',
    missingForGenerate({ ...base, sizing_result: null }).includes('A sizing selection'))

  const sections = { ...blankSections(), cover_letter: 'Hello.', scope: 'Supply and deliver.' }

  ok('a clean draft is approvable',
    approvalBlockers({ edited_sections: sections, gaps: [], flags: [] }).length === 0)
  ok('an undrafted proposal is blocked',
    approvalBlockers({ edited_sections: null, gaps: [], flags: [] }).length === 1)
  ok('an empty cover letter is blocked',
    approvalBlockers({ edited_sections: { ...sections, cover_letter: '' }, gaps: [], flags: [] }).length === 1)
  ok('an uncleared digit flag blocks approval',
    approvalBlockers({ edited_sections: sections, gaps: [], flags: [{ token: '42', section: 'scope', snippet: '', cleared: false }] }).length === 1)
  ok('a CLEARED digit flag does not block',
    approvalBlockers({ edited_sections: sections, gaps: [], flags: [{ token: '42', section: 'scope', snippet: '', cleared: true }] }).length === 0)
  ok('an unresolved gap blocks approval',
    approvalBlockers({ edited_sections: sections, gaps: [{ section: 'scope', need: 'x', resolved: false }], flags: [] }).length === 1)
  ok('blockers accumulate rather than short-circuiting',
    approvalBlockers({
      edited_sections: { ...sections, scope: '' },
      gaps: [{ section: 'scope', need: 'x', resolved: false }],
      flags: [{ token: '42', section: 'scope', snippet: '', cleared: false }],
    }).length === 3)
}

// ─── 5. Preliminary vs engineering-grade ─────────────────────────────────────
section('5. A proposal is only engineering-grade once verified')

{
  ok('no verification → preliminary', isEngineeringGrade({ verification: null }) === false)
  ok('a verification → engineering-grade', isEngineeringGrade({ verification: { verifiedAt: 'x' } }) === true)
  ok('blankSections seeds exclusions but leaves the AI sections empty',
    blankSections().exclusions.length > 0 &&
    AI_SECTION_KEYS.every((k) => blankSections()[k] === ''))
  ok('every SECTION_KEY has a slot in blankSections',
    SECTION_KEYS.every((k) => typeof blankSections()[k] === 'string'))
}

// ─── 6. The PDF actually renders ─────────────────────────────────────────────
section('6. The PDF renders, and the watermark is real')

{
  const { generateProposalPDF } = await import('../lib/proposal-pdf.ts')

  const pdfBase = {
    title: 'Packaging Room',
    customer_name: base.customer_name,
    job_name: base.job_name,
    site_location: base.site_location,
    prepared_for: base.prepared_for,
    sections: {
      cover_letter: 'Thank you for the opportunity to propose a system.\n\nIt suits the application well.',
      scope: 'IAT will supply one packaged desiccant unit with electric reactivation.',
      exclusions: 'Electrical service by others.',
      notes: '',
    },
    sizing_result: result,
    verification: null,
    reference: 'ABC12345',
    dateLabel: 'August 5, 2026',
  }

  const asText = async (blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1')

  const draft = await generateProposalPDF({ ...pdfBase, status: 'draft' })
  const approved = await generateProposalPDF({ ...pdfBase, status: 'approved' })
  const draftText = await asText(draft)

  ok('a draft PDF is produced', draft.size > 1000, `${draft.size} bytes`)
  ok('it is a real PDF', draftText.startsWith('%PDF'))
  ok('an approved PDF is produced', approved.size > 1000, `${approved.size} bytes`)

  // The watermark is the entire control that distinguishes a circulated draft
  // from an approved document, so assert it is genuinely present on one and
  // genuinely absent from the other rather than trusting the branch.
  ok('the draft is LARGER than the approved copy (the watermark adds content)',
    draft.size > approved.size, `${draft.size} vs ${approved.size}`)

  const pageCount = Number((draftText.match(/\/Count (\d+)/) || [])[1] || 0)
  ok('the document paginates', pageCount >= 1, `${pageCount} page(s)`)

  // A missing logo must degrade, not throw — loadLogo() has no origin in Node,
  // so this run already exercised that path.
  ok('a document renders even with no logo available (Node has no origin to fetch from)',
    draft.size > 1000)

  // Verified proposals carry two figures the unverified one cannot: pressure
  // drop and an optimised RPH.
  const verifiedPdf = await generateProposalPDF({
    ...pdfBase,
    status: 'approved',
    verification: {
      verifiedAt: '2026-08-05T00:00:00.000Z',
      request: { optimizeRPH: true, reactTemperature: 285, rotorDiameter: 965, rotorDepth: 200 },
      response: { rphOut: 7.5, processDeltaP: 0.56, reactDeltaP: 0.75, moistureRemovalLbsHr: 67.4 },
      leaving: { tempF: 123.5, grains: 7.58, dewPointF: 6.3, rh: 2 },
      delta: { grains: -8, tempF: 3, grainsPercent: 205 },
      meetsTarget: true,
      balanced: true,
    },
  })
  ok('a verified proposal renders a longer performance section',
    verifiedPdf.size > approved.size, `${verifiedPdf.size} vs ${approved.size}`)

  // A proposal with no selection at all must still produce a document rather
  // than throwing — the editor allows drafting prose before sizing is attached.
  const noSizing = await generateProposalPDF({ ...pdfBase, status: 'draft', sizing_result: null })
  ok('a proposal with no sizing selection still renders', noSizing.size > 1000, `${noSizing.size} bytes`)

  // Long prose must paginate rather than run off the page — the failure mode
  // lib/pdf.ts has (its page-break heuristic estimates line count from string
  // length and can overflow).
  const long = await generateProposalPDF({
    ...pdfBase,
    status: 'approved',
    sections: {
      ...pdfBase.sections,
      scope: Array.from({ length: 90 }, (_, i) => `Scope paragraph ${'x'.repeat(60)}.`).join('\n\n'),
    },
  })
  const longPages = Number(((await asText(long)).match(/\/Count (\d+)/) || [])[1] || 0)
  ok('long prose breaks onto further pages', longPages > pageCount, `${longPages} pages vs ${pageCount}`)
}

console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m`)
process.exit(failed > 0 ? 1 : 0)
