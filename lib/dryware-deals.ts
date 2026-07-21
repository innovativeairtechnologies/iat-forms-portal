// ─────────────────────────────────────────────────────────────────────────────
// lib/dryware-deals.ts — materialize the DryWare projected_sales feed into the
// deals table (migration 063). DryWare is the source of truth for the sales
// pipeline; the portal adds a workflow overlay (stage / ★ focus / follow-ups /
// notes) that must survive every wipe-and-reload sync.
//
// Called after replace_projected_sales() in the sync route (so every sync
// refreshes the Board, Focused, Calendar, and the /admin dashboard at once) and
// from scripts/materialize-dryware-deals.mts for the one-time cutover.
//
// Per project (deduped by dryware_key = lower(project_customer)|lower(project_name)):
//   • DryWare-owned fields are OVERWRITTEN on every sync (customer, $, confidence,
//     close date, salesperson, unit models, contact, quote date).
//   • portal-owned workflow is PRESERVED (stage, stage_changed_at, focused,
//     notes, checklist, next_step/due, closed_reason).
//   • a project whose key vanished from DryWare is PRUNED (only when the sync
//     returned a non-empty set, so a transient short response can't wipe the board).
//   • manually-created deals (dryware_key IS NULL) are never touched.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

/** Stable identity for a DryWare project. `company` is always "Innovative Air"
 *  (the seller) — the account is project_customer, so the key never uses company. */
export function drywareKey(projectCustomer: string | null, projectName: string | null): string | null {
  const c = (projectCustomer ?? '').trim().toLowerCase()
  const p = (projectName ?? '').trim().toLowerCase()
  if (!c && !p) return null
  return `${c}|${p}`
}

type ProjectedSalesRow = {
  user_name: string | null
  company: string | null
  project_customer: string | null
  project_name: string | null
  date_created: string | null
  contact: string | null
  project_types: string | null
  confidence_level: number | null
  estimated_closing_date: string | null
  units: { unitName: string | null; modelNumber: string | null; quoteTotal: number | null }[] | null
  quote_total: number | null
}

/** DryWare-owned columns overwritten on every sync (workflow columns excluded). */
function drywareFields(r: ProjectedSalesRow): Record<string, unknown> {
  const units = Array.isArray(r.units) ? r.units : []
  const models = [...new Set(units.map((u) => u?.modelNumber?.trim()).filter(Boolean))] as string[]
  let unitModel: string | null = models.join(', ') || null
  if (unitModel && unitModel.length > 90) unitModel = unitModel.slice(0, 89) + '…'
  const conf = r.confidence_level == null ? 0 : Math.max(0, Math.min(100, Math.round(r.confidence_level)))
  const salesperson = r.user_name?.trim() || null
  return {
    customer: r.project_customer?.trim() || r.company?.trim() || 'Unknown project',
    assigned_to: salesperson,
    group_name: salesperson || 'MAIN', // drives the dashboard leaderboard (by rep)
    total_cost: r.quote_total ?? 0,
    confidence: conf,
    expected_close: r.estimated_closing_date || null,
    project_type: r.project_types?.trim() || null,
    job_name: r.project_name?.trim() || null,
    unit_model: unitModel,
    rep_contact: r.contact?.trim() || null,
    date_quoted: r.date_created || null,
  }
}

export type MaterializeStats = { inserted: number; updated: number; pruned: number; projects: number }

// Supabase's generated types aren't wired up here; the admin client is loosely
// typed on purpose (matches the rest of lib/*).
type Admin = SupabaseClient<any, any, any>

export async function materializeDealsFromProjectedSales(admin: Admin): Promise<MaterializeStats> {
  const { data: ps, error } = await admin
    .from('projected_sales')
    .select('user_name, company, project_customer, project_name, date_created, contact, project_types, confidence_level, estimated_closing_date, units, quote_total')
  if (error) throw new Error(`Could not read projected_sales: ${error.message}`)

  // Dedupe by key, keeping the largest-quote row (the doubled source rows are
  // byte-identical, but a genuine variance shouldn't halve the number).
  const byKey = new Map<string, ProjectedSalesRow>()
  for (const r of (ps ?? []) as ProjectedSalesRow[]) {
    const key = drywareKey(r.project_customer, r.project_name)
    if (!key) continue
    const cur = byKey.get(key)
    if (!cur || (r.quote_total ?? 0) > (cur.quote_total ?? 0)) byKey.set(key, r)
  }

  const { data: existing } = await admin.from('deals').select('id, dryware_key').not('dryware_key', 'is', null)
  const idByKey = new Map<string, string>((existing ?? []).map((d: { id: string; dryware_key: string }) => [d.dryware_key, d.id]))

  let updated = 0
  const insertRows: Record<string, unknown>[] = []
  for (const [key, r] of byKey) {
    const fields = drywareFields(r)
    const id = idByKey.get(key)
    if (id) {
      const { error: upErr } = await admin.from('deals').update(fields).eq('id', id)
      if (!upErr) updated++
    } else {
      insertRows.push({ ...fields, dryware_key: key, stage: 'quoted', status: null })
    }
  }

  let inserted = 0
  for (let i = 0; i < insertRows.length; i += 200) {
    const { data: newRows, error: insErr } = await admin.from('deals').insert(insertRows.slice(i, i + 200)).select('id, stage')
    if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`)
    inserted += newRows?.length ?? 0
    // Seed a stage-history floor for the funnel (best-effort, additive).
    if (newRows?.length) {
      await admin.from('deal_stage_history')
        .insert(newRows.map((d: { id: string; stage: string }) => ({ deal_id: d.id, from_stage: null, to_stage: d.stage, actor: 'dryware-sync' })))
        .then(() => {}, () => {})
    }
  }

  // Prune DryWare deals whose project fell off the feed — but only when the
  // sync actually returned projects (never let an empty/short response wipe it).
  let pruned = 0
  if (byKey.size > 0) {
    const { data: current } = await admin.from('deals').select('id, dryware_key').not('dryware_key', 'is', null)
    const goneIds = (current ?? [])
      .filter((d: { dryware_key: string }) => !byKey.has(d.dryware_key))
      .map((d: { id: string }) => d.id)
    for (let i = 0; i < goneIds.length; i += 200) {
      const { error: delErr } = await admin.from('deals').delete().in('id', goneIds.slice(i, i + 200))
      if (!delErr) pruned += Math.min(200, goneIds.length - i)
    }
  }

  return { inserted, updated, pruned, projects: byKey.size }
}
