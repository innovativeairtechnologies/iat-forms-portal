import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 25 * 1024 * 1024

// Validate by EXTENSION, not MIME: browsers report .msg/.eml inconsistently
// (often application/octet-stream or empty), so the extension is the reliable
// signal. Same list the internal route uses.
const ALLOWED_EXT = new Set([
  'eml', 'msg',
  'pdf', 'txt', 'csv', 'rtf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic',
  'zip',
])

/**
 * Bridge: issue a one-shot signed UPLOAD url for a ticket attachment.
 *
 * Ticket media stays in the internal private `ticket-attachments` bucket — it is
 * not mirrored to the customer project — so the customer browser uploads bytes
 * straight to internal storage with this token. That also sidesteps Vercel's
 * ~4.5MB function body limit, which a proxied multipart upload would hit.
 *
 * The path is always prefixed with the ticket id, so a token can only ever write
 * inside the ticket the caller was authorized for.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket-attachment')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  const name = requireString(auth.body, 'name')
  const size = typeof auth.body.size === 'number' && Number.isFinite(auth.body.size) ? auth.body.size : 0

  if (!customerId || !ticketId) {
    return NextResponse.json({ error: 'Missing customerId or ticketId' }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })

  const owned = await getBridgeTicket(customerId, ticketId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type${ext ? ` (.${ext})` : ''}` }, { status: 400 })
  }

  const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('ticket-attachments')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[bridge/ticket-attachment] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }

  // signedUrl (not just the token) is what the CUSTOMER deployment needs: its
  // Supabase client points at the customer project, so it can't use
  // uploadToSignedUrl against this project. It PUTs the bytes to this absolute
  // URL instead. Returned as an absolute URL so the caller needs no knowledge of
  // our storage host.
  const signedUrl = new URL(
    data.signedUrl,
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '') + '/storage/v1/'
  ).toString()

  return NextResponse.json({ path, token: data.token, signedUrl })
}
