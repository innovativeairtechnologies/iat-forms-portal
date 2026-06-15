import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

// Issues a one-shot signed upload URL for a ticket-note attachment. The browser
// then uploads the file BYTES directly to Supabase Storage with this token,
// which avoids Vercel's ~4.5MB function request-body limit (a multipart upload
// routed through here 413s on anything larger). Admin-gated; files land in the
// private `ticket-attachments` bucket under the ticket's id prefix.

const MAX_BYTES = 25 * 1024 * 1024 // 25MB — emails with attachments run large

// Validate by extension: browsers report .msg/.eml MIME inconsistently (often
// application/octet-stream or empty), so the extension is the reliable signal.
const ALLOWED_EXT = new Set([
  'eml', 'msg',                                   // saved emails
  'pdf', 'txt', 'csv', 'rtf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',    // office docs
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic',    // images
  'zip',
])

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type${ext ? ` (.${ext})` : ''}` }, { status: 400 })
  }

  const path = `${params.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('ticket-attachments')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Ticket attachment signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }

  return NextResponse.json({ path, token: data.token })
}
