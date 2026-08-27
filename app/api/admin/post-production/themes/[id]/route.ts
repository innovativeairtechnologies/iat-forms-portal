import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { employeeIdForEmail } from '@/lib/my-employee'
import { logAudit } from '@/lib/audit'
import { isCategory, THEME_STATUSES, type ThemeStatus } from '@/lib/post-production'

/* PATCH /api/admin/post-production/themes/[id]
 *
 * Rename, re-describe, or settle a recurring issue.
 *
 * Settling comes in two honest flavours and the second one matters. `resolved`
 * means engineering changed something. `accepted` means this is a known
 * trade-off nobody intends to change — and having that option is what stops
 * people quietly marking things resolved to clear the board. Both drop out of
 * the pre-production checklist; only `resolved` claims a fix.
 *
 * ⚠️ A theme marked resolved REOPENS ITSELF when a new finding lands on it (see
 * lib/pp-match.ts). That is the whole "we've brought this up twelve times"
 * mechanic: a fix that did not take must not stay green because of a decision
 * made before the recurrence.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: before } = await supabaseAdmin
    .from('pp_themes').select('*').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'That group no longer exists.' }, { status: 404 })

  const now = new Date()
  const actor = await getAdminSurfaceUser()
  const patch: Record<string, unknown> = { updated_at: now.toISOString() }

  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
  if (typeof body.summary === 'string') patch.summary = body.summary.trim().slice(0, 800) || null
  if (isCategory(body.category)) patch.category = body.category

  if (typeof body.status === 'string' && (THEME_STATUSES as readonly string[]).includes(body.status)) {
    const next = body.status as ThemeStatus
    patch.status = next
    if (next === 'open') {
      patch.resolved_at = null
      patch.resolved_by = null
    } else {
      patch.resolved_at = now.toISOString()
      patch.resolved_by = await employeeIdForEmail(actor?.user.email)
    }
  }

  if (typeof body.resolution === 'string') patch.resolution = body.resolution.trim().slice(0, 2000) || null

  const { data, error } = await supabaseAdmin
    .from('pp_themes').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[post-production/themes] patch failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }

  if (patch.status && patch.status !== before.status) {
    await logAudit({
      actor: { id: actor?.user.id, name: actor?.displayName },
      action: 'post_production.theme_status',
      entityType: 'pp_theme',
      entityId: id,
      summary: `Recurring issue "${data.title}" marked ${patch.status}`,
      metadata: { from: before.status, to: patch.status },
    })
  }

  return NextResponse.json({ theme: data })
}
