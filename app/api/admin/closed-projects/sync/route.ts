import { NextResponse } from 'next/server'
import { requireClosedProjectsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { fetchClosedProjectsRaw, deriveClosedProjects } from '@/lib/dryware-closed'
import { materializeWonDeals, type MaterializeWonStats } from '@/lib/dryware-closed-deals'

export const runtime = 'nodejs'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/admin/closed-projects/sync — pull the latest closed (won) projects
   from Dryware and upsert them into closed_projects (100), then transition each
   matching CRM deal to stage='won' (materializeWonDeals). Gated on the `deals`
   permission via requireClosedProjectsAuth.

   ADDITIVE ONLY: closed_projects is never wiped (see migration 100) — a failed
   fetch or a partial response can never lose a previously-recorded win. This
   route does not touch projected_sales or its prune step; the Performance sync
   does that (and also calls this same pipeline first, so a single "Sync now"
   on either page keeps both feeds and the CRM Board consistent).
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST() {
  const denied = await requireClosedProjectsAuth()
  if (denied) return denied

  const surfaceUser = await getAdminSurfaceUser()
  const syncedBy = surfaceUser?.displayName ?? null

  try {
    const { raw, durationMs } = await fetchClosedProjectsRaw()
    const { rows, summary } = deriveClosedProjects(raw)

    const meta = {
      status: 'ok',
      error: null,
      fetched_count: summary.fetchedCount,
      duration_ms: durationMs,
      synced_by: syncedBy,
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('upsert_closed_projects', { p_rows: rows, p_meta: meta })
    if (rpcErr) throw new Error(rpcErr.message)

    // Best-effort: closed_projects already committed successfully above, so a
    // materialization failure here must not surface as a sync failure — the
    // Closed Projects page is still correct, and the next sync retries it.
    let wonStats: MaterializeWonStats | null = null
    try {
      wonStats = await materializeWonDeals(supabaseAdmin)
    } catch (e) {
      console.error('[closed-projects/sync] deal materialization failed (sync itself succeeded):', e)
    }

    await logAudit({
      actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
      action: 'closed_projects.sync',
      entityType: 'closed_projects',
      summary:
        `Synced ${summary.fetchedCount} closed projects ` +
        `($${Math.round(summary.totalClosedThisBatch).toLocaleString()} this batch) from Dryware in ${durationMs}ms` +
        (wonStats
          ? ` · CRM: ${wonStats.transitioned} won, ${wonStats.created} added directly, ${wonStats.alreadyWon} already won`
          : ' · CRM update skipped (error)'),
      metadata: {
        fetched_count: summary.fetchedCount,
        total_closed_this_batch: summary.totalClosedThisBatch,
        duration_ms: durationMs,
        won_stats: wonStats,
      },
    })

    const [{ data: projects }, { data: sync }] = await Promise.all([
      supabaseAdmin.from('closed_projects').select('*').order('actual_closing_date', { ascending: false }),
      supabaseAdmin.from('closed_projects_sync').select('*').maybeSingle(),
    ])

    return NextResponse.json({ ok: true, projects: projects ?? [], sync, wonStats })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed.'
    console.error('[closed-projects/sync] failed:', message)
    await supabaseAdmin
      .from('closed_projects_sync')
      .upsert({ id: true, status: 'error', error: message, synced_by: syncedBy }, { onConflict: 'id' })
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
