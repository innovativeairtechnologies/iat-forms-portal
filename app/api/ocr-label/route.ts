import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'

// Reads an equipment nameplate photo and pulls out serial / model / voltage so
// the customer (often a contractor or 3rd-party tech) doesn't have to transcribe
// it by hand. Public + unauthenticated like the rest of the support wizard, so
// it's rate-limited and the image is size-capped. The client resizes before
// sending; this just backstops the body size.

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedMedia = (typeof ALLOWED)[number]

// "data:image/jpeg;base64,XXXX" → { media_type, data }
function parseDataUrl(v: unknown): { media_type: AllowedMedia; data: string } | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  return { media_type: m[1] as AllowedMedia, data: m[2] }
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 120) : '')

export async function POST(req: NextRequest) {
  // Tight: each call is a vision request to Claude. Anonymous endpoint.
  const limited = await rateLimit(req, { name: 'ocr-label', max: 12, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'ocr_label')
    if (!recaptcha.ok) {
      return NextResponse.json({ error: 'Could not verify the request. Please enter the details manually.' }, { status: 400 })
    }
    const img = parseDataUrl(body.image)
    if (!img) {
      return NextResponse.json({ error: 'Send a base64 image data URL (PNG, JPG, or WebP).' }, { status: 400 })
    }
    // ~6 MB of base64 (~4.5 MB binary). The client downsizes to ~1600px first.
    if (img.data.length > 6_000_000) {
      return NextResponse.json({ error: 'That photo is too large — try again.' }, { status: 413 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
            {
              type: 'text',
              text:
                'This is a photo of the nameplate/data label on an industrial dehumidification unit (IAT or US Rotors). ' +
                'Read the label and extract these fields:\n' +
                '- serial_number\n- model_number\n- voltage (operating voltage, e.g. "460V / 3-phase")\n\n' +
                'Respond with ONLY a raw JSON object: {"serial_number":"...","model_number":"...","voltage":"..."}. ' +
                'Use an empty string for any field you cannot read with confidence. No markdown, no commentary.',
            },
          ],
        },
      ],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: { serial_number?: string; model_number?: string; voltage?: string }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Couldn't read the label. Please enter the details manually." },
        { status: 422 }
      )
    }

    return NextResponse.json({
      serial_number: clean(parsed.serial_number),
      model_number: clean(parsed.model_number),
      voltage: clean(parsed.voltage),
    })
  } catch (err) {
    console.error('[ocr-label] error:', err)
    return NextResponse.json(
      { error: 'Label scan failed. Please enter the details manually.' },
      { status: 500 }
    )
  }
}
