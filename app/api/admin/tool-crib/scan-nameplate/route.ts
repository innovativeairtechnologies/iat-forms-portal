import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { requireToolCribAuth } from '@/lib/api-auth'
import { CRIB_CATEGORIES } from '@/lib/tool-crib'

/* Reads a photo of a tool's label / nameplate and pulls out the fields the Add
   Tool form wants, so a whole crib can be entered by pointing a phone at each
   tool instead of typing. Same shape as the equipment nameplate scanner
   (app/api/ocr-label) — client resizes the photo and posts a base64 data URL,
   Claude vision reads it, we prompt-and-parse a flat JSON object.

   Admin-gated (this feeds the admin registry), so no anonymous rate limit — the
   client-side resize + the size cap here are the only backstops needed. */

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedMedia = (typeof ALLOWED)[number]

function parseDataUrl(v: unknown): { media_type: AllowedMedia; data: string } | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) return null
  return { media_type: m[1] as AllowedMedia, data: m[2] }
}

const clean = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Snap a free-text category guess onto the fixed list, else drop it — a value
// off the list won't match the form's <select> and would silently blank out.
function snapCategory(v: unknown): string {
  const s = clean(v).toLowerCase()
  if (!s) return ''
  const hit = CRIB_CATEGORIES.find(c => c.toLowerCase() === s)
  return hit ?? ''
}

export async function POST(req: NextRequest) {
  const err = await requireToolCribAuth(); if (err) return err

  try {
    const body = await req.json().catch(() => null)
    const img = parseDataUrl(body?.image)
    if (!img) {
      return NextResponse.json({ error: 'Send a base64 image data URL (PNG, JPG, or WebP).' }, { status: 400 })
    }
    if (img.data.length > 6_000_000) {
      return NextResponse.json({ error: 'That photo is too large — try again.' }, { status: 413 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
            {
              type: 'text',
              text:
                'This is a photo of a hand or power tool — either its label/nameplate or the tool itself. ' +
                'Read whatever is legible and extract these fields:\n' +
                '- name: a short, human tool name someone would recognize on a shelf, e.g. "Milwaukee 1/2\\" Hammer Drill" or "Dewalt 20V Impact Driver". Compose it from the brand + tool type if there is no printed product name.\n' +
                '- make: the manufacturer / brand only, e.g. "Milwaukee", "Dewalt", "Bosch".\n' +
                '- model: the model or catalog number, e.g. "2904-20".\n' +
                '- serial: the serial number, if one is printed.\n' +
                `- category: choose the SINGLE best fit from EXACTLY this list, or "" if unsure: ${CRIB_CATEGORIES.join(', ')}.\n\n` +
                'Respond with ONLY a raw JSON object: {"name":"...","make":"...","model":"...","serial":"...","category":"..."}. ' +
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

    let parsed: { name?: string; make?: string; model?: string; serial?: string; category?: string }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that label. Enter the details manually." },
        { status: 422 }
      )
    }
    // JSON.parse("null") succeeds → parsed is null; dereferencing it below would
    // throw and turn a graceful 422 into a 500. Guard the shape.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Couldn't read that label. Enter the details manually." },
        { status: 422 }
      )
    }

    return NextResponse.json({
      name: clean(parsed.name),
      make: clean(parsed.make),
      model: clean(parsed.model),
      serial_number: clean(parsed.serial),
      category: snapCategory(parsed.category),
    })
  } catch (e) {
    console.error('[tool-crib/scan-nameplate] error:', e)
    return NextResponse.json(
      { error: 'Label scan failed. Enter the details manually.' },
      { status: 500 }
    )
  }
}
