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
  created_at: string
  updated_at: string
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
