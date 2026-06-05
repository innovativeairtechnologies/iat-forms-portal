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
  created_at: string
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
