import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { graphConfigured } from '@/lib/graph'
import { discoverSharePointDocuments } from '@/lib/kb-sharepoint-sync'

// "Pull from SharePoint now" — phase 1, DISCOVERY.
//
// Asks SharePoint what's changed and records every new supported file in the
// review queue as pending-but-unread. Metadata only: no downloads, no AI, so it
// finishes quickly even across a whole library.
//
// Reading each document happens one at a time afterwards, via
// /api/admin/kb/queue/{id}/analyze — that split exists because transcribing a
// batch of multi-megabyte PDFs in one request blows the 300s function limit (it
// did, on the first live run, saving nothing).
//
// Admin-only. READ ONLY against SharePoint; nothing is published to Jerry here.
//
//   POST /api/admin/kb/sharepoint/sync

export const maxDuration = 120

export async function POST() {
  const err = await requireAdminAuth(); if (err) return err

  if (!graphConfigured()) {
    return NextResponse.json(
      { error: 'SharePoint isn’t connected yet. Add the Microsoft Graph credentials to the environment first.' },
      { status: 400 },
    )
  }

  try {
    const result = await discoverSharePointDocuments()
    return NextResponse.json(result)
  } catch (e) {
    console.error('[kb/sharepoint/sync] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Something went wrong reaching SharePoint.' },
      { status: 502 },
    )
  }
}
