import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateBriefing } from '@/lib/briefing'
import type { Employee, Ticket } from '@/lib/supabase'

/* Shared logic behind the daily admin email digest (app/api/cron/admin-digest)
   and the on-demand test-send (app/api/admin/digest/test-send). Everything
   here is pure data-gathering — no email sending, no auth — so both routes
   can reuse it without duplicating query logic. */

// A trimmed ticket shape — just what the digest email needs to render a row
// and link back into the admin portal.
export type DigestTicket = {
  id: string
  ticket_number: string
  customer_company: string | null
  problem_description: string
}

const AGING_DAYS = 3
const OVERDUE_DAYS = 7
const RECENTLY_ASSIGNED_HOURS = 24

function toDigestTicket(t: Ticket): DigestTicket {
  return {
    id: t.id,
    ticket_number: t.ticket_number,
    customer_company: t.customer_company,
    problem_description: t.problem_description,
  }
}

/** Current wall-clock time in America/New_York, plus the NY calendar date
 *  (YYYY-MM-DD). The date MUST be derived from the NY timezone, not
 *  `new Date().toISOString()` (UTC), or a run close to midnight UTC would be
 *  filed under the wrong calendar day. */
export function getNyWallClock(): { hour: number; minute: number; dateISO: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  // Intl can render midnight as "24" with hour12:false in some environments —
  // normalize to 0 so the digest-time window check below is never skipped.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  const dateISO = `${get('year')}-${get('month')}-${get('day')}`

  return { hour, minute, dateISO }
}

/** True inside the ~10-minute window around 4:30pm America/New_York. The two
 *  cron entries in vercel.json fire 60 minutes apart (one for EDT, one for
 *  EST), so only one of them ever lands inside this window on a given day —
 *  the other is a harmless no-op. */
export function isDigestTime(): boolean {
  const { hour, minute } = getNyWallClock()
  return hour === 16 && minute >= 25 && minute <= 34
}

/** All admins who should receive the daily digest. */
export async function getDigestRecipients(): Promise<Employee[]> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('is_admin', true)
    .eq('is_active', true)
  if (error) throw error
  return data || []
}

export type AdminTicketDigest = {
  assigned: DigestTicket[]
  aging: DigestTicket[]
  overdue: DigestTicket[]
}

/** Builds one admin's slice of the digest: tickets recently assigned to them,
 *  plus THEIR aging/overdue open tickets (not the whole org's queue — keeps
 *  the email actionable rather than a firehose of every open ticket). */
export async function getAdminTicketDigest(adminId: string): Promise<AdminTicketDigest> {
  const now = Date.now()
  const agingCutoff = new Date(now - AGING_DAYS * 864e5).toISOString()
  const overdueCutoff = new Date(now - OVERDUE_DAYS * 864e5).toISOString()
  const recentAssignCutoff = new Date(now - RECENTLY_ASSIGNED_HOURS * 3600e3).toISOString()

  const { data: ownedOpen, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, customer_company, problem_description, status, created_at')
    .eq('owner_id', adminId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: true })

  if (error) throw error
  const tickets = (ownedOpen || []) as (Ticket & { created_at: string })[]

  // "Recently assigned" = owned, still open/in_progress, created in the last
  // 24h. We don't have an owner-assignment timestamp separate from
  // created_at, so this approximates "new to them" as "new ticket, already
  // assigned to them" rather than re-flagging long-open tickets every day.
  const assigned = tickets
    .filter(t => t.created_at >= recentAssignCutoff)
    .map(toDigestTicket)

  const aging = tickets
    .filter(t => t.created_at < agingCutoff && t.created_at >= overdueCutoff)
    .map(toDigestTicket)

  const overdue = tickets
    .filter(t => t.created_at < overdueCutoff)
    .map(toDigestTicket)

  return { assigned, aging, overdue }
}

/** The one shared briefing paragraph for the day (same generator the
 *  dashboard widget uses) — generated once per digest run, not once per
 *  admin, to keep this to a single Claude call. */
export async function getSharedBriefing(): Promise<{ briefing: string; generatedAt: string }> {
  const payload = await generateBriefing()
  return { briefing: payload.briefing, generatedAt: payload.generatedAt }
}
