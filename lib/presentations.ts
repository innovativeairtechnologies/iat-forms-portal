/* ────────────────────────────────────────────────────────────────────────────
   Presentations tool — shared types, constants, and pure helpers.

   PURE ONLY. No server imports (no supabaseAdmin) so this is safe to import from
   both server components and client components. Data-fetch helpers that touch the
   service-role client live in lib/presentations-data.ts (server-only).
   See docs/presentations-tool-spec.md.
   ──────────────────────────────────────────────────────────────────────────── */

export type BlockType = 'clip' | 'slide'
export type Visibility = 'internal' | 'client_safe'
export type SlideTemplate = 'welcome' | 'contact' | 'divider' | 'quote' | 'blank'
export type PresentationStatus = 'in_progress' | 'saved' | 'archived'

/** Freeform per-slide content. Which keys are used depends on the template. */
export interface SlideData {
  heading?: string
  subtext?: string
  /** background preset key (see SLIDE_BACKGROUNDS) */
  background?: string
  logo_url?: string | null
  /** quote / blank body text */
  body?: string
  /** quote attribution */
  attribution?: string
}

export interface PresentationBlock {
  id: string
  type: BlockType
  title: string
  category: string | null
  tags: string[]
  visibility: Visibility
  loom_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  slide_template: SlideTemplate | null
  slide_data: SlideData
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface Presentation {
  id: string
  title: string
  status: PresentationStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PresentationItem {
  id: string
  presentation_id: string
  block_id: string
  position: number
  block: PresentationBlock | null
}

/** Row shape for the builds list — a deck plus its computed summary. */
export interface DeckSummary extends Presentation {
  block_count: number
  runtime_seconds: number
}

// ── Mutation input shapes (used by the server actions + content panel) ─────────
export interface ClipInput {
  type: 'clip'
  title: string
  category?: string | null
  tags?: string[]
  visibility?: Visibility
  loom_url: string
  thumbnail_url?: string | null
  duration_seconds?: number | null
}
export interface SlideInput {
  type: 'slide'
  title: string
  category?: string | null
  tags?: string[]
  visibility?: Visibility
  slide_template: SlideTemplate
  slide_data: SlideData
}
export type BlockInput = ClipInput | SlideInput

// ── Library taxonomy ──────────────────────────────────────────────────────────
export const CATEGORIES = ['Fundamentals', 'Formulas', 'Products', 'Case studies', 'Other'] as const

export const SLIDE_TEMPLATES: { key: SlideTemplate; label: string }[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'contact', label: 'Contact' },
  { key: 'divider', label: 'Section divider' },
  { key: 'quote', label: 'Quote' },
  { key: 'blank', label: 'Blank' },
]

/** Background presets for slides — key → { label, bg (hex), fg, accent }. */
export const SLIDE_BACKGROUNDS: Record<string, { label: string; bg: string; fg: string; sub: string; accent: string }> = {
  dark:    { label: 'Charcoal', bg: '#1c1c1b', fg: '#f4f4f5', sub: '#a1a1aa', accent: '#10b981' },
  emerald: { label: 'Emerald',  bg: '#065f46', fg: '#ecfdf5', sub: '#6ee7b7', accent: '#a7f3d0' },
  slate:   { label: 'Slate',    bg: '#1e293b', fg: '#f1f5f9', sub: '#94a3b8', accent: '#38bdf8' },
  light:   { label: 'Light',    bg: '#f4f4f5', fg: '#18181b', sub: '#52525b', accent: '#059669' },
}
export const DEFAULT_BACKGROUND = 'dark'

export function backgroundOf(key: string | undefined) {
  return SLIDE_BACKGROUNDS[key || DEFAULT_BACKGROUND] || SLIDE_BACKGROUNDS[DEFAULT_BACKGROUND]
}

// ── Loom helpers ──────────────────────────────────────────────────────────────
/** Pull the video id out of a Loom share or embed URL. */
export function loomIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9-]+)/)
  return m ? m[1] : null
}

/** Turn any Loom URL into its player-embed URL. */
export function loomEmbedUrl(url: string | null | undefined): string | null {
  const id = loomIdFromUrl(url)
  return id ? `https://www.loom.com/embed/${id}` : null
}

// ── Formatting ────────────────────────────────────────────────────────────────
/** Seconds → "m:ss", or "—" when unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Total clip runtime of a set of blocks (slides count as 0). */
export function deckRuntimeSeconds(blocks: { duration_seconds?: number | null }[]): number {
  return blocks.reduce((sum, b) => sum + (b.duration_seconds || 0), 0)
}

/** Seconds → "m:ss" for a runtime readout (0 → "0:00"). */
export function formatRuntime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const STATUS_META: Record<PresentationStatus, { label: string; tone: 'emerald' | 'amber' | 'slate' }> = {
  in_progress: { label: 'In progress', tone: 'amber' },
  saved:       { label: 'Saved',       tone: 'emerald' },
  archived:    { label: 'Archived',    tone: 'slate' },
}
