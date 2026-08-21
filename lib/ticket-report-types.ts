/* Shapes and constants for the support-ticket report.
   ⚠️ THIS FILE MUST NEVER IMPORT A SERVER MODULE. It is imported by
   TicketReportClient, a 'use client' component. lib/ticket-report.ts imports
   supabase-admin, so a VALUE import from there (RANGES, not just a type) drags
   the service-role client into the browser bundle and the page dies at hydration
   with "supabaseKey is required" — while tsc and the server render both pass.
   That is exactly how this file came to exist. Types are erased and would have
   been fine; the constant was not. */

export type RangeKey = '30d' | '90d' | '12m' | 'all'

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'All time', days: null },
]

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

export type Bucket = { label: string; count: number }
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
