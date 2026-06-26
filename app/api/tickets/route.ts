import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveViewedKbArticles } from '@/lib/kb'
import type { ViewedKbArticle } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'
import { sendTicketConfirmationToCustomer, sendTicketNotificationToAdmins } from '@/lib/resend-tickets'

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
  // Tight window: each ticket is a DB insert + a Claude call + two emails.
  const limited = await rateLimit(req, { name: 'tickets', max: 5, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

    // Ticket number: IAT-YYYY-NNNN, sequential per year (migration 029). The DB
    // generates the next value atomically so concurrent tickets can't collide. If
    // the RPC isn't there yet (migration not run) we fall back to a timestamp-based
    // number so a ticket is never lost — it just won't be sequential until applied.
    const year = new Date().getFullYear()
    let ticket_number: string
    const { data: seq, error: seqError } = await supabaseAdmin.rpc('next_ticket_number', { p_year: year })
    if (seqError || typeof seq !== 'number') {
      console.error('[tickets] next_ticket_number RPC failed — using fallback number:', seqError)
      ticket_number = `IAT-${year}-${Date.now().toString().slice(-5)}`
    } else {
      ticket_number = `IAT-${year}-${String(seq).padStart(4, '0')}`
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
        customer_company: body.customer_company || null,
        customer_email: body.customer_email,
        customer_phone: body.customer_phone || null,
        serial_number: body.serial_number,
        model_number: body.model_number,
        voltage: body.voltage,
        problem_description: body.problem_description,
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
          customer_company: body.customer_company || null,
          customer_name:    body.customer_name || null,
          customer_email:   body.customer_email || null,
          customer_phone:   body.customer_phone || null,
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

    // Email loop — customer confirmation + staff notification. Awaited so
    // Vercel doesn't kill the function before Resend fires; failures are
    // logged but never fail the ticket.
    const fullTicket = { ...ticket, ai_recommendations: ai_recommendations.length ? ai_recommendations : null }

    const { data: admins } = await supabaseAdmin
      .from('employees')
      .select('email')
      .eq('is_admin', true)
    const adminEmails = admins?.map(a => a.email) ?? []
    const fallback = process.env.ADMIN_NOTIFICATION_EMAIL
    if (fallback && !adminEmails.includes(fallback)) adminEmails.push(fallback)

    await Promise.all([
      sendTicketConfirmationToCustomer(fullTicket).catch(console.error),
      adminEmails.length
        ? sendTicketNotificationToAdmins(fullTicket, adminEmails).catch(console.error)
        : Promise.resolve(console.log('[tickets] no admin recipients configured — staff notification skipped')),
    ])

    return NextResponse.json({ success: true, ticket_number, ai_recommendations })
  } catch (err) {
    console.error('Ticket route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
