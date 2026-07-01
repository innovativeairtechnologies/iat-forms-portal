import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

// Issues a one-shot signed upload URL for a Submittal scan. The browser then
// uploads the file bytes directly to Supabase Storage with this token, which
// avoids Vercel's ~4.5MB function request-body limit (routing the file through
// this function's own body, as extract-submittal used to, 413s well before its
// own size check ever runs). Admin-gated; files land in the private
// `admin-submittals` bucket and are deleted right after extraction.

const MAX_BYTES = 20 * 1024 * 1024 // 20MB — comfortably above real-world Submittals

const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) return NextResponse.json({ error: 'That file is too large to scan (max 20MB).' }, { status: 400 })

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type${ext ? ` (.${ext})` : ''}. Attach a PDF or an image.` }, { status: 400 })
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('admin-submittals')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Submittal signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }

  return NextResponse.json({ path, token: data.token })
}
