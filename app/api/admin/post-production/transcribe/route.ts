import { NextRequest, NextResponse } from 'next/server'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { transcribeStoredAudio, transcriptionProvider } from '@/lib/transcribe'

/* POST /api/admin/post-production/transcribe — { path } → { text }
 *
 * Takes a storage PATH, never bytes: a Vercel function caps its request body at
 * ~4.5MB and that cap is enforced before route code runs. The recording is
 * already in the private bucket by the time this is called.
 *
 * ⚠️ NOT CONFIGURED TODAY, and it says so rather than pretending. The portal has
 * one AI key (Anthropic) and the Claude API does not accept audio. This returns
 * 501 with a sentence a person can read until OPENAI_API_KEY or DEEPGRAM_API_KEY
 * exists — see lib/transcribe.ts. The walkaround page checks the same thing on
 * the server and never offers a button that cannot work.
 *
 * Live browser dictation is what produces text today, and the audio file is kept
 * regardless. That is the durable record; the transcript is a convenience.
 */
export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  if (!transcriptionProvider()) {
    return NextResponse.json({
      error: 'No transcription service is connected — the recording is saved as audio.',
      reason: 'unconfigured',
    }, { status: 501 })
  }

  const body = await req.json().catch(() => null)
  const path = String(body?.path ?? '')
  if (!/^audio\/\d{10,}-[a-z0-9]+\.[a-z0-9]{2,5}$/i.test(path)) {
    return NextResponse.json({ error: 'Invalid recording.' }, { status: 400 })
  }

  const result = await transcribeStoredAudio(path)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status: result.reason === 'unconfigured' ? 501 : 422 },
    )
  }
  return NextResponse.json({ text: result.text, provider: result.provider })
}
