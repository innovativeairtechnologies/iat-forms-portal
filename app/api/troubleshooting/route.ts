import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'
import { sendTroubleshootingCsAlert } from '@/lib/resend-troubleshooting'
import { isPublicBucketUrl, publicBucketPrefix } from '@/lib/public-storage'
import { verifyRecaptcha } from '@/lib/recaptcha'

// Retired path — the checklist merged into the Equipment Support ticket, so this
// endpoint only fires if something POSTs it directly. Kept in step with
// app/api/tickets/route.ts: one email, to the support desk, none to the customer.
const SUPPORT_DESK_EMAIL = 'crystal@dehumidifiers.com'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ONSET = ['sudden', 'gradual', 'unsure'] as const
const TRISTATE = ['yes', 'no', 'unsure'] as const

// Whitelist the external-factor options so a tampered client can't store junk.
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
//
// The prefix check lives in lib/public-storage.ts so the env is trimmed once —
// see that file for why an untrimmed prefix silently ate customer photos.
function validPhotoUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const kept = v.filter(u => isPublicBucketUrl(u, 'ticket-photos')).slice(0, 8) as string[]
  // A submission that uploaded photos and then stored none is the exact shape of
  // the 2026-08-13 data-loss bug. Never let that pass without a trace in the log.
  if (Array.isArray(v) && v.length > kept.length) {
    console.warn(
      `[troubleshooting] dropped ${v.length - kept.length} of ${v.length} photo URL(s) — not in our public bucket.`,
      { prefix: publicBucketPrefix('ticket-photos'), rejected: v.filter(u => !isPublicBucketUrl(u, 'ticket-photos')) },
    )
  }
  return kept
}

export async function POST(req: NextRequest) {
  // A submission is a single DB insert; allow a healthy burst per IP.
  const limited = await rateLimit(req, { name: 'troubleshooting', max: 10, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

    // Public, unauthenticated endpoint that writes a row, spends a model call and
    // sends mail — so it gets the same gate as /api/tickets (added 2026-08-13;
    // rate limiting alone was the only barrier before that).
    //
    // ⚠️ No live UI posts here: the checklist merged into the Equipment Support
    // ticket, /support/troubleshooting redirects to it, and
    // components/support/TroubleshootingChecklistForm.tsx is no longer rendered
    // anywhere. If that form is ever revived it must send a token generated with
    // action 'submit_troubleshooting', or every submit will 400.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'submit_troubleshooting')
    if (!recaptcha.ok) {
      console.warn('[troubleshooting] reCAPTCHA check failed:', recaptcha.reason)
      return NextResponse.json({ error: 'Please try again.' }, { status: 400 })
    }

    // ── Required-field backstop (client validates too, but never trust it) ──
    const customer_name = str(body.customer_name)
    const customer_email = str(body.customer_email)
    const serial_number = str(body.serial_number)
    const problem_description = str(body.problem_description)

    if (!customer_name || !customer_email || !serial_number || !problem_description) {
      return NextResponse.json(
        { error: 'Name, email, serial number, and problem description are required.' },
        { status: 400 }
      )
    }
    if (!EMAIL_RE.test(customer_email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    const ts = Date.now().toString().slice(-6)
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const reference_number = `TSC-${ts}-${rand}`

    const external_factors = Array.isArray(body.external_factors)
      ? body.external_factors.filter((f: unknown): f is string => typeof f === 'string' && EXTERNAL_FACTORS.includes(f))
      : []

    const photo_urls = validPhotoUrls(body.photo_urls)

    // AI tips: prefer the ones the in-form "AI Analysis" card already generated
    // (passed back on submit) — avoids a second model call and keeps them
    // consistent with what the customer just saw; generate here only if absent.
    let ai_recommendations = Array.isArray(body.ai_recommendations)
      ? body.ai_recommendations
          .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x: string) => x.trim().slice(0, 600))
          .slice(0, 3)
      : []
    if (ai_recommendations.length === 0) {
      ai_recommendations = await generateTroubleshootingTips(body)
    }

    const { data: intake, error: insertError } = await supabaseAdmin
      .from('troubleshooting_intakes')
      .insert({
        reference_number,
        customer_name,
        customer_company: str(body.customer_company),
        customer_email,
        customer_phone: str(body.customer_phone),
        serial_number,
        model_number: str(body.model_number),
        voltage: str(body.voltage),
        problem_description,
        problem_started: str(body.problem_started),
        onset: oneOf(body.onset, ONSET),
        what_changed: str(body.what_changed),
        unit_running: bool(body.unit_running),
        has_alarms: bool(body.has_alarms),
        alarm_details: str(body.alarm_details),
        process_airflow_cfm: str(body.process_airflow_cfm),
        react_airflow_cfm: str(body.react_airflow_cfm),
        react_temp_f: str(body.react_temp_f),
        wheel_rotating: oneOf(body.wheel_rotating, TRISTATE),
        seal_light_leakage: oneOf(body.seal_light_leakage, TRISTATE),
        external_factors: external_factors.length ? external_factors : null,
        photo_urls: photo_urls.length ? photo_urls : null,
        ai_recommendations: ai_recommendations.length ? ai_recommendations : null,
        status: 'new',
      })
      .select()
      .single()

    if (insertError || !intake) {
      console.error('[troubleshooting] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
    }

    // The one email: a support-desk heads-up. Awaited so Vercel doesn't kill the
    // function before Resend fires; failures log but never fail the case.
    const csRecipients = (process.env.SUPPORT_NOTIFICATION_EMAIL || SUPPORT_DESK_EMAIL)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    await sendTroubleshootingCsAlert(intake, csRecipients).catch(console.error)

    return NextResponse.json({ success: true, reference_number, ai_recommendations })
  } catch (err) {
    console.error('[troubleshooting] route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
