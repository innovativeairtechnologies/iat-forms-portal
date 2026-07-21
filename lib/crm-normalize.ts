/* ────────────────────────────────────────────────────────────────────────────
   Company-name normalization + clustering (CRM Phase 2, migration 062).

   Pure functions, no I/O — the backfill route, the deals POST auto-link, and
   the importer all normalize through HERE so "H&H, Inc." and "H&H Inc" can
   never become two companies. `normalized` is what companies.normalized_name
   stores (UNIQUE index = the dupe guard).

   Clustering is deliberately conservative: only EXACT normalized equality
   auto-groups names. Anything fuzzier (typos, branch offices, subset names)
   is surfaced as a *suggestion* for the human review panel — auto-merging
   "H&H Nashville" into "H&H Charlotte" would corrupt real accounts, so a
   person decides those.
   ──────────────────────────────────────────────────────────────────────────── */

export type NormalizedCompany = {
  /** Display-ready base name — original casing, trailing parenthetical stripped. */
  base: string
  /** Trailing parenthetical content ("MBI Battery" from "H&H (MBI Battery)"), or null. */
  hint: string | null
  /** Canonical comparison key (what companies.normalized_name stores). */
  normalized: string
}

// Legal-suffix tokens dropped from the END of a name, repeatedly ("Acme Co
// Inc" → "acme"). Deliberately excludes ambiguous words like "group"/"systems"
// that are often the actual distinguishing part of a name.
const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'corp', 'corporation', 'co', 'company',
  'ltd', 'limited', 'lp', 'llp', 'pllc', 'pc',
])

export function normalizeCompany(raw: string): NormalizedCompany {
  const trimmed = raw.trim()
  // Trailing parenthetical = a deal-specific hint, not part of the company
  // ("QCorp (20+ compacts)"). Only stripped when something remains outside it.
  const paren = trimmed.match(/^(.*\S)\s*\(([^)]*)\)\s*$/)
  const base = paren ? paren[1].trim() : trimmed
  const hint = paren ? paren[2].trim() || null : null

  const tokens = base
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,'’"`!/\\\-_+#:;]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  // Leading article + trailing legal suffixes carry no identity.
  if (tokens.length > 1 && tokens[0] === 'the') tokens.shift()
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()

  return { base, hint, normalized: tokens.join(' ') || trimmed.toLowerCase() }
}

export type NameCluster = {
  /** Best display name — the most frequent raw base spelling (ties → longest). */
  canonical: string
  normalized: string
  /** Every distinct RAW string that mapped here (what the backfill matches deals by). */
  members: string[]
  count: number // total occurrences across all members
}

export type ClusterSuggestion = {
  a: number // cluster indexes into the clusters array
  b: number
  reason: 'typo' | 'subset'
}

/** Levenshtein distance with early exit past `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let cur = [i, ...new Array(b.length).fill(0)]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return max + 1
    prev.splice(0, prev.length, ...cur)
  }
  return prev[b.length]
}

/**
 * Group raw names by exact normalized equality; surface conservative merge
 * SUGGESTIONS (never auto-applied) between clusters:
 *  - 'typo'   — normalized forms within edit distance 2 (length ≥ 8)
 *  - 'subset' — one token set strictly contains the other with exactly one
 *               extra token ("h and h" vs "h and h nashville") — usually a
 *               branch office or a shorthand; a human decides.
 */
export function clusterNames(rawNames: string[]): { clusters: NameCluster[]; suggestions: ClusterSuggestion[] } {
  const byNorm = new Map<string, { members: Map<string, number>; bases: Map<string, number> }>()
  for (const raw of rawNames) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const { base, normalized } = normalizeCompany(trimmed)
    let c = byNorm.get(normalized)
    if (!c) { c = { members: new Map(), bases: new Map() }; byNorm.set(normalized, c) }
    c.members.set(trimmed, (c.members.get(trimmed) ?? 0) + 1)
    c.bases.set(base, (c.bases.get(base) ?? 0) + 1)
  }

  const clusters: NameCluster[] = [...byNorm.entries()].map(([normalized, c]) => {
    const canonical = [...c.bases.entries()].sort((x, y) => y[1] - x[1] || y[0].length - x[0].length)[0][0]
    const count = [...c.members.values()].reduce((a, n) => a + n, 0)
    return { canonical, normalized, members: [...c.members.keys()], count }
  }).sort((a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical))

  const suggestions: ClusterSuggestion[] = []
  const tokenSets = clusters.map((c) => new Set(c.normalized.split(' ')))
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i].normalized
      const b = clusters[j].normalized
      if (a.length >= 8 && b.length >= 8 && editDistance(a, b, 2) <= 2) {
        suggestions.push({ a: i, b: j, reason: 'typo' })
        continue
      }
      const [small, big] = tokenSets[i].size <= tokenSets[j].size ? [tokenSets[i], tokenSets[j]] : [tokenSets[j], tokenSets[i]]
      if (big.size === small.size + 1 && small.size >= 2 && [...small].every((t) => big.has(t))) {
        suggestions.push({ a: i, b: j, reason: 'subset' })
      }
    }
  }
  return { clusters, suggestions }
}
