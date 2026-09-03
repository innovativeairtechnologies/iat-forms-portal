// ─────────────────────────────────────────────────────────────────────────────
// lib/dryware-closed-deals.ts — materialize closed_projects (100) into deals as
// stage='won'. Sibling to lib/dryware-deals.ts (which materializes the OPEN feed);
// kept separate because this one only ever moves a deal FORWARD to a terminal
// stage, never overwrites in-progress workflow, and never deletes.
//
// Called from both sync routes: the Performance sync (projected-sales/sync,
// right before its prune step — see the note in lib/dryware-deals.ts) and the
// Closed Projects page's own sync (closed-projects/sync). Either call is safe to
// run repeatedly — a deal already at stage='won' is left untouched (no re-write,
// no duplicate deal_stage_history row).
//
// A closed project with no matching deal (dryware_key not found) is INSERTED
// directly as a won deal. Two real cases produce this: a deal already pruned by
// the OLD (pre-fix) prune logic, or a sales cycle so short the project was never
// seen on the open feed before it closed.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import { drywareKey } from './dryware-key'

type ClosedRow = {
  project_customer: string | null
  project_name: string | null
  company: string | null
  user_name: string | null
  project_types: string | null
  contact: string | null
  date_created: string | null
  closed_total: number | null
  units: { modelNumber: string | null }[] | null
}

/** DryWare-owned fields set on a won deal — identical whether transitioning an
 *  existing deal or inserting a fresh one, matching the convention in
 *  lib/dryware-deals.ts's drywareFields(). */
function closedDealFields(r: ClosedRow): Record<string, unknown> {
  const units = Array.isArray(r.units) ? r.units : []
  const models = [...new Set(units.map((u) => u?.modelNumber?.trim()).filter(Boolean))] as string[]
  let unitModel: string | null = models.join(', ') || null
  if (unitModel && unitModel.length > 90) unitModel = unitModel.slice(0, 89) + '…'
  return {
    customer: r.project_customer?.trim() || r.company?.trim() || 'Unknown project',
    assigned_to: r.user_name?.trim() || null,
    group_name: r.user_name?.trim() || 'MAIN',
    total_cost: r.closed_total ?? 0, // the authoritative closed figure, not the last-known quote
    confidence: 100, // won — no forecast uncertainty left
    project_type: r.project_types?.trim() || null,
    job_name: r.project_name?.trim() || null,
    unit_model: unitModel,
    rep_contact: r.contact?.trim() || null,
    date_quoted: r.date_created || null,
    stage: 'won',
    status: 'Won', // kept in sync with stage per migration 061's contract
  }
}

export type MaterializeWonStats = { transitioned: number; created: number; alreadyWon: number; projects: number }

type Admin = SupabaseClient<any, any, any>

export async function materializeWonDeals(admin: Admin): Promise<MaterializeWonStats> {
  const { data: cp, error } = await admin
    .from('closed_projects')
    .select('project_customer, project_name, company, user_name, project_types, contact, date_created, closed_total, units')
  if (error) throw new Error(`Could not read closed_projects: ${error.message}`)

  const byKey = new Map<string, ClosedRow>()
  for (const r of (cp ?? []) as ClosedRow[]) {
    const key = drywareKey(r.project_customer, r.project_name)
    if (key) byKey.set(key, r) // closed_projects already holds one row per real project_id — no dedupe-by-value trick needed here
  }

  const { data: existing } = await admin.from('deals').select('id, dryware_key, stage').not('dryware_key', 'is', null)
  const dealByKey = new Map<string, { id: string; stage: string }>(
    (existing ?? []).map((d: { id: string; dryware_key: string; stage: string }) => [d.dryware_key, { id: d.id, stage: d.stage }]),
  )

  let transitioned = 0
  let alreadyWon = 0
  const insertRows: Record<string, unknown>[] = []
  const historyRows: Record<string, unknown>[] = []

  for (const [key, r] of byKey) {
    const match = dealByKey.get(key)
    if (match) {
      if (match.stage === 'won') { alreadyWon++; continue }
      const { error: upErr } = await admin.from('deals').update(closedDealFields(r)).eq('id', match.id)
      if (!upErr) {
        transitioned++
        historyRows.push({ deal_id: match.id, from_stage: match.stage, to_stage: 'won', actor: 'dryware-sync', note: 'Closed via Dryware sync' })
      }
    } else {
      insertRows.push({ ...closedDealFields(r), dryware_key: key })
    }
  }

  let created = 0
  for (let i = 0; i < insertRows.length; i += 200) {
    const { data: newRows, error: insErr } = await admin.from('deals').insert(insertRows.slice(i, i + 200)).select('id')
    if (insErr) throw new Error(`Won-deal insert failed: ${insErr.message}`)
    created += newRows?.length ?? 0
    if (newRows?.length) {
      historyRows.push(
        ...newRows.map((d: { id: string }) => ({
          deal_id: d.id, from_stage: null, to_stage: 'won', actor: 'dryware-sync',
          note: 'Closed via Dryware sync (no prior open-pipeline record)',
        })),
      )
    }
  }

  for (let i = 0; i < historyRows.length; i += 200) {
    await admin.from('deal_stage_history').insert(historyRows.slice(i, i + 200)).then(() => {}, () => {})
  }

  return { transitioned, created, alreadyWon, projects: byKey.size }
}
