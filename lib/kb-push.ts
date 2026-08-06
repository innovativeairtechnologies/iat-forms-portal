import { supabaseAdmin } from '@/lib/supabase-admin'
import { graphConfigured, uploadFile, GraphError } from '@/lib/graph'

// ─────────────────────────────────────────────────────────────────────────────
// PUSH — Jerry → SharePoint. The other half of the 1:1 repository: a document
// approved in Jerry's Brain is filed back into the SharePoint library, into the
// folder the admin picked at approval time.
//
// What goes up is the ORIGINAL file, never the transcript. SharePoint is the
// canonical home for the real document; Jerry keeps the searchable text.
//
// THREE RULES, none of them negotiable:
//
//  1. NEVER push a document that came FROM SharePoint. That is the echo loop —
//     pull it, approve it, push it back, see it as new, pull it again. Enforced
//     here by source, and belt-and-braces by the caller only pushing portal rows.
//  2. NEVER overwrite. uploadFile() uses conflictBehavior=rename, so a clash
//     with a human's file creates "Report 1.pdf" instead of destroying work.
//  3. RECORD THE ITEM ID on success. The pull's dedup asks kb_documents which
//     SharePoint items it already knows; without that id our own upload comes
//     straight back as a new document to review. The id closes the loop.
//
// Safe before write access exists: a push with no permission fails, records why
// on the row, and leaves Jerry untouched. Approval never depends on it.
// ─────────────────────────────────────────────────────────────────────────────

const KB_UPLOADS_BUCKET = 'kb-uploads'

/**
 * Register a document Jerry cannot read, so it can still be filed in SharePoint.
 *
 * Some documents are scanned paper longer than one vision pass — genuinely
 * unreadable here, and no amount of retrying changes that. Refusing them
 * entirely would mean the two sides can never actually match, which is the whole
 * point of the exercise. So the file is filed and recorded, with no chunks:
 * SharePoint holds it, the portal knows it exists, and Jerry simply cannot quote
 * it. That is an honest gap rather than a hidden one.
 *
 * Deliberately NOT ingested: a document with no text would otherwise sit in the
 * pool contributing nothing to an answer while looking like knowledge.
 */
export async function registerPushOnlyDocument(params: {
  filename: string
  title: string
  isInternal: boolean
  storagePath: string
  storageMime: string | null
  pushFolderId: string | null
  pushFolderName: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: doc, error } = await supabaseAdmin
    .from('kb_documents')
    .insert({
      title: params.title,
      // Qualified so an unreadable file can never collide with, or replace, a
      // readable document of the same name.
      source_filename: `push-only:${params.storagePath}/${params.filename}`,
      category: null,
      is_internal: params.isInternal,
      page_count: null,
      source: 'portal',
      storage_path: params.storagePath,
      storage_mime: params.storageMime,
      push_folder_id: params.pushFolderId,
      push_folder_name: params.pushFolderName,
    })
    .select('id')
    .single()

  if (error || !doc) {
    console.error('[kb-push] push-only insert failed:', error?.message)
    return { ok: false, error: 'Could not record that document.' }
  }
  return { ok: true, id: doc.id as string }
}

export type PushResult =
  | { ok: true; itemId: string; webUrl: string | null; folderName: string | null }
  | { ok: false; error: string; skipped?: boolean }

/**
 * File one approved document into SharePoint. Returns a result rather than
 * throwing: a failed push must never fail the approval that triggered it — the
 * document is already safely in Jerry, and the row keeps the reason so it can be
 * retried.
 */
export async function pushDocumentToSharePoint(documentId: string): Promise<PushResult> {
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('kb_documents')
    .select('id, title, source, source_filename, storage_path, storage_mime, push_folder_id, push_folder_name, pushed_at, sharepoint_item_id')
    .eq('id', documentId)
    .maybeSingle()

  if (docErr || !doc) return { ok: false, error: 'That document no longer exists.' }

  // Rule 1 — the echo loop. Two independent guards: where it came from, and
  // whether it already carries a SharePoint identity.
  if (doc.source === 'sharepoint' || doc.sharepoint_item_id) {
    return { ok: false, skipped: true, error: 'That document came from SharePoint — it is already there.' }
  }
  if (doc.pushed_at) {
    return { ok: false, skipped: true, error: 'That document has already been filed in SharePoint.' }
  }
  if (!doc.storage_path) {
    return { ok: false, skipped: true, error: 'No original file was kept for this document, so there is nothing to file.' }
  }
  if (!graphConfigured()) {
    return { ok: false, error: 'SharePoint isn’t connected.' }
  }

  const fail = async (message: string): Promise<PushResult> => {
    await supabaseAdmin.from('kb_documents').update({ push_error: message }).eq('id', documentId)
    return { ok: false, error: message }
  }

  try {
    const { data: file, error: dlErr } = await supabaseAdmin
      .storage.from(KB_UPLOADS_BUCKET).download(doc.storage_path as string)
    if (dlErr || !file) {
      return fail('The original file is no longer in storage, so it could not be filed.')
    }
    const bytes = Buffer.from(await file.arrayBuffer())

    // The name a human should see in SharePoint — the document's own filename,
    // not the opaque storage key.
    const filename = (doc.source_filename as string) || `${doc.title as string}.pdf`

    const item = await uploadFile(
      (doc.push_folder_id as string) || null,
      filename,
      bytes,
      (doc.storage_mime as string) || undefined,
    )

    // Rule 3 — stamp the identity BEFORE cleaning anything up, so the pull can
    // never mistake our own upload for a new document.
    const { error: updErr } = await supabaseAdmin
      .from('kb_documents')
      .update({
        sharepoint_item_id: item.id,
        sharepoint_etag: item.eTag ?? null,
        // Record the cTag of what we just uploaded. Without it the next pull
        // sees our own file as "known but changed" and re-ingests it — the echo
        // loop coming back through the change-detection door instead of the
        // identity one.
        sharepoint_ctag: item.cTag ?? null,
        pushed_at: new Date().toISOString(),
        push_error: null,
      })
      .eq('id', documentId)

    if (updErr) {
      // The file IS in SharePoint but we failed to record it. Say so loudly: the
      // next pull will see it as new, and a human needs to know why.
      console.error('[kb-push] uploaded but could not record item id:', updErr.message)
      return fail(`Filed in SharePoint, but the link back could not be saved (${updErr.message}). It may reappear as a new document on the next pull.`)
    }

    // SharePoint now holds the canonical copy, so the staging upload is redundant.
    // Best-effort: a leftover object costs storage, never correctness.
    await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).remove([doc.storage_path as string]).catch(() => {})

    return {
      ok: true,
      itemId: item.id,
      webUrl: item.webUrl ?? null,
      folderName: (doc.push_folder_name as string) || null,
    }
  } catch (e) {
    const msg = e instanceof GraphError
      ? (e.status === 403
          ? 'SharePoint refused the upload — the app has read access but not write access yet.'
          : e.message)
      : 'Something went wrong filing that document in SharePoint.'
    console.error('[kb-push] failed:', doc.title, e)
    return fail(msg)
  }
}
