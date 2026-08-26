import type { RangeKey } from './report-shared'
import type { Stream } from './engineering'

/* 🔴 TYPES ONLY, and it must stay that way.
   ────────────────────────────────────────────────────────────────────────────
   The report's client component imports from here. lib/eng-report.ts (which
   builds all of this) imports supabase-admin, so a VALUE import from that module
   would ship the service-role client to the browser and kill the page at
   hydration — past tsc AND past a green server render, so only loading the page
   catches it. That has happened in this repo once already; lib/report-shared.ts
   and lib/ticket-report-types.ts carry the same warning. Types are erased and
   are safe. Constants are not. When in doubt, put it in report-shared. */

export type { RangeKey }

/** One finished task, flattened for the table and the CSV. */
export type EngReportRow = {
  id: string
  jobNumber: string
  customer: string
  stream: Stream
  step: string
  title: string
  owner: string
  status: string
  dueDate: string
  completedAt: string
  /** Whole days. Positive = finished early, negative = late. Null = no due date. */
  varianceDays: number | null
  targetHours: number | null
  actualHours: number | null
  /** Calendar days from first touch to done. Null when it was never started
   *  properly (no started_at) — never zero, which would read as instant. */
  cycleDays: number | null
}

export type StreamPerformance = {
  stream: Stream
  completed: number
  onTime: number
  onTimePct: number | null
  medianVarianceDays: number | null
  /** Median hands-on hours actually logged. Null when nobody logged any. */
  medianActualHours: number | null
  /** Sum of the targets across the completed tasks that HAVE one. */
  targetHours: number | null
  /** How many of the completed tasks had a target at all — the coverage figure
   *  every hours comparison has to be read against. */
  costedOf: { costed: number; total: number }
}

export type StepPerformance = {
  stream: Stream
  step: string
  title: string
  completed: number
  targetHours: number | null
  medianActualHours: number | null
  /** medianActual − target. Positive = it takes longer than the standard says. */
  gapHours: number | null
  onTimePct: number | null
}

export type PersonPerformance = {
  name: string
  completed: number
  onTime: number
  onTimePct: number | null
  medianVarianceDays: number | null
  actualHours: number | null
  openNow: number
  atRiskNow: number
}

export type EngReport = {
  rangeKey: RangeKey
  rangeLabel: string
  generatedAt: string
  totals: {
    completed: number
    onTime: number
    onTimePct: number | null
    medianVarianceDays: number | null
    medianCycleDays: number | null
    /** Every hours figure in the report is computed over this subset. */
    hoursCoverage: { logged: number; total: number }
    medianActualHours: number | null
    openNow: number
    atRiskNow: number
    overdueNow: number
    unassignedNow: number
    activeJobs: number
    jobsAtRisk: number
  }
  byStream: StreamPerformance[]
  bySteps: StepPerformance[]
  byPerson: PersonPerformance[]
  /** Completed vs newly-created per month, oldest first. */
  monthly: { month: string; created: number; completed: number; late: number }[]
  rows: EngReportRow[]
}
