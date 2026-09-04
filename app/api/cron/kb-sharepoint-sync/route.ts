import { NextRequest, NextResponse } from 'next/server'
import { isPushWindow, pushWindowReason } from '@/lib/et-clock'
import { graphConfigured } from '@/lib/graph'
import { discoverSharePointDocuments, analyzeQueuedDocument, nextUnreadQueued } from '@/lib/kb-sharepoint-sync'

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

  // ⛔ Nothing scheduled may do work between 8:00am and 5:30pm Eastern — that is
  // the window production pushes go out in, and a deploy landing on a running
  // job loses the run. Placed immediately after auth and before ANY work, so it
  // holds no matter what a future vercel.json entry says. See lib/et-clock.ts.
  if (isPushWindow()) {
    return NextResponse.json({ skipped: true, reason: pushWindowReason() })
  }
  if (!graphConfigured()) {
    return NextResponse.json({ skipped: 'SharePoint not configured' })
  }

  try {
    const discovery = await discoverSharePointDocuments()

    // Then read what fits in the time left. One document per iteration, with a
    // wall-clock budget checked BEFORE each one — transcription time varies with
    // document size, so the guard has to be time-based, not a fixed count. The
    // rest stay queued as unread and the next run continues from there.
    const started = Date.now()
    const BUDGET_MS = 210_000 // leave comfortable headroom under maxDuration
    let read = 0, failed = 0
    while (Date.now() - started < BUDGET_MS) {
      const next = await nextUnreadQueued()
      if (!next) break
      const res = await analyzeQueuedDocument(next.id)
      if (res.ok) read++; else failed++
    }

    return NextResponse.json({ ...discovery, read, failed })
  } catch (e) {
    console.error('[cron/kb-sharepoint-sync] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
