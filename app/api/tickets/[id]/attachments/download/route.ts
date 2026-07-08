import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireTicketAccess } from '@/lib/ticket-access'

// Hands out a short-lived signed URL for a ticket-note attachment and redirects
// to it. Dual-gated via requireTicketAccess (admin, or the owning customer).
// The path must live under this ticket's prefix, so one ticket can't be used
// to fetch another's files.
//
// By default `download` forces the browser to save the file (with its original
// name). With ?disposition=inline AND a browser-safe type (image/PDF only), the
// download option is dropped so Storage serves it inline and the file renders in
// the in-app viewer (components/shared/AttachmentViewer). Everything else always
// downloads — office/zip/email are never served inline. The signed-URL TTL and
// ownership gate are identical in both cases; nothing is made public.
const INLINE_VIEWABLE = /\.(png|jpe?g|gif|webp|pdf)$/i

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireTicketAccess(params.id)
  if (auth instanceof NextResponse) return auth

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!path || !path.startsWith(`${params.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const name = (req.nextUrl.searchParams.get('name') || 'attachment').replace(/[\r\n"\\]/g, '').slice(0, 255)

  const inline = req.nextUrl.searchParams.get('disposition') === 'inline' && INLINE_VIEWABLE.test(path)
  const signOpts = inline ? undefined : { download: name }

  const { data, error } = await supabaseAdmin.storage
    .from('ticket-attachments')
    .createSignedUrl(path, 60, signOpts)

  if (error || !data) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl, 307)
}
