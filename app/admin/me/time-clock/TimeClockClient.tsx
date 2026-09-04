'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, MapPin, Coffee, LogOut, Play, Briefcase, Check, TriangleAlert, RefreshCw } from 'lucide-react'
import { hhmm, minutesBetween, stateOf, type ClockState, type PunchAction, type Segment, type Shift } from '@/lib/time-clock'

/* ════════════════════════════════════════════════════════════════════════════
   THE PUNCH SCREEN

   The whole budget is five to ten seconds, standing at the door with a phone in
   one hand. Three things buy that:

   1. GEOLOCATION IS REQUESTED ON MOUNT, not on tap. A GPS fix takes two to eight
      seconds; asking for it when the thumb lands would spend the entire budget
      watching a spinner. It is requested in parallel with the state fetch, so by
      the time the page has painted the fix is usually already in hand.
   2. ONE BUTTON, sized for a thumb and a work glove. The state decides which one
      — an impossible action is never drawn, so there is nothing to read.
   3. THE JOB IS OPTIONAL AND BELOW THE FOLD OF ATTENTION. Clocking in never waits
      on it. Recent jobs are one tap.

   ⚠️ Nothing here decides whether you are inside the fence. The browser reports
   coordinates; the server compares them to the site. See the route.
   ════════════════════════════════════════════════════════════════════════════ */

type Site = { label: string; radius_m: number; enforced: boolean }
type Payload = {
  state: ClockState
  allowed: PunchAction[]
  shift: Shift | null
  openSegment: Segment | null
  segments: Segment[]
  site: Site
}

type Fix = { lat: number; lng: number; accuracy_m: number } | null

const LABEL: Record<PunchAction, string> = {
  clock_in: 'Clock in',
  clock_out: 'Clock out',
  lunch_start: 'Start lunch',
  lunch_end: 'End lunch',
  break_start: 'Start break',
  break_end: 'End break',
  switch_job: 'Switch job',
}

export default function TimeClockClient({ firstName, recentJobs }: { firstName: string; recentJobs: string[] }) {
  const [data, setData] = useState<Payload | null>(null)
  const [fix, setFix] = useState<Fix>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [busy, setBusy] = useState<PunchAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [job, setJob] = useState('')
  const [tick, setTick] = useState(0)
  const fixRef = useRef<Fix>(null)

  // ── Location, started the instant the page exists ──
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGeoError('This device cannot report its location.'); return }
    // watchPosition rather than getCurrentPosition: the first fix is often coarse
    // and a better one lands a second or two later. Keeping the best-so-far means
    // a punch made at t+3s uses the sharper fix, not the one that arrived first.
    const id = navigator.geolocation.watchPosition(
      p => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }
        const prev = fixRef.current
        if (!prev || next.accuracy_m <= prev.accuracy_m) { fixRef.current = next; setFix(next) }
        setGeoError(null)
      },
      err => setGeoError(err.code === err.PERMISSION_DENIED
        ? 'Location is blocked for this site. Turn it on in your browser settings to punch.'
        : 'Could not read your location yet.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/time-clock/punch', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  // Ticking clock for the running total. One second is the right resolution for
  // something somebody is watching while they decide whether to go to lunch.
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t) }, [])

  const punch = async (action: PunchAction, jobNumber?: string | null) => {
    setBusy(action); setError(null)
    try {
      const res = await fetch('/api/time-clock/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, job_number: jobNumber ?? null, ...(fixRef.current ?? {}), source: 'qr' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || 'That did not go through.')
        if (body.stale) await refresh()
        return
      }
      setFlash(body.offsite ? 'Clocked out — but you were away from the shop, so it is flagged.' : `${LABEL[action]} — done.`)
      setTimeout(() => setFlash(null), 3500)
      if (action === 'switch_job' || action === 'clock_in') setJob('')
      await refresh()
    } catch {
      setError('No connection. Your punch was not recorded — try again.')
    } finally { setBusy(null) }
  }

  if (!data) {
    return <div className="rounded-xl border border-hairline bg-surface p-8 text-center text-[13px] text-ink-muted">Loading your clock…</div>
  }

  const state = stateOf(data.shift, data.openSegment)
  const paidToday = data.segments
    .filter(s => s.kind !== 'lunch')
    .reduce((m, s) => m + minutesBetween(s.started_at, s.ended_at), 0)
  const lunchToday = data.segments
    .filter(s => s.kind === 'lunch')
    .reduce((m, s) => m + minutesBetween(s.started_at, s.ended_at), 0)
  const currentJob = data.openSegment?.kind === 'work' ? data.openSegment.job_number : null

  const primary: PunchAction = state === 'off' ? 'clock_in' : state === 'lunch' ? 'lunch_end' : state === 'break' ? 'break_end' : 'clock_out'
  const locating = !fix && !geoError

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {/* Status. Reads in one glance from arm's length. */}
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
              {state === 'off' ? 'Not on the clock' : state === 'lunch' ? 'On lunch' : state === 'break' ? 'On break' : 'On the clock'}
            </p>
            <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-ink">
              {state === 'off' ? `Morning, ${firstName}` : hhmm(paidToday)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-secondary">
              {state === 'off'
                ? 'Tap the green button and you are on.'
                : <>Since {new Date(data.shift!.started_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}
                    {lunchToday > 0 ? ` · ${hhmm(lunchToday)} lunch` : ''}
                    {currentJob ? <> · job <span className="font-semibold text-ink">{currentJob}</span></> : ' · no job set'}</>}
            </p>
          </div>
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === 'off' ? 'bg-surface-strong text-ink-muted' : 'bg-brand-soft text-brand'}`}>
            <Clock size={18} />
          </span>
        </div>
      </div>

      {/* Location. Never blocks the button — it reports, and the server decides. */}
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-soft px-4 py-2.5 text-[12px]">
        <MapPin size={14} className={geoError ? 'text-rose-600' : fix ? 'text-brand' : 'text-ink-faint'} />
        <span className={geoError ? 'text-rose-700 dark:text-rose-400' : 'text-ink-secondary'}>
          {geoError ? geoError
            : locating ? 'Finding you…'
            : `At ${data.site.label} · accurate to about ${Math.round(fix!.accuracy_m)}m`}
        </span>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-[13px] text-brand-ink">
          <Check size={15} /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-[13px] text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* THE button. */}
      <button
        onClick={() => punch(primary, primary === 'clock_in' ? (job.trim() || null) : undefined)}
        disabled={busy !== null}
        className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-6 text-[19px] font-semibold tracking-tight transition-colors duration-150 disabled:opacity-60 ${
          primary === 'clock_out'
            ? 'border border-hairline-strong bg-surface text-ink hover:bg-surface-soft'
            : 'bg-brand text-white hover:bg-brand-hover'
        }`}
      >
        {busy === primary ? <RefreshCw size={20} className="animate-spin" />
          : primary === 'clock_in' ? <Play size={20} />
          : primary === 'clock_out' ? <LogOut size={20} />
          : <Coffee size={20} />}
        {LABEL[primary]}
      </button>

      {/* Secondary actions, only the ones that apply. */}
      {state !== 'off' && (
        <div className="grid grid-cols-2 gap-2.5">
          {data.allowed.filter(a => a !== primary && a !== 'switch_job').map(a => (
            <button key={a} onClick={() => punch(a)} disabled={busy !== null}
              className="rounded-lg border border-hairline bg-surface px-4 py-3.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-surface-soft disabled:opacity-60">
              {LABEL[a]}
            </button>
          ))}
        </div>
      )}

      {/* Job. Optional everywhere, and never in the way of a punch. */}
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-ink-faint" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            {state === 'off' ? 'Job number — optional' : 'Working on'}
          </p>
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            value={job} onChange={e => setJob(e.target.value)}
            placeholder={currentJob ?? 'e.g. 12347890'} inputMode="text" autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {state !== 'off' && (
            <button onClick={() => punch('switch_job', job.trim() || null)} disabled={busy !== null || !job.trim()}
              className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-brand-hover disabled:opacity-40">
              Switch
            </button>
          )}
        </div>
        {recentJobs.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {recentJobs.map(j => (
              <button key={j} onClick={() => (state === 'off' ? setJob(j) : punch('switch_job', j))} disabled={busy !== null}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors duration-150 disabled:opacity-50 ${
                  currentJob === j ? 'border-brand bg-brand-soft text-brand-ink' : 'border-hairline bg-surface-soft text-ink-secondary hover:bg-surface-strong'}`}>
                {j}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-muted">
          Switch as many times as you like — the clock keeps running and each job gets the minutes you actually spent on it.
        </p>
      </div>

      {/* Today, as it was actually spent. */}
      {data.segments.length > 0 && (
        <div className="rounded-xl border border-hairline bg-surface">
          <p className="border-b border-hairline px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Today</p>
          <ul className="divide-y divide-hairline">
            {[...data.segments].reverse().map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                <span className="text-ink">
                  {s.kind === 'lunch' ? 'Lunch' : s.kind === 'break' ? 'Break' : s.job_number ? `Job ${s.job_number}` : 'Work — no job'}
                  {!s.ended_at && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-brand">now</span>}
                </span>
                <span className="tabular-nums text-ink-secondary">{hhmm(minutesBetween(s.started_at, s.ended_at))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
