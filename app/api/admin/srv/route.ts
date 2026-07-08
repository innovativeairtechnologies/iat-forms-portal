import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { getSrvSections, saveSrvSections, validateSrvSections } from '@/lib/srv-config'
import { ensureSrvForm } from '@/lib/srv-form'
import { logAudit } from '@/lib/audit'
import type { SrvSection } from '@/lib/srv'

// Save the SRV content (migration 046). Full-admin only (getAdminUser strict).
// Validates the incoming sections against the CURRENT ones — section
// keys/numbers/conditionals can't change (the 3D hotspots + numbering depend on
// them; only content is editable) and every flattened field label must stay
// unique — then persists and re-syncs the mirrored form_fields so the admin
// submission view matches the new content immediately.
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const incoming = body?.sections

  const reference = await getSrvSections()
  const problem = validateSrvSections(incoming, reference)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const sections = incoming as SrvSection[]

  try {
    await saveSrvSections(sections, admin.displayName)
  } catch (e) {
    console.error('[admin/srv] save failed:', e)
    return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 })
  }

  // Re-sync the mirrored form_fields to the just-saved content (pass it
  // explicitly — getSrvSections is request-cached and would return the old row).
  try {
    await ensureSrvForm(sections)
  } catch (e) {
    console.error('[admin/srv] field re-sync failed:', e)
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'srv.update',
    entityType: 'form',
    entityId: 'srv',
    summary: 'Edited the Start-Up Readiness Verification content',
  })

  return NextResponse.json({ ok: true })
}
