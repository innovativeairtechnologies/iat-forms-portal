'use client'

/* The course certificate.
 *
 * Eligibility is decided server-side (`/api/learn/hvacr-certificate`) using the
 * same completion rule as the library and the compliance report — the client
 * never gets to declare itself finished. Until it is earned, the same card is a
 * progress checklist naming exactly what is left, which is more useful than a
 * locked padlock.
 */

import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import { GhostButton, Overline, ResultNote } from './WidgetFrame'

type CertificateState = {
  eligible: boolean
  name: string
  courseName: string
  awardedAt: string | null
  subjectsTotal: number
  subjectsComplete: number
  outstanding: string[]
  capstone: { passed: boolean; bestPct: number | null } | null
}

export default function Certificate() {
  const [state, setState] = useState<CertificateState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/learn/hvacr-certificate')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not check your progress'))))
      .then((d) => live && setState(d))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <ResultNote tone="incorrect">{error}</ResultNote>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="h-[220px] animate-pulse rounded-xl border border-hairline bg-surface-strong" />
    )
  }

  if (!state.eligible) {
    const pct = Math.round((state.subjectsComplete / Math.max(1, state.subjectsTotal)) * 100)
    return (
      <section className="rounded-xl border border-hairline bg-surface p-5">
        <Overline>Certificate — not yet earned</Overline>
        {/* Span carries the type — see the note in WidgetFrame's ExerciseCard. */}
        <h3 className="mt-1.5">
          <span className="text-[16px] font-semibold tracking-[-0.011em] text-ink">
            {state.subjectsComplete} of {state.subjectsTotal} subjects complete
          </span>
        </h3>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong">
          <div className="h-full rounded-full bg-brand transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>

        {state.outstanding.length ? (
          <div className="mt-4">
            <Overline>Still outstanding</Overline>
            <ul className="mt-2 space-y-1">
              {state.outstanding.map((title) => (
                <li key={title} className="text-[13px] text-ink-secondary">
                  {title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.capstone && !state.capstone.passed ? (
          <div className="mt-4">
            <ResultNote>
              {state.capstone.bestPct === null
                ? 'The final exam has not been attempted yet.'
                : `Best final-exam score so far: ${state.capstone.bestPct}%. You need 80% to pass — retakes are unlimited and your best score is kept.`}
            </ResultNote>
          </div>
        ) : null}
      </section>
    )
  }

  const awarded = state.awardedAt
    ? new Date(state.awardedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <section className="rounded-2xl border border-hairline bg-surface px-8 py-10 text-center print:border-0">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
        <Award className="h-6 w-6 text-brand-ink" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-muted">
        Certificate of completion
      </p>

      <p className="mt-5 text-[13px] text-ink-muted">This certifies that</p>
      <p className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink">{state.name}</p>

      <p className="mt-4 text-[13px] text-ink-muted">has completed</p>
      <p className="mt-1 text-[16px] font-semibold tracking-[-0.011em] text-ink">
        {state.courseName} Technician Training
      </p>
      <p className="mt-1 text-[13px] text-ink-secondary">
        {state.subjectsTotal} subjects and the cumulative final exam
      </p>

      {awarded ? <p className="mt-6 text-[12px] tabular-nums text-ink-muted">{awarded}</p> : null}

      <div className="mt-6 print:hidden">
        <GhostButton onClick={() => window.print()}>Print or save as PDF</GhostButton>
      </div>
    </section>
  )
}
