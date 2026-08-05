import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Reject one queued SharePoint document — it does NOT enter Jerry's knowledge.
//
// The row is marked rejected rather than deleted, which is what stops the next
// pull from re-queueing it: the delta would happily hand us the same file again,
// and a rejected row is a durable record of "a human said no to this one".
//
//   POST /api/admin/kb/queue/{id}/reject

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('kb_review_queue')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[kb/queue/reject] error:', error)
    return NextResponse.json({ error: 'Could not reject that document.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'That document is no longer pending.' }, { status: 404 })

  return NextResponse.json({ id: data.id, status: 'rejected' })
}
