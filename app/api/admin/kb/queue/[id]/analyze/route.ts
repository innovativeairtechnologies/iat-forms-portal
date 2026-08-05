import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { graphConfigured } from '@/lib/graph'
import { analyzeQueuedDocument } from '@/lib/kb-sharepoint-sync'

// Read ONE discovered document: download it from SharePoint, transcribe it with
// Claude, and run the scrub — filling in the queue row so a human can review it.
//
// One document per request, deliberately. Transcribing several multi-megabyte
// PDFs in a single request exceeds the 300s function limit; a single large manual
// can come close on its own. The client walks the queue one call at a time, which
// also means progress is visible and AI spend is incremental and interruptible.
//
// A document that can't be read records the reason on its row and returns 422 —
// it stays visible and retryable instead of blocking everything behind it.
//
// Admin-only. Still publishes nothing: reading only fills in the review card.
//
//   POST /api/admin/kb/queue/{id}/analyze

export const maxDuration = 300

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err
  const { id } = await params

  if (!graphConfigured()) {
    return NextResponse.json({ error: 'SharePoint isn’t connected.' }, { status: 400 })
  }

  const result = await analyzeQueuedDocument(id)
  if (!result.ok) return NextResponse.json({ error: result.error, id: result.id }, { status: 422 })
  return NextResponse.json(result)
}
