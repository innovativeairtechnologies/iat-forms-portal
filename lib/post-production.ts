/* ────────────────────────────────────────────────────────────────────────────
   lib/post-production.ts — the Post-Production domain: what a finding is, how
   long there is to answer it, and how it reads on a screen.

   🔴 DEPENDENCY-FREE ON PURPOSE, exactly like lib/engineering.ts. The walkaround
   capture surface is a client component and imports VALUES from here
   (CATEGORIES, SEVERITIES, the labels, dueFor). If this file ever imports a
   module that reaches supabase-admin, that value import ships the service-role
   client to the browser and the page dies at hydration — past tsc and past a
   green server render.

   Data access lives in lib/pp-data.ts. Recurrence matching in lib/pp-match.ts.
   Only pure functions and constants belong here.
   ──────────────────────────────────────────────────────────────────────────── */

import type { Tone } from '@/components/admin/list'

/** The response window from the meeting, in calendar days: "it needs to be
 *  responded to within two weeks on what the solution is."
 *
 *  Calendar days, not working days — that is how it was said out loud, and a
 *  working-day reading would quietly hand back three extra days over a holiday
 *  week without anyone deciding to. */
export const RESPONSE_DAYS = 14

/** How far back the pre-production checklist reaches for themes to carry in.
 *  The transcript says "all the issues from previous jobs in the last month".
 *  A theme whose last sighting is older than this has either been fixed or has
 *  stopped mattering; carrying it forever is how a checklist becomes wallpaper. */
export const PREFLIGHT_LOOKBACK_DAYS = 60

/** How many findings on a theme make it worth putting in front of leadership.
 *  Two is "it happened again", which is the moment the transcript wants caught —
 *  "if it's occurred more than one time, it automatically gets put into… those
 *  pre-production meetings." */
export const RECURRENCE_THRESHOLD = 2

// ─── Categories ──────────────────────────────────────────────────────────────
//
// Nine buckets, and they come from what the walk actually produced rather than
// from a quality-management taxonomy. The transcript's own worked example — the
// wheel that could have come further down, the gap to the reactor, air coming in
// and having to get back down again — is `layout_airflow`. The one before it,
// "we didn't account for that little guy right there… we'd have to gouge that
// out", is `fit_clearance`. Those two are first because they are what an
// engineer walking a built unit sees.
//
// `other` stays last and is a real answer, not a failure. Somebody standing at a
// unit with a phone must never have to shop for a category.

export const CATEGORIES = [
  'layout_airflow',
  'fit_clearance',
  'fabrication',
  'electrical',
  'controls',
  'finish',
  'serviceability',
  'documentation',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  layout_airflow: 'Layout & airflow',
  fit_clearance: 'Fit & clearance',
  fabrication: 'Fabrication',
  electrical: 'Electrical',
  controls: 'Controls',
  finish: 'Paint & finish',
  serviceability: 'Serviceability',
  documentation: 'Drawings & docs',
  other: 'Other',
}

/** The short form for a chip on a 375px screen. */
export const CATEGORY_SHORT: Record<Category, string> = {
  layout_airflow: 'Airflow',
  fit_clearance: 'Fit',
  fabrication: 'Fab',
  electrical: 'Elec',
  controls: 'Controls',
  finish: 'Finish',
  serviceability: 'Service',
  documentation: 'Docs',
  other: 'Other',
}

export const CATEGORY_TONE: Record<Category, Tone> = {
  layout_airflow: 'sky',
  fit_clearance: 'violet',
  fabrication: 'amber',
  electrical: 'rose',
  controls: 'emerald',
  finish: 'slate',
  serviceability: 'sky',
  documentation: 'slate',
  other: 'slate',
}

export const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v)

// ─── Severity ────────────────────────────────────────────────────────────────
//
// Three levels, and the bottom one is load-bearing. Most of what a walk produces
// is what the transcript calls "little things" — and the old spreadsheet's
// failure mode was that a thousand little things and one real problem looked
// identical in a list. `nit` lets somebody log an observation honestly instead
// of either inflating it or swallowing it.

export const SEVERITIES = ['nit', 'should_fix', 'must_fix'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_LABELS: Record<Severity, string> = {
  nit: 'Little thing',
  should_fix: 'Should fix',
  must_fix: 'Must fix',
}

export const SEVERITY_BLURB: Record<Severity, string> = {
  nit: 'Worth knowing. Nothing is wrong with the unit.',
  should_fix: 'Change it on the next one.',
  must_fix: 'Do not build another one like this.',
}

export const SEVERITY_TONE: Record<Severity, Tone> = {
  nit: 'slate',
  should_fix: 'amber',
  must_fix: 'rose',
}

export const isSeverity = (v: unknown): v is Severity =>
  typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v)

// ─── Status ──────────────────────────────────────────────────────────────────
//
// `answered` is separate from `closed` on purpose, and it is the whole
// difference between this and the spreadsheet. An engineer writing "we changed
// the bracket" does not get to also decide the matter is settled — it goes back
// to the person who raised it, who accepts or reopens. A queue where the owner
// of the work is also the judge of the work is a queue that empties itself.

export const FINDING_STATUSES = ['draft', 'open', 'assigned', 'answered', 'closed', 'duplicate'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  draft: 'Drafting',
  open: 'Unassigned',
  assigned: 'With engineering',
  answered: 'Answered',
  closed: 'Closed',
  duplicate: 'Duplicate',
}

export const FINDING_STATUS_TONE: Record<FindingStatus, Tone> = {
  draft: 'slate',
  open: 'amber',
  assigned: 'sky',
  answered: 'violet',
  closed: 'emerald',
  duplicate: 'slate',
}

/** Still owed an answer. `answered` is NOT here — it is owed an acceptance, and
 *  that is a different chase to a different person. */
export const OPEN_FINDING_STATUSES: readonly FindingStatus[] = ['open', 'assigned']

export const THEME_STATUSES = ['open', 'resolved', 'accepted'] as const
export type ThemeStatus = (typeof THEME_STATUSES)[number]

export const THEME_STATUS_LABELS: Record<ThemeStatus, string> = {
  open: 'Recurring',
  resolved: 'Resolved',
  accepted: 'Accepted trade-off',
}

export const THEME_STATUS_TONE: Record<ThemeStatus, Tone> = {
  open: 'rose',
  resolved: 'emerald',
  accepted: 'slate',
}

export const PREFLIGHT_VERDICTS = ['pending', 'addressed', 'not_applicable', 'risk'] as const
export type PreflightVerdict = (typeof PREFLIGHT_VERDICTS)[number]

export const VERDICT_LABELS: Record<PreflightVerdict, string> = {
  pending: 'Not discussed',
  addressed: 'Designed around',
  not_applicable: "Doesn't apply",
  risk: 'Known risk',
}

export const VERDICT_TONE: Record<PreflightVerdict, Tone> = {
  pending: 'slate',
  addressed: 'emerald',
  not_applicable: 'sky',
  risk: 'amber',
}

// ─── Who walked it ───────────────────────────────────────────────────────────
//
// The four perspectives the meeting actually asked for — "from the engineer
// standpoint. The production guy's standpoint, who built it, the electrician's
// point of view from the guy who wired it, and even the guy who tested it."
//
// This is not decoration and it is not a job title. It is the answer to "why is
// this person's opinion of this unit worth recording", and it is what turns
// twelve findings on job 4153 from a list into a build review.

export const WALK_ROLES = ['engineering', 'built_it', 'wired_it', 'tested_it', 'other'] as const
export type WalkRole = (typeof WALK_ROLES)[number]

export const WALK_ROLE_LABELS: Record<WalkRole, string> = {
  engineering: 'Engineering',
  built_it: 'Built it',
  wired_it: 'Wired it',
  tested_it: 'Tested it',
  other: 'Something else',
}

/** How it reads next to a name on a finding: "Kyle · wired it". */
export const WALK_ROLE_SUFFIX: Record<WalkRole, string> = {
  engineering: 'engineering',
  built_it: 'built it',
  wired_it: 'wired it',
  tested_it: 'tested it',
  other: '',
}

export const WALK_ROLE_TONE: Record<WalkRole, Tone> = {
  engineering: 'sky',
  built_it: 'amber',
  wired_it: 'violet',
  tested_it: 'emerald',
  other: 'slate',
}

export const isWalkRole = (v: unknown): v is WalkRole =>
  typeof v === 'string' && (WALK_ROLES as readonly string[]).includes(v)

/** How a walkaround got here. `tag` means somebody scanned a sticker and typed
 *  their own name — unverified, and every screen that shows the name says so. */
export type WalkSource = 'portal' | 'tag'

// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaKind = 'photo' | 'video' | 'audio'

export type Media = {
  kind: MediaKind
  /** Storage path in the private `post-production` bucket. Never a URL — a URL
   *  in a column is a URL that expires. */
  path: string
  mime?: string
  bytes?: number
  duration_ms?: number
}

/** Supabase's standard upload endpoint — the one uploadToSignedUrl uses — is
 *  capped by the project's global upload limit, 50MB unless raised in the
 *  dashboard. Matches the bucket's file_size_limit in migration 098. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const MEDIA_EXT: Record<MediaKind, string[]> = {
  photo: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
  video: ['mp4', 'mov', 'm4v', 'webm', 'quicktime', '3gp'],
  audio: ['m4a', 'mp4', 'mp3', 'webm', 'ogg', 'wav', 'aac'],
}

/** The read route for one stored object. Private bucket, so an <img> or a
 *  <video> needs the redirect-to-signed-URL hop (same shape as tool-crib). */
export function mediaSrc(path: string): string {
  return `/api/admin/post-production/media?path=${encodeURIComponent(path)}`
}

export function humanBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function clock(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── Row shapes ──────────────────────────────────────────────────────────────

export type PpWalkaround = {
  id: string
  /** The four digits the shop says out loud. This is the unit SERIAL and the job
   *  number — the same number (confirmed 2026-08-27). The column keeps the name
   *  `job_number` because that is what it joins to on eng_jobs; the UI calls it
   *  what the shop calls it. */
  job_number: string
  job_id: string | null
  customer_name: string
  model_number: string | null
  /** NULL for a tag walk — nobody was signed in. */
  walked_by: string | null
  /** Self-declared on a tag walk. Never render it as though it were verified. */
  walked_by_name: string
  walked_by_role: WalkRole | null
  source: WalkSource
  tag_id: string | null
  status: 'walking' | 'submitted'
  notes: string | null
  started_at: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export type PpTag = {
  id: string
  token: string
  label: string
  /** NULL = a standing tag (scanner types the number). Set = a unit tag. */
  job_number: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

/** The scan URL a QR encodes. Deliberately NOT NEXT_PUBLIC_APP_URL, which is
 *  'http://localhost:3000' on a dev box — a sticker is glued to a machine for
 *  years, and printing one from dev would produce a QR that works nowhere. Same
 *  reasoning and the same variable as the tool-crib labels. */
export function walkTagUrl(token: string): string {
  const origin = process.env.NEXT_PUBLIC_LABEL_ORIGIN || 'https://iatportal.vercel.app'
  return `${origin.replace(/\/+$/, '')}/walk/${token}`
}

export type PpFinding = {
  id: string
  walkaround_id: string
  job_number: string
  job_id: string | null
  seq: number
  note: string
  note_source: 'typed' | 'dictated' | 'transcribed' | 'mixed'
  category: Category
  severity: Severity
  media: Media[]
  status: FindingStatus
  assignee_id: string | null
  assigned_at: string | null
  due_date: string | null
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  theme_id: string | null
  theme_source: 'ai' | 'human' | null
  theme_note: string | null
  created_at: string
  updated_at: string
}

/** A finding joined to the names a screen needs.
 *
 *  `source` and `walked_by_role` ride along from the walkaround because every
 *  screen that prints `walked_by_name` has to be able to say whether that name
 *  was authenticated or typed into a phone by whoever was holding it. */
export type PpFindingRow = PpFinding & {
  assignee_name: string | null
  walked_by_name: string
  walked_by_role: WalkRole | null
  source: WalkSource
  customer_name: string
  theme_title: string | null
}

export type PpTheme = {
  id: string
  title: string
  summary: string | null
  category: Category
  status: ThemeStatus
  resolution: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type PpThemeRow = PpTheme & {
  /** Confirmed by a person. This is the number leadership is shown. */
  confirmed: number
  /** Matched by the model and not yet looked at. Shown SEPARATELY, never added
   *  into the headline count — see the theme_source note in migration 098. */
  suggested: number
  /** Confirmed findings still owed an answer. */
  stillOpen: number
  jobs: string[]
  firstSeen: string | null
  lastSeen: string | null
}

// ─── The clock ───────────────────────────────────────────────────────────────

export type Standing = {
  kind: 'undated' | 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'done'
  label: string
  /** Negative = late by that many days. Null when there is no date to be late against. */
  days: number | null
}

export const STANDING_TONE: Record<Standing['kind'], Tone> = {
  undated: 'slate',
  overdue: 'rose',
  due_today: 'amber',
  due_soon: 'amber',
  on_track: 'sky',
  done: 'emerald',
}

/**
 * Where a finding stands against its two-week clock.
 *
 * ⚠️ An undated finding reports 'undated', never 'on track'. A finding with no
 * due date is a finding nobody has committed to, and scoring it as healthy makes
 * "stop setting due dates" the cheapest way to improve the number — the same
 * rule the engineering report follows for on-time percentages.
 */
export function standingOf(
  f: Pick<PpFinding, 'status' | 'due_date'>,
  now: Date = new Date(),
): Standing {
  if (f.status === 'closed' || f.status === 'duplicate') return { kind: 'done', label: 'Closed', days: null }
  if (f.status === 'answered') return { kind: 'done', label: 'Answered', days: null }
  if (!f.due_date) return { kind: 'undated', label: 'No date', days: null }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const due = new Date(`${f.due_date}T12:00:00`)
  if (Number.isNaN(due.getTime())) return { kind: 'undated', label: 'No date', days: null }
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const days = Math.round((dueDay - today) / 86_400_000)

  if (days < 0) return { kind: 'overdue', label: `${-days}d over`, days }
  if (days === 0) return { kind: 'due_today', label: 'Due today', days }
  if (days <= 3) return { kind: 'due_soon', label: `${days}d left`, days }
  return { kind: 'on_track', label: `${days}d left`, days }
}

export const isLate = (s: Standing) => s.kind === 'overdue'

/** The due date for a finding submitted on `from`. */
export function dueFor(from: Date = new Date(), days: number = RESPONSE_DAYS): string {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A four-digit-ish shop number, cleaned. Kept permissive on length — the shop
 *  says "4153" today, but a job number is a human convention and hard-coding
 *  exactly four digits would reject the first five-digit one and give no clue
 *  why. Non-digits are stripped because a phone keypad and a person in a hurry
 *  produce spaces and dashes. */
export function normalizeJobNumber(raw: string): string {
  return raw.replace(/[^0-9A-Za-z-]/g, '').trim().slice(0, 24)
}

/** First line of a note, for a list row. Findings are dictated, so the first
 *  sentence is usually the observation and the rest is the reasoning. */
export function findingTitle(note: string, max = 90): string {
  const first = (note || '').trim().split(/\n|(?<=[.!?])\s+/)[0] ?? ''
  const t = first.trim() || (note || '').trim()
  if (!t) return 'Untitled finding'
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

export function shortDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00` : d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
