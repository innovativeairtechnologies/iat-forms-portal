'use client'

// Client-side tracking of which Knowledge Base articles a visitor has opened.
// Support customers are anonymous on /support, so there is no server session to
// hang views off of. We record opens in localStorage and attach the list to the
// ticket payload when the customer submits (see EquipmentTicketForm). The server
// then validates the slugs against published articles before storing them.

export type KbView = {
  slug: string
  title: string
  first_viewed_at: string
  last_viewed_at: string
  count: number
}

const KEY = 'iat:kb-views'
const MAX_ENTRIES = 50

/** Read the visitor's recorded article views. Returns [] outside the browser. */
export function getKbViews(): KbView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as KbView[]) : []
  } catch {
    return []
  }
}

/** Record (or bump) a view of one article. Safe to call repeatedly. */
export function recordKbView(slug: string, title: string): void {
  if (typeof window === 'undefined' || !slug) return
  try {
    const now = new Date().toISOString()
    const views = getKbViews()
    const existing = views.find(v => v.slug === slug)
    if (existing) {
      existing.title = title
      existing.last_viewed_at = now
      existing.count += 1
    } else {
      views.push({ slug, title, first_viewed_at: now, last_viewed_at: now, count: 1 })
    }
    window.localStorage.setItem(KEY, JSON.stringify(views.slice(-MAX_ENTRIES)))
  } catch {
    // Ignore quota / serialization errors — view tracking is best-effort.
  }
}

/** Clear all recorded views — called after a ticket is successfully submitted. */
export function clearKbViews(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
