import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { graphConfigured, resolveLibrary, listLibraryTop, GraphError } from '@/lib/graph'

// Connection smoke test for the SharePoint sync — admin only, READ ONLY.
// The go-live milestone: once IT's credentials are in the environment, hitting
// this lists the top files in the configured library, proving auth + the
// least-privilege site grant work end-to-end before any sync is wired.
//   GET /api/admin/kb/sharepoint/test

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err

  if (!graphConfigured()) {
    return NextResponse.json({
      configured: false,
      message: 'SharePoint isn’t connected yet. Add MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET and SHAREPOINT_SITE_URL to the environment.',
    })
  }

  try {
    const lib = await resolveLibrary()
    const items = await listLibraryTop(20)
    const files = items.filter((i) => i.file).map((i) => ({
      name: i.name,
      sizeKb: i.size ? Math.round(i.size / 1024) : null,
      modified: i.lastModifiedDateTime,
      by: i.lastModifiedBy?.user?.displayName ?? null,
    }))
    return NextResponse.json({
      configured: true,
      connected: true,
      site: lib.siteName,
      library: lib.libraryName,
      // The immutable ids — pin these in env (SHAREPOINT_SITE_ID / SHAREPOINT_DRIVE_ID)
      // and a future SharePoint URL/site rename needs no change on our side at all.
      siteId: lib.siteId,
      driveId: lib.driveId,
      fileCount: files.length,
      sample: files.slice(0, 20),
    })
  } catch (e) {
    const msg = e instanceof GraphError ? e.message : 'Unexpected error reaching SharePoint.'
    console.error('[kb/sharepoint/test] error:', e)
    return NextResponse.json({ configured: true, connected: false, error: msg }, { status: 502 })
  }
}
