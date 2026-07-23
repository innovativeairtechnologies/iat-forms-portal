'use server'

import { revalidatePath } from 'next/cache'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { saveLayout, resetLayout } from '@/lib/dashboard-layouts'
import { CARD_BY_ID, type LayoutItem, type Span } from '@/components/dashboards/dept-cards'

/* Server actions for the per-user department-dashboard editor. Only scoped roles
   have a customizable department dashboard (admin uses the exec view). Every
   saved layout is validated against the card registry AND the user's live
   permissions, and spans are clamped to each card's allowed sizes — so a crafted
   payload can never store an unknown card, a card the user can't see, or an
   illegal size. */

const SPANS: Span[] = [1, 2, 3]

export async function saveDashboardLayout(raw: LayoutItem[]): Promise<{ ok: boolean; error?: string }> {
  const actor = await getAdminSurfaceUser()
  if (!actor || actor.role === 'admin') return { ok: false, error: 'No customizable dashboard for this role.' }
  if (!Array.isArray(raw)) return { ok: false, error: 'Invalid layout.' }

  const seen = new Set<string>()
  const layout: LayoutItem[] = []
  for (const it of raw) {
    const id = it?.id
    const card = typeof id === 'string' ? CARD_BY_ID[id] : undefined
    if (!card || seen.has(id)) continue
    if (card.perm && !actor.can(card.perm)) continue // never store a card the user can't see
    const span: Span = SPANS.includes(it?.span) && card.sizes.includes(it.span) ? it.span : card.defaultSpan
    seen.add(id)
    layout.push({ id, span })
  }
  if (layout.length === 0) return { ok: false, error: 'A dashboard needs at least one card.' }

  await saveLayout(actor.user.id, layout)
  revalidatePath('/admin')
  return { ok: true }
}

export async function resetDashboardLayout(): Promise<{ ok: boolean }> {
  const actor = await getAdminSurfaceUser()
  if (!actor || actor.role === 'admin') return { ok: false }
  await resetLayout(actor.user.id)
  revalidatePath('/admin')
  return { ok: true }
}
