import { NextRequest, NextResponse } from 'next/server'
import { graphConfigured } from '@/lib/graph'
import { runSharePointSync } from '@/lib/kb-sharepoint-sync'

// Scheduled PULL: SharePoint → Jerry's Brain review queue.
//
// Runs the same engine as the admin "Pull from SharePoint now" button
// (lib/kb-sharepoint-sync) — delta → download → scrub → park in kb_review_queue
// as PENDING. It NEVER publishes to Jerry; a human approves in the "From
// SharePoint" queue. READ ONLY (no writes back to SharePoint in v1).
//
// Authenticated with CRON_SECRET, same as the other scheduled jobs, and fails
// closed. Safe no-op until Graph env is configured.
//
// NOT SCHEDULED TODAY: this route is not in vercel.json's crons. Phase 1 pulls
// on demand via the admin button, deliberately — adding a third cron would need
// a plan that allows it, and setting CRON_SECRET would also reactivate the two
// currently-dormant jobs (accrue-pto, admin-digest). Wiring a schedule is a
// separate decision; this route is ready for it when that's made.
//
// GET /api/cron/kb-sharepoint-sync

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!graphConfigured()) {
    return NextResponse.json({ skipped: 'SharePoint not configured' })
  }

  try {
    const result = await runSharePointSync()
    return NextResponse.json(result)
  } catch (e) {
    console.error('[cron/kb-sharepoint-sync] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
