import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// Move the geofence, or loosen it. Full-admin only: this control decides who can
// get paid, and a radius quietly widened to 50km is a silent payroll hole.
//
// ⚠️ The seeded pin is a GEOCODE of the address in lib/company.ts, not a survey.
// "Set from where I'm standing" exists because the only reliable way to place it
// is for somebody to stand on the shop floor and press a button — and the same
// button is the fix when refusals show up in the denials list.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => null) as
    | { lat?: number; lng?: number; radius_m?: number; max_accuracy_m?: number; enforce_geofence?: boolean; site_label?: string }
    | null
  if (!b) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.user.id }
  if (typeof b.lat === 'number' && typeof b.lng === 'number') {
    if (Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) {
      return NextResponse.json({ error: 'That is not a real coordinate' }, { status: 400 })
    }
    patch.lat = b.lat; patch.lng = b.lng
  }
  // Bounded on both ends. Below ~30m consumer GPS cannot reliably tell inside
  // from the parking lot and everybody gets refused; above 5km the fence is
  // decorative and should be turned off honestly instead.
  if (typeof b.radius_m === 'number') patch.radius_m = Math.min(5000, Math.max(30, Math.round(b.radius_m)))
  if (typeof b.max_accuracy_m === 'number') patch.max_accuracy_m = Math.min(2000, Math.max(20, Math.round(b.max_accuracy_m)))
  if (typeof b.enforce_geofence === 'boolean') patch.enforce_geofence = b.enforce_geofence
  if (typeof b.site_label === 'string' && b.site_label.trim()) patch.site_label = b.site_label.trim().slice(0, 80)

  const { data, error } = await supabaseAdmin
    .from('time_clock_settings').update(patch).eq('id', true).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.user.email ?? 'Admin' },
    action: 'time_clock.settings',
    entityType: 'time_clock',
    entityId: 'settings',
    summary: `Time clock fence updated — ${data?.radius_m}m around ${data?.site_label}${data?.enforce_geofence ? '' : ' (ENFORCEMENT OFF)'}`,
    metadata: patch,
  })
  return NextResponse.json({ ok: true, settings: data })
}
