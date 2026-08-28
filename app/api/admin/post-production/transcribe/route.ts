import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { transcribeStoredAudio, transcriptionProvider } from '@/lib/transcribe'
import type { Media } from '@/lib/post-production'

/* POST /api/admin/post-production/transcribe — { finding_id, path } → { text }
 *
 * ⚠️ DORMANT IN PRODUCTION AS OF 2026-08-28. The portal has one AI key
 * (Anthropic) and the Claude API does not accept audio, so this returns **501
 * with a sentence a person can read** and the button that calls it does not
 * render. Setting OPENAI_API_KEY or DEEPGRAM_API_KEY in Vercel is the only thing
 * standing between this and working — see lib/transcribe.ts.
 *
 * ── Why this route persists the result itself ──────────────────────────────
 * Transcribing costs money at a third party. If the route only returned text and
 * left the client to save it, a dropped connection between the two would mean
 * paying for a transcript and losing it — and the obvious fix (retry) pays
 * again. So the write happens here, in the same request that spends the money.
 *
 * ── Why the transcript does not touch the note ─────────────────────────────
 * It lands on the MEDIA ENTRY, beside the recording. The note is what the walker
 * said in their own words; a transcript is a machine's second opinion on the
 * same audio, and an engineer weighing a finding needs to know which one they
 * are reading. Merging them is a human action, taken deliberately on the detail
 * page, and it stamps note_source = 'transcribed'.
 *
 * Takes a storage PATH, never bytes: a Vercel request body is capped at ~4.5MB
 * before route code runs, and the recording is already in the bucket anyway.
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
  const findingId = String(body?.finding_id ?? '')
  const path = String(body?.path ?? '')

  if (!findingId) return NextResponse.json({ error: 'Which finding?' }, { status: 400 })
  if (!/^audio\/\d{10,}-[a-z0-9]+\.[a-z0-9]{2,5}$/i.test(path)) {
    return NextResponse.json({ error: 'That is not a recording.' }, { status: 400 })
  }

  // The path must actually hang off this finding. Without this, the route would
  // transcribe any object in the bucket for anyone who could guess a path —
  // including recordings from another customer's unit.
  const { data: finding } = await supabaseAdmin
    .from('pp_findings').select('id, media').eq('id', findingId).maybeSingle()
  if (!finding) return NextResponse.json({ error: 'That finding no longer exists.' }, { status: 404 })

  const media = (Array.isArray(finding.media) ? finding.media : []) as Media[]
  const target = media.find(m => m.path === path && m.kind === 'audio')
  if (!target) return NextResponse.json({ error: 'That recording is not on this finding.' }, { status: 404 })

  const result = await transcribeStoredAudio(path)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status: result.reason === 'unconfigured' ? 501 : 422 },
    )
  }

  const now = new Date().toISOString()
  const next = media.map(m => (m.path === path
    ? { ...m, transcript: result.text.slice(0, 20000), transcribed_at: now, transcript_by: result.provider }
    : m))

  const { error } = await supabaseAdmin
    .from('pp_findings').update({ media: next, updated_at: now }).eq('id', findingId)
  if (error) {
    // The spend already happened, so hand the text back regardless — losing it
    // silently would be the worst of both outcomes.
    console.error('[post-production/transcribe] could not save the transcript:', error.message)
    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      saved: false,
      error: 'Transcribed, but it could not be saved. Copy it before leaving the page.',
    })
  }

  return NextResponse.json({ text: result.text, provider: result.provider, saved: true })
}
