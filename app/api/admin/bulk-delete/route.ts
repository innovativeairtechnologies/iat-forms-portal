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
      case 'rfq': {
        // Notes first, same as tickets and submissions — rfq_notes.rfq_id has no
        // ON DELETE CASCADE, so the parent delete would fail on the FK otherwise.
        //
        // ⚠️ Deleting a quote request destroys the customer's survey answers and
        // the estimate we returned. That is the whole record of a conversation
        // with someone outside the company, and there is no undo — hence
        // full-admin only (the gate at the top of this route), while the RFQ page
        // itself is open to anyone holding `deals`.
        //
        // The stored PDF goes WITH the record (owner, 2026-09-03). Migration 095
        // stores the exact bytes the customer's browser produced, and that file
        // carries their contact details, site location and project economics on
        // page one — so a deleted quote request must not leave it sitting in the
        // bucket. `pdf_path` is the only pointer to the object, so it has to be
        // read BEFORE the rows go.
        //
        // ⚠️ Deliberately UNLIKE the post_production case below, which keeps its
        // storage objects on purpose. The difference is what the blob is: there,
        // it is the only recording of what somebody said next to a unit and a
        // mis-click would be unrecoverable. Here it is a document we generated and
        // can regenerate from the survey answers — and the survey answers are
        // being destroyed in the same breath anyway.
        const { data: withPdfs } = await supabaseAdmin
          .from('rfq_requests').select('pdf_path').in('id', ids)
        const pdfPaths = (withPdfs ?? [])
          .map((r) => r.pdf_path)
          .filter((p): p is string => typeof p === 'string' && p.length > 0)

        await supabaseAdmin.from('rfq_notes').delete().in('rfq_id', ids)
        const { data, error } = await supabaseAdmin.from('rfq_requests').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null

        // Rows first, objects second, and never fatal. Removing the object first
        // would leave a surviving row pointing at a missing file if the row delete
        // then failed — a broken "Open the PDF" button on a record somebody still
        // has. This ordering fails the other way: a leftover object nobody can
        // reach, logged loudly, which is the cheaper mistake.
        if (!error && pdfPaths.length) {
          const { error: storageErr } = await supabaseAdmin.storage.from('rfq-pdfs').remove(pdfPaths)
          if (storageErr) {
            console.error('[bulk-delete] rfq rows deleted but their PDFs were left behind:', pdfPaths, storageErr)
          }
        }
        break
      }
      case 'post_production': {
        // Post-production FINDINGS. No child table to clear first — a finding's
        // notes are columns on it and its attachments live in `media` jsonb.
        //
        // ⚠️ The storage objects are deliberately left behind, the same call the
        // equipment and tool photos make. They are invisible and harmless, and a
        // cascading blob delete here would be irreversible in a way a row delete
        // is not — a mis-click would destroy the only recording of what somebody
        // said next to a unit.
        //
        // ⚠️ The walkaround is NOT deleted, even when its last finding goes. It
        // records that a named person walked a named unit on a date, which stays
        // true whether or not the findings survived — and deleting it would take
        // any sibling findings with it via ON DELETE CASCADE.
        //
        // Full-admin only, like every case here: the page is gated on
        // `engineering_jobs`, which engineering and production_manager hold, and
        // a finding is somebody's recorded criticism of a build with a two-week
        // clock on it. Removing one should be a narrower grant than working it.
        const { data, error } = await supabaseAdmin
          .from('pp_findings').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'pp_theme': {
        /* 🔴 DETACH THE PRE-PRODUCTION LINES FIRST — do not let them cascade.
         *
         * pp_preflight_items.theme_id is ON DELETE CASCADE, so deleting a theme
         * would silently delete its line from every pre-production check it was
         * ever carried into. Those lines are the record of a conversation a room
         * actually had — "we discussed this at kickoff and marked it Addressed" —
         * and a tidy-up on the themes board must not rewrite it.
         *
         * pp_preflight_items.title is a SNAPSHOT of the theme's name taken when
         * the check was held, and it is NOT NULL. That is exactly what makes this
         * possible: nulling theme_id leaves the line intact and still readable,
         * just no longer linked to a theme that no longer exists.
         *
         * pp_findings.theme_id is ON DELETE SET NULL already, so findings survive
         * a theme delete and simply become ungrouped. That is the right default —
         * deleting a grouping should never delete the observations in it.
         */
        await supabaseAdmin.from('pp_preflight_items').update({ theme_id: null }).in('theme_id', ids)
        const { data, error } = await supabaseAdmin
          .from('pp_themes').delete().in('id', ids).select('id')
        deleted = data?.length ?? 0
        errorMsg = error?.message ?? null
        break
      }
      case 'pp_preflight': {
        // Items cascade WITH the check, and that is correct: a pre-production
        // check and its lines are one record, not two. Unlike the theme case
        // above, there is nothing here that outlives the parent.
        const { data, error } = await supabaseAdmin
          .from('pp_preflights').delete().in('id', ids).select('id')
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
