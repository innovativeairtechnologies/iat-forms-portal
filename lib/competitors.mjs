// ─────────────────────────────────────────────────────────────────────────────
// Competitor-name scrubbing — single source of truth.
//
// IAT leadership rule: a COMPETITOR'S name must NEVER reach a customer through the
// assistant — not in an answer, not in a cited document's title, nowhere. It does
// not have to say "IAT"; it must simply never name the competition.
//
// We enforce this at THREE layers, all driven by this one module so they can't
// drift apart:
//   1. ingest  — scripts/ingest-kb-docs.mjs scrubs chunk CONTENT + de-brands TITLES
//   2. answer  — app/api/customer/assistant/route.ts scrubs the excerpts it feeds
//                the model AND post-filters the model's final reply
//   3. detect  — hasCompetitor() backs the verification harness / guards
//
// IMPORTANT — competitors only. Component SUPPLIERS whose parts go INTO IAT units
// (Omron, Fuji, Vaisala, Watlow, Belimo, Honeywell, GE, Setra, Johnson Controls,
// TAMCO, Control Products, TAC, KAS…) are NOT competitors. Customers legitimately
// need those names — they must be left untouched. Only add a brand here if it is a
// rival DEHUMIDIFIER / desiccant-system maker.
//
// Plain .mjs (no TS syntax) so the Node ingest script and the TS API route can both
// import it (tsconfig: allowJs + moduleResolution "bundler").
//
// To add a competitor later: add its tokens to COMPETITOR_NAMES and, if it reads
// better than the generic "the manufacturer" swap, a tuned rule to COMPETITOR_RULES
// (most-specific pattern FIRST).
// ─────────────────────────────────────────────────────────────────────────────

/** Distinctive brand tokens, for DETECTION (hasCompetitor) — not necessarily the
 *  replacement patterns. Keep these specific enough not to hit a supplier. */
export const COMPETITOR_NAMES = ['Munters']

/** Optional, case-insensitive MULTIWORD prose rules that read better than the
 *  generic bare-word swap. Applied first. (Bare words, URLs, emails and compound
 *  tokens are handled generically per-brand by scrubCompetitors from COMPETITOR_NAMES
 *  — these rules only exist to make common phrases read naturally.) */
export const COMPETITOR_RULES = [
  { re: /\bMunters\s+Rotor\s+Technology\b/gi, to: 'Desiccant Rotor Technology' },
  { re: /\bMunters\s+Corporation\b/gi, to: 'the manufacturer' },
]

/** Neutral citation titles for competitor-branded source docs, keyed by
 *  source_filename. deriveTitle() in the ingest script consults this FIRST. */
export const COMPETITOR_TITLE_OVERRIDES = {
  'Munters DH handbook.pdf': 'Dehumidification Guide',
  'M120.pdf': 'M120 Desiccant Dehumidifier',
}

const NEUTRAL = 'the manufacturer'
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replace every competitor reference in `text` with a neutral equivalent and tidy
 *  the artifacts that leaves. GUARANTEE: after this runs, hasCompetitor(result) is
 *  false — no brand token survives, even glued into a URL, an email address, or a
 *  compound word (e.g. www.MuntersAmerica.com, info@muntersnv.be, MuntersAmerica).
 *  Safe on any input; returns '' for nullish. */
export function scrubCompetitors(text) {
  let s = String(text ?? '')
  // 1) Readable MULTIWORD prose replacements first (these never occur inside a URL
  //    or email, so running them early is safe).
  for (const { re, to } of COMPETITOR_RULES) s = s.replace(re, to)
  // 2) Per-brand generic sweeps. ORDER MATTERS: strip brand-bearing URLs/emails as
  //    WHOLE tokens BEFORE the bare-word swap — otherwise the bare-word swap injects
  //    a space into a clean domain label (munters.at) and hides the address.
  for (const name of COMPETITOR_NAMES) {
    const t = escapeRe(name)
    s = s
      // emails whose local-part OR domain contains the brand → drop the address
      .replace(new RegExp(`\\S*${t}\\S*@\\S+|\\S+@\\S*${t}\\S*`, 'gi'), '')
      // URLs / bare domains containing the brand → drop them
      .replace(new RegExp(`\\S*${t}\\S*\\.[a-z]{2,}\\S*`, 'gi'), '')
      // bare brand word (punctuation-safe) → neutral noun
      .replace(new RegExp(`\\b${t}\\b`, 'gi'), NEUTRAL)
      // any remaining run still touching the brand (compound words) → neutral
      .replace(new RegExp(`\\S*${t}\\S*`, 'gi'), NEUTRAL)
  }
  // 3) Tidy artifacts the swaps can leave.
  s = s
    .replace(/\bthe\s+the manufacturer\b/gi, 'the manufacturer') // "the Munters X" → "the X"
    .replace(/\b(the manufacturer)(\s+\1\b)+/gi, '$1')           // collapse repeats
    .replace(/\(\s*©\s*\)/g, '')                                  // empty copyright parens
    .replace(/[ \t]+([.,;:])/g, '$1')                             // space before punctuation
    .replace(/[ \t]{2,}/g, ' ')
  return s
}

/** True if any competitor brand token still appears in `text` (for verification). */
export function hasCompetitor(text) {
  const s = String(text ?? '').toLowerCase()
  return COMPETITOR_NAMES.some((n) => s.includes(n.toLowerCase()))
}
