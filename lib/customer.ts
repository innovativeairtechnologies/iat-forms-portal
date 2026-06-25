// Customer-portal shared helpers: the build/ship milestone model + small utilities.
import type { EquipmentMilestone } from './supabase'

// Canonical build → ship timeline shown on the customer dashboard. Staff seed
// these on a unit ("Start tracker") and advance them in the admin equipment UI;
// the portal renders them as a stepper. `stage` is stored verbatim on the row,
// so this list can grow/reorder without a migration.
export const DEFAULT_MILESTONE_STAGES: { stage: string; description: string }[] = [
  { stage: 'Order Received',  description: 'Your order is confirmed and queued for production.' },
  { stage: 'In Production',   description: 'Your unit is being built on the IAT floor.' },
  { stage: 'Quality Control', description: 'Final inspection, testing, and sign-off.' },
  { stage: 'Shipped',         description: 'On its way — carrier and tracking shown when available.' },
  { stage: 'Delivered',       description: 'Delivered to your site.' },
]

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'complete'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export type MilestoneProgress = {
  total: number
  completed: number
  percent: number
  currentStage: string | null
}

/** Summarize a unit's timeline for the tracker header (progress bar + current step). */
export function milestoneProgress(milestones: EquipmentMilestone[]): MilestoneProgress {
  const ordered = [...milestones].sort((a, b) => a.sort_order - b.sort_order)
  const total = ordered.length
  const completed = ordered.filter((m) => m.status === 'complete').length
  // current = first in-progress, else first not-yet-complete, else the last (all done)
  const current =
    ordered.find((m) => m.status === 'in_progress') ||
    ordered.find((m) => m.status !== 'complete') ||
    ordered[ordered.length - 1] ||
    null
  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    currentStage: current?.stage ?? null,
  }
}

/** A unit's timeline is valid only when progress runs in order: a block of completed
 *  steps, then at most one in-progress step, then pending steps — no skipping ahead and
 *  no gaps. Pass the milestones sorted by sort_order. Used by both the admin editor
 *  (blocks the change + shows an error) and the milestones API (rejects out-of-order
 *  writes), so the customer portal can never display an impossible sequence. */
export function isMilestoneSequenceValid(ordered: { status: string }[]): boolean {
  let seenIncomplete = false
  for (const m of ordered) {
    if (m.status === 'complete') {
      if (seenIncomplete) return false // a completed step after an unfinished one = gap
    } else if (m.status === 'in_progress') {
      if (seenIncomplete) return false // starting a step before the prior one is done = skip
      seenIncomplete = true
    } else {
      seenIncomplete = true
    }
  }
  return true
}

// Canned, customer-facing note suggestions per build/ship stage. Admins one-click
// one (or type their own) when advancing the tracker, so they don't write a note
// from scratch for every unit. Keyed by stage name (case-insensitive); a generic
// set covers any custom stage. These render on the customer portal, so keep the
// tone customer-friendly.
export const MILESTONE_NOTE_PRESETS: Record<string, string[]> = {
  'order received': [
    'Order confirmed and queued for production.',
    'Specs reviewed — your build is scheduled.',
  ],
  'in production': [
    'Your unit is being built on the IAT floor.',
    'Fabrication underway.',
    'Assembly in progress.',
  ],
  'quality control': [
    'In final inspection and testing.',
    'Running QC checks and sign-off.',
  ],
  shipped: [
    'On its way — carrier and tracking to follow.',
    'Picked up by the carrier.',
  ],
  delivered: [
    'Delivered to your site.',
    'Delivery complete — thank you!',
  ],
}

const GENERIC_NOTE_PRESETS = ['Update posted.', 'On track.', "We'll share more soon."]

/** Suggested notes for a stage (case-insensitive); generic fallback for custom stages. */
export function notePresetsFor(stage: string): string[] {
  return MILESTONE_NOTE_PRESETS[stage.trim().toLowerCase()] || GENERIC_NOTE_PRESETS
}
