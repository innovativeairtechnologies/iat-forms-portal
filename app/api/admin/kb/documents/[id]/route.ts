import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Remove a document from Jerry's knowledge pool. Its chunks cascade
// (kb_chunks.document_id ON DELETE CASCADE, migration 030). Admin-only.
//
// PATCH changes who Jerry may use a document for, without re-uploading it.
// Cheap by design: is_internal lives only on kb_documents and retrieval joins to
// it at query time (migration 030's search function filters on d.is_internal), so
// flipping the flag changes every passage of that document at once. No
// re-reading, no re-chunking, nothing to rebuild.

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 })

  const { is_internal } = (await req.json().catch(() => ({}))) as { is_internal?: boolean }
  if (typeof is_internal !== 'boolean') {
    return NextResponse.json({ error: 'is_internal must be true or false.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('kb_documents')
    .update({ is_internal })
    .eq('id', id)
    .select('id, title, is_internal')
    .maybeSingle()

  if (error) {
    console.error('[kb/documents] visibility update error:', error)
    return NextResponse.json({ error: 'Could not change that document’s visibility.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'That document no longer exists.' }, { status: 404 })

  return NextResponse.json({ id: data.id, title: data.title, isInternal: data.is_internal })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Missing document id.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('kb_documents').delete().eq('id', id)
  if (error) {
    console.error('[kb/documents] delete error:', error)
    return NextResponse.json({ error: 'Could not remove that document.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
