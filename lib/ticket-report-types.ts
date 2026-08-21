/* Shapes for the support-ticket report.

   🔴 MUST NEVER IMPORT A SERVER MODULE — it is imported by TicketReportClient,
   a 'use client' component. See lib/report-shared.ts for the full story; the
   short version is that a VALUE import from lib/ticket-report.ts ships
   supabase-admin to the browser and kills the page at hydration, past tsc and
   past a green server render.

   RangeKey/RANGES now live in lib/report-shared.ts so all five reports share one
   definition and their range tabs cannot drift apart. Re-exported here so the
   ticket report's existing imports keep working. */

import type { Bucket, RangeKey } from '@/lib/report-shared'

export { RANGES } from '@/lib/report-shared'
export type { Bucket, RangeKey }

export type ReportRow = {
  id: string
  ticketNumber: string
  customer: string
  company: string
  model: string
  serial: string
  status: string
  priority: string
  requestType: string
  owner: string
  createdAt: string
  closedAt: string | null
  reopenCount: number
  /** Created → first close, in days. Null while never closed. */
  daysToClose: number | null
  /** Age in days for anything not closed; null once closed. */
  ageDays: number | null
  resolvedReason: string
}

export type OwnerStat = { owner: string; assigned: number; closed: number; medianDaysToClose: number | null }
export type MonthPoint = { month: string; opened: number; closed: number }

export type TicketReport = {
  rangeKey: RangeKey
  rangeLabel: string
  from: string | null
  totals: {
    openedInRange: number
    closedInRange: number
    net: number
    reopenedInRange: number
    openNow: number
    unassignedNow: number
    medianDaysToClose: number | null
    reopenRatePct: number | null
    /** Oldest still-unclosed ticket, in days. */
    oldestOpenDays: number | null
  }
  aging: Bucket[]
  byStatus: Bucket[]
  byOwner: OwnerStat[]
  byCompany: Bucket[]
  byModel: Bucket[]
  byReason: Bucket[]
  monthly: MonthPoint[]
  rows: ReportRow[]
}
