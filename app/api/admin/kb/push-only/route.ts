import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { titleFromFilename } from '@/lib/kb-chunking.mjs'
import { registerPushOnlyDocument, pushDocumentToSharePoint } from '@/lib/kb-push'

// File a document into SharePoint that Jerry cannot read.
//
// Reserved for the genuinely unreadable: scanned paper longer than a single
// vision pass, where no retry helps. Without this the two sides could never
// actually match — the document would exist on neither side, or on one only,
// which defeats the point of keeping them in step.
//
// The trade is stated plainly to the admin before they choose it: the file
// lands in SharePoint and the portal records that it exists, but Jerry cannot
// quote from it. An acknowledged gap, not a silent one.
//
//   POST /api/admin/kb/push-only

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const { filename, is_internal, storage_path, storage_mime, push_folder_id, push_folder_name } =
    (await req.json().catch(() => ({}))) as {
      filename?: string; is_internal?: boolean
      storage_path?: string; storage_mime?: string
      push_folder_id?: string | null; push_folder_name?: string | null
    }

  if (!filename || !storage_path) {
    return NextResponse.json({ error: 'Missing document details.' }, { status: 400 })
  }

  const registered = await registerPushOnlyDocument({
    filename,
    title: titleFromFilename(filename),
    isInternal: is_internal !== false,
    storagePath: storage_path,
    storageMime: storage_mime ?? null,
    pushFolderId: push_folder_id ?? null,
    pushFolderName: push_folder_name ?? null,
  })
  if (!registered.ok) return NextResponse.json({ error: registered.error }, { status: 500 })

  const pushed = await pushDocumentToSharePoint(registered.id)
  if (!pushed.ok) {
    // The row survives with push_error recorded, so this is retryable rather
    // than lost — but say so, because nothing was filed.
    return NextResponse.json({ id: registered.id, pushed: false, error: pushed.error }, { status: 502 })
  }

  return NextResponse.json({
    id: registered.id,
    pushed: true,
    folderName: pushed.folderName,
    webUrl: pushed.webUrl,
  })
}
