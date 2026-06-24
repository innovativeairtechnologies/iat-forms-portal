import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdminAuth } from '@/lib/api-auth'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Roughly Vercel's ~4.5MB function body cap; base64 inflates the binary ~37%.
const MAX_BASE64_CHARS = 6_000_000

const SYSTEM_PROMPT = `You extract structured data from an IAT (Innovative Air Technologies) equipment "Submittal" — a sales/engineering document that wraps a dehumidifier unit's specs and the buying customer's details.

Return ONLY a valid JSON object. No markdown, no code fences, no commentary. Raw JSON only.

Exact structure:
{
  "company_name": string | null,        // the customer / buying company
  "primary_contact_name": string | null,// the customer contact person
  "contact_email": string | null,       // the customer contact's email
  "phone": string | null,               // the customer contact's phone
  "location": string | null,            // install / ship-to site (city, state is fine)
  "serial_number": string | null,       // the unit serial number
  "model_number": string | null,        // the unit model number
  "voltage": string | null,             // e.g. "460V/3ph/60Hz"
  "ship_date": string | null,           // ISO YYYY-MM-DD if a ship/delivery date is given
  "warranty_months": number | null,     // integer months if a warranty term is stated
  "notes": string | null                // any other useful unit detail, one short line
}

Rules:
- Extract ONLY what is actually present in the document. Use null for anything missing.
- NEVER invent or guess a serial number, model number, or email. Copy them verbatim.
- Normalize any date to ISO YYYY-MM-DD.
- Convert warranty terms to whole months ("1 year" → 12, "18 months" → 18). null if not stated.
- If the document covers more than one unit, extract the FIRST / primary unit only.
- Keep "notes" to a single short sentence, or null.`

type Extracted = {
  company_name: string | null
  primary_contact_name: string | null
  contact_email: string | null
  phone: string | null
  location: string | null
  serial_number: string | null
  model_number: string | null
  voltage: string | null
  ship_date: string | null
  warranty_months: number | null
  notes: string | null
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  try {
    const { file } = (await req.json()) as {
      file?: { data: string; media_type: string; name?: string }
    }

    if (!file?.data || !file?.media_type) {
      return NextResponse.json({ error: 'Attach the Submittal PDF (or an image of it).' }, { status: 400 })
    }
    if (file.data.length > MAX_BASE64_CHARS) {
      return NextResponse.json(
        { error: 'That file is too large to scan (max ~4MB). Try a smaller PDF or fill the fields in manually.' },
        { status: 413 }
      )
    }

    // Send the file to Claude as a native document/image block — reads text +
    // layout directly, far more reliable than client-side text extraction.
    const blocks: Anthropic.ContentBlockParam[] = []
    if (file.media_type === 'application/pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.data },
      })
    } else if (file.media_type.startsWith('image/')) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.media_type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
          data: file.data,
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Attach a PDF or an image (PNG, JPG).' },
        { status: 400 }
      )
    }
    blocks.push({ type: 'text', text: 'Extract the unit and customer details from this Submittal.' })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: blocks }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: Extracted
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('Submittal extraction was not valid JSON:', raw)
      return NextResponse.json(
        { error: "Couldn't read that Submittal automatically. You can still fill the fields in manually." },
        { status: 422 }
      )
    }

    // Light normalization / guard against unexpected shapes.
    const fields: Extracted = {
      company_name:         strOrNull(parsed.company_name),
      primary_contact_name: strOrNull(parsed.primary_contact_name),
      contact_email:        strOrNull(parsed.contact_email),
      phone:                strOrNull(parsed.phone),
      location:             strOrNull(parsed.location),
      serial_number:        strOrNull(parsed.serial_number),
      model_number:         strOrNull(parsed.model_number),
      voltage:              strOrNull(parsed.voltage),
      ship_date:            strOrNull(parsed.ship_date),
      warranty_months:      Number.isFinite(parsed.warranty_months as number) ? Number(parsed.warranty_months) : null,
      notes:                strOrNull(parsed.notes),
    }

    return NextResponse.json({ fields })
  } catch (err) {
    console.error('Submittal extraction error:', err)
    return NextResponse.json({ error: 'Something went wrong scanning the Submittal. Please try again.' }, { status: 500 })
  }
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}
