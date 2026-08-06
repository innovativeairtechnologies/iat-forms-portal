import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { graphConfigured, listFolders, GraphError } from '@/lib/graph'

// The folders in the SharePoint library, for the "file it here" picker on the
// approval card. READ ONLY — this needs nothing beyond the permission the pull
// already has, so it works today, before any write access exists.
//
// Read live rather than from configuration: the picker shows whatever folders
// SharePoint actually has right now, so one added next month appears on its own.
//
//   GET /api/admin/kb/folders

export const maxDuration = 60

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err

  if (!graphConfigured()) {
    return NextResponse.json({ configured: false, folders: [] })
  }

  try {
    const folders = await listFolders()
    return NextResponse.json({ configured: true, folders })
  } catch (e) {
    const msg = e instanceof GraphError ? e.message : 'Could not read the SharePoint folders.'
    console.error('[kb/folders] error:', e)
    // Not fatal to approval — the caller falls back to filing at the library root.
    return NextResponse.json({ configured: true, folders: [], error: msg }, { status: 502 })
  }
}
