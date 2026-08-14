import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendRfqNotificationToSalesDesk } from '@/lib/resend-rfq'
import { applicationLabel, emptyRfq, type RfqData } from '@/lib/rfq'

// Public endpoint behind /support/rfq. Anonymous by design — the whole point of
// the wizard is that a stranger with a humidity problem can reach our desk in
// three minutes without an account.
//
// ── Where the desk alert goes ────────────────────────────────────────────────
// RFQ_NOTIFICATION_EMAIL (comma-separated) → SUPPORT_NOTIFICATION_EMAIL → the
// inside-sales default below.
//
// That middle step is the load-bearing one. Until dehumidifiers.com verifies in
// Resend, portal mail sends from Resend's SANDBOX address, which may only
// deliver to the Resend account owner — every other recipient is refused, and
// refused silently. That is what made six support tickets vanish between
// 2026-08-03 and 08-13. SUPPORT_NOTIFICATION_EMAIL is the stopgap that already
// points at an address which does deliver, so inheriting it means RFQ alerts
// arrive on day one with no new Vercel config, and both senders revert to their
// proper defaults together the moment that stopgap is deleted.
//
// The survey itself is committed before any mail is attempted, so a refused
// send never costs us the request — it is still in /admin/rfq either way.
const SALES_DESK_EMAIL = 'jacob@dehumidifiers.com'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Everything on the wire is untrusted. Rather than validate 60 fields one at a
// time, coerce the payload against a known-good empty record: every key that
// exists on RfqData is copied with its expected type, and anything else is
// dropped. A direct POST cannot smuggle extra columns or oversized blobs in.
const MAX_TEXT = 4000
const MAX_DOORS = 24

function coerce(raw: unknown): RfqData {
  const src = (raw ?? {}) as Record<string, unknown>
  const base = emptyRfq()
  const out = { ...base } as Record<string, unknown>

  for (const key of Object.keys(base) as (keyof RfqData)[]) {
    if (key === 'doors') continue
    const want = base[key]
    const got = src[key]
    if (typeof want === 'boolean') {
      if (typeof got === 'boolean') out[key] = got
    } else if (typeof want === 'string') {
      if (typeof got === 'string') out[key] = got.slice(0, MAX_TEXT)
      else if (typeof got === 'number' && Number.isFinite(got)) out[key] = String(got)
    }
  }

  const doors = Array.isArray(src.doors) ? src.doors.slice(0, MAX_DOORS) : []
  out.doors = doors
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d, i) => ({
      id: typeof d.id === 'string' ? d.id.slice(0, 40) : `d${i}`,
      label: typeof d.label === 'string' ? d.label.slice(0, 120) : 'Opening',
      widthFt: finite(d.widthFt),
      heightFt: finite(d.heightFt),
      opensPerHour: finite(d.opensPerHour),
      secondsOpen: finite(d.secondsOpen),
      exposure: d.exposure === 'Outdoor' ? 'Outdoor' : 'Surrounding space',
    }))

  out.track = src.track === 'process' ? 'process' : 'room'
  return out as unknown as RfqData
}

function finite(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  // Clamped rather than rejected: a nonsense door size should not lose a whole
  // survey, and the estimate is preliminary anyway.
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100000) : 0
}

/** The client's computed estimate, kept only if it is a flat, small JSON object. */
function coerceSummary(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const json = JSON.stringify(raw)
  if (json.length > 20000) return {}
  return JSON.parse(json) as Record<string, unknown>
}

export async function POST(req: NextRequest) {
  // A whole office can share one IP, and a person legitimately re-submits after
  // spotting a typo — so the window is generous but still bounded.
  const limited = await rateLimit(req, { name: 'rfq', max: 12, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

    // Fails open on a missing secret or a Google outage (lib/recaptcha.ts), so
    // this can never be the reason a real customer cannot reach us.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'submit_rfq')
    if (!recaptcha.ok) {
      return NextResponse.json({ error: 'Could not verify your submission. Please try again.' }, { status: 400 })
    }

    const data = coerce(body.data)
    const summary = coerceSummary(body.summary)

    if (!data.contactName.trim() || !EMAIL_RE.test(data.email.trim()) || !data.company.trim()) {
      return NextResponse.json({ error: 'Please give us your name, company and a valid email address.' }, { status: 400 })
    }
    if (!data.application) {
      return NextResponse.json({ error: 'Please choose an application.' }, { status: 400 })
    }

    // Atomic per-year sequence — two people pressing send at the same instant
    // cannot be issued the same reference. Falls back to a timestamp form only
    // if the RPC is unavailable, so a numbering hiccup never loses a survey.
    const year = new Date().getFullYear()
    const { data: seq, error: seqError } = await supabaseAdmin.rpc('next_rfq_number', { p_year: year })
    const reference = !seqError && typeof seq === 'number'
      ? `RFQ-${year}-${String(seq).padStart(4, '0')}`
      : `RFQ-${year}-${Date.now().toString().slice(-6)}`
    if (seqError) console.error('[rfq] next_rfq_number failed, using fallback reference:', seqError)

    // Best-effort identity stamp when a portal customer is signed in. Never
    // taken from the client — an anonymous poster must not be able to forge it.
    let submittedBy: string | null = null
    try {
      const supabase = await createSupabaseServer()
      const { data: { user } } = await supabase.auth.getUser()
      submittedBy = user?.id ?? null
    } catch {
      /* anonymous — the normal case */
    }

    const label = applicationLabel(data)

    const { data: saved, error } = await supabaseAdmin
      .from('rfq_requests')
      .insert({
        reference,
        track: data.track,
        application: data.application,
        application_label: label,
        company: data.company.trim(),
        contact_name: data.contactName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        project_name: data.projectName.trim(),
        location: data.location.trim(),
        date_required: data.dateRequired || null,
        data,
        summary,
        submitted_by: submittedBy,
      })
      .select('id, reference')
      .single()

    if (error || !saved) {
      console.error('[rfq] insert failed:', error)
      return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 })
    }

    // Desk heads-up. Awaited so Vercel does not kill the function mid-send, but a
    // mail failure never fails the request — the survey is already committed.
    const recipients = (
      process.env.RFQ_NOTIFICATION_EMAIL
      || process.env.SUPPORT_NOTIFICATION_EMAIL
      || SALES_DESK_EMAIL
    ).split(',').map(s => s.trim()).filter(Boolean)
    if (recipients.length) {
      await sendRfqNotificationToSalesDesk({ reference, data, summary, applicationLabel: label }, recipients)
        .catch(err => console.error('[rfq] desk notification failed:', err))
    } else {
      console.log('[rfq] no sales recipient configured — notification skipped')
    }

    return NextResponse.json({ success: true, id: saved.id, reference: saved.reference })
  } catch (err) {
    console.error('[rfq] route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
