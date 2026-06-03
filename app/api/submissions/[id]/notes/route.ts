import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const err = requireAdminAuth(); if (err) return err
  const { data, error } = await supabaseAdmin
    .from('submission_notes')
    .select('*')
    .eq('submission_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const err = requireAdminAuth(); if (err) return err
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('submission_notes')
    .insert({ submission_id: params.id, content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const err = requireAdminAuth(); if (err) return err
  const { note_id } = await req.json()
  const { error } = await supabaseAdmin
    .from('submission_notes')
    .delete()
    .eq('id', note_id)
    .eq('submission_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
