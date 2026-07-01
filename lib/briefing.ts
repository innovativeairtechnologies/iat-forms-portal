import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* AI Executive Briefing — shared logic behind app/api/admin/briefing (the
   dashboard widget) AND the admin email digest (app/api/cron/admin-digest).
   Kept in one place so there is exactly ONE Claude call generating the
   day's briefing paragraph, reused everywhere it's shown — not one call per
   admin per surface. See app/api/admin/briefing/route.ts for the dashboard
   endpoint that wraps generateBriefing() with its own HTTP-level caching. */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are the operations chief of staff for IAT (Innovative Air Technologies). You write a short executive briefing for the business owner, read from live portal metrics.

Write 2–4 sentences of plain, confident English. Rules:
- Lead with the single most important thing right now.
- Call out notable week-over-week changes (up or down) and anything that needs attention (unread submissions, aging open tickets, pending approvals, time-off awaiting a decision).
- If everything is healthy and quiet, say so plainly — don't manufacture urgency.
- Be specific with numbers, but conversational — like a sharp assistant briefing the boss, not a report.
- No markdown, no headers, no bullet points, no preamble like "Here's your briefing." Just the briefing text itself.`

export type BriefingMetrics = {
  subsThisWeek: number
  subsLastWeek: number
  unread: number
  openTickets: number
  oldestOpenTicketDays: number | null
  resolvedThisWeek: number
  pendingApprovals: number
  pendingPto: number
  pendingSick: number
  topFormThisWeek: { title: string; count: number } | null
}

export type BriefingPayload = { briefing: string; generatedAt: string; metrics: BriefingMetrics }

export async function gatherMetrics(): Promise<BriefingMetrics> {
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 864e5).toISOString()
  const twoWeeksAgo = new Date(now - 14 * 864e5).toISOString()

  const [
    { count: subsThisWeek },
    { count: subsLastWeek },
    { count: unread },
    { count: openTickets },
    { count: resolvedThisWeek },
    { count: pendingApprovals },
    { count: pendingPto },
    { count: pendingSick },
    { data: oldestOpen },
    { data: weekSubs },
  ] = await Promise.all([
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', weekAgo),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', twoWeeksAgo).lt('submitted_at', weekAgo),
    supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('is_read', false),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved').gte('created_at', weekAgo),
    supabaseAdmin.from('forms').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'pto').eq('status', 'pending'),
    supabaseAdmin.from('time_off_requests').select('*', { count: 'exact', head: true }).eq('type', 'sick').eq('status', 'pending'),
    supabaseAdmin.from('tickets').select('created_at').eq('status', 'open').order('created_at', { ascending: true }).limit(1),
    supabaseAdmin.from('submissions').select('form_title').gte('submitted_at', weekAgo).limit(2000),
  ])

  const oldestAt = oldestOpen?.[0]?.created_at
  const oldestOpenTicketDays = oldestAt ? Math.floor((now - new Date(oldestAt).getTime()) / 864e5) : null

  // Top form by volume this week.
  const counts = new Map<string, number>()
  for (const s of (weekSubs || []) as { form_title: string | null }[]) {
    const t = s.form_title || 'Untitled form'
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  let topFormThisWeek: BriefingMetrics['topFormThisWeek'] = null
  for (const [title, count] of Array.from(counts.entries())) {
    if (!topFormThisWeek || count > topFormThisWeek.count) topFormThisWeek = { title, count }
  }

  return {
    subsThisWeek: subsThisWeek ?? 0,
    subsLastWeek: subsLastWeek ?? 0,
    unread: unread ?? 0,
    openTickets: openTickets ?? 0,
    oldestOpenTicketDays,
    resolvedThisWeek: resolvedThisWeek ?? 0,
    pendingApprovals: pendingApprovals ?? 0,
    pendingPto: pendingPto ?? 0,
    pendingSick: pendingSick ?? 0,
    topFormThisWeek,
  }
}

/** Gathers fresh metrics and makes the one Claude call that turns them into the
 *  day's briefing paragraph. Throws on model failure — callers decide fallback. */
export async function generateBriefing(): Promise<BriefingPayload> {
  const metrics = await gatherMetrics()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Today's live metrics (JSON). Write the briefing.\n\n${JSON.stringify(metrics, null, 2)}`,
    }],
  })
  const briefing = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
  return { briefing, generatedAt: new Date().toISOString(), metrics }
}
