import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/* Resend webhook → permanent email history.

   Resend keeps email logs only ~30 days and its webhooks are ephemeral, so we
   capture every lifecycle event here and store one row per email (keyed on the
   Resend email_id) in email_events (migration 049). The /admin/audit "Emails"
   tab reads that table — the portal owns the history forever, independent of
   Resend's retention.

   Security: Resend signs webhooks via Svix. We verify the svix-id /
   svix-timestamp / svix-signature headers against RESEND_WEBHOOK_SECRET over
   the RAW request body before trusting anything. No secret set, or a bad
   signature → 401 (nothing is captured until the webhook is registered in the
   Resend dashboard and the secret lives in Vercel — the "build now, enable
   later" posture).

   No send-site changes are needed: every email in the app already goes through
   Resend, so capturing at the webhook covers 100% of outbound mail. */

// Lifecycle rank — the row's status only ever moves FORWARD, so a late
// `delivered` can't clobber a terminal `bounced`/`complained`, and an `opened`
// isn't downgraded by a straggler `delivered`. Higher wins.
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  complained: 6,
  bounced: 7,
}

// Resend event type (e.g. "email.delivered") → our status key.
function statusFromType(type: string): string | null {
  if (!type.startsWith('email.')) return null
  const key = type.slice('email.'.length)
  return key in STATUS_RANK ? key : null
}

type EmailEventRow = {
  email_id: string
  to_addresses: string[]
  from_address: string | null
  subject: string | null
  status: string
  last_event: string
  sent_at: string | null
  last_event_at: string
  bounce_detail: string | null
  raw: unknown
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 })
  }

  // Verify the Svix signature over the raw body.
  const body = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let event: { type?: string; created_at?: string; data?: Record<string, unknown> }
  try {
    event = new Webhook(secret).verify(body, headers) as typeof event
  } catch (err) {
    console.error('[resend-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const type = event.type || ''
  const status = statusFromType(type)
  // Valid, signed, but not an event we track — ack so Resend stops retrying.
  if (!status) {
    return NextResponse.json({ ok: true, ignored: type || 'unknown' })
  }

  const data = (event.data || {}) as Record<string, unknown>
  const emailId = typeof data.email_id === 'string' ? data.email_id : null
  if (!emailId) {
    // Signed but malformed — ack rather than trigger endless retries.
    return NextResponse.json({ ok: true, ignored: 'missing email_id' })
  }

  const to = Array.isArray(data.to)
    ? (data.to as unknown[]).filter((x): x is string => typeof x === 'string')
    : typeof data.to === 'string'
      ? [data.to]
      : []
  const from = typeof data.from === 'string' ? data.from : null
  const subject = typeof data.subject === 'string' ? data.subject : null
  const eventAt = event.created_at || new Date().toISOString()

  // Bounce / complaint reason, when Resend includes one.
  let bounceDetail: string | null = null
  const bounce = data.bounce as Record<string, unknown> | undefined
  if (bounce && typeof bounce === 'object') {
    const parts = [bounce.type, bounce.subType, bounce.message].filter(
      (x): x is string => typeof x === 'string',
    )
    if (parts.length) bounceDetail = parts.join(' · ')
  }

  try {
    // Read the current row (if any) to decide whether this event advances it.
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('email_events')
      .select('status, sent_at, bounce_detail')
      .eq('email_id', emailId)
      .maybeSingle()

    if (readErr) throw readErr

    const currentRank = existing ? STATUS_RANK[existing.status] ?? 0 : 0
    const incomingRank = STATUS_RANK[status] ?? 0
    const advances = incomingRank >= currentRank

    const row: EmailEventRow = {
      email_id: emailId,
      to_addresses: to,
      from_address: from,
      subject,
      // Only move the status forward; keep the terminal one otherwise.
      status: advances && existing ? status : existing ? existing.status : status,
      last_event: type,
      // Preserve the first email.sent timestamp once we have it.
      sent_at: existing?.sent_at ?? (status === 'sent' ? eventAt : null),
      last_event_at: eventAt,
      // Keep a previously-captured bounce/complaint reason if this event has none.
      bounce_detail: bounceDetail ?? existing?.bounce_detail ?? null,
      raw: event,
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('email_events')
      .upsert(row, { onConflict: 'email_id' })

    if (upsertErr) throw upsertErr

    return NextResponse.json({ ok: true, email_id: emailId, status: row.status })
  } catch (err) {
    console.error('[resend-webhook] failed to persist event:', err)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }
}
