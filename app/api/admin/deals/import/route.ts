import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseSalesForecastXlsx, type ImportResult } from '@/lib/deals-import'

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
  /** Portal-native workflow data at stake in a replace (0s pre-migration-047). */
  portalData: { checklists: number; activities: number }
}

/** Identity used to carry checklists/activity across a replace-import: the
 *  same deal re-exported keeps its customer + job + group. Lossy on true
 *  duplicates (first match wins) — acceptable for best-effort carry-over. */
const dealKey = (d: { customer: string; job_name: string | null; group_name: string }) =>
  `${d.customer.trim().toLowerCase()}|${(d.job_name ?? '').trim().toLowerCase()}|${d.group_name.trim().toUpperCase()}`

/** Count portal workflow data (checklist progress + activity rows). Both
 *  probes tolerate a pre-047 database by returning zeros. */
async function countPortalData(): Promise<{ checklists: number; activities: number }> {
  let checklists = 0
  let activities = 0
  const { data, error: colErr } = await supabaseAdmin.from('deals').select('checklist')
  if (!colErr) {
    checklists = ((data ?? []) as { checklist: Record<string, boolean> | null }[])
      .filter((r) => r.checklist && Object.values(r.checklist).some(Boolean)).length
  }
  // NB: a HEAD count on a missing table does NOT error (observed against this
  // PostgREST) — it just returns a null count, which conveniently reads as 0.
  const { count, error: actErr } = await supabaseAdmin.from('deal_activity').select('*', { count: 'exact', head: true })
  if (!actErr) activities = count ?? 0
  return { checklists, activities }
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
  type Snapshot = { checklists: Map<string, Record<string, boolean>>; activities: Map<string, unknown[]> }
  let snapshot: Snapshot | null = null
  if (mode === 'replace' && (preview.portalData.checklists > 0 || preview.portalData.activities > 0)) {
    snapshot = { checklists: new Map(), activities: new Map() }
    const { data: oldDeals } = await supabaseAdmin.from('deals').select('id, customer, job_name, group_name, checklist')
    const byId = new Map((oldDeals ?? []).map((d) => [d.id as string, d]))
    for (const d of oldDeals ?? []) {
      const c = d.checklist as Record<string, boolean> | null
      if (c && Object.values(c).some(Boolean) && !snapshot.checklists.has(dealKey(d))) {
        snapshot.checklists.set(dealKey(d), c)
      }
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
  }

  if (mode === 'replace') {
    // Full-table wipe scoped by a tautological filter (PostgREST refuses a
    // bare unfiltered DELETE).
    const { error: delErr } = await supabaseAdmin.from('deals').delete().gte('created_at', '1970-01-01')
    if (delErr) return NextResponse.json({ error: `Could not clear existing deals: ${delErr.message}` }, { status: 500 })
  }

  let inserted = 0
  const insertedRows: { id: string; customer: string; job_name: string | null; group_name: string }[] = []
  for (let i = 0; i < parsed.deals.length; i += CHUNK) {
    const chunk = parsed.deals.slice(i, i + CHUNK)
    const { data: rows, error: insErr } = await supabaseAdmin
      .from('deals')
      .insert(chunk)
      .select('id, customer, job_name, group_name')
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
  let carried = { checklists: 0, activities: 0 }
  if (snapshot) {
    try {
      const consumed = new Set<string>()
      const activityRows: Record<string, unknown>[] = []
      for (const row of insertedRows) {
        const key = dealKey(row)
        if (consumed.has(key)) continue // duplicate board rows: first match wins
        const checklist = snapshot.checklists.get(key)
        const acts = snapshot.activities.get(key)
        if (!checklist && !acts) continue
        consumed.add(key)
        if (checklist) {
          const { error } = await supabaseAdmin.from('deals').update({ checklist }).eq('id', row.id)
          if (!error) carried.checklists++
        }
        if (acts) {
          for (const a of acts) activityRows.push({ ...(a as Record<string, unknown>), deal_id: row.id })
        }
      }
      for (let i = 0; i < activityRows.length; i += CHUNK) {
        const { error } = await supabaseAdmin.from('deal_activity').insert(activityRows.slice(i, i + CHUNK))
        if (!error) carried.activities += Math.min(CHUNK, activityRows.length - i)
      }
    } catch (e) {
      console.error('[deals-import] carry-over failed (import itself succeeded):', e)
    }
  }

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

  // Hand back the fresh board so the client can swap state without refetching.
  const { data: deals, error: selErr } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (selErr) return NextResponse.json({ ok: true, inserted, carried, preview, deals: null })

  return NextResponse.json({ ok: true, inserted, carried, preview, deals })
}
