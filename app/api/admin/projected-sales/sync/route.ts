import { NextResponse } from 'next/server'
import { requireProjectedSalesAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { fetchProjectedSalesRaw, dedupeAndDeriveProjectedSales } from '@/lib/dryware'
import { materializeDealsFromProjectedSales, type MaterializeStats } from '@/lib/dryware-deals'

export const runtime = 'nodejs'
// Dryware responds in ~1s in practice, but raise the function ceiling so a slow
// day still completes instead of being cut off at the platform default — it
// matches the 60s abort in fetchProjectedSalesRaw().
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/admin/projected-sales/sync — pull the latest snapshot from the
   Dryware reporting API, de-duplicate it, and mirror it into projected_sales.
   Gated on the `deals` permission (Sales + admin) via requireProjectedSalesAuth.

   SUCCESS: replace_projected_sales() swaps the data AND updates the sync log in
   ONE transaction (a concurrent reader never sees a half-empty table); we then
   hand back the fresh rows so the page updates without a refetch.

   FAILURE (Dryware down, timeout, bad response): record the error on the sync
   log WITHOUT touching projected_sales, so the last good snapshot stays on
   screen. Never wipe good data on a failed fetch.
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST() {
  const denied = await requireProjectedSalesAuth()
  if (denied) return denied

  const surfaceUser = await getAdminSurfaceUser()
  const syncedBy = surfaceUser?.displayName ?? null

  try {
    const { raw, durationMs } = await fetchProjectedSalesRaw()
    const { rows, summary } = dedupeAndDeriveProjectedSales(raw)

    const meta = {
      status: 'ok',
      error: null,
      source_count: summary.sourceCount,
      unique_count: summary.uniqueCount,
      total_quote: summary.totalQuote,
      weighted_total: summary.weightedTotal,
      duration_ms: durationMs,
      synced_by: syncedBy,
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('replace_projected_sales', {
      p_rows: rows,
      p_meta: meta,
    })
    if (rpcErr) throw new Error(rpcErr.message)

    // Mirror the fresh feed into `deals` so the CRM Board / Focused / Calendar
    // and the /admin dashboard all reflect this sync. DryWare owns the facts;
    // portal workflow (stage / ★ / follow-ups / notes) is preserved. Best-effort:
    // a materialization failure must NOT fail the sync (projected_sales already
    // swapped successfully) — the Performance page is still correct, and the
    // next sync retries the deals mirror.
    let dealStats: MaterializeStats | null = null
    try {
      dealStats = await materializeDealsFromProjectedSales(supabaseAdmin)
    } catch (e) {
      console.error('[projected-sales/sync] deal materialization failed (sync itself succeeded):', e)
    }

    await logAudit({
      actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
      action: 'projected_sales.sync',
      entityType: 'projected_sales',
      summary:
        `Synced ${summary.uniqueCount} projects ` +
        `($${Math.round(summary.totalQuote).toLocaleString()} quoted, ` +
        `$${Math.round(summary.weightedTotal).toLocaleString()} weighted) from Dryware in ${durationMs}ms` +
        (summary.sourceCount !== summary.uniqueCount
          ? ` — de-duplicated from ${summary.sourceCount} source rows`
          : '') +
        (dealStats
          ? ` · deals mirror: +${dealStats.inserted} new / ${dealStats.updated} updated / ${dealStats.pruned} pruned`
          : ' · deals mirror skipped (error)'),
      metadata: {
        source_count: summary.sourceCount,
        unique_count: summary.uniqueCount,
        total_quote: summary.totalQuote,
        weighted_total: summary.weightedTotal,
        duration_ms: durationMs,
        deal_stats: dealStats,
      },
    })

    // Hand back the fresh snapshot + sync log so the client swaps state directly.
    const [{ data: projects }, { data: sync }] = await Promise.all([
      supabaseAdmin.from('projected_sales').select('*').order('quote_total', { ascending: false }),
      supabaseAdmin.from('projected_sales_sync').select('*').maybeSingle(),
    ])

    return NextResponse.json({ ok: true, projects: projects ?? [], sync, dealStats })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed.'
    console.error('[projected-sales/sync] failed:', message)
    // Record the failure WITHOUT wiping the last good snapshot. Only the
    // status/error/synced_by columns are sent, so last_synced_at + the counts
    // from the previous good sync stay intact (the page still shows "last synced
    // <good time>" plus a failure note).
    await supabaseAdmin
      .from('projected_sales_sync')
      .upsert({ id: true, status: 'error', error: message, synced_by: syncedBy }, { onConflict: 'id' })
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
