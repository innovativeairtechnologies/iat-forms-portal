'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Loader2, Check, X, CameraOff, Keyboard } from 'lucide-react'
import { normalizeTagCode } from '@/lib/tool-crib'

type Result = { code: string; name: string | null; action: 'check_out' | 'check_in'; ok: true }
             | { code: string; error: string; ok: false }

/* PATH B — the continuous scanner, for taking several tools at once.
 *
 * Purely additive. Path A (the phone's own Camera app → /t/<code>) does not use
 * any of this, so if the decoder breaks, iOS changes the camera rules, or the
 * wasm won't load, the feature still works — you just tap labels one at a time.
 * That's the whole reason Path A exists.
 */
export default function ScannerClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const rafRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  // Codes we've already acted on this session, with when. Without this, a label
  // held in frame decodes ~30x/second and would fire 30 check-outs.
  const seenRef = useRef<Map<string, number>>(new Map())

  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [camError, setCamError] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [manual, setManual] = useState('')

  const submit = useCallback(async (code: string) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      // Check-out is the assumed intent; the endpoint flips to check-in when the
      // scanner already holds it, so one motion covers both directions.
      const res = await fetch('/api/tool-crib/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'check_out' }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setResults(r => [{ code, name: data.name, action: data.action, ok: true }, ...r])
        return
      }

      // 409 on check-out and it's already yours → they meant to return it.
      if (res.status === 409) {
        const back = await fetch('/api/tool-crib/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, action: 'check_in' }),
        })
        const bd = await back.json().catch(() => ({}))
        if (back.ok) {
          setResults(r => [{ code, name: bd.name, action: 'check_in', ok: true }, ...r])
          return
        }
      }
      setResults(r => [{ code, error: data.error || 'Failed', ok: false }, ...r])
    } finally {
      busyRef.current = false
    }
  }, [])

  const onCode = useCallback((raw: string) => {
    const code = normalizeTagCode(raw)
    if (!code) return
    const now = Date.now()
    const last = seenRef.current.get(code)
    if (last && now - last < 4000) return // debounce window per code
    seenRef.current.set(code, now)
    void submit(code)
  }, [submit])

  const start = useCallback(async () => {
    setStarting(true)
    setCamError('')
    try {
      // Lazy — keeps the ~1MB decoder out of every other page's bundle.
      const { createDetector, openRearCamera } = await import('@/lib/tool-crib-scanner')
      const detector = createDetector()
      const cam = await openRearCamera()
      stopRef.current = cam.stop

      const video = videoRef.current
      if (!video) { cam.stop(); return }
      video.srcObject = cam.stream
      await video.play()
      setRunning(true)
      setStarting(false)

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        try {
          const codes = await detector.detect(videoRef.current)
          for (const c of codes) if (c.rawValue) onCode(c.rawValue)
        } catch {
          // A single failed frame is normal (motion blur, bad light) — keep going.
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setStarting(false)
      const name = (err as { name?: string })?.name
      setCamError(
        name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow it in your browser settings, or type the code instead.'
          : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : !window.isSecureContext
              ? 'The camera needs a secure (https) connection.'
              : 'Couldn’t start the camera. Type the code instead.'
      )
    }
  }, [onCode])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    stopRef.current?.()
    stopRef.current = null
    setRunning(false)
  }, [])

  // Release the camera on unmount, or the indicator light stays on.
  useEffect(() => stop, [stop])

  const goManual = (e: React.FormEvent) => {
    e.preventDefault()
    const c = normalizeTagCode(manual)
    if (!c) return
    setManual('')
    void submit(c)
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
        {/* playsInline + muted are load-bearing on iOS: without them Safari
            either refuses to play inline or takes the video fullscreen. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${running ? '' : 'opacity-0'}`}
        />

        {running && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-2/3 aspect-square border-2 border-white/70 rounded-xl" />
          </div>
        )}

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {camError ? (
              <>
                <CameraOff size={30} className="text-white/50" />
                <p className="text-[13px] text-white/70">{camError}</p>
              </>
            ) : (
              <>
                <Camera size={30} className="text-white/50" />
                <p className="text-[13px] text-white/60">
                  Point the camera at a tool label.
                </p>
              </>
            )}
            {/* Start MUST be a tap: iOS rejects getUserMedia outside a user
                gesture, and the failure is indistinguishable from a denial. */}
            <button
              onClick={start}
              disabled={starting}
              className="h-12 px-6 flex items-center gap-2 text-[15px] font-semibold bg-brand hover:bg-brand-hover text-brand-ink rounded-lg transition-colors disabled:opacity-60"
            >
              {starting ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
              {starting ? 'Starting…' : camError ? 'Try again' : 'Start camera'}
            </button>
          </div>
        )}

        {running && (
          <button
            onClick={stop}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white"
            aria-label="Stop camera"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <form onSubmit={goManual} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          <input
            value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder="Type a code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-11 pl-9 pr-3 text-[16px] bg-surface border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 font-mono"
          />
        </div>
        <button type="submit"
          className="px-4 h-11 text-[14px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
          Go
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-5 bg-surface border border-hairline rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <div key={`${r.code}-${i}`}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                r.ok ? 'bg-brand-soft text-brand' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
              }`}>
                {r.ok ? <Check size={14} /> : <X size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink truncate" style={{ fontWeight: 600 }}>
                  {r.ok ? (r.name ?? r.code) : r.code}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {r.ok ? (r.action === 'check_out' ? 'Checked out to you' : 'Checked back in') : r.error}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/tool-crib"
        className="mt-3 h-11 flex items-center justify-center text-[14px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
        Done
      </Link>
    </div>
  )
}
