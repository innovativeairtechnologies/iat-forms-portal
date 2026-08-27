'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { clock, type Media } from '@/lib/post-production'
import { extForMime, uploadMedia } from './upload'

/* ────────────────────────────────────────────────────────────────────────────
   Tap once, talk while you walk, tap again.

   Two things run at the same time and they are independent on purpose:

     1. MediaRecorder captures the AUDIO. This is the record. It is uploaded to
        the private bucket and kept forever.
     2. The Web Speech API transcribes LIVE, so words appear as they are spoken.

   🔴 THE AUDIO IS THE ARTEFACT; THE TRANSCRIPT IS A CONVENIENCE. Dictation on a
   shop floor mishears — "react air" becomes "reactor", a plant name becomes a
   word salad — and it does it fluently enough that nobody notices reading it
   back. An engineer who disagrees with a finding can play the recording. Never
   "tidy this up" by dropping the audio once there is text.

   ── What each browser actually does ────────────────────────────────────────
   • Android Chrome — both work. Words stream in.
   • iOS Safari 14.5+ — both work, but recognition stops itself every few
     seconds; the onend handler restarts it while the recorder is still running,
     which is why that loop exists and must not be "simplified" away.
   • Anything else / permission denied — recording still works, or if even that
     is unavailable the component says so and the person types. The keyboard's
     own microphone key is always there, and this never becomes the only way to
     get words in.

   ⚠️ The waveform is requestAnimationFrame, which does not tick in a hidden or
   headless tab. That is cosmetic only — the recorder itself is unaffected — but
   it does mean a screenshot from an automated browser shows a flat bar.
   ──────────────────────────────────────────────────────────────────────────── */

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
}

function speechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function pickAudioMime(): string {
  // Order matters: Safari only offers audio/mp4, Chrome prefers opus in webm.
  // An empty string lets the browser choose, which is the right last resort.
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  if (typeof MediaRecorder === 'undefined') return ''
  return candidates.find(c => MediaRecorder.isTypeSupported(c)) ?? ''
}

export default function VoiceNote({
  onDone,
  onTranscript,
  transcriptionConfigured,
  uploadEndpoint,
  uploadBody,
}: {
  /** Called once the recording is stored. */
  onDone: (media: Media, previewUrl: string) => void
  /** Called with dictated text as it arrives, so the note fills in live. */
  onTranscript: (text: string) => void
  /** Whether a server-side transcription provider exists. Only changes the
   *  wording under the button — the recorder works either way. */
  transcriptionConfigured: boolean
  /** Route that mints the signed upload URL — differs between the signed-in walk
   *  and the no-login scan page. See uploadMedia. */
  uploadEndpoint: string
  /** Merged into the upload-url request. The no-login route refuses to mint a
   *  URL for bytes not destined for a note that sticker owns. */
  uploadBody?: Record<string, unknown>
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [heard, setHeard] = useState('')
  const [dictating, setDictating] = useState(false)

  /* 🔴 THE DICTATION CALLBACK MUST BE REACHED THROUGH A REF, NOT CLOSED OVER.
   *
   * start() builds the SpeechRecognition handlers once, and on iOS Safari
   * recognition ends itself on every pause for breath — so those handlers get
   * rebuilt and re-run many times during one recording. A handler that captured
   * `onTranscript` directly would keep calling the version from the render at
   * which recording started, which in turn computes "existing note + new words"
   * from the note as it was BEFORE the first sentence.
   *
   * The symptom is brutal and looks like the recorder is broken: every pause
   * wipes what you had already said, and anything typed by hand, replacing it
   * with just the newest phrase. Reported from a real phone 2026-08-27; fixed
   * here and in FindingCard's appendDictated, which needs the same treatment for
   * the note itself. Do not "simplify" either one back into a plain closure. */
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const wantRecogRef = useRef(false)
  const startedAtRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const teardown = useCallback(() => {
    wantRecogRef.current = false
    try { recogRef.current?.stop() } catch { /* already stopped */ }
    recogRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Release the microphone if the card unmounts mid-recording. A live mic
  // indicator that never goes away is the fastest way to lose somebody's trust
  // in a tool they run on their own phone.
  useEffect(() => () => teardown(), [teardown])

  useEffect(() => {
    if (state !== 'recording') return
    const t = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => clearInterval(t)
  }, [state])

  const drawMeter = (analyser: AnalyserNode) => {
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      analyser.getByteTimeDomainData(buf)

      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const bars = 28
      const step = Math.floor(buf.length / bars)
      // Read the token off the canvas element so the meter follows the theme —
      // no hex literal, and it flips correctly in dark mode.
      ctx.fillStyle = getComputedStyle(canvas).color
      for (let i = 0; i < bars; i++) {
        let peak = 0
        for (let j = 0; j < step; j++) peak = Math.max(peak, Math.abs(buf[i * step + j] - 128) / 128)
        const bh = Math.max(2, Math.min(h, peak * h * 2.2))
        ctx.fillRect(i * (w / bars) + 1, (h - bh) / 2, (w / bars) - 2, bh)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const start = async () => {
    setError(''); setHeard('')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('The microphone is not available. Type the note, or use the microphone key on your keyboard.')
      return
    }
    streamRef.current = stream

    const mime = pickAudioMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      teardown()
      setError('This browser cannot record audio. Type the note instead.')
      return
    }

    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
      const duration = Date.now() - startedAtRef.current
      teardown()

      // Under a second is a mis-tap, not a note. Uploading it would leave a
      // silent attachment on the finding forever.
      if (blob.size < 1200 || duration < 900) {
        setState('idle')
        setError('That was too short to keep.')
        return
      }

      setState('saving')
      const res = await uploadMedia('audio', blob, `note.${extForMime(blob.type, 'webm')}`, uploadEndpoint, { duration_ms: duration, extraBody: uploadBody })
      setState('idle')
      if (!res.ok) { setError(res.error); return }
      onDone(res.media, res.previewUrl)
    }

    startedAtRef.current = Date.now()
    setElapsed(0)
    rec.start()
    recorderRef.current = rec
    setState('recording')

    // Level meter.
    try {
      const AudioCtor = (window.AudioContext
        || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new AudioCtor()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
      drawMeter(analyser)
    } catch { /* the meter is decoration; never let it stop a recording */ }

    // Live dictation, if this browser has it.
    const Ctor = speechCtor()
    if (Ctor) {
      wantRecogRef.current = true
      const startRecog = () => {
        if (!wantRecogRef.current) return
        try {
          const r = new Ctor()
          r.continuous = true
          r.interimResults = true
          r.lang = 'en-US'
          r.onresult = e => {
            let finalText = ''
            let interim = ''
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const res = e.results[i]
              if (res.isFinal) finalText += res[0].transcript
              else interim += res[0].transcript
            }
            // ⚠️ Through the REF, never the captured prop. See the note above
            // onTranscriptRef — this closure is built once per recognition
            // instance and iOS rebuilds one on every pause.
            if (finalText.trim()) onTranscriptRef.current(finalText)
            setHeard(interim.trim())
          }
          // ⚠️ iOS Safari ends recognition on its own every few seconds. Restart
          // while the recorder is still running, or dictation stops after the
          // first sentence and the person thinks the feature is broken.
          r.onend = () => { setHeard(''); if (wantRecogRef.current) setTimeout(startRecog, 250) }
          r.onerror = ev => {
            // 'no-speech' and 'aborted' are normal in a noisy shop with pauses;
            // only a permission refusal is worth telling anybody about, and even
            // then the recording continues.
            if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
              wantRecogRef.current = false
              setDictating(false)
            }
          }
          r.start()
          recogRef.current = r
          setDictating(true)
        } catch { setDictating(false) }
      }
      startRecog()
    }
  }

  const stop = () => {
    wantRecogRef.current = false
    try { recogRef.current?.stop() } catch { /* already stopped */ }
    try { recorderRef.current?.stop() } catch { teardown(); setState('idle') }
  }

  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-surface-strong text-[13px] text-ink-secondary">
        <Loader2 size={16} className="animate-spin" /> Saving the recording…
      </span>
    )
  }

  if (state === 'recording') {
    return (
      <div className="w-full">
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 px-3 h-14">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <canvas
            ref={canvasRef}
            width={220}
            height={28}
            className="flex-1 min-w-0 h-7 text-rose-500 dark:text-rose-400"
          />
          <span className="tabular-nums text-[13px] font-medium text-rose-700 dark:text-rose-300 w-11 text-right">
            {clock(elapsed)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-600 text-white text-[13px] font-medium active:scale-[0.98] transition-transform"
          >
            <Square size={13} fill="currentColor" /> Stop
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-muted min-h-[16px] leading-snug">
          {heard ? <span className="italic">{heard}</span>
            : dictating ? 'Listening — words appear in the note as you talk.'
            : 'Recording. This device does not do live dictation, so the audio is saved for later.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-hairline-strong bg-surface text-[13.5px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink active:scale-[0.98] transition-all"
      >
        <Mic size={16} strokeWidth={1.75} /> Record a voice note
      </button>
      {error && <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400 leading-snug">{error}</p>}
      {!error && !transcriptionConfigured && (
        <p className="mt-1.5 text-[11.5px] text-ink-faint leading-snug">
          The recording is always kept. Text appears live where the device supports dictation.
        </p>
      )}
    </div>
  )
}
