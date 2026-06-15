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
  location: string | null
  ship_date: string | null
  install_date: string | null
  warranty_months: number
  warranty_end: string | null
  status: 'active' | 'decommissioned'
  photo_urls: string[] | null
  notes: string | null
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
  seals_good: boolean | null
  photo_urls: string[] | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'med' | 'high'
  owner_id: string | null
  notes: string | null
  resolved_reason: string | null
  ai_recommendations: string[] | null
  created_at: string
  owner?: Employee
}

export type TicketNote = {
  id: string
  ticket_id: string
  content: string
  created_at: string
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
