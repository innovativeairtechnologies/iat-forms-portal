import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

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
  // A submission is a single DB insert; allow a healthy burst per IP.
  const limited = await rateLimit(req, { name: 'troubleshooting', max: 10, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()

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

    const { error: insertError } = await supabaseAdmin
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
        status: 'new',
      })

    if (insertError) {
      console.error('[troubleshooting] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, reference_number })
  } catch (err) {
    console.error('[troubleshooting] route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
