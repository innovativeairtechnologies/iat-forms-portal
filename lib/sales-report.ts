import { supabaseAdmin } from '@/lib/supabase-admin'
import { type Bucket, type RangeKey, DAY, median, rangeFor, tally, tallySum } from '@/lib/report-shared'

/* Sales pipeline reporting (/admin/reports/sales).

   🔴 THIS REPORTS VALUE AND CONFIDENCE, NOT A STAGE FUNNEL. That is a deliberate
   choice made against the data, not an omission:

     • 402 of the 479 deal_stage_history rows are `actor: 'dryware-sync'` seed
       rows (from_stage null → quoted), written when the deal was materialized.
       They are not movement.
     • The remaining 77 are ONE person, between 2026-07-21 and 2026-07-29, and
       nothing since. They read as trialling rather than process:
       quoted→follow_up 23 times and follow_up→quoted 21 times back, plus a
       won→verbal and a lost→verbal undo.
     • Every deal currently sits in `quoted`.

   A stage-velocity chart off that would be a picture of one week of one person's
   clicking, presented as a sales process. lib/deals.ts already says as much:
   "Open pipeline sliced by confidence — the closest true read of 'stage' this
   board has (it forecasts by confidence, not kanban stages)."

   If the board ever gets used in earnest, stage velocity becomes worth adding and
   the history table is already recording it. Check the actor split first.

   ⚠️ Deals are MATERIALIZED FROM DRYWARE and the sync wipes and reloads
   projected_sales before rebuilding (docs/projected-sales.md). Portal-owned
   workflow (stage, focus, follow-ups) is preserved across that, but the money
   fields are DryWare's and change underneath you. This report is a read of the
   current mirror, not an immutable ledger. */

export type DealRow = {
  id: string
  customer: string
  jobName: string
  rep: string
  projectType: string
  unitModel: string
  stage: string
  status: string
  /** Quoted value. */
  total: number
  /** 0-100. */
  confidence: number
  /** total × confidence. The forecast number, not the sticker number. */
  weighted: number
  dateQuoted: string
  expectedClose: string
  closedReason: string
  ageDays: number | null
}

export type SalesReport = {
  rangeKey: RangeKey
  rangeLabel: string
  totals: {
    dealCount: number
    quotedValue: number
    weightedValue: number
    medianDealSize: number | null
    highConfidenceValue: number
    withoutExpectedClose: number
    staleDays: number | null
  }
  byConfidence: Bucket[]
  byRep: Bucket[]
  byProjectType: Bucket[]
  byModel: Bucket[]
  byCloseMonth: Bucket[]
  rows: DealRow[]
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Confidence bands rather than raw percentages — 55% and 60% are the same
 *  business decision, and a bar per distinct integer is unreadable. */
function band(c: number): string {
  if (c >= 90) return '90-100%  near certain'
  if (c >= 70) return '70-89%  strong'
  if (c >= 50) return '50-69%  even'
  if (c >= 25) return '25-49%  long shot'
  if (c > 0) return 'Under 25%'
  return 'No confidence set'
}

export async function buildSalesReport(rangeKey: RangeKey, now: Date = new Date()): Promise<SalesReport> {
  const range = rangeFor(rangeKey, now)

  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, customer, job_name, rep_contact, rep, project_type, unit_model, stage, status, total_cost, confidence, projected, date_quoted, expected_close, closed_reason, created_at')
    .limit(20000)

  if (error) console.error('[sales-report] read failed:', error.message)

  const rows: DealRow[] = (data ?? []).map(d => {
    const total = num(d.total_cost)
    const confidence = num(d.confidence)
    const quoted = (d.date_quoted as string) || (d.created_at as string) || ''
    return {
      id: d.id as string,
      customer: ((d.customer as string) ?? '').trim(),
      jobName: ((d.job_name as string) ?? '').trim(),
      // ⚠️ rep_contact holds the rep's NAME; `rep` is empty in this data
      // (docs/projected-sales.md). Reading `rep` gives a report of blanks.
      rep: ((d.rep_contact as string) ?? '').trim() || 'Unattributed',
      projectType: ((d.project_type as string) ?? '').trim(),
      unitModel: ((d.unit_model as string) ?? '').trim(),
      stage: (d.stage as string) ?? '',
      status: ((d.status as string) ?? '').trim(),
      total,
      confidence,
      weighted: Math.round(total * (confidence / 100)),
      dateQuoted: quoted,
      expectedClose: ((d.expected_close as string) ?? '').trim(),
      closedReason: ((d.closed_reason as string) ?? '').trim(),
      ageDays: quoted ? Math.floor((now.getTime() - new Date(quoted).getTime()) / DAY) : null,
    }
  })

  const inRange = rows.filter(r => !range.from || (r.dateQuoted && new Date(r.dateQuoted) >= range.from))
  const sizes = inRange.map(r => r.total).filter(n => n > 0)
  const ages = inRange.map(r => r.ageDays).filter((n): n is number => n != null)

  const closeMonths = new Map<string, number>()
  for (const r of inRange) {
    if (!r.expectedClose) continue
    const k = r.expectedClose.slice(0, 7)
    closeMonths.set(k, (closeMonths.get(k) ?? 0) + r.weighted)
  }

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    totals: {
      dealCount: inRange.length,
      quotedValue: Math.round(inRange.reduce((s, r) => s + r.total, 0)),
      weightedValue: Math.round(inRange.reduce((s, r) => s + r.weighted, 0)),
      medianDealSize: median(sizes),
      highConfidenceValue: Math.round(inRange.filter(r => r.confidence >= 70).reduce((s, r) => s + r.total, 0)),
      withoutExpectedClose: inRange.filter(r => !r.expectedClose).length,
      staleDays: ages.length ? Math.max(...ages) : null,
    },
    byConfidence: tallySum(inRange.map(r => ({ label: band(r.confidence), value: r.total }))),
    byRep: tallySum(inRange.map(r => ({ label: r.rep, value: r.total }))).slice(0, 15),
    byProjectType: tallySum(inRange.map(r => ({ label: r.projectType, value: r.total })), 'No type set').slice(0, 15),
    byModel: tally(inRange.map(r => r.unitModel), 'No model set').slice(0, 15),
    byCloseMonth: [...closeMonths.entries()]
      .map(([label, count]) => ({ label, count: Math.round(count) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    rows,
  }
}
