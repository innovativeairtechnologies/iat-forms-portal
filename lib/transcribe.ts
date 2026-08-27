import 'server-only'
import { supabaseAdmin } from './supabase-admin'

/* ────────────────────────────────────────────────────────────────────────────
   lib/transcribe.ts — turning a recorded voice note into text.

   ⚠️ READ THIS BEFORE ASSUMING THIS WORKS. As of 2026-08-27 the portal has ONE
   AI key, ANTHROPIC_API_KEY, and the Claude API does not accept audio. There is
   therefore NO server-side transcription configured, and this module returns
   `{ ok: false, reason: 'unconfigured' }` on every call until somebody adds a
   provider key. That is the honest state, not a bug, and the UI says so in
   words rather than showing a spinner that never resolves.

   ── What actually produces text today ──────────────────────────────────────
   Two things, both in the browser, and both good enough that this module is a
   bonus rather than a dependency:

     1. Live dictation via the Web Speech API while the recording runs — the
        text appears as the person talks, on Android Chrome and iOS Safari.
     2. The phone keyboard's own microphone key, which works everywhere and
        always has.

   And in every case THE AUDIO FILE IS KEPT. That is the part that matters. A
   transcript is a machine's guess at what somebody said next to a running unit,
   and it will occasionally be wrong in a way that reads perfectly fluently. An
   engineer who disagrees with a finding can play the recording. Never "clean up"
   this design by dropping the audio once text exists.

   ── Adding a provider later ────────────────────────────────────────────────
   Set ONE of these in Vercel and this module starts working with no other
   change. Nothing else in the app needs editing.

     OPENAI_API_KEY    — Whisper (whisper-1), ~$0.006/minute
     DEEPGRAM_API_KEY  — Deepgram nova-3

   ── Why this fetches from Storage instead of taking the bytes ──────────────
   A Vercel function caps its request body at ~4.5MB, and that cap is enforced
   before route code runs, so an in-route size check never executes. The client
   uploads the audio straight to the private bucket (signed upload URL) and posts
   only the PATH here; this module pulls the object with the service role and
   forwards it. Same reasoning as every other upload path in the app.
   ──────────────────────────────────────────────────────────────────────────── */

const BUCKET = 'post-production'

/** Providers are capped well below their real limits — a voice note taken while
 *  walking a unit is seconds to a couple of minutes, and anything an order of
 *  magnitude past that is a mis-click, not a recording. */
const MAX_AUDIO_BYTES = 24 * 1024 * 1024

export type TranscribeProvider = 'openai' | 'deepgram'

export type TranscribeResult =
  | { ok: true; text: string; provider: TranscribeProvider }
  | { ok: false; reason: 'unconfigured' | 'too_large' | 'not_found' | 'failed'; message: string }

/** Which provider is wired, if any. Exported so a page can tell the truth about
 *  what the microphone button will and will not do BEFORE somebody records two
 *  minutes of observations expecting text out the other end. */
export function transcriptionProvider(): TranscribeProvider | null {
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.DEEPGRAM_API_KEY) return 'deepgram'
  return null
}

export const isTranscriptionConfigured = () => transcriptionProvider() !== null

/**
 * Transcribe one stored audio object.
 *
 * Never throws — every failure comes back as a typed reason the caller can put
 * in front of a person. A voice note that could not be transcribed is still a
 * voice note, and the finding it belongs to is still perfectly usable; this
 * failing must never fail the save.
 */
export async function transcribeStoredAudio(path: string): Promise<TranscribeResult> {
  const provider = transcriptionProvider()
  if (!provider) {
    return {
      ok: false,
      reason: 'unconfigured',
      message: 'No transcription service is connected, so the recording is saved as audio only.',
    }
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) {
    return { ok: false, reason: 'not_found', message: 'That recording could not be read back.' }
  }
  if (data.size > MAX_AUDIO_BYTES) {
    return { ok: false, reason: 'too_large', message: 'That recording is too long to transcribe.' }
  }

  try {
    const text = provider === 'openai'
      ? await viaOpenAI(data, path)
      : await viaDeepgram(data)
    const clean = text.trim()
    if (!clean) return { ok: false, reason: 'failed', message: 'Nothing could be made out in that recording.' }
    return { ok: true, text: clean, provider }
  } catch (err) {
    console.error('[transcribe] provider call failed:', err)
    return { ok: false, reason: 'failed', message: 'The transcription service did not answer.' }
  }
}

async function viaOpenAI(blob: Blob, path: string): Promise<string> {
  const form = new FormData()
  // Whisper picks its decoder off the filename extension, so the stored path's
  // extension has to survive the hand-off. A blob posted as "blob" is rejected.
  form.append('file', blob, path.split('/').pop() || 'audio.m4a')
  form.append('model', 'whisper-1')
  // The walk is in English and the vocabulary is HVAC. Naming the language stops
  // a short, noisy clip being auto-detected as something else entirely, which is
  // Whisper's most common failure on a shop floor.
  form.append('language', 'en')
  form.append(
    'prompt',
    'Post-production walkaround of an industrial desiccant dehumidifier. Terms: desiccant wheel, ' +
    'reactivation, laminar airflow, damper, filter rack, plenum, coil, VFD, humidistat, gasket, weldment.',
  )

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text().catch(() => '')}`)
  const json = (await res.json()) as { text?: string }
  return json.text ?? ''
}

async function viaDeepgram(blob: Blob): Promise<string> {
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en', {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': blob.type || 'audio/mp4',
    },
    body: await blob.arrayBuffer(),
  })
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${await res.text().catch(() => '')}`)
  const json = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] }
  }
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}
