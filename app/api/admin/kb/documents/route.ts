import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// The current contents of Jerry's knowledge pool — every ingested document plus the
// total chunk count (what the reactor's size reflects). Admin-only.

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err

  const { data: documents, error } = await supabaseAdmin
    .from('kb_documents')
    .select('id, title, category, is_internal, page_count, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[kb/documents] list error:', error)
    return NextResponse.json({ error: 'Could not load the knowledge base.' }, { status: 500 })
  }

  // Total chunks = how much Jerry "knows" — a head count (no rows pulled).
  const { count } = await supabaseAdmin.from('kb_chunks').select('*', { count: 'exact', head: true })

  return NextResponse.json({
    documents: documents || [],
    totalDocs: (documents || []).length,
    totalChunks: count ?? 0,
  })
}
