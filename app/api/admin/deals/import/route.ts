import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseSalesForecastXlsx, type ImportResult } from '@/lib/deals-import'
import { statusForStage, type DealStage } from '@/lib/deals'

/** Stage for a freshly-imported row (no portal enrichment): a closed status
 *  wins, a dated quote means Quoted, else Lead — mirroring migration 061's
 *  backfill. Portal-only stages (follow_up/verbal) are restored by the
 *  replace-mode carry-over below, never derived from the export. */
const importStage = (d: { status: 'Won' | 'Lost' | null; date_quoted: string | null }): DealStage =>
  d.status === 'Won' ? 'won' : d.status === 'Lost' ? 'lost' : d.date_quoted ? 'quoted' : 'lead'

export const runtime = 'nodejs'

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/admin/deals/import — upload a monday.com Sales Forecasting export.

   multipart/form-data fields:
     file    the .xlsx export (required)
     mode    'replace' (default) — the export IS the whole board, so wipe and
             reload; 'append' — add rows on top of what's already here
     commit  'true' to write; anything else = dry run (parse + preview only)

   Two-phase on purpose: the modal first dry-runs to show the user exactly
   what will happen (per-group counts, totals, warnings, and what replace
   would delete), then commits. Gated by requireDealsAuth — same trust
   boundary as the rest of the deals API (sales reps own their board and will
   re-upload fresh exports until the monday.com integration exists).
   ──────────────────────────────────────────────────────────────────────────── */

// The export is a whole-board snapshot, typically well under 1MB. 8MB leaves
// generous headroom while refusing absurd uploads before XLSX.read sees them.
const MAX_BYTES = 8 * 1024 * 1024

const CHUNK = 200 // rows per insert statement

type Preview = {
  groups: ImportResult['groups']
  totalDeals: number
  totalCost: number
  totalWeighted: number
  warnings: string[]
  existingCount: number
  mode: 'replace' | 'append'
  /** Portal-native enrichment at stake in a replace (0s pre-migrations).
   *  `stages` = deals whose pipeline position/dates the export can't express;
   *  `stageHistory` = transition rows (not shown in the modal, but it gates
   *  the snapshot so history always survives a replace). */
  portalData: { checklists: number; activities: number; followUps: number; focused: number; projectTypes: number; stages: number; stageHistory: number }
}

/** Identity used to carry checklists/activity across a replace-import: the
 *  same deal re-exported keeps its customer + job + group. Lossy on true
 *  duplicates (first match wins) — acceptable for best-effort carry-over. */
const dealKey = (d: { customer: string; job_name: string | null; group_name: string }) =>
  `${d.customer.trim().toLowerCase()}|${(d.job_name ?? '').trim().toLowerCase()}|${d.group_name.trim().toUpperCase()}`

/** Count portal enrichment (checklist progress, activity + follow-up rows,
 *  focused stars, project types). Every probe tolerates a pre-migration
 *  database by returning zeros. */
async function countPortalData(): Promise<Preview['portalData']> {
  let checklists = 0
  let activities = 0
  let followUps = 0
  let focused = 0
  let projectTypes = 0
  let stages = 0
  let stageHistory = 0
  // checklist (047) + focused/project_type (048) all live on the deals row.
  const { data, error: colErr } = await supabaseAdmin.from('deals').select('checklist, focused, project_type')
  if (!colErr) {
    const rows = (data ?? []) as { checklist: Record<string, boolean> | null; focused: boolean | null; project_type: string | null }[]
    checklists = rows.filter((r) => r.checklist && Object.values(r.checklist).some(Boolean)).length
    focused = rows.filter((r) => r.focused === true).length
    projectTypes = rows.filter((r) => !!r.project_type).length
  } else {
    // Pre-048 the focused/project_type columns are missing, so the whole select
    // errors — fall back to counting just the 047 checklist column.
    const { data: cData } = await supabaseAdmin.from('deals').select('checklist')
    checklists = ((cData ?? []) as { checklist: Record<string, boolean> | null }[])
      .filter((r) => r.checklist && Object.values(r.checklist).some(Boolean)).length
  }
  // NB: a HEAD count on a missing table does NOT error (observed against this
  // PostgREST) — it just returns a null count, which conveniently reads as 0.
  const { count: actCount, error: actErr } = await supabaseAdmin.from('deal_activity').select('*', { count: 'exact', head: true })
  if (!actErr) activities = actCount ?? 0
  const { count: fuCount, error: fuErr } = await supabaseAdmin.from('deal_follow_ups').select('*', { count: 'exact', head: true })
  if (!fuErr) followUps = fuCount ?? 0
  // 061 stage enrichment: pipeline positions the export can't express
  // (follow_up/verbal) plus the new date/discipline columns.
  const { data: sData, error: sErr } = await supabaseAdmin
    .from('deals')
    .select('stage, expected_close, closed_reason, next_step')
  if (!sErr) {
    stages = ((sData ?? []) as { stage: string; expected_close: string | null; closed_reason: string | null; next_step: string | null }[])
      .filter((r) => r.stage === 'follow_up' || r.stage === 'verbal' || !!r.expected_close || !!r.closed_reason || !!r.next_step).length
  }
  const { count: shCount, error: shErr } = await supabaseAdmin.from('deal_stage_history').select('*', { count: 'exact', head: true })
  if (!shErr) stageHistory = shCount ?? 0
  return { checklists, activities, followUps, focused, projectTypes, stages, stageHistory }
}

export async function POST(req: NextRequest) {
  const err = await requireDealsAuth(); if (err) return err

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach the exported .xlsx as "file".' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is larger than 8MB — not a board export.' }, { status: 413 })
  }
  const mode = form.get('mode') === 'append' ? 'append' : 'replace'
  const commit = form.get('commit') === 'true'

  let parsed: ImportResult
  try {
    parsed = parseSalesForecastXlsx(await file.arrayBuffer())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not parse that file.' }, { status: 400 })
  }

  const { count: existingCount, error: countErr } = await supabaseAdmin
    .from('deals')
    .select('*', { count: 'exact', head: true })
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })

  const preview: Preview = {
    groups: parsed.groups,
    totalDeals: parsed.deals.length,
    totalCost: parsed.deals.reduce((a, d) => a + d.total_cost, 0),
    totalWeighted: parsed.deals.reduce((a, d) => a + d.total_cost * (d.confidence / 100), 0),
    warnings: parsed.warnings,
    existingCount: existingCount ?? 0,
    mode,
    portalData: await countPortalData(),
  }

  if (!commit) return NextResponse.json({ ok: true, dryRun: true, preview })

  // ── Commit ──────────────────────────────────────────────────────────────
  // Replace wipes rows the portal has since enriched (checklists, activity
  // log — deal_activity cascades on delete). Snapshot that data first and
  // carry it onto the re-imported rows by customer+job+group. Best-effort:
  // a carry-over failure must never fail the import itself.
  type Stage61 = {
    stage: DealStage
    stage_changed_at: string
    expected_close: string | null
    closed_reason: string | null
    next_step: string | null
    next_step_due: string | null
  }
  type Snapshot = {
    checklists: Map<string, Record<string, boolean>>
    activities: Map<string, unknown[]>
    followUps: Map<string, unknown[]>
    focus: Map<string, boolean>
    projectType: Map<string, string>
    stage61: Map<string, Stage61>
    stageHistory: Map<string, unknown[]>
  }
  const pd = preview.portalData
  let snapshot: Snapshot | null = null
  if (mode === 'replace' && (pd.checklists > 0 || pd.activities > 0 || pd.followUps > 0 || pd.focused > 0 || pd.projectTypes > 0 || pd.stages > 0 || pd.stageHistory > 0)) {
    snapshot = { checklists: new Map(), activities: new Map(), followUps: new Map(), focus: new Map(), projectType: new Map(), stage61: new Map(), stageHistory: new Map() }
    // Base identity + checklist (works on any post-043 database).
    const { data: oldDeals } = await supabaseAdmin.from('deals').select('id, customer, job_name, group_name, checklist')
    const byId = new Map((oldDeals ?? []).map((d) => [d.id as string, d]))
    for (const d of oldDeals ?? []) {
      const c = d.checklist as Record<string, boolean> | null
      if (c && Object.values(c).some(Boolean) && !snapshot.checklists.has(dealKey(d))) {
        snapshot.checklists.set(dealKey(d), c)
      }
    }
    // 048 enrichment in a separate query so a pre-048 database (missing
    // focused/project_type columns) errors here without losing the checklist/
    // activity/follow-up carry-over above.
    const { data: enrich } = await supabaseAdmin.from('deals').select('id, focused, project_type')
    for (const e of (enrich ?? []) as { id: string; focused: boolean | null; project_type: string | null }[]) {
      const owner = byId.get(e.id)
      if (!owner) continue
      const key = dealKey(owner)
      if (e.focused === true && !snapshot.focus.has(key)) snapshot.focus.set(key, true)
      if (e.project_type && !snapshot.projectType.has(key)) snapshot.projectType.set(key, e.project_type)
    }
    // 061 stage enrichment — snapshotted for EVERY deal (restoring
    // stage_changed_at even when the stage itself is re-derivable keeps
    // deal-rot ages honest across a re-import).
    const { data: enrich61 } = await supabaseAdmin
      .from('deals')
      .select('id, stage, stage_changed_at, expected_close, closed_reason, next_step, next_step_due')
    for (const e of (enrich61 ?? []) as ({ id: string } & Stage61)[]) {
      const owner = byId.get(e.id)
      if (!owner) continue
      const key = dealKey(owner)
      if (!snapshot.stage61.has(key)) {
        snapshot.stage61.set(key, {
          stage: e.stage, stage_changed_at: e.stage_changed_at, expected_close: e.expected_close,
          closed_reason: e.closed_reason, next_step: e.next_step, next_step_due: e.next_step_due,
        })
      }
    }
    const { data: oldHistory } = await supabaseAdmin
      .from('deal_stage_history')
      .select('deal_id, from_stage, to_stage, actor, note, changed_at')
    for (const h of (oldHistory ?? []) as { deal_id: string; from_stage: string | null; to_stage: string; actor: string | null; note: string | null; changed_at: string }[]) {
      const owner = byId.get(h.deal_id)
      if (!owner) continue
      const key = dealKey(owner)
      const list = snapshot.stageHistory.get(key) ?? []
      list.push({ from_stage: h.from_stage, to_stage: h.to_stage, actor: h.actor, note: h.note, changed_at: h.changed_at })
      snapshot.stageHistory.set(key, list)
    }
    const { data: oldActivity } = await supabaseAdmin
      .from('deal_activity')
      .select('deal_id, kind, summary, actor, created_at')
    for (const a of (oldActivity ?? []) as { deal_id: string; kind: string; summary: string; actor: string | null; created_at: string }[]) {
      const owner = byId.get(a.deal_id)
      if (!owner) continue
      const key = dealKey(owner)
      const list = snapshot.activities.get(key) ?? []
      list.push({ kind: a.kind, summary: a.summary, actor: a.actor, created_at: a.created_at })
      snapshot.activities.set(key, list)
    }
    const { data: oldFollowUps } = await supabaseAdmin
      .from('deal_follow_ups')
      .select('deal_id, due_date, note, done, auto_generated')
    for (const f of (oldFollowUps ?? []) as { deal_id: string; due_date: string; note: string | null; done: boolean; auto_generated: boolean }[]) {
      const owner = byId.get(f.deal_id)
      if (!owner) continue
      const key = dealKey(owner)
      const list = snapshot.followUps.get(key) ?? []
      list.push({ due_date: f.due_date, note: f.note, done: f.done, auto_generated: f.auto_generated })
      snapshot.followUps.set(key, list)
    }
  }

  if (mode === 'replace') {
    // Full-table wipe scoped by a tautological filter (PostgREST refuses a
    // bare unfiltered DELETE).
    const { error: delErr } = await supabaseAdmin.from('deals').delete().gte('created_at', '1970-01-01')
    if (delErr) return NextResponse.json({ error: `Could not clear existing deals: ${delErr.message}` }, { status: 500 })
  }

  let inserted = 0
  const insertedRows: { id: string; customer: string; job_name: string | null; group_name: string; status: 'Won' | 'Lost' | null; stage: DealStage }[] = []
  // Fresh rows land with a derived stage (won/lost/quoted/lead); the carry-over
  // below restores portal-only stages (follow_up/verbal) on matching deals.
  const importRows = parsed.deals.map((d) => ({ ...d, stage: importStage(d) }))
  for (let i = 0; i < importRows.length; i += CHUNK) {
    const chunk = importRows.slice(i, i + CHUNK)
    const { data: rows, error: insErr } = await supabaseAdmin
      .from('deals')
      .insert(chunk)
      .select('id, customer, job_name, group_name, status, stage')
    if (insErr) {
      return NextResponse.json(
        {
          error:
            `Import stopped after ${inserted} of ${parsed.deals.length} rows: ${insErr.message}` +
            (mode === 'replace' ? ' The board was partially replaced — re-upload to recover.' : ''),
        },
        { status: 500 },
      )
    }
    inserted += chunk.length
    insertedRows.push(...(rows ?? []))
  }

  // ── Carry-over ──────────────────────────────────────────────────────────
  const carried = { checklists: 0, activities: 0, followUps: 0, focused: 0, projectTypes: 0, stages: 0, stageHistory: 0 }
  const carriedHistIds = new Set<string>()
  if (snapshot) {
    try {
      const consumed = new Set<string>()
      const activityRows: Record<string, unknown>[] = []
      const followUpRows: Record<string, unknown>[] = []
      const historyRows: Record<string, unknown>[] = []
      for (const row of insertedRows) {
        const key = dealKey(row)
        if (consumed.has(key)) continue // duplicate board rows: first match wins
        const checklist = snapshot.checklists.get(key)
        const acts = snapshot.activities.get(key)
        const fus = snapshot.followUps.get(key)
        const wasFocused = snapshot.focus.get(key)
        const projectType = snapshot.projectType.get(key)
        const s61 = snapshot.stage61.get(key)
        const hist = snapshot.stageHistory.get(key)
        if (!checklist && !acts && !fus && !wasFocused && !projectType && !s61 && !hist) continue
        consumed.add(key)
        // Fold every deal-row column that carries over into one update.
        const dealUpdate: Record<string, unknown> = {}
        if (checklist) dealUpdate.checklist = checklist
        if (wasFocused) dealUpdate.focused = true
        if (projectType) dealUpdate.project_type = projectType
        if (s61) {
          // Stage rule: the export's closed state (Won/Lost) always wins;
          // otherwise the portal's stage survives the re-import. Whenever the
          // stage survives (restored OR identical), restore stage_changed_at
          // too so deal-rot ages don't reset on every re-import.
          const importedClosed = row.status === 'Won' || row.status === 'Lost'
          if (!importedClosed && s61.stage !== row.stage) {
            dealUpdate.stage = s61.stage
            dealUpdate.status = statusForStage(s61.stage)
            dealUpdate.stage_changed_at = s61.stage_changed_at
          } else if (s61.stage === row.stage) {
            dealUpdate.stage_changed_at = s61.stage_changed_at
          }
          if (s61.expected_close) dealUpdate.expected_close = s61.expected_close
          if (s61.closed_reason) dealUpdate.closed_reason = s61.closed_reason
          if (s61.next_step) dealUpdate.next_step = s61.next_step
          if (s61.next_step_due) dealUpdate.next_step_due = s61.next_step_due
        }
        if (Object.keys(dealUpdate).length > 0) {
          const { error } = await supabaseAdmin.from('deals').update(dealUpdate).eq('id', row.id)
          if (!error) {
            if (checklist) carried.checklists++
            if (wasFocused) carried.focused++
            if (projectType) carried.projectTypes++
            if (s61 && (dealUpdate.stage !== undefined || dealUpdate.stage_changed_at !== undefined
              || dealUpdate.expected_close !== undefined || dealUpdate.closed_reason !== undefined
              || dealUpdate.next_step !== undefined || dealUpdate.next_step_due !== undefined)) carried.stages++
          }
        }
        if (acts) {
          for (const a of acts) activityRows.push({ ...(a as Record<string, unknown>), deal_id: row.id })
        }
        if (fus) {
          for (const f of fus) followUpRows.push({ ...(f as Record<string, unknown>), deal_id: row.id })
        }
        if (hist) {
          for (const h of hist) historyRows.push({ ...(h as Record<string, unknown>), deal_id: row.id })
          carriedHistIds.add(row.id)
        }
      }
      for (let i = 0; i < activityRows.length; i += CHUNK) {
        const { error } = await supabaseAdmin.from('deal_activity').insert(activityRows.slice(i, i + CHUNK))
        if (!error) carried.activities += Math.min(CHUNK, activityRows.length - i)
      }
      for (let i = 0; i < followUpRows.length; i += CHUNK) {
        const { error } = await supabaseAdmin.from('deal_follow_ups').insert(followUpRows.slice(i, i + CHUNK))
        if (!error) carried.followUps += Math.min(CHUNK, followUpRows.length - i)
      }
      for (let i = 0; i < historyRows.length; i += CHUNK) {
        const { error } = await supabaseAdmin.from('deal_stage_history').insert(historyRows.slice(i, i + CHUNK))
        if (!error) carried.stageHistory += Math.min(CHUNK, historyRows.length - i)
      }
    } catch (e) {
      console.error('[deals-import] carry-over failed (import itself succeeded):', e)
    }
  }

  // Every inserted deal that didn't inherit carried history gets a seed row
  // (append mode, first import, or unmatched rows) — the funnel floor.
  // Best-effort and additive; never fails the import.
  try {
    const seeds = insertedRows
      .filter((r) => !carriedHistIds.has(r.id))
      .map((r) => ({ deal_id: r.id, from_stage: null, to_stage: r.stage, actor: 'import' }))
    for (let i = 0; i < seeds.length; i += CHUNK) {
      await supabaseAdmin.from('deal_stage_history').insert(seeds.slice(i, i + CHUNK))
    }
  } catch { /* pre-061 or insert failed */ }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'deal.import',
    entityType: 'deal',
    summary:
      `Imported ${inserted} deals from "${file.name}" (${mode}` +
      (mode === 'replace' ? `, replaced ${existingCount ?? 0} existing` : '') +
      `) — ${parsed.groups.map((g) => `${g.name} ${g.count}`).join(', ')}`,
    metadata: {
      file: file.name,
      mode,
      inserted,
      replaced: mode === 'replace' ? existingCount ?? 0 : 0,
      groups: parsed.groups,
      warnings: parsed.warnings.length,
      carried,
    },
  })

  // Hand back the fresh board + follow-ups so the client can swap state
  // without refetching (follow-ups may have been carried over above).
  const { data: deals, error: selErr } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  const { data: followUps } = await supabaseAdmin.from('deal_follow_ups').select('*').order('due_date')
  if (selErr) return NextResponse.json({ ok: true, inserted, carried, preview, deals: null, followUps: followUps ?? [] })

  return NextResponse.json({ ok: true, inserted, carried, preview, deals, followUps: followUps ?? [] })
}
