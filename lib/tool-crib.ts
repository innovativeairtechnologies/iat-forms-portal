import type { Tone } from '@/components/admin/list'
import type { CribTool, CribToolStatus, CribEventAction } from './supabase'

/* Tool Crib domain layer — the single source of truth for status tones, code
   normalization, label URLs and the money rollups.

   NOT lib/tools.ts. That file is the internal field-app launcher (duct traverse,
   calculators) behind the `tools` perm. This is the warehouse tool check-out
   registry behind the `tool_crib` perm. They share a word and nothing else. */

// ── Brand ────────────────────────────────────────────────────────────────────
// Used on the printed label and the "if found, contact us" note on the scan
// page. There's no repo-wide brand constant yet (the name is hardcoded in a
// dozen places); scoped here for the two Tool Crib uses. Phone matches the
// contact line in app/api/admin/srv-review.
export const IAT_NAME = 'Innovative Air Technologies'
export const IAT_PHONE_DISPLAY = '770-788-6744'
export const IAT_PHONE_TEL = '+17707886744'

// The sticker descriptor runs vertically up the right edge of the QR, so its
// length is bounded by the QR's height. 14 chars is the most that fits at a
// readable size — enforced on the input, the server, and the label render so no
// description can ever run past the code. Covers the usual 2-word tool names
// ("Meter kit", "Impact driver", "Torque wrench").
export const CRIB_SHORT_LABEL_MAX = 14

// ── Status ───────────────────────────────────────────────────────────────────

export const CRIB_STATUS: Record<CribToolStatus, { label: string; tone: Tone }> = {
  available:   { label: 'Available',   tone: 'emerald' },
  checked_out: { label: 'Checked out', tone: 'sky' },
  maintenance: { label: 'Maintenance', tone: 'amber' },
  lost:        { label: 'Lost',        tone: 'rose' },
  retired:     { label: 'Retired',     tone: 'slate' },
}

export const CRIB_EVENT_LABEL: Record<CribEventAction, string> = {
  created:        'Added to the crib',
  check_out:      'Checked out',
  check_in:       'Checked in',
  force_check_in: 'Force-returned',
  transfer:       'Custody transferred',
  status_change:  'Status changed',
  note:           'Note',
}

/* A fixed list, not freeform text. Freeform drifts into "Drills" / "drill" /
   "Drill " within a week, and the by-category cost rollup silently splits across
   the variants — which makes the one number leadership looks at wrong. */
export const CRIB_CATEGORIES = [
  'Power tools',
  'Hand tools',
  'Test equipment',
  'Ladders & access',
  'Carts & material handling',
  'Safety equipment',
  'Other',
] as const
export type CribCategory = (typeof CRIB_CATEGORIES)[number]

// ── Codes ────────────────────────────────────────────────────────────────────

/* The label under the QR reads 'IAT-0042'. Codes are minted by a DB sequence
   (see migration 050) — never here; app-side minting races.

   Accepts anything a human or a scanner might actually deliver:
     'IAT-0042' · 'iat-0042' · ' iat 42 ' · '42' · a full scanned URL.
   Returns the canonical uppercase form, or null if there's no code in there.

   Bare digits are accepted because someone reading a scuffed label aloud says
   "forty-two", not "india-alpha-tango-dash-zero-zero-four-two". */
export function normalizeTagCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null

  // A scanned QR delivers the whole URL. Take the last path segment.
  if (s.includes('/')) {
    const seg = s.split(/[?#]/)[0].split('/').filter(Boolean).pop()
    if (!seg) return null
    s = seg
  }

  s = s.toUpperCase().replace(/\s+/g, '')

  const m = s.match(/^(?:IAT[-\s]?)?(\d{1,6})$/)
  if (!m) return null
  return `IAT-${m[1].padStart(4, '0')}`
}

/* The <img src> for a stored tool photo. Points at the staff-gated read route,
   which 307-redirects to a short-lived signed URL (the crib-photos bucket is
   private). photo_urls holds storage PATHS, not public URLs. */
export function photoSrc(path: string): string {
  return `/api/tool-crib/photo?path=${encodeURIComponent(path)}`
}

/** The representative photo for a tool — the first one, or null. */
export function toolThumbPath(photoUrls: string[] | null | undefined): string | null {
  return photoUrls && photoUrls.length > 0 ? photoUrls[0] : null
}

/* The origin baked into printed labels.

   Deliberately NOT NEXT_PUBLIC_APP_URL: that is 'http://localhost:3000' on a dev
   box, and a label is glued to a drill forever. Printing from dev with the
   ambient var would produce a sheet of stickers pointing at localhost, and we'd
   only find out when someone scanned one on the floor. This var exists solely so
   label printing has a value that cannot silently be a dev value. */
export const LABEL_ORIGIN = process.env.NEXT_PUBLIC_LABEL_ORIGIN || ''

/* The URL a printed QR encodes. Short and route-stable: /t/ is a redirect stub
   with nothing to outgrow, so renaming or moving the tool-crib routes later
   doesn't invalidate stickers already on tools. */
export function labelUrl(tagCode: string): string {
  return `${LABEL_ORIGIN}/t/${tagCode}`
}

/** True when labels can safely be printed. Guards the print UI. */
export function canPrintLabels(): boolean {
  return /^https:\/\/[^/]+$/.test(LABEL_ORIGIN)
}

// ── Money ────────────────────────────────────────────────────────────────────

export function formatCost(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/* The two numbers leadership actually asks for: how much kit is off the shelf
   right now, and how much has evaporated. Tools with no purchase_cost recorded
   contribute 0 — so these read as a floor, not a precise valuation. */
export function cribTotals(tools: Pick<CribTool, 'status' | 'purchase_cost'>[]) {
  let onFloor = 0, lost = 0, available = 0, checkedOut = 0, maintenance = 0
  for (const t of tools) {
    const cost = t.purchase_cost ?? 0
    if (t.status === 'checked_out') { onFloor += cost; checkedOut++ }
    else if (t.status === 'lost')   { lost += cost; }
    else if (t.status === 'available')   available++
    else if (t.status === 'maintenance') maintenance++
  }
  return { onFloor, lost, available, checkedOut, maintenance }
}

// ── Error mapping ────────────────────────────────────────────────────────────

/* The custody functions in migration 050 raise bare sentinel codes. Turn them
   into something a person holding a drill can act on. Anything unmapped is a
   real bug, not a user error — say so rather than inventing a friendly lie. */
const CRIB_ERRORS: Record<string, string> = {
  TOOL_NOT_AVAILABLE:        'Someone already has this one.',
  NOT_HELD_BY_ACTOR:         "This isn't checked out to you.",
  TOOL_NOT_CHECKED_OUT:      "This tool isn't checked out.",
  TOOL_NOT_FOUND:            'No tool with that code.',
  TOOL_IS_CHECKED_OUT:       'Force-return it first — it’s still checked out.',
  REASON_REQUIRED:           'A reason is required.',
  RECIPIENT_REQUIRED:        'Pick who it’s going to.',
  ALREADY_HELD_BY_RECIPIENT: 'They already have it.',
  BAD_STATUS:                'That status isn’t valid.',
}

export function cribErrorMessage(err: unknown): { message: string; known: boolean } {
  const raw = (err as { message?: string } | null)?.message ?? ''
  for (const [code, msg] of Object.entries(CRIB_ERRORS)) {
    if (raw.includes(code)) return { message: msg, known: true }
  }
  return { message: 'Something went wrong — try again.', known: false }
}
