import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { BULK_ENTITIES, type BulkEntity } from '@/lib/bulk-delete'

// ─────────────────────────────────────────────────────────────────────────────
// Generic multi-select bulk delete — POST { entity, ids }. Full-admin only,
// audit-logged. Mirrors the per-record DELETE endpoints (child notes first;
// account deletes go through auth.admin.deleteUser to free emails; the employees
// case never deletes the acting admin). Returns { deleted, failed, skipped }.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await getAdminUser() // strict full-admin
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const entity = body.entity as BulkEntity
  const rawIds = body.ids
  if (!BULK_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })
  }
  const ids: string[] = Array.isArray(rawIds) ? rawIds.filter((x) => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
  }

  let deleted = 0
  let failed = 0
  let skipped = 0
  let errorMsg: string | null = null

  try {
    switch (entity) {
      case 'submissions': {
        await supabaseAdmin.from('submission_notes').delete().in('submission_id', ids)
        const { data, error } = await supabaseAdmin.from('submissions').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'tickets': {
        await supabaseAdmin.from('ticket_notes').delete().in('ticket_id', ids)
        const { data, error } = await supabaseAdmin.from('tickets').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'equipment': {
        const { data, error } = await supabaseAdmin.from('equipment').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'time_off': {
        const { data, error } = await supabaseAdmin.from('time_off_requests').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'customers': {
        for (const id of ids) {
          // Capture logins before the company-row delete nulls their customer_id.
          const { data: logins } = await supabaseAdmin
            .from('profiles').select('id').eq('customer_id', id).eq('role', 'customer')
          const loginIds = (logins ?? []).map((p) => p.id)
          const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
          if (error) { failed++; continue }
          deleted++
          for (const uid of loginIds) await supabaseAdmin.auth.admin.deleteUser(uid)
          if (loginIds.length) await supabaseAdmin.from('profiles').delete().in('id', loginIds)
        }
        break
      }
      case 'employees': {
        for (const id of ids) {
          if (id === admin.user.id) { skipped++; continue } // never delete self
          const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id)
          if (authErr) {
            const notFound = authErr.status === 404 || /not.?found/i.test(authErr.message || '')
            if (notFound) {
              const { error: rowErr } = await supabaseAdmin.from('employees').delete().eq('id', id)
              if (rowErr) failed++
              else deleted++
            } else {
              failed++
            }
          } else {
            deleted++
          }
        }
        break
      }
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Delete failed'
  }

  if (errorMsg) {
    return NextResponse.json({ error: errorMsg, deleted, failed, skipped }, { status: 500 })
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'bulk.delete',
    entityType: entity,
    summary: `Bulk deleted ${deleted} ${entity}` +
      (failed > 0 ? `, ${failed} failed` : '') +
      (skipped > 0 ? `, ${skipped} skipped` : ''),
    metadata: { entity, deleted, failed, skipped, requested: ids.length },
  })

  return NextResponse.json({ ok: true, deleted, failed, skipped })
}
