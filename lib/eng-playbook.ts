/* ────────────────────────────────────────────────────────────────────────────
   lib/eng-playbook.ts — the rules that turn "a PO landed for job 4153" into a
   list of dated, assigned, estimated tasks.

   🔴 SERVER-FREE, like lib/engineering.ts. The playbook editor is a client
   component and imports ENG_PLAYBOOK_DEFAULT as a VALUE (that is what "Reset to
   the shipped default" restores). The DB read lives in lib/eng-data.ts.

   ── Where every number came from ────────────────────────────────────────────
   The meeting's own follow-up list says it plainly: "specific formulas,
   dependencies, and timelines for each task were not defined. A follow-up
   session is needed to map these business rules precisely." So this file is
   seeded with what IS written down and nothing else:

     • Engineering Lead-Times.xlsx › Mech Lead-Times — "Average Lead-Time"
       (target hands-on hours), "Cycle Time" (calendar days from the anchor) and
       "Priority", for the four highlighted rows and the rows beneath them.
     • Engineering Lead-Times.xlsx › Elec Lead-Times — the takt hours AND the
       completion percentages: Drawings (incl sub) 30%, BOM 60%, Programming
       99%, and a cell comment reading "Upload 1%" that closes it at 100.
     • The monday Submittals board — the eight sub-tasks a submittal is actually
       broken into, read off a completed job.
     • The 2026-08-25 meeting notes — the production and BOM breakdowns, which
       exist as words but not yet as numbers.

   Anything the sources leave as "TBD", "-", "See Master", "Per Smartsheet" or
   "Must be scheduled" is `null` here and prints as "Not set". Steps that no
   source has costed carry `provisional: true`, and the editor shows them with an
   amber "unconfirmed" marker so nobody mistakes a placeholder for a standard.
   That is the whole point: a fabricated 4-hour estimate becomes the baseline
   every future variance is measured against, and nobody ever finds out.
   ──────────────────────────────────────────────────────────────────────────── */

import { STREAMS, type Complexity, type Stream } from './engineering'

export type PlaybookStep = {
  /** Stable key. Renaming a title is safe; changing this orphans history. */
  key: string
  title: string
  /** Workbook "Average Lead-Time" — the hands-on hours this SHOULD take. */
  targetHours: number | null
  /** Due date = the job's PO date + this many calendar days. */
  cycleDays: number | null
  /** Where finishing this step lands the STREAM's progress bar (Elec sheet). */
  band: number | null
  /** Workbook Priority column. 0 = its "Immediate" rows. */
  priority: number
  /** Restrict generation to these complexities. Omitted = every job. */
  complexity?: Complexity[]
  /** Not generated with the job — added by hand when the situation arises
   *  (a customer markup, a field revision). Revisions are not scheduled work. */
  onDemand?: boolean
  /** No source has costed or dated this. Rendered with a warning. */
  provisional?: boolean
  /** Shown under the step in the editor. Say where the number came from. */
  note?: string
}

export type PlaybookStream = {
  stream: Stream
  /** Elec sheet: Sch (hr) = ROUNDUP(total takt × multiplier). The gap between
   *  touch time and the calendar time it really occupies. Null where no source
   *  publishes one — do not guess it, it would silently double every forecast. */
  multiplier: number | null
  /** Generate this stream's steps when a job is created. */
  autoGenerate: boolean
  steps: PlaybookStep[]
}

/** From "Mechanical Engineer Expected Workweek" / "CAD Designer Expected
 *  Workweek" on the Mech sheet, transcribed exactly. */
export type CapacityRole = {
  key: string
  label: string
  /** ⚠️ NOT in the workbook. Null until someone sets it. The capacity page
   *  degrades to "scheduled hours" rather than inventing a 40-hour week — the
   *  sheet describes Monday–Thursday plus "OT if required" on Friday, which is
   *  not 40 and not 32 either. */
  weeklyHours: number | null
  split: { label: string; share: number | null }[]
}

export type Playbook = {
  streams: PlaybookStream[]
  capacity: CapacityRole[]
  /** Days BEFORE a due date the owner gets a nudge. Tunable default, not a
   *  number from any source. */
  nudgeLeadDays: number
  /** Days PAST due before the department lead is copied. Tunable default. */
  escalateAfterDays: number
  /** Days with no status change before a task is reported as untouched. The
   *  meeting asked for exactly this: "tasks that haven't been touched". */
  staleAfterDays: number
}

// ─── Submittals ──────────────────────────────────────────────────────────────
// Cycle 2 weeks, Priority 3, target 2 hours — workbook, highlighted row.
// The eight steps are the subitems on a completed monday submittal.
const SUBMITTAL: PlaybookStream = {
  stream: 'submittal',
  multiplier: null,
  autoGenerate: true,
  steps: [
    {
      key: 'package_creation', title: 'Submittal Package Creation',
      targetHours: 2, cycleDays: 14, band: null, priority: 3,
      note: 'Workbook: 2 hours target, 2-week cycle, priority 3. A completed STD-MAJOR job on the monday board logged 8 actual hours against it — the gap is the point.',
    },
    {
      key: 'unit_outline', title: 'Unit Outline',
      targetHours: 4, cycleDays: 2, band: null, priority: 4,
      note: 'Workbook has its own row for this: 4 hours, 2-day cycle, priority 4.',
    },
    {
      key: 'electrical_drawings', title: 'Electrical Drawings',
      targetHours: 2.5, cycleDays: null, band: null, priority: 3,
      note: 'Hours from the Elec sheet — "Drawings (incl sub)", 2.5 hr. Same work, counted once: the Electrical stream tracks its own copy for the controls package.',
    },
    { key: 'pid', title: 'Create P&ID', targetHours: null, cycleDays: null, band: null, priority: 3, provisional: true, note: 'A monday subitem. No source gives it hours.' },
    { key: 'points_list', title: 'Update Points List', targetHours: null, cycleDays: null, band: null, priority: 3, provisional: true, note: 'A monday subitem. No source gives it hours.' },
    { key: 'soo_diagram', title: 'Update SOO Diagram', targetHours: null, cycleDays: null, band: null, priority: 3, provisional: true, note: 'A monday subitem. No source gives it hours. The portal already builds these — /admin/soo.' },
    {
      key: 'send_to_customer', title: 'Send to Customer',
      targetHours: null, cycleDays: 14, band: null, priority: 3,
      note: 'The 2-week cycle lands here: this is the date the customer sees.',
    },
    {
      key: 'customer_markups', title: 'Update Customer Markups',
      targetHours: 1, cycleDays: 3, band: null, priority: 3, onDemand: true,
      note: 'Workbook "Submittal Revisions": 1 hour, 3-day cycle. On demand — a revision round starts when markups arrive, not when the job does. Add one per round; the monday board shows jobs with two.',
    },
  ],
}

// ─── Long-Lead Items ─────────────────────────────────────────────────────────
// Both rows are the workbook's, verbatim. Priority 2 — second only to production
// packages, which is why this is the second tile on the board.
const LONG_LEAD: PlaybookStream = {
  stream: 'long_lead',
  multiplier: null,
  autoGenerate: true,
  steps: [
    { key: 'identify', title: 'Long-Lead Items', targetHours: 1, cycleDays: 7, band: null, priority: 2, note: 'Workbook: 1 hour, 1-week cycle, priority 2.' },
    { key: 'final_approval', title: 'Long-Lead Items Final Approval', targetHours: 1, cycleDays: 8, band: null, priority: 2, note: 'Workbook: 1 hour, 1-day cycle — one day after the list itself, so 8 from the PO.' },
  ],
}

// ─── Bill of Materials ───────────────────────────────────────────────────────
// The workbook has NO row for the BOM. This stream exists because the meeting
// and the whiteboard both put it on the board, split mechanical / electrical.
//
// Only the mechanical half lives here. The electrical BOM is a step of the
// Electrical stream, where the Elec sheet gives it 1 hour AND the 60% band —
// carrying it in both places would double-count an hour into every capacity
// forecast. The Status Box's BOM tile shows both; see lib/eng-data.ts.
const BOM: PlaybookStream = {
  stream: 'bom',
  multiplier: null,
  autoGenerate: true,
  steps: [
    { key: 'mech_bom', title: 'Mechanical BOM', targetHours: null, cycleDays: null, band: null, priority: 1, provisional: true, note: 'From the meeting and the whiteboard. The workbook has no BOM row — hours and cycle are for James to set.' },
    { key: 'release_to_ordering', title: 'Release to Ordering', targetHours: null, cycleDays: null, band: null, priority: 1, provisional: true, note: 'The meeting’s "alert the ordering department as soon as a BOM is released". Marking this done is the trigger.' },
  ],
}

// ─── Production / Design ─────────────────────────────────────────────────────
// Workbook, highlighted row: Production Packages — "See Master" hours, "Per
// Smartsheet" cycle, PRIORITY 1. Both blanks are real answers, not gaps: the
// dates live in a master schedule this portal does not own yet. So the package
// generates with no date and the job's ship date is what the board sorts on.
const PRODUCTION: PlaybookStream = {
  stream: 'production',
  multiplier: null,
  autoGenerate: true,
  steps: [
    { key: 'prod_drawings', title: 'Production Drawings', targetHours: null, cycleDays: null, band: null, priority: 1, provisional: true, note: 'Meeting notes: "Mechanical production (drawings, sheet metal, framing)". Workbook says hours are "See Master" and the cycle is "Per Smartsheet".' },
    { key: 'sheet_metal', title: 'Sheet Metal', targetHours: null, cycleDays: null, band: null, priority: 1, provisional: true, note: 'Meeting notes. No hours published.' },
    { key: 'framing', title: 'Framing', targetHours: null, cycleDays: null, band: null, priority: 1, provisional: true, note: 'Meeting notes. The whiteboard sketches a finer breakdown (frame → component drop → skin) with a 0–100 bar; add those steps here once the wording is confirmed.' },
    { key: 'cross_check', title: 'Production Cross-Check', targetHours: 1, cycleDays: 1, band: null, priority: 0, note: 'Workbook: 1 hour, 1-day cycle, priority "Immediate". The gate before the package goes to the floor.' },
  ],
}

// ─── Electrical Production ───────────────────────────────────────────────────
// The Elec sheet, complete and unaltered — the only place in either source that
// publishes completion percentages, which is what makes this stream's progress
// bar mean something instead of being four equal quarters.
//
//   Drawings (incl sub)  2.5 hr → 30%
//   BOM                  1   hr → 60%
//   Programming          2   hr → 99%
//   Upload                     → 100%   (cell comment on D3: "Upload 1%")
//   Total takt 5.5 hr × multiplier 2.75 = 16 scheduled hours  [=ROUNDUP(E4*F4,0)]
//
// The whiteboard splits Programming into "PLC Program" and "HMI Program". It is
// left as one step here because the sheet costs it as one 2-hour block and
// splitting it would mean inventing the ratio. Two minutes in the editor once
// James says how the 2 hours divide.
const ELECTRICAL: PlaybookStream = {
  stream: 'electrical',
  multiplier: 2.75,
  autoGenerate: true,
  steps: [
    { key: 'elec_drawings', title: 'Drawings (incl. submittal)', targetHours: 2.5, cycleDays: null, band: 30, priority: 2, note: 'Elec sheet, as of 2.17.2023: 2.5 hr, completes the job at 30%.' },
    { key: 'elec_bom', title: 'Electrical BOM', targetHours: 1, cycleDays: null, band: 60, priority: 1, note: 'Elec sheet: 1 hr, completes at 60%. The BOM tile on the status board shows this alongside the mechanical BOM.' },
    { key: 'programming', title: 'PLC & HMI Programming', targetHours: 2, cycleDays: null, band: 99, priority: 2, note: 'Elec sheet: 2 hr, completes at 99%. The whiteboard splits PLC and HMI — the sheet does not, so neither does this.' },
    { key: 'upload', title: 'Upload', targetHours: null, cycleDays: null, band: 100, priority: 2, note: 'From the "Upload 1%" comment on the Elec sheet — the last point on the bar.' },
  ],
}

// ─── Support & Other ─────────────────────────────────────────────────────────
// Every un-highlighted workbook row. None of it generates with a job; all of it
// is added when it happens. This is the 20% of Monday-to-Wednesday, and it is in
// here so that "where did the week go" has an answer.
const SUPPORT: PlaybookStream = {
  stream: 'support',
  multiplier: null,
  autoGenerate: false,
  steps: [
    { key: 'sales_support', title: 'Sales Support', targetHours: null, cycleDays: 7, band: null, priority: 5, onDemand: true, note: 'Workbook: hours "TBD", 1-week cycle, priority 5. Covers DriveWorks model updates, tech support and the like.' },
    { key: 'submittal_revisions', title: 'Submittal Revisions', targetHours: 1, cycleDays: 3, band: null, priority: 3, onDemand: true, note: 'Workbook: 1 hour, 3-day cycle, priority 3.' },
    { key: 'unit_outline_revisions', title: 'Unit Outline Revisions', targetHours: 1, cycleDays: 1, band: null, priority: 4, onDemand: true, note: 'Workbook: 1 hour, 1-day cycle, priority 4.' },
    { key: 'production_support', title: 'Production Support / Revisions', targetHours: null, cycleDays: null, band: null, priority: 0, onDemand: true, note: 'Workbook: "As needed", priority "Immediate".' },
    { key: 'testing_support', title: 'Testing Support', targetHours: null, cycleDays: null, band: null, priority: 0, onDemand: true, note: 'Workbook: hours and cycle both "-", priority "Immediate".' },
    { key: 'training', title: 'Training', targetHours: null, cycleDays: null, band: null, priority: 6, onDemand: true, note: 'Workbook: "Must be scheduled".' },
    { key: 'rnd', title: 'R&D', targetHours: null, cycleDays: null, band: null, priority: 6, onDemand: true, note: 'Workbook: "Must be scheduled".' },
  ],
}

export const ENG_PLAYBOOK_DEFAULT: Playbook = {
  // Board order = whiteboard order.
  streams: [SUBMITTAL, LONG_LEAD, BOM, PRODUCTION, ELECTRICAL, SUPPORT],
  capacity: [
    {
      key: 'mech_engineer', label: 'Mechanical Engineer', weeklyHours: null,
      split: [
        { label: 'Mon–Wed · Production Packages', share: 0.8 },
        { label: 'Mon–Wed · Other Tasks', share: 0.2 },
        { label: 'Thursday · Submittals, LLI & anything else', share: null },
        { label: 'Friday · OT if required', share: null },
      ],
    },
    {
      key: 'cad_designer', label: 'CAD Designer', weeklyHours: null,
      split: [
        { label: 'Mon–Wed · Production Packages', share: 0.8 },
        { label: 'Mon–Wed · Other Tasks', share: 0.2 },
        { label: 'Thursday · Unit Outlines & Other Tasks', share: null },
        { label: 'Friday · OT if required', share: null },
      ],
    },
  ],
  nudgeLeadDays: 2,
  escalateAfterDays: 2,
  staleAfterDays: 5,
}

// ─── Coercion ────────────────────────────────────────────────────────────────
//
// The playbook is a whole-blob JSON column an admin edits. A blob that has lost
// a stream, gained a junk one, or picked up a string where a number belongs must
// not take job generation down with it, and must not silently produce tasks with
// NaN hours. coercePlaybook rebuilds a known-good shape from whatever it is
// handed, keeping every value it can read and falling back per-field otherwise.
//
// ⚠️ It REBUILDS rather than patches — a field it does not know about is
// dropped. If you add a field to PlaybookStep, add it here too or edits to it
// will be silently discarded on save. (The RFQ intake learned this the hard way:
// its coerce() rebuilds doors, and a field missing from it was dropped on submit.)

const num = (v: unknown, fallback: number | null = null): number | null => {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function coerceStep(raw: unknown, fallback?: PlaybookStep): PlaybookStep | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const key = String(r.key ?? fallback?.key ?? '').trim()
  const title = String(r.title ?? fallback?.title ?? '').trim()
  if (!key || !title) return null
  const band = num(r.band, fallback?.band ?? null)
  return {
    key,
    title,
    targetHours: num(r.targetHours, fallback?.targetHours ?? null),
    cycleDays: num(r.cycleDays, fallback?.cycleDays ?? null),
    band: band == null ? null : Math.max(0, Math.min(100, Math.round(band))),
    priority: Math.max(0, Math.min(9, Math.round(num(r.priority, fallback?.priority ?? 3) ?? 3))),
    ...(Array.isArray(r.complexity) ? { complexity: r.complexity as Complexity[] } : fallback?.complexity ? { complexity: fallback.complexity } : {}),
    ...(r.onDemand === true || (r.onDemand === undefined && fallback?.onDemand) ? { onDemand: true } : {}),
    ...(r.provisional === true || (r.provisional === undefined && fallback?.provisional) ? { provisional: true } : {}),
    ...(typeof r.note === 'string' && r.note.trim() ? { note: r.note.trim() } : fallback?.note ? { note: fallback.note } : {}),
  }
}

export function coercePlaybook(raw: unknown): Playbook {
  const r = (raw ?? {}) as Record<string, unknown>
  const byStream = new Map<Stream, PlaybookStream>()
  for (const s of Array.isArray(r.streams) ? r.streams : []) {
    const rec = (s ?? {}) as Record<string, unknown>
    const stream = rec.stream as Stream
    if (!STREAMS.includes(stream)) continue
    const dflt = ENG_PLAYBOOK_DEFAULT.streams.find(d => d.stream === stream)
    const steps = (Array.isArray(rec.steps) ? rec.steps : [])
      .map(st => coerceStep(st, dflt?.steps.find(d => d.key === (st as Record<string, unknown>)?.key)))
      .filter((s): s is PlaybookStep => s !== null)
    byStream.set(stream, {
      stream,
      multiplier: num(rec.multiplier, dflt?.multiplier ?? null),
      autoGenerate: rec.autoGenerate === undefined ? (dflt?.autoGenerate ?? true) : rec.autoGenerate !== false,
      // An empty step list is honored (a department can switch a stream off by
      // emptying it) — but a MISSING streams entry falls back, so a truncated
      // blob cannot quietly delete a bucket.
      steps,
    })
  }

  const capacity = (Array.isArray(r.capacity) ? r.capacity : []).map((c, i) => {
    const rec = (c ?? {}) as Record<string, unknown>
    const dflt = ENG_PLAYBOOK_DEFAULT.capacity[i]
    return {
      key: String(rec.key ?? dflt?.key ?? `role_${i}`),
      label: String(rec.label ?? dflt?.label ?? 'Role'),
      weeklyHours: num(rec.weeklyHours, dflt?.weeklyHours ?? null),
      split: (Array.isArray(rec.split) ? rec.split : dflt?.split ?? []).map(s => {
        const sr = (s ?? {}) as Record<string, unknown>
        return { label: String(sr.label ?? ''), share: num(sr.share, null) }
      }).filter(s => s.label),
    }
  })

  return {
    streams: STREAMS.map(s => byStream.get(s) ?? ENG_PLAYBOOK_DEFAULT.streams.find(d => d.stream === s)!),
    capacity: capacity.length ? capacity : ENG_PLAYBOOK_DEFAULT.capacity,
    nudgeLeadDays: Math.max(0, Math.round(num(r.nudgeLeadDays, ENG_PLAYBOOK_DEFAULT.nudgeLeadDays)!)),
    escalateAfterDays: Math.max(0, Math.round(num(r.escalateAfterDays, ENG_PLAYBOOK_DEFAULT.escalateAfterDays)!)),
    staleAfterDays: Math.max(1, Math.round(num(r.staleAfterDays, ENG_PLAYBOOK_DEFAULT.staleAfterDays)!)),
  }
}

/** The steps a NEW job generates, in board order. Excludes on-demand steps and
 *  streams switched off, and honors a step's complexity restriction. */
export function stepsForNewJob(pb: Playbook, complexity: Complexity) {
  const out: { stream: Stream; step: PlaybookStep; sort: number }[] = []
  let sort = 0
  for (const s of pb.streams) {
    if (!s.autoGenerate) continue
    for (const step of s.steps) {
      if (step.onDemand) continue
      if (step.complexity && !step.complexity.includes(complexity)) continue
      out.push({ stream: s.stream, step, sort: sort++ })
    }
  }
  return out
}
