import Link from 'next/link'
import Logo from '@/components/Logo'
import { LifeBuoy, ArrowRight, Camera, Sparkles, Clock, type LucideIcon } from 'lucide-react'

// A single support avenue for now: the Equipment Support request. This page is
// deliberately one loud "do this" — hero + one primary action — rather than a
// grid of options. Follows DESIGN.md (Quiet Precision): warm canvas, hairline
// cards, green only on the single primary action + focus rings.

// Quiet reassurance points under the CTA — each mirrors a real feature of the form.
const ASSURANCES: { icon: LucideIcon; label: string; desc: string }[] = [
  { icon: Camera,   label: 'Scan the label',  desc: 'Snap your nameplate and we auto-fill the serial, model and voltage.' },
  { icon: Sparkles, label: 'Guided checks',   desc: 'A few quick questions, with live tips as you go.' },
  { icon: Clock,    label: 'Arrive prepared', desc: 'Your details reach our team pre-screened, so help is faster.' },
]

export default function SupportPortal() {
  return (
    <div className="min-h-screen bg-canvas text-ink">

      {/* Header — brand mark only; no status-lookup link */}
      <header className="sticky top-0 z-30 h-14 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-full max-w-[860px] items-center px-5">
          <Link href="/support" className="flex items-center gap-2.5 no-underline">
            <Logo size={26} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-tight text-ink">IAT</span>
              <span className="text-[13px] text-ink-faint">/</span>
              <span className="text-[13px] font-medium text-ink-muted">Support</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[860px] px-5 py-14 sm:py-20">
        <div className="animate-fade-up">

          {/* Hero */}
          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Customer Support
            </p>
            <h1 className="text-[30px] font-semibold leading-[1.06] tracking-tight text-ink sm:text-[38px]">
              Having trouble with your&nbsp;equipment?
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-secondary">
              Open a support request and we&apos;ll walk you through it — pre-screening your unit
              so our service team arrives prepared.
            </p>
          </div>

          {/* The one action */}
          <Link
            href="/support/equipment-support"
            className="group mt-9 flex items-center gap-5 rounded-2xl border border-hairline bg-surface p-6 transition-all duration-150 hover:border-hairline-strong hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-7"
          >
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
              <LifeBuoy size={26} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[18px] font-semibold tracking-tight text-ink">
                Start a support request
              </span>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
                Report an equipment issue and walk the guided checks — about 3 minutes.
              </p>
            </div>
            <ArrowRight
              size={20}
              className="flex-shrink-0 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-brand"
            />
          </Link>

          {/* Reassurances */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {ASSURANCES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl border border-hairline bg-surface p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-strong text-ink-muted">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-ink">{label}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{desc}</p>
              </div>
            ))}
          </div>

          {/* Status strip */}
          { /* <div className="mt-8 flex items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
            <span className="text-[12px] text-ink-muted">
              All systems operational&nbsp;·&nbsp;Average response time{' '}
              <strong className="font-semibold tabular-nums text-ink-secondary">4 hours</strong>
            </span>
          </div> */}

          {/* Coming-soon note */}
          <p className="mt-6 text-[12px] leading-relaxed text-ink-faint">
            Parts &amp; Warranty requests and Preventive Maintenance scheduling are coming soon.
          </p>

        </div>
      </main>
    </div>
  )
}
