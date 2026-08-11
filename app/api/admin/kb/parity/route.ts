import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { graphConfigured, driveDelta, GraphError } from '@/lib/graph'
import { SYNC_SOURCE } from '@/lib/kb-sharepoint-sync'

// Is Jerry actually 1:1 with the SharePoint library? This answers it with
// evidence rather than assurance, and answers it from the portal — no CLI, no
// credentials on anyone's laptop, which matters when the project changes hands.
//
// Runs live against Graph, so it reflects the library as it is now rather than a
// local mirror (which lags, and flattens the folder structure).
//
// "Awaiting review" counts as OUTSTANDING, not covered. A queue is not parity.
//
//   GET /api/admin/kb/parity

export const maxDuration = 120

// Kept in step with lib/kb-sharepoint-sync. Spreadsheets and presentations are
// deliberately excluded — their text is formulas and fragments, not knowledge.
const READABLE = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
])

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err
  if (!graphConfigured()) {
    return NextResponse.json({ error: 'SharePoint isn’t connected.' }, { status: 400 })
  }

  try {
    // A full pass, not the incremental cursor: an audit that reuses the delta
    // cursor would only see what changed since the last sync and would report
    // an empty library as perfect parity.
    const { items } = await driveDelta(null)
    const files = items.filter((i) => i.file && !i.folder && !i.deleted)
    const readable = files.filter((f) => READABLE.has(f.file?.mimeType || ''))
    const notRead = files.filter((f) => !READABLE.has(f.file?.mimeType || ''))

    const { data: docs } = await supabaseAdmin
      .from('kb_documents').select('id, title, sharepoint_item_id, pushed_at')
    const { data: queue } = await supabaseAdmin
      .from('kb_review_queue').select('external_id, filename, status').eq('source', SYNC_SOURCE)

    const inJerry = new Set((docs || []).filter((d) => d.sharepoint_item_id).map((d) => d.sharepoint_item_id as string))
    const queueStatus = new Map((queue || []).map((q) => [q.external_id as string, q.status as string]))

    const held: string[] = [], awaiting: string[] = [], rejected: string[] = [], missing: string[] = []
    for (const f of readable) {
      const name = f.name || '(unnamed)'
      if (inJerry.has(f.id)) { held.push(name); continue }
      const st = queueStatus.get(f.id)
      if (st === 'pending') awaiting.push(name)
      else if (st === 'rejected') rejected.push(name)
      else missing.push(name)
    }

    // The other direction: Jerry claiming an item the library no longer has.
    const liveIds = new Set(files.map((f) => f.id))
    const orphaned = (docs || [])
      .filter((d) => d.sharepoint_item_id && !liveIds.has(d.sharepoint_item_id as string))
      .map((d) => d.title as string)

    const parity = missing.length === 0 && awaiting.length === 0 && orphaned.length === 0

    return NextResponse.json({
      parity,
      summary: parity
        ? 'Every readable file in SharePoint is in Jerry, or was consciously rejected.'
        : 'Not yet 1:1 — see the lists.',
      sharePoint: { files: files.length, readable: readable.length, notRead: notRead.length },
      jerry: {
        documents: (docs || []).length,
        linkedToSharePoint: inJerry.size,
        portalOnly: (docs || []).filter((d) => !d.sharepoint_item_id).length,
        pushedUp: (docs || []).filter((d) => d.pushed_at).length,
      },
      counts: {
        held: held.length,
        awaitingReview: awaiting.length,
        rejectedByAPerson: rejected.length,
        missingEntirely: missing.length,
        goneFromSharePoint: orphaned.length,
      },
      missingEntirely: missing.slice(0, 50),
      awaitingReview: awaiting.slice(0, 50),
      goneFromSharePoint: orphaned.slice(0, 25),
      notRead: notRead.slice(0, 30).map((f) => f.name),
    })
  } catch (e) {
    const msg = e instanceof GraphError ? e.message : 'Could not complete the parity check.'
    console.error('[kb/parity] error:', e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
