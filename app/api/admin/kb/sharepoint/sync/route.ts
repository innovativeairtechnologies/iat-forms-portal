import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { graphConfigured } from '@/lib/graph'
import { runSharePointSync } from '@/lib/kb-sharepoint-sync'

// "Pull from SharePoint now" — the admin-triggered half of the pull, so a human
// can fetch on demand instead of waiting for (or depending on) a schedule. Runs
// the SAME engine as the cron; the only difference is who authenticates.
//
// Admin-only. READ ONLY against SharePoint, and it never publishes to Jerry —
// everything it finds lands in kb_review_queue as pending, awaiting approval.
//
// One batch per click by design: a large library shouldn't dump hundreds of
// review cards (or hundreds of AI transcriptions) in a single request. The
// response reports what's left so the UI can invite another click.
//
//   POST /api/admin/kb/sharepoint/sync

export const maxDuration = 300

export async function POST() {
  const err = await requireAdminAuth(); if (err) return err

  if (!graphConfigured()) {
    return NextResponse.json(
      { error: 'SharePoint isn’t connected yet. Add the Microsoft Graph credentials to the environment first.' },
      { status: 400 },
    )
  }

  try {
    const result = await runSharePointSync()
    return NextResponse.json(result)
  } catch (e) {
    console.error('[kb/sharepoint/sync] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Something went wrong pulling from SharePoint.' },
      { status: 502 },
    )
  }
}
