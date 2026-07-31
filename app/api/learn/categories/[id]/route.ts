import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getDeleteImpact } from '@/lib/learn'
import { logAudit } from '@/lib/audit'

/* Categories are delete-only for now, deliberately.

   A PATCH (rename) handler was written here and removed before shipping: no UI
   calls it, and an admin-only endpoint that nothing exercises never gets
   smoke-tested. Renaming is on the Learn roadmap (docs/learn.md) — add it back
   together with the affordance that uses it, and note that Supabase's
   .update().eq() does NOT error on a non-existent id, so it needs the same
   existence check the DELETE below does. */

// DELETE /api/learn/categories/[id]
// The widest blast radius in Learn, and irreversible. Every FK below a category
// is ON DELETE CASCADE — learn_modules.category_id → learn_lessons.module_id →
// learn_progress.lesson_id — so this destroys the category, all of its subjects,
// all of their lessons, and every completion record for those lessons. XP,
// levels and badges are derived from learn_progress, so people's totals drop
// retroactively and cannot be restored.
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: category } = await supabaseAdmin
    .from('learn_categories').select('name').eq('id', params.id).single()
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  // If we cannot establish what is about to be destroyed, we do not destroy it.
  let impact
  try {
    impact = await getDeleteImpact('category', params.id)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not determine what would be deleted' },
      { status: 500 },
    )
  }

  const { error } = await supabaseAdmin.from('learn_categories').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'learn.category.delete',
    entityType: 'learn_category',
    entityId: params.id,
    summary: `Deleted Learn category "${category.name}" with ${impact.modules} subject${impact.modules === 1 ? '' : 's'}`
      + ` and ${impact.lessons} lesson${impact.lessons === 1 ? '' : 's'}`
      + (impact.completions > 0 ? ` (erased ${impact.completions} completion${impact.completions === 1 ? '' : 's'})` : ''),
    metadata: { name: category.name, ...impact },
  })

  return NextResponse.json({ ok: true, deleted: impact })
}
