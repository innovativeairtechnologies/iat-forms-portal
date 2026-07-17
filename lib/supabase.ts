import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Category = {
  id: string
  name: string
  icon: string | null
  sort_order: number
  created_at: string
}

export type Form = {
  id: string
  title: string
  description: string | null
  category_id: string | null
  slug: string
  is_active: boolean
  approval_status: 'pending' | 'approved'
  approved_by: string | null
  approved_at: string | null
  success_message: string
  created_at: string
  updated_at: string
  categories?: Category
  submission_count?: number
}

export type Employee = {
  id: string
  email: string
  name: string
  avatar_url: string | null
  job_title: string | null
  department: string | null
  phone: string | null
  bio: string | null
  pto_balance: number
  sick_balance: number
  pto_accrual_rate: number
  sick_accrual_rate: number
  hire_date: string | null
  is_admin: boolean
  is_active: boolean
  created_at: string
}

export type Equipment = {
  id: string
  serial_number: string
  model_number: string | null
  voltage: string | null
  customer_company: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_id: string | null
  location: string | null
  ship_date: string | null
  install_date: string | null
  warranty_months: number
  warranty_end: string | null
  pm_interval_months: number | null
  status: 'active' | 'decommissioned'
  photo_urls: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Tool Crib (migration 050) ───────────────────────────────────────────────
// One row per physical warehouse tool, keyed by the tag_code printed under its
// QR label. NOT related to lib/tools.ts / the `tools` perm — that's the internal
// field-app launcher (duct traverse, calculators).
export type CribToolStatus = 'available' | 'checked_out' | 'maintenance' | 'lost' | 'retired'

export type CribTool = {
  id: string
  tag_code: string          // 'IAT-0042' — minted by a DB sequence, printed on the label
  name: string
  short_label: string | null // 2-3 word descriptor for the printed sticker (migration 057)
  category: string | null
  make: string | null
  model: string | null
  serial_number: string | null   // the manufacturer's serial, NOT our tag_code
  home_location: string | null
  photo_urls: string[] | null
  purchase_cost: number | null
  purchase_date: string | null
  status: CribToolStatus
  held_by: string | null         // employees.id — null unless status is 'checked_out'
  held_since: string | null
  due_at: string | null          // reserved: no due-date UI/cron/email in v1
  condition_note: string | null
  kind: 'unique' | 'consumable'  // reserved: v1 is unique-only
  quantity: number | null        // reserved: consumables
  notes: string | null
  created_at: string
  updated_at: string
}

export type CribEventAction =
  | 'created' | 'check_out' | 'check_in' | 'force_check_in'
  | 'transfer' | 'status_change' | 'note'

// Append-only custody history. actor_name/subject_name are snapshots taken at
// write time so the trail survives an employee account being deleted — the FKs
// are ON DELETE SET NULL and answering "who had it" is the whole point.
export type CribEvent = {
  id: string
  tool_id: string
  action: CribEventAction
  actor_id: string | null        // who performed it
  subject_id: string | null      // who custody moved TO
  actor_name: string | null
  subject_name: string | null
  from_status: string | null
  to_status: string | null
  from_held_by: string | null
  to_held_by: string | null
  reason: string | null          // required for force_check_in / transfer
  condition_note: string | null
  created_at: string
}

// A customer COMPANY account (migration 026). One row per customer; one login
// (profiles.role='customer', profiles.customer_id) sees all of this company's
// equipment + support history on /customer. Service-role only.
export type Customer = {
  id: string
  company_name: string
  primary_contact_name: string | null
  contact_email: string | null
  phone: string | null
  location: string | null
  logo_url: string | null       // nullable: reserved for light white-label
  accent_color: string | null   // nullable: reserved for light white-label
  status: 'active' | 'inactive'
  notes: string | null
  created_at: string
  updated_at: string
}

// A staff-updated build/ship milestone for one unit (migration 026). Rendered as
// the shipping tracker on the customer portal. Canonical defaults: lib/customer.ts.
export type EquipmentMilestone = {
  id: string
  equipment_id: string
  stage: string
  status: 'pending' | 'in_progress' | 'complete'
  occurred_at: string | null
  note: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type TimeOffRequest = {
  id: string
  employee_id: string
  type: 'pto' | 'sick'
  hours_requested: number
  start_date: string
  end_date: string
  notes: string | null
  status: 'pending' | 'approved' | 'denied'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  employees?: Employee
  reviewer?: Employee
}

export type AccrualLog = {
  id: string
  employee_id: string
  type: 'pto' | 'sick'
  hours_delta: number
  reason: 'scheduled' | 'manual_adjustment' | 'request_approved' | 'request_denied'
  note: string | null
  created_at: string
}

export type FormField = {
  id: string
  form_id: string
  label: string
  field_type: 'text' | 'email' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'signature' | 'number' | 'section_header'
  placeholder: string | null
  options: string[] | null
  is_required: boolean
  sort_order: number
  // Conditional visibility (migration 028): show this field only when the field
  // labeled `show_when_field` currently equals `show_when_value`. Null = always show.
  show_when_field: string | null
  show_when_value: string | null
  created_at: string
}

export type NotificationRule = {
  id: string
  form_id: string
  recipient_email: string
  recipient_name: string | null
  send_on_submit: boolean
  email_subject: string | null
  created_at: string
}

export type Submission = {
  id: string
  form_id: string
  form_title: string | null
  data: Record<string, unknown>
  submitted_at: string
  is_read: boolean
}

export type Ticket = {
  id: string
  ticket_number: string
  customer_name: string
  customer_company: string | null
  customer_email: string
  customer_phone: string | null
  // Customer-editable "how should we reach you" preference (migration 037),
  // set from the customer ticket-detail page's Contact card.
  preferred_contact_method: 'email' | 'phone' | null
  serial_number: string
  model_number: string
  voltage: string
  problem_description: string
  pre_cooling: boolean | null
  pre_cooling_type: string | null
  pre_cooling_working: boolean | null
  post_cooling: boolean | null
  post_cooling_type: string | null
  post_cooling_working: boolean | null
  airflow_balanced: boolean | null
  process_airflow_cfm: string | null
  react_airflow_cfm: string | null
  react_heat_working: boolean | null
  react_heat_setpoint: boolean | null
  react_temp_f: string | null
  seals_good: boolean | null
  // Merged in from the Troubleshooting Checklist (migration 027)
  problem_started: string | null
  onset: 'sudden' | 'gradual' | 'unsure' | null
  what_changed: string | null
  unit_running: boolean | null
  has_alarms: boolean | null
  alarm_details: string | null
  wheel_rotating: 'yes' | 'no' | 'unsure' | null
  seal_light_leakage: 'yes' | 'no' | 'unsure' | null
  external_factors: string[] | null
  photo_urls: string[] | null
  brand: 'iat' | 'us_rotors'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'med' | 'high'
  owner_id: string | null
  notes: string | null
  resolved_reason: string | null
  // migration 044 — advisory customer signal (NOT the staff-owned status enum):
  // a logged-in customer marks their own ticket resolved so staff know to close
  // it out. Set/cleared from /customer/tickets/[id]; staff still formally close.
  customer_marked_resolved: boolean
  customer_resolved_at: string | null
  ai_recommendations: string[] | null
  viewed_kb_articles: ViewedKbArticle[] | null
  created_at: string
  owner?: Employee
  customer_id: string | null
  // 'warranty' when this ticket was opened from an approved warranty claim
  // (migration 036); 'support' for the normal support-form path.
  request_type: 'support' | 'warranty'
}

// A customer's self-serve warranty claim on one of their units (migration 036).
// Filed from /customer (WarrantyCard → WarrantySubmitModal), reviewed at
// /admin/customers (Warranty tab). Approving stamps resulting_ticket_id with a
// newly created tickets row (request_type='warranty') so the existing ticket
// workflow handles servicing the claim. Service-role only.
export type WarrantyRequest = {
  id: string
  customer_id: string
  equipment_id: string
  serial_number: string
  description: string
  problem_started: string | null
  resolution: 'repair' | 'replace' | 'credit'
  status: 'pending' | 'approved' | 'denied'
  decided_by: string | null
  decided_at: string | null
  deny_reason: string | null
  resulting_ticket_id: string | null
  created_at: string
  updated_at: string
}

// A Knowledge Base article the customer viewed before submitting their ticket.
// Recorded client-side (lib/kb-views.ts) and validated against kb_articles by
// the ticket API before being stored on the ticket.
export type ViewedKbArticle = {
  slug: string
  title: string
  first_viewed_at: string | null
  last_viewed_at: string | null
  count: number
}

export type TicketNoteAttachment = {
  path: string   // object key in the ticket-attachments bucket (prefixed by ticket id)
  name: string   // original filename, shown to the admin and used as the download name
  type: string   // browser-reported MIME (may be empty for .msg/.eml)
  size: number   // bytes
}

export type TicketNote = {
  id: string
  ticket_id: string
  content: string
  attachments?: TicketNoteAttachment[]
  created_at: string
  // migration 037 — visibility gates whether a customer can ever see this note;
  // author_type records who wrote it. Both default to internal/admin so every
  // historical note stays admin-only with no retroactive exposure.
  visibility: 'internal' | 'public'
  author_type: 'admin' | 'customer'
  // migration 054 — WHICH person wrote it (author_type only says staff-vs-customer).
  // Optional/nullable on purpose: notes written before 054 are unattributed and are
  // never backfilled with a guess, and both fields are stripped before any note is
  // sent to a customer, so they're absent on the customer thread by design.
  author_id?: string | null
  author_name?: string | null
}

export type AccrualTier = {
  id: number
  label: string
  min_tenure_years: number
  max_tenure_years: number | null
  pto_weekly_rate: number
  sort_order: number
}

export type AccrualConfig = {
  id: number
  sick_weekly_rate: number
  pto_cap_hours: number
  sick_cap_hours: number
}

export type KbArticle = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  category: string | null
  tags: string[]
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ── KB RAG pool (migration 030) — searchable documentation for the AI Assistant ─
// A source PDF fed into the retrieval pool. Chunks are searched via FTS and cited
// (document + page). Customer-facing retrieval excludes is_internal=true docs.
export type KbDocument = {
  id: string
  title: string
  source_filename: string
  category: string | null
  is_internal: boolean
  page_count: number | null
  created_at: string
}

// One page-sized text chunk of a KbDocument. `tsv` is a generated FTS column in
// Postgres and is never selected into the app.
export type KbChunk = {
  id: string
  document_id: string
  chunk_index: number
  page_number: number
  content: string
  created_at: string
}

// A sales deal/opportunity (migration 043) — the "Forecast Pulse" pipeline
// rebuilt from Monday.com. One flat record viewed through three admin lenses
// (Pipeline / CRM / Focused, app/admin/deals). `weighted` is deliberately NOT
// a column — it's always total_cost * (confidence / 100), computed client-side
// (lib/deals.ts) so it can never drift out of sync. Service-role only; admin +
// sales can both read and write (see lib/api-auth.ts requireDealsAuth).
export type Deal = {
  id: string
  customer: string
  assigned_to: string | null
  date_quoted: string | null
  status: 'Won' | 'Lost' | null // null = active/open
  unit_model: string | null
  job_name: string | null
  total_cost: number
  confidence: number // 0–100
  projected: string | null
  rep: string | null
  rep_contact: string | null
  notes: string | null
  group_name: string
  /** Follow-up checklist: step key → done (keys in lib/deals CHECKLIST_STEPS).
   *  Optional because the column arrives with migration 047. */
  checklist?: Record<string, boolean> | null
  /** Hand-picked into the Focused tab via the Pipeline ★ (migration 048). */
  focused?: boolean
  /** Industry / vertical — values in lib/deals PROJECT_TYPES (migration 048). */
  project_type?: string | null
  created_at: string
  updated_at: string
}

// A dated reminder on a deal (deal_follow_ups, migration 048). auto_generated
// marks the New-Deal automation's 2-week reminder vs a hand-scheduled one.
export type DealFollowUp = {
  id: string
  deal_id: string
  due_date: string // YYYY-MM-DD
  note: string | null
  done: boolean
  auto_generated: boolean
  created_at: string
}

export type DealActivityKind = 'call' | 'email' | 'meeting' | 'proposal' | 'checklist' | 'note'

// One logged interaction on a deal (deal_activity, migration 047) — fed by the
// detail modal's Quick Actions and checklist toggles.
export type DealActivity = {
  id: string
  deal_id: string
  kind: DealActivityKind
  summary: string
  actor: string | null
  created_at: string
}

export type USRotorsOrder = {
  id: string
  order_ref: string
  company: string
  po_number: string | null
  contact_name: string
  contact_email: string
  model: string
  quantity: number
  rph: string | null
  hz: string | null
  sprocket: string | null
  motor_voltage: string
  config: string
  notes: string | null
  status: 'pending' | 'processing' | 'shipped' | 'complete'
  submitted_by: string | null
  created_at: string
}

// Customer "Troubleshooting Checklist" intake (the DATA BEFORE DECISIONS card as
// a guided wizard at /support/troubleshooting). Written via /api/troubleshooting
// using the service role; see migration 024. Tri-state fields hold the customer's
// literal answer ('unsure' is preserved, not coerced to null).
export type TroubleshootingIntake = {
  id: string
  reference_number: string
  customer_name: string
  customer_company: string | null
  customer_email: string
  customer_phone: string | null
  serial_number: string
  model_number: string | null
  voltage: string | null
  problem_description: string
  problem_started: string | null
  onset: 'sudden' | 'gradual' | 'unsure' | null
  what_changed: string | null
  unit_running: boolean | null
  has_alarms: boolean | null
  alarm_details: string | null
  process_airflow_cfm: string | null
  react_airflow_cfm: string | null
  react_temp_f: string | null
  wheel_rotating: 'yes' | 'no' | 'unsure' | null
  seal_light_leakage: 'yes' | 'no' | 'unsure' | null
  external_factors: string[] | null
  photo_urls: string[] | null
  ai_recommendations: string[] | null
  status: 'new' | 'reviewed' | 'closed'
  created_at: string
}

// ─── Production board (migration 055) ────────────────────────────────────────
// The public, per-department shop checklist at /board/<token>. No login: the
// token IS the credential, so nothing here should hold anything you wouldn't
// pin to the break-room wall. See lib/production.ts for the rules that read it.

export type TaskCadence = 'once' | 'daily' | 'weekly'
export type TaskPriority = 'normal' | 'high'
export type ProductionTaskStatus = 'open' | 'done' | 'blocked'
export type ProductionProjectStatus = 'active' | 'complete'

export type ProductionDepartment = {
  id: string
  name: string
  /** The unguessable half of /board/<token>. NEVER send this to a board client —
   *  it's the capability, and one leaked token is one permanently public board. */
  token: string
  blurb: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Floor roster for the board's check-off picker. NOT portal accounts, and
 *  deliberately not `employees` — the floor has no logins (see migration 055). */
export type ProductionPerson = {
  id: string
  department_id: string
  name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

/** A build under a department (migration 056). Two projects can share a task
 *  list yet track separately — that's the point. `people` is a display-only
 *  snapshot of roster names ("who's on this build"); it does NOT gate the
 *  assignee picker. `type` is free text. */
export type ProductionProject = {
  id: string
  department_id: string
  name: string
  type: string | null
  detail: string | null
  people: string[]
  status: ProductionProjectStatus
  sort_order: number
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ProductionTask = {
  id: string
  department_id: string
  /** The project this task belongs to (migration 056). NULL => a department-wide
   *  standing duty. `isStanding()` keys off THIS, not the deprecated `project`. */
  project_id: string | null
  /** Optional sub-heading inside a project ("Day 1", "Framing"). Blank = flat. */
  phase: string | null
  title: string
  detail: string | null
  /** @deprecated since 056 — superseded by project_id + phase. Kept for pre-056
   *  rows; new code never reads or writes it. */
  project: string | null
  cadence: TaskCadence
  priority: TaskPriority
  due_date: string | null
  /** NULL/blank => unassigned, which the board surfaces on purpose. */
  assignee: string | null
  status: ProductionTaskStatus
  blocked_note: string | null
  /** Shop-LOCAL completion date (America/New_York). Recurring tasks reset by
   *  comparing this to today — never read it as a timestamp. */
  done_on: string | null
  done_by: string | null
  done_at: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ProductionTaskAction = 'created' | 'done' | 'reopened' | 'blocked' | 'unblocked' | 'edited'

/** Append-only check-off trail. actor_name is a snapshot typed on the floor and
 *  is NOT verified — it answers "who says they did this", which is all an
 *  honor-system board can offer. `source` marks which side it came from. */
export type ProductionTaskEvent = {
  id: string
  task_id: string
  action: ProductionTaskAction
  actor_name: string | null
  source: 'board' | 'admin'
  note: string | null
  created_at: string
}
