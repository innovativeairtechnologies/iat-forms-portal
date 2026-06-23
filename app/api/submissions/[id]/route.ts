import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'

function submitterName(data: Record<string, unknown> | null | undefined): string {
  return String(data?.['Employee Name'] || data?.['Full Name'] || data?.['Name'] || 'Anonymous')
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err
  const { data, error } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err
  const body = await req.json()

  // Whitelist only the fields admins are allowed to update
  const allowed: Record<string, unknown> = {}
  if (body.status !== undefined) allowed.status = body.status
  if (body.is_read !== undefined) allowed.is_read = body.is_read

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Capture prior status for the audit trail (only when status is changing).
  type SubSnap = { status: string | null; form_title: string | null; data: Record<string, unknown> }
  let prior: SubSnap | null = null
  if (allowed.status !== undefined) {
    const { data } = await supabaseAdmin
      .from('submissions')
      .select('status, form_title, data')
      .eq('id', params.id)
      .single()
    prior = data as SubSnap | null
  }

  const { error } = await supabaseAdmin.from('submissions').update(allowed).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit status transitions only (mark-as-read toggles are noise).
  if (allowed.status !== undefined && prior && allowed.status !== prior.status) {
    const admin = await getAdminUser()
    const who = submitterName(prior.data)
    await logAudit({
      actor: { id: admin?.user.id, name: admin?.displayName },
      action: 'submission.status',
      entityType: 'submission',
      entityId: params.id,
      summary: `Set ${who}'s "${prior.form_title || 'submission'}" to ${String(allowed.status).replace('_', ' ')}`,
      metadata: { from: prior.status, to: allowed.status },
    })
  }

  return NextResponse.json({ success: true })
}
