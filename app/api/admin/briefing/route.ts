import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/* AI Executive Briefing — a plain-English read of the operation, written by
   Claude from live metrics. The dashboard is force-dynamic (loads often), so we
   never call the model inline: this endpoint is fetched client-side and the
   result is cached in-module for an hour. ?refresh=1 forces a regenerate. */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are the operations chief of staff for IAT (Innovative Air Technologies). You write a short executive briefing for the business owner, read from live portal metrics.

Write 2–4 sentences of plain, confident English. Rules:
- Lead with the single most important thing right now.
- Call out notable week-over-week changes (up or down) and anything that needs attention (unread submissions, aging open tickets, pending approvals, time-off awaiting a decision).
- If everything is healthy and quiet, say so plainly — don't manufacture urgency.
- Be specific with numbers, but conversational — like a sharp assistant briefing the boss, not a report.
- No markdown, no headers, no bullet points, no preamble like "Here's your briefing." Just the briefing text itself.`

type Metrics = {
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

type Payload = { briefing: string; generatedAt: string; metrics: Metrics }

// Module-level cache (best-effort across warm invocations).
let cache: { at: number; payload: Payload } | null = null
const TTL_MS = 60 * 60 * 1000

async function gatherMetrics(): Promise<Metrics> {
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
  let topFormThisWeek: Metrics['topFormThisWeek'] = null
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

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  if (!refresh && cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ ...cache.payload, cached: true })
  }

  const metrics = await gatherMetrics()

  try {
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
    const payload: Payload = { briefing, generatedAt: new Date().toISOString(), metrics }
    cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[briefing] generation failed:', err)
    return NextResponse.json({ error: 'Could not generate a briefing right now.', metrics }, { status: 502 })
  }
}
