import type { LearnTone } from '@/lib/learn'

/* Per-category colour for the Learn library.

   This is the DESIGN.md §2.4 "dashboard exception" — the one sanctioned place
   Tone chroma may be used decoratively rather than for status. Every value below
   is a Tone from that table (emerald / sky / amber / violet / rose / slate); no
   off-system pastels. Colour carries meaning here too: a subject inherits its
   CATEGORY's tone, so the wash tells you which part of the library you're in.

   Plain module (no 'use client'), so both the server list and the client
   scroller can import it. */

export type ToneClasses = {
  /** Card surface + border. */
  card: string
  /** Small overline pill sitting on the wash. */
  pill: string
  /** Progress-bar fill. */
  bar: string
  /** Progress-bar track on the wash. */
  track: string
  /** Icon/accent text on the wash. */
  accent: string
  /** Solid dot, for the streak strip. */
  dot: string
}

export const LEARN_TONE: Record<LearnTone, ToneClasses> = {
  emerald: {
    card: 'bg-emerald-50 border-emerald-200/70 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    pill: 'bg-white/75 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-900/10 dark:bg-white/10',
    accent: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  sky: {
    card: 'bg-sky-50 border-sky-200/70 dark:bg-sky-500/10 dark:border-sky-500/20',
    pill: 'bg-white/75 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    bar: 'bg-sky-500',
    track: 'bg-sky-900/10 dark:bg-white/10',
    accent: 'text-sky-700 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  amber: {
    card: 'bg-amber-50 border-amber-200/70 dark:bg-amber-500/10 dark:border-amber-500/20',
    pill: 'bg-white/75 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
    track: 'bg-amber-900/10 dark:bg-white/10',
    accent: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  violet: {
    card: 'bg-violet-50 border-violet-200/70 dark:bg-violet-500/10 dark:border-violet-500/20',
    pill: 'bg-white/75 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    bar: 'bg-violet-500',
    track: 'bg-violet-900/10 dark:bg-white/10',
    accent: 'text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  rose: {
    card: 'bg-rose-50 border-rose-200/70 dark:bg-rose-500/10 dark:border-rose-500/20',
    pill: 'bg-white/75 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    bar: 'bg-rose-500',
    track: 'bg-rose-900/10 dark:bg-white/10',
    accent: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  slate: {
    card: 'bg-slate-50 border-slate-200/70 dark:bg-slate-500/10 dark:border-slate-500/20',
    pill: 'bg-white/75 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    bar: 'bg-slate-500',
    track: 'bg-slate-900/10 dark:bg-white/10',
    accent: 'text-slate-700 dark:text-slate-400',
    dot: 'bg-slate-500',
  },
}

/** "45 min" / "2h 15m" */
export function fmtMins(min: number): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
