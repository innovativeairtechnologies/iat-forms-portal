import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveViewedKbArticles } from '@/lib/kb'
import type { ViewedKbArticle } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'
import { sendTicketNotificationToSupportDesk } from '@/lib/resend-tickets'
import { sendTicketConfirmationToCustomer } from '@/lib/resend-customer-tickets'
import { formatTicketNumber, fallbackTicketSeq } from '@/lib/ticket-number'

// A support submission sends a heads-up to the support desk so they know a ticket
// came through (decision 2026-08-03). The admin roster is deliberately NOT mailed —
// don't re-plumb getAdminRecipients()/ADMIN_NOTIFICATION_EMAIL back in here.
// SUPPORT_NOTIFICATION_EMAIL (comma-separated) redirects or widens the list from
// Vercel without a deploy.
//
// A customer confirmation is ALSO sent, but it ships INERT: sendTicketConfirmation-
// ToCustomer() is a no-op unless CUSTOMER_TICKET_EMAILS === "on" (see
// lib/resend-customer-tickets.ts). With the switch unset — its default — this route
// behaves exactly as the desk-only version did. Do not remove the call thinking the
// 2026-08-03 "no customer confirmation" decision still stands; the owner reversed it
// 2026-08-12, gated on the email-domain cutover.
// A shared mailbox on purpose, never an individual. Support has to keep working
// when someone is on holiday, off sick, or has left — a personal address is a
// single point of failure that nobody notices until a ticket goes unanswered.
// SUPPORT_NOTIFICATION_EMAIL (comma-separated) can widen or redirect this from
// Vercel without a deploy; this constant is only the floor it falls back to.
const SUPPORT_DESK_EMAIL = 'iatsupport@dehumidifiers.com'

// Minimum problem description. Mirrors MIN_PROBLEM_CHARS in the support wizard.
const MIN_PROBLEM_CHARS = 100

// ── Merged-field validation (the unified support form carries the old
// Troubleshooting Checklist fields too). Mirrors app/api/troubleshooting/route.ts.
const ONSET = ['sudden', 'gradual', 'unsure'] as const
const TRISTATE = ['yes', 'no', 'unsure'] as const
const EXTERNAL_FACTORS = [
  'Room construction changes',
  'Door openings',
  'People load change',
  'Process moisture load change',
  'Building pressure',
  'New equipment / process changes',
  'Weather changes',
]
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const bool = (v: unknown) => (typeof v === 'boolean' ? v : null)
const oneOf = <T extends readonly string[]>(v: unknown, allowed: T): T[number] | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T[number]) : null

// Photos must be https links into our own public storage bucket. Anything else
// (javascript:/data:/external host) is dropped, so a direct POST to this public
// endpoint can't seed the table with malicious or off-site URLs. Also caps the
// count to the client's contract so a flood can't bloat the row.
const PHOTO_URL_PREFIX =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/ticket-photos/`

function validPhotoUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((u): u is string => typeof u === 'string')
    .filter(u => {
      try { return new URL(u).protocol === 'https:' && u.startsWith(PHOTO_URL_PREFIX) }
      catch { return false }
    })
    .slice(0, 8)
}

export async function POST(req: NextRequest) {
  // Tight window: each ticket is a DB insert + a Claude call + an email.
  const limited = await rateLimit(req, { name: 'tickets', max: 5, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'submit_ticket')
    if (!recaptcha.ok) {
      console.warn('[tickets] reCAPTCHA check failed:', recaptcha.reason)
      return NextResponse.json({ error: 'Please try again.' }, { status: 400 })
    }

    // Intake quality gates (owner decision 2026-08-17). The wizard enforces the
    // same three rules step by step; this is the backstop, because the endpoint
    // is public and unauthenticated. Kept in sync with MIN_PROBLEM_CHARS /
    // phoneOk() in components/support/EquipmentTicketForm.tsx.
    const customerCompany = String(body.customer_company ?? '').trim()
    const customerPhone = String(body.customer_phone ?? '').trim()
    const problemDescription = String(body.problem_description ?? '').trim()

    if (!customerCompany) {
      return NextResponse.json({ error: 'Please tell us your company or organization.' }, { status: 400 })
    }
    if ((customerPhone.match(/\d/g) || []).length < 10) {
      return NextResponse.json({ error: 'Please give us a phone number we can reach you on.' }, { status: 400 })
    }
    if (problemDescription.length < MIN_PROBLEM_CHARS) {
      return NextResponse.json(
        { error: `Please describe the problem in at least ${MIN_PROBLEM_CHARS} characters so our team can help.` },
        { status: 400 }
      )
    }

    // Ticket number: IAT-SSSS-NNNN — last 4 of the unit serial, then a global
    // counter (migration 092). The DB issues NNNN atomically via a sequence, and
    // ALL uniqueness rests on it: the serial tag is context only, since one unit
    // files many tickets and two units can share their last four characters.
    // If the RPC isn't there yet (migration not run) we fall back to a
    // timestamp-based number so a ticket is never lost.
    let ticket_number: string
    const { data: seq, error: seqError } = await supabaseAdmin.rpc('next_ticket_seq')
    if (seqError || typeof seq !== 'number') {
      console.error('[tickets] next_ticket_seq RPC failed — using fallback number:', seqError)
      ticket_number = formatTicketNumber(body.serial_number, fallbackTicketSeq())
    } else {
      ticket_number = formatTicketNumber(body.serial_number, seq)
    }

    // KB articles the customer viewed before submitting (recorded in their
    // browser). Validate against published articles so stored titles are
    // trustworthy. Non-fatal — a lookup hiccup must not block the ticket.
    let viewed_kb_articles: ViewedKbArticle[] | null = null
    try {
      const resolved = await resolveViewedKbArticles(body.viewed_kb_articles)
      if (resolved.length > 0) viewed_kb_articles = resolved
    } catch (kbErr) {
      console.error('[tickets] viewed KB articles resolve failed:', kbErr)
    }

    const photo_urls = validPhotoUrls(body.photo_urls)
    const external_factors = Array.isArray(body.external_factors)
      ? body.external_factors.filter((f: unknown): f is string => typeof f === 'string' && EXTERNAL_FACTORS.includes(f))
      : []

    const { data: ticket, error: insertError } = await supabaseAdmin
      .from('tickets')
      .insert({
        ticket_number,
        customer_name: body.customer_name,
        customer_company: customerCompany,
        customer_email: body.customer_email,
        customer_phone: customerPhone,
        serial_number: body.serial_number,
        model_number: body.model_number,
        voltage: body.voltage,
        problem_description: problemDescription,
        pre_cooling: body.pre_cooling ?? null,
        pre_cooling_type: body.pre_cooling_type || null,
        pre_cooling_working: body.pre_cooling_working ?? null,
        post_cooling: body.post_cooling ?? null,
        post_cooling_type: body.post_cooling_type || null,
        post_cooling_working: body.post_cooling_working ?? null,
        airflow_balanced: body.airflow_balanced ?? null,
        process_airflow_cfm: body.process_airflow_cfm || null,
        react_airflow_cfm: body.react_airflow_cfm || null,
        react_heat_working: body.react_heat_working ?? null,
        react_heat_setpoint: body.react_heat_setpoint ?? null,
        react_temp_f: str(body.react_temp_f),
        seals_good: body.seals_good ?? null,
        // Merged-in Troubleshooting Checklist fields (migration 027)
        problem_started: str(body.problem_started),
        onset: oneOf(body.onset, ONSET),
        what_changed: str(body.what_changed),
        unit_running: bool(body.unit_running),
        has_alarms: bool(body.has_alarms),
        alarm_details: str(body.alarm_details),
        wheel_rotating: oneOf(body.wheel_rotating, TRISTATE),
        seal_light_leakage: oneOf(body.seal_light_leakage, TRISTATE),
        external_factors: external_factors.length ? external_factors : null,
        photo_urls: photo_urls.length ? photo_urls : null,
        viewed_kb_articles,
        brand: body.brand === 'us_rotors' ? 'us_rotors' : 'iat',
        status: 'open',
        priority: 'med',
      })
      .select()
      .single()

    if (insertError || !ticket) {
      console.error('Ticket insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    // Equipment registry: auto-accrue the unit the first time we see its serial.
    // Upsert with ignoreDuplicates so an existing (possibly hand-edited) record is
    // never clobbered. Non-fatal — a registry hiccup must not fail the ticket.
    const eqSerial = (body.serial_number || '').trim()
    if (eqSerial) {
      try {
        await supabaseAdmin.from('equipment').upsert({
          serial_number:    eqSerial,
          model_number:     body.model_number || null,
          voltage:          body.voltage || null,
          customer_company: customerCompany,
          customer_name:    body.customer_name || null,
          customer_email:   body.customer_email || null,
          customer_phone:   customerPhone,
        }, { onConflict: 'serial_number', ignoreDuplicates: true })
      } catch (eqErr) {
        console.error('[tickets] equipment auto-accrue failed:', eqErr)
      }
    }

    // Prefer the tips the in-form "AI Analysis" step already generated (sent back
    // on submit) — avoids a second model call and keeps them consistent with what
    // the customer just saw; generate here only if absent.
    let ai_recommendations: string[] = Array.isArray(body.ai_recommendations)
      ? body.ai_recommendations
          .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x: string) => x.trim().slice(0, 600))
          .slice(0, 3)
      : []
    if (ai_recommendations.length === 0) {
      ai_recommendations = await generateTroubleshootingTips(body)
    }

    if (ai_recommendations.length > 0) {
      await supabaseAdmin
        .from('tickets')
        .update({ ai_recommendations })
        .eq('id', ticket.id)
    }

    // The one email: a support-desk heads-up. Awaited so Vercel doesn't kill the
    // function before Resend fires; a failure is logged but never fails the
    // ticket, which is already committed above.
    const fullTicket = { ...ticket, ai_recommendations: ai_recommendations.length ? ai_recommendations : null }

    const supportRecipients = (process.env.SUPPORT_NOTIFICATION_EMAIL || SUPPORT_DESK_EMAIL)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    if (supportRecipients.length) {
      await sendTicketNotificationToSupportDesk(fullTicket, supportRecipients).catch(console.error)
    } else {
      console.log('[tickets] no support recipient configured — notification skipped')
    }

    // Customer confirmation — no-op unless CUSTOMER_TICKET_EMAILS === "on". Never
    // fails the ticket (already committed above); a send error is only logged.
    await sendTicketConfirmationToCustomer(fullTicket).catch(console.error)

    return NextResponse.json({ success: true, ticket_number, ai_recommendations })
  } catch (err) {
    console.error('Ticket route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
