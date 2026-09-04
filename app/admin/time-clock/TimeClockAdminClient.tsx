'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { MapPin, Download, Printer, TriangleAlert, Users, Clock } from 'lucide-react'
import { decimalHours, hhmm, type ClockSettings } from '@/lib/time-clock'

type OnNow = { id: string; name: string; since: string; minutes: number; doing: string; offsiteStart: boolean }
type Total = {
  employee_id: string; name: string; paidMinutes: number; lunchMinutes: number
  unallocatedMinutes: number; jobs: { job: string | null; minutes: number }[]
}
type Denial = { id: string; name: string; attempted_at: string; distance_m: number | null; reason: string }

/* The job bars. Six tones from the DESIGN.md set, cycled by position within a
   person's week — deliberately NOT hashed from the job number, because a stable
   hash would hand two adjacent jobs the same colour often enough to be confusing,
   and nobody is comparing one person's "job 3" to another's. */
const BAR = ['bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-400']
const UNALLOCATED = 'bg-surface-strong'

export default function TimeClockAdminClient({
  settings, week, onNow, totals, denials, flaggedOut, hourlyMissingNumber,
}: {
  settings: ClockSettings
  week: { start: string; end: string }
  onNow: OnNow[]
  totals: Total[]
  denials: Denial[]
  flaggedOut: number
  hourlyMissingNumber: number
}) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const clockUrl = `${origin}/clock`
  const weekPaid = totals.reduce((m, t) => m + t.paidMinutes, 0)

  // "Set from where I'm standing" — the only reliable way to place the pin. The
  // seeded coordinate is a geocode of the street address, good to the building
  // but not to the door somebody actually punches at.
  const setFenceHere = () => {
    if (!navigator.geolocation) return setNote('This device cannot report its location.')
    setSaving(true); setNote('Getting a fix…')
    navigator.geolocation.getCurrentPosition(
      async p => {
        const res = await fetch('/api/admin/time-clock/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }),
        })
        setSaving(false)
        setNote(res.ok
          ? `Pin moved to where you are standing (fix accurate to ~${Math.round(p.coords.accuracy)}m). Reload to see it.`
          : 'Could not save the new pin.')
      },
      () => { setSaving(false); setNote('Could not read your location.') },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  const printQr = () => {
    const svg = document.getElementById('clock-qr')?.outerHTML ?? ''
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<html><head><title>IAT Time Clock</title><style>
      body{font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
      h1{font-size:26px;margin:0 0 6px}p{font-size:13px;color:#555;margin:0 0 22px}
      svg{width:300px;height:300px}small{margin-top:18px;color:#888;font-size:11px}
    </style></head><body><h1>Clock in / out</h1><p>Scan with your phone camera</p>${svg}<small>${clockUrl}</small></body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On the clock" value={String(onNow.length)} sub="right now" tone={onNow.length ? 'brand' : 'muted'} icon={<Users size={14} />} />
        <Stat label="Paid this week" value={hhmm(weekPaid)} sub={`${decimalHours(weekPaid)} hrs`} icon={<Clock size={14} />} />
        <Stat label="Off-site clock-outs" value={String(flaggedOut)} sub="recorded, not refused" tone={flaggedOut ? 'amber' : 'muted'} />
        <Stat label="Refused punches" value={String(denials.length)} sub="most recent 8" tone={denials.length ? 'amber' : 'muted'} />
      </div>

      {hourlyMissingNumber > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">{hourlyMissingNumber}</strong> hourly {hourlyMissingNumber === 1 ? 'employee has' : 'employees have'} no
            employee number. They can still punch — but the payroll export will have a blank in the column QuickBooks keys on.
            Add it on their profile in <span className="font-semibold">HR → Employees</span>.
          </span>
        </div>
      )}

      {/* On the clock now */}
      <section className="rounded-xl border border-hairline bg-surface">
        <header className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">On the clock now</h2>
        </header>
        {onNow.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-muted">Nobody is punched in.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {onNow.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="text-ink-secondary">
                    {p.doing} · since {new Date(p.since).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })}
                    {p.offsiteStart && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">started off-site</span>}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-[15px] font-semibold text-ink">{hhmm(p.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The week, by job */}
      <section className="rounded-xl border border-hairline bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Payroll week</h2>
            <p className="mt-0.5 text-[13px] text-ink-secondary">{week.start} to {week.end} · Eastern · lunch excluded</p>
          </div>
          <a href={`/api/admin/time-clock/export?week=${week.start}`}
             className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-brand-hover">
            <Download size={14} /> QuickBooks CSV
          </a>
        </header>
        {totals.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-muted">No time recorded this week yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {totals.map(t => (
              <li key={t.employee_id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13.5px] font-semibold text-ink">{t.name}</p>
                  <p className="tabular-nums text-[13px] text-ink">
                    {hhmm(t.paidMinutes)} <span className="text-ink-faint">· {decimalHours(t.paidMinutes)} hrs</span>
                  </p>
                </div>
                {/* One bar per person: the share of THEIR week each job took. */}
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-soft">
                  {t.jobs.map((j, i) => (
                    <div key={j.job ?? '_'} title={`${j.job ?? 'Unallocated'} — ${hhmm(j.minutes)}`}
                         style={{ width: `${(j.minutes / Math.max(t.paidMinutes, 1)) * 100}%` }}
                         className={j.job ? BAR[i % BAR.length] : UNALLOCATED} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {t.jobs.map((j, i) => (
                    <span key={j.job ?? '_'} className="inline-flex items-center gap-1.5 text-ink-secondary">
                      <span className={`inline-block h-2 w-2 rounded-full ${j.job ? BAR[i % BAR.length] : UNALLOCATED}`} />
                      {j.job ?? <em className="not-italic text-ink-muted">Unallocated</em>}
                      <span className="tabular-nums text-ink-faint">
                        {Math.round((j.minutes / Math.max(t.paidMinutes, 1)) * 100)}% · {hhmm(j.minutes)}
                      </span>
                    </span>
                  ))}
                  {t.lunchMinutes > 0 && <span className="text-ink-faint">Lunch {hhmm(t.lunchMinutes)} (unpaid)</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* QR */}
        <section className="rounded-xl border border-hairline bg-surface p-5 text-center">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Punch QR</h2>
          <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-ink-secondary">
            Print it and put it by the door. Scanning goes straight to the punch screen.
          </p>
          <div className="mt-4 inline-block rounded-xl bg-white p-4">
            <QRCodeSVG id="clock-qr" value={clockUrl} size={168} level="M" marginSize={0} />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-faint">{clockUrl}</p>
          <button onClick={printQr}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-surface-soft">
            <Printer size={14} /> Print
          </button>
          <p className="mx-auto mt-3 max-w-xs text-[11.5px] leading-relaxed text-ink-muted">
            The scan still needs them signed in — a time clock has to know who is punching, so the
            QR is a shortcut, not a key.
          </p>
        </section>

        {/* Fence */}
        <section className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">The fence</h2>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            <Row k="Site" v={settings.site_label} />
            <Row k="Pin" v={`${settings.lat.toFixed(5)}, ${settings.lng.toFixed(5)}`} />
            <Row k="Radius" v={`${settings.radius_m} m`} />
            <Row k="Worst fix accepted" v={`${settings.max_accuracy_m} m`} />
            <Row k="Enforced" v={settings.enforce_geofence ? 'Yes — clock-in is refused off-site' : 'No — anyone can punch anywhere'} />
          </dl>
          <button onClick={setFenceHere} disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-brand-hover disabled:opacity-60">
            <MapPin size={14} /> Set from where I&apos;m standing
          </button>
          {note && <p className="mt-2 text-[12px] text-ink-secondary">{note}</p>}
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
            The pin was seeded by geocoding the address in <code className="text-ink-secondary">lib/company.ts</code> — accurate to the
            building, not to the door. Stand on the shop floor, press the button, and the radius can come down.
          </p>

          {denials.length > 0 && (
            <>
              <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">Recently refused</h3>
              <ul className="mt-2 space-y-1 text-[12.5px]">
                {denials.map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-ink-secondary">
                    <span>{d.name}</span>
                    <span className="tabular-nums text-ink-faint">
                      {d.reason === 'too_far' && d.distance_m != null ? `${Math.round(d.distance_m)}m away`
                        : d.reason === 'accuracy' ? 'fix too vague' : 'no location'}
                      {' · '}
                      {new Date(d.attempted_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
                People refused while standing at the shop is the signal that the pin or the radius is wrong — not that they were cheating.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  )
}

function Stat({ label, value, sub, tone = 'ink', icon }: { label: string; value: string; sub?: string; tone?: 'ink' | 'brand' | 'amber' | 'muted'; icon?: React.ReactNode }) {
  const colour = tone === 'brand' ? 'text-brand' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : tone === 'muted' ? 'text-ink-muted' : 'text-ink'
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">{icon}{label}</p>
      <p className={`mt-1.5 text-[22px] font-semibold leading-none tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-ink-muted">{sub}</p>}
    </div>
  )
}
