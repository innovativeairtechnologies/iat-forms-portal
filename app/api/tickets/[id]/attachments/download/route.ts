import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

// Hands out a short-lived signed URL for a ticket-note attachment and redirects
// to it. Admin-gated. The path must live under this ticket's prefix, so one
// ticket can't be used to fetch another's files. `download` forces the browser
// to save the file (with its original name) rather than navigate to it.

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!path || !path.startsWith(`${params.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const name = (req.nextUrl.searchParams.get('name') || 'attachment').replace(/[\r\n"\\]/g, '').slice(0, 255)

  const { data, error } = await supabaseAdmin.storage
    .from('ticket-attachments')
    .createSignedUrl(path, 60, { download: name })

  if (error || !data) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl, 307)
}
