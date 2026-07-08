import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Remove a document from Jerry's knowledge pool. Its chunks cascade
// (kb_chunks.document_id ON DELETE CASCADE, migration 030). Admin-only.

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
