'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import type {
  PresentationStatus, Visibility, BlockInput,
} from '@/lib/presentations'

/* Presentations mutations. Run with the service-role key (bypasses RLS), so each
   guards the caller with getAdminUser() rather than trusting only the /admin
   middleware — same model as the org-chart actions. */

async function requireAdmin() {
  const admin = await getAdminUser()
  if (!admin) throw new Error('Forbidden')
  return admin
}

// ── Decks ─────────────────────────────────────────────────────────────────────

export async function createPresentation(title?: string): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const { data, error } = await supabaseAdmin
    .from('presentations')
    .insert({ title: title?.trim() || 'Untitled presentation', created_by: admin.user.id })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message || 'Could not create presentation.')

  revalidatePath('/admin/presentations')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'presentation.create', entityType: 'presentation', entityId: data.id,
    summary: `Created presentation "${title?.trim() || 'Untitled presentation'}"`,
  })
  return { id: data.id }
}

export async function renamePresentation(id: string, title: string): Promise<void> {
  await requireAdmin()
  const clean = title.trim().slice(0, 140) || 'Untitled presentation'
  const { error } = await supabaseAdmin
    .from('presentations').update({ title: clean, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/presentations')
  revalidatePath(`/admin/presentations/${id}`)
}

export async function setPresentationStatus(id: string, status: PresentationStatus): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await supabaseAdmin
    .from('presentations').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/presentations')
  revalidatePath(`/admin/presentations/${id}`)
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: `presentation.${status}`, entityType: 'presentation', entityId: id,
    summary: `Marked presentation ${status.replace('_', ' ')}`,
  })
}

/** Deep-copy a deck (with its ordered items) into a new in-progress build. */
export async function duplicatePresentation(id: string): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const { data: src } = await supabaseAdmin.from('presentations').select('title').eq('id', id).single()
  const { data: items } = await supabaseAdmin
    .from('presentation_items').select('block_id, position').eq('presentation_id', id).order('position')

  const { data: deck, error } = await supabaseAdmin
    .from('presentations')
    .insert({ title: `Copy of ${src?.title || 'presentation'}`.slice(0, 140), created_by: admin.user.id })
    .select('id').single()
  if (error || !deck) throw new Error(error?.message || 'Could not duplicate.')

  if (items && items.length) {
    await supabaseAdmin.from('presentation_items').insert(
      items.map((it, i) => ({ presentation_id: deck.id, block_id: it.block_id, position: i })),
    )
  }
  revalidatePath('/admin/presentations')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'presentation.duplicate', entityType: 'presentation', entityId: deck.id,
    summary: `Duplicated a presentation`, metadata: { from: id },
  })
  return { id: deck.id }
}

/** Replace a deck's ordered items (autosave). Full-replace — decks are small. */
export async function setPresentationItems(id: string, blockIds: string[]): Promise<void> {
  await requireAdmin()
  await supabaseAdmin.from('presentation_items').delete().eq('presentation_id', id)
  if (blockIds.length) {
    const { error } = await supabaseAdmin.from('presentation_items').insert(
      blockIds.map((block_id, position) => ({ presentation_id: id, block_id, position })),
    )
    if (error) throw new Error(error.message)
  }
  await supabaseAdmin.from('presentations').update({ updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath(`/admin/presentations/${id}`)
  revalidatePath('/admin/presentations')
}

// ── Library blocks ──────────────────────────────────────────────────────────

function cleanTags(tags?: string[]): string[] {
  return Array.from(new Set((tags || []).map((t) => t.trim()).filter(Boolean))).slice(0, 12).map((t) => t.slice(0, 40))
}

export async function createBlock(input: BlockInput): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const title = input.title.trim().slice(0, 140)
  if (!title) throw new Error('A title is required.')

  const common = {
    title,
    category: input.category?.trim() || null,
    tags: cleanTags(input.tags),
    visibility: (input.visibility as Visibility) || 'internal',
    created_by: admin.user.id,
  }

  let row: Record<string, unknown>
  if (input.type === 'clip') {
    if (!input.loom_url?.trim()) throw new Error('A Loom link is required for a clip.')
    row = {
      ...common, type: 'clip',
      loom_url: input.loom_url.trim(),
      thumbnail_url: input.thumbnail_url || null,
      duration_seconds: input.duration_seconds ?? null,
    }
  } else {
    row = { ...common, type: 'slide', slide_template: input.slide_template, slide_data: input.slide_data || {} }
  }

  const { data, error } = await supabaseAdmin.from('presentation_blocks').insert(row).select('id').single()
  if (error || !data) throw new Error(error?.message || 'Could not save the block.')

  revalidatePath('/admin/presentations')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'presentation.block.create', entityType: 'presentation_block', entityId: data.id,
    summary: `Added a ${input.type} to the library: "${title}"`,
  })
  return { id: data.id }
}

export async function updateBlock(id: string, patch: Partial<BlockInput>): Promise<void> {
  const admin = await requireAdmin()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) update.title = patch.title.trim().slice(0, 140)
  if (patch.category !== undefined) update.category = patch.category?.trim() || null
  if (patch.tags !== undefined) update.tags = cleanTags(patch.tags)
  if (patch.visibility !== undefined) update.visibility = patch.visibility
  if (patch.type === 'clip') {
    if (patch.loom_url !== undefined) update.loom_url = patch.loom_url.trim()
    if (patch.thumbnail_url !== undefined) update.thumbnail_url = patch.thumbnail_url || null
    if (patch.duration_seconds !== undefined) update.duration_seconds = patch.duration_seconds
  }
  if (patch.type === 'slide') {
    if (patch.slide_template !== undefined) update.slide_template = patch.slide_template
    if (patch.slide_data !== undefined) update.slide_data = patch.slide_data
  }

  const { error } = await supabaseAdmin.from('presentation_blocks').update(update).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/presentations')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'presentation.block.update', entityType: 'presentation_block', entityId: id,
    summary: `Edited a library block`,
  })
}

export async function setBlockArchived(id: string, archived: boolean): Promise<void> {
  const admin = await requireAdmin()
  const { error } = await supabaseAdmin
    .from('presentation_blocks')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/presentations')
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: archived ? 'presentation.block.archive' : 'presentation.block.restore',
    entityType: 'presentation_block', entityId: id,
    summary: `${archived ? 'Archived' : 'Restored'} a library block`,
  })
}

// ── Loom metadata (public oEmbed — no auth) ────────────────────────────────────

export async function fetchLoomMeta(
  url: string,
): Promise<{ title: string | null; thumbnail_url: string | null; duration_seconds: number | null } | null> {
  await requireAdmin()
  try {
    const res = await fetch(`https://www.loom.com/v1/oembed?format=json&url=${encodeURIComponent(url.trim())}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { title?: string; thumbnail_url?: string; duration?: number }
    return {
      title: j.title || null,
      thumbnail_url: j.thumbnail_url || null,
      duration_seconds: typeof j.duration === 'number' ? Math.round(j.duration) : null,
    }
  } catch {
    return null
  }
}
