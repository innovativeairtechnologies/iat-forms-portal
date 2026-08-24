import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateBriefing } from '@/lib/briefing'
import { getAdminRecipients } from '@/lib/staff'
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

/**
 * Which NY hours a digest invocation may send in.
 *
 * ⚠️ THIS WAS A TEN-MINUTE WINDOW (`hour === 16 && minute 25..34`) AND IT NEVER
 * ONCE LET THE DIGEST THROUGH. `digest_runs` sat empty from the day migration 038
 * created it. The cause was not the missing CRON_SECRET that got the blame in
 * August — that was real, but fixing it only moved the failure. Vercel fires crons
 * on this project 14 to 42 minutes late (measured from Resend send timestamps:
 * 13:00→13:41, 21:30→22:03, 22:00→22:42), so the 20:30 UTC entry — 16:30 NY on the
 * dot — always landed at 16:44 or later. Even the BEST observed delay missed.
 *
 * Widening to `hour === 16` is NOT enough either: the entry runs at :30 past, so a
 * delay over thirty minutes crosses into 17:xx and misses again. (The weekly
 * leadership report survives on a bare hour check only because it is scheduled at
 * :00, so its whole delay budget fits inside the hour.)
 *
 * ── Why 16..18, and why excluding 15 matters ────────────────────────────────
 * Correctness now rests on `digest_runs`' UNIQUE index on run_date, not on hitting
 * a narrow time: the first invocation of the NY day claims the run and any later
 * one no-ops. The hour range is only a sanity bound, so a wildly misfired
 * invocation cannot mail everyone at 3am.
 *
 * Dropping 15 is what keeps the send at ~4:30pm in BOTH seasons, because the
 * earliest eligible entry is the one that claims:
 *
 *              20:30 UTC          21:30 UTC          sends
 *   EDT        16:30 NY  CLAIMS   17:30 NY  no-op    ~4:30-4:45pm
 *   EST        15:30 NY  skipped  16:30 NY  CLAIMS   ~4:30-4:45pm
 *
 * Tolerates roughly ninety minutes of lateness in either season, against a worst
 * observed forty-two. No seasonal maintenance, and vercel.json is unchanged.
 */
export function withinDigestWindow(hour: number): boolean {
  return hour >= 16 && hour <= 18
}

/** True if this invocation may claim and send today's digest. */
export function isDigestTime(): boolean {
  return withinDigestWindow(getNyWallClock().hour)
}

/**
 * ⚠️ TEMPORARY OPT-OUT — added 2026-08-17, REVISIT.
 *
 * The digest had never actually sent: CRON_SECRET was missing from Vercel, so
 * every cron invocation 401'd and `digest_runs` sat empty from the day it was
 * built. Setting that secret armed it for real, and Jacob asked to hold three
 * people back for the first live sends while the format is reviewed:
 *
 *   jacob.younker@dehumidifiers.com   Jacob Younker
 *   tyler@dehumidifiers.com           Tyler Bell
 *   jo.evans@dehumidifiers.com        Jo Evans
 *
 * The remaining admins (Crystal, Kacy, Lee) do receive it.
 *
 * TO PUT THEM BACK: delete a line here, or set DIGEST_OPT_OUT_EMAILS in Vercel
 * to override the whole list without a deploy (empty string = nobody excluded).
 * This is a recipient filter only — nothing else about the digest changes.
 */
const DIGEST_OPT_OUT_DEFAULT = [
  'jacob.younker@dehumidifiers.com',
  'tyler@dehumidifiers.com',
  'jo.evans@dehumidifiers.com',
]

function digestOptOut(): Set<string> {
  const raw = process.env.DIGEST_OPT_OUT_EMAILS
  const list = raw === undefined
    ? DIGEST_OPT_OUT_DEFAULT
    : raw.split(',').map(s => s.trim()).filter(Boolean)
  return new Set(list.map(e => e.toLowerCase()))
}

/** All admins who should receive the daily digest, minus the opt-out above. */
export async function getDigestRecipients(): Promise<Employee[]> {
  const all = await getAdminRecipients()
  const skip = digestOptOut()
  const recipients = all.filter(e => !skip.has((e.email ?? '').toLowerCase()))
  const held = all.length - recipients.length
  if (held > 0) {
    // Logged every run so a "temporary" exclusion cannot quietly become permanent.
    console.log(`[admin-digest] ${held} admin(s) held back by the opt-out list — see lib/admin-digest.ts`)
  }
  return recipients
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

// ── Quote requests ───────────────────────────────────────────────────────────

export type DigestRfq = {
  id: string
  reference: string
  company: string
  application: string
  ageDays: number
}

export type AdminRfqDigest = {
  /** Assigned to this person in the last 24h. */
  assigned: DigestRfq[]
  /** Theirs, and getting old. */
  aging: DigestRfq[]
  /** ⚠️ ORG-WIDE, not theirs — see below. */
  unclaimed: DigestRfq[]
}

/**
 * One admin's slice of the quote-request digest, mirroring the ticket sections.
 *
 * ⚠️ `unclaimed` IS DELIBERATELY ORG-WIDE while everything else is per-person.
 * An unclaimed request belongs to nobody, so a strictly per-owner digest is
 * exactly the shape that never mentions it — and unclaimed is the state that
 * matters most, because a quote request nobody picks up is a customer waiting on
 * a number. Checked 2026-08-21: all ten live requests were unassigned, so a
 * per-owner-only view would have shown every admin an empty section while ten
 * requests sat there.
 *
 * `rfq_requests` has a real `assigned_at`, unlike tickets — so "newly assigned"
 * here is genuinely when it became theirs rather than the created_at
 * approximation getAdminTicketDigest has to make do with.
 */
export async function getAdminRfqDigest(adminId: string): Promise<AdminRfqDigest> {
  const now = Date.now()
  const agingCutoff = new Date(now - AGING_DAYS * 864e5).toISOString()
  const recentAssignCutoff = new Date(now - RECENTLY_ASSIGNED_HOURS * 3600e3).toISOString()

  const { data, error } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, company, application_label, application, status, assignee_id, assigned_at, created_at')
    .neq('status', 'closed')
    .order('created_at', { ascending: true })

  if (error) {
    // A digest that loses its ticket half is a bug; one that loses its RFQ half
    // should still send the tickets. Degrade, never throw.
    console.error('[admin-digest] rfq read failed:', error.message)
    return { assigned: [], aging: [], unclaimed: [] }
  }

  const rows = (data ?? []).map(r => ({
    id: r.id as string,
    reference: (r.reference as string) ?? '',
    company: ((r.company as string) ?? '').trim(),
    application: ((r.application_label as string) || (r.application as string) || '').trim(),
    ageDays: Math.floor((now - new Date(r.created_at as string).getTime()) / 864e5),
    assigneeId: (r.assignee_id as string) ?? null,
    assignedAt: (r.assigned_at as string) ?? null,
    createdAt: r.created_at as string,
  }))

  const strip = ({ id, reference, company, application, ageDays }: (typeof rows)[number]): DigestRfq =>
    ({ id, reference, company, application, ageDays })

  const mine = rows.filter(r => r.assigneeId === adminId)

  return {
    assigned: mine.filter(r => r.assignedAt && r.assignedAt >= recentAssignCutoff).map(strip),
    aging: mine.filter(r => r.createdAt < agingCutoff).map(strip),
    unclaimed: rows.filter(r => !r.assigneeId).map(strip),
  }
}

// ── Portal access requests ───────────────────────────────────────────────────

export type DigestPortalRequest = {
  id: string
  company: string
  contactName: string
  email: string
  ticketNumber: string
  ageDays: number
}

/**
 * Every PENDING self-serve portal-access request, org-wide.
 *
 * ⚠️ Not per-admin, and it cannot be: these rows have no owner field at all.
 * Same reasoning as `unclaimed` in getAdminRfqDigest — a request belonging to
 * nobody is exactly the shape a strictly per-person digest never mentions, and
 * "nobody has looked at this" is the whole failure mode. Before this section
 * existed the only surface for a pending request was a tab on /admin/customers
 * that nobody had a reason to click; two requests sat there for days.
 *
 * Fetched ONCE per digest run and handed to every recipient's email, not
 * re-queried per admin, because the answer is identical for all of them — the
 * same treatment getSharedBriefing() gets.
 *
 * Degrades to an empty list on a read failure rather than throwing: losing this
 * section must not cost the recipient their tickets and quotes.
 */
export async function getPendingPortalRequests(): Promise<DigestPortalRequest[]> {
  const now = Date.now()

  const { data, error } = await supabaseAdmin
    .from('customer_portal_requests')
    .select('id, ticket_id, requested_email, requested_company, requested_contact_name, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin-digest] portal request read failed:', error.message)
    return []
  }

  const rows = data ?? []
  if (!rows.length) return []

  // Ticket numbers joined in manually rather than via an embed — the same
  // untyped-query-builder caution app/admin/customers/page.tsx documents for
  // this table, and one extra query either way.
  const ticketIds = [...new Set(rows.map(r => r.ticket_id as string).filter(Boolean))]
  const numbersById = new Map<string, string>()
  if (ticketIds.length) {
    const { data: tickets, error: tErr } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number')
      .in('id', ticketIds)
    if (tErr) console.error('[admin-digest] portal request ticket join failed:', tErr.message)
    for (const t of tickets ?? []) numbersById.set(t.id as string, (t.ticket_number as string) ?? '')
  }

  return rows.map(r => ({
    id: r.id as string,
    company: ((r.requested_company as string) ?? '').trim(),
    contactName: ((r.requested_contact_name as string) ?? '').trim(),
    email: ((r.requested_email as string) ?? '').trim(),
    ticketNumber: numbersById.get(r.ticket_id as string) ?? '',
    ageDays: Math.floor((now - new Date(r.created_at as string).getTime()) / 864e5),
  }))
}

/** The one shared briefing paragraph for the day (same generator the
 *  dashboard widget uses) — generated once per digest run, not once per
 *  admin, to keep this to a single Claude call. */
export async function getSharedBriefing(): Promise<{ briefing: string; generatedAt: string }> {
  const payload = await generateBriefing()
  return { briefing: payload.briefing, generatedAt: payload.generatedAt }
}
