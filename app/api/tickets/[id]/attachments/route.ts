import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

// Upload a single file to be attached to a ticket note. Admin-gated; files land
// in the private `ticket-attachments` bucket under the ticket's id prefix. The
// note itself is saved separately (POST /api/tickets/[id]/notes) with the
// returned metadata. Downloads go through ./download (signed URLs).

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

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `Unsupported file type${ext ? ` (.${ext})` : ''}` }, { status: 400 })
    }

    const path = `${params.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = new Uint8Array(await file.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('ticket-attachments')
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

    if (error) {
      console.error('Ticket attachment upload error:', error)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    return NextResponse.json({ path, name: file.name, type: file.type || '', size: file.size })
  } catch (e) {
    console.error('Ticket attachment route error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
