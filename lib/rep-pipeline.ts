import 'server-only'
import { supabaseAdmin } from './supabase-admin'

// ─────────────────────────────────────────────────────────────────────────────
// lib/rep-pipeline.ts — live open-pipeline / RFQ figures per rep, derived from
// the DryWare deal mirror, for the rep scorecard's "hard numbers" assist.
//
// Why this can exist at all: IAT sells THROUGH reps, so on a DryWare quote the
// rep is the person in `contact` — which materializes onto `deals.rep_contact`
// (lib/dryware-deals.ts). 305 of 372 live deals carry one. That gives a real
// per-rep open-quote total and recent-activity count without anyone typing them,
// which is the one thing the source workbook could never do.
//
// ⚠️ Matched on the rep's NAME, not an id — `deals.rep_contact` is free text
// from DryWare and there is no FK to `contacts`. So this is a SUGGESTION, never
// an authority: the UI shows it beside the stored figure with an explicit
// "use it" action, and what's saved is always what a human accepted. Two reps
// who genuinely share a name would collide here; a lopsided figure is the tell.
//
// Not every `rep_contact` is a rep either — some quotes name an end-customer's
// contact. That's harmless for lookups (we only ever ask about reps Sales has
// already added to the roster) and is why `pipelineCandidates` below is offered
// as autocomplete rather than bulk-imported into the roster.
// ─────────────────────────────────────────────────────────────────────────────

/** Loose name key: case- and whitespace-insensitive. Deliberately NOT the CRM's
 *  company normalizer — that strips corporate suffixes, which are meaningful in
 *  a person's name ("Jr", "III"). */
export function repNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type RepPipeline = {
  /** The name as DryWare spells it — the map is keyed on a normalized form. */
  name: string
  /** Sum of open quote value on deals naming this rep. */
  openPipeline: number
  /** Quotes dated in the last 60 days — the workbook's "RFQs (60d)" column. */
  rfqs60d: number
  /** Total quotes on record, for context when 60d reads 0. */
  quotes: number
  /** Most recent quote date, ISO — "when did we last hear from them". */
  lastQuoted: string | null
}

/**
 * Open pipeline + RFQ activity for every rep name appearing on a deal, keyed by
 * `repNameKey`. One query; callers filter to the reps they care about.
 *
 * "Open" is every mirrored deal: the DryWare feed carries only live projected
 * sales (all `stage='quoted'`, no won/lost), so there is nothing closed to
 * exclude. If a won/lost signal ever lands on `deals`, filter it HERE — the
 * scorecard reads pipeline as "still winnable".
 */
export async function repPipelineByName(): Promise<Map<string, RepPipeline>> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('rep_contact, total_cost, date_quoted')
    .not('rep_contact', 'is', null)

  const out = new Map<string, RepPipeline>()
  if (error || !data) return out

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)

  for (const row of data as { rep_contact: string | null; total_cost: number | string | null; date_quoted: string | null }[]) {
    const name = row.rep_contact?.trim()
    if (!name) continue
    const key = repNameKey(name)
    const entry = out.get(key) ?? { name, openPipeline: 0, rfqs60d: 0, quotes: 0, lastQuoted: null }

    const cost = row.total_cost === null ? 0 : Number(row.total_cost)
    if (Number.isFinite(cost)) entry.openPipeline += cost
    entry.quotes++
    if (row.date_quoted) {
      if (new Date(row.date_quoted) >= cutoff) entry.rfqs60d++
      if (!entry.lastQuoted || row.date_quoted > entry.lastQuoted) entry.lastQuoted = row.date_quoted
    }
    out.set(key, entry)
  }
  return out
}

export type PipelineCandidate = { name: string; quotes: number; openPipeline: number }

/**
 * Rep names seen on deals, busiest first — the "add a rep" autocomplete source,
 * so Sales picks a known name instead of retyping (and typo-ing) one that then
 * fails to match its own pipeline. `exclude` drops names already on the roster.
 *
 * Derived from an existing `repPipelineByName()` map rather than re-querying:
 * the caller always needs both, and one scan of `deals` serves them.
 */
export function pipelineCandidates(
  pipeline: Map<string, RepPipeline>,
  exclude: string[] = [],
  limit = 200,
): PipelineCandidate[] {
  const skip = new Set(exclude.map(repNameKey))
  return [...pipeline.entries()]
    .filter(([key]) => !skip.has(key))
    .map(([, p]) => ({ name: p.name, quotes: p.quotes, openPipeline: p.openPipeline }))
    .sort((a, b) => b.quotes - a.quotes || a.name.localeCompare(b.name))
    .slice(0, limit)
}
