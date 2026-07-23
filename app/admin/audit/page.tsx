export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import AuditClient, { type AuditRow, type LoginRow, type EmailRow } from './AuditClient'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/audit — accountability trail (server data layer).
   Immutable record of consequential admin actions (audit_log, mig 020), the
   sign-in trail (login_events, mig 031), and the permanent Resend email history
   (email_events, mig 049). This component only fetches; AuditClient renders the
   shared one-card list view. Gated by admin middleware (see ADMIN_PATH_PERMS).
   ──────────────────────────────────────────────────────────────────────────── */

const EMAILS_PER_PAGE = 25

// Filter tabs shown in the header. `prefix` filters match a family of actions
// (e.g. every `form.*` or `employee.*`); the rest match exactly.
const FILTERS: { key: string; label: string; prefix?: boolean }[] = [
  { key: 'all', label: 'All activity' },
  { key: 'logins', label: 'Logins' },
  { key: 'emails', label: 'Emails' },
  { key: 'role.update', label: 'Role changes' },
  { key: 'form.', label: 'Forms', prefix: true },
  { key: 'submission.', label: 'Submissions', prefix: true },
  { key: 'ticket.', label: 'Tickets', prefix: true },
  { key: 'request.review', label: 'Time off' },
  { key: 'employee.', label: 'Employees', prefix: true },
  { key: 'accrual.', label: 'Accrual', prefix: true },
]

export default async function AuditLogPage(
  props: {
    searchParams: Promise<{ action?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams
  const selected = FILTERS.find((f) => f.key === searchParams.action)
  const active = selected ? selected.key : 'all'
  const isLogins = active === 'logins'
  const isEmails = active === 'emails'

  // Login feed reads a separate table (login_events, mig 031); the email feed
  // reads the permanent Resend history (email_events, mig 049); everything else
  // reads the admin-action trail (audit_log, mig 020).
  let rows: AuditRow[] = []
  let logins: LoginRow[] = []
  let emails: EmailRow[] = []
  let emailCount = 0
  let error: unknown = null

  // Emails is the one tab that grows unbounded, so it paginates server-side.
  const emailPage = Math.max(1, parseInt(searchParams.page || '1') || 1)

  if (isEmails) {
    const offset = (emailPage - 1) * EMAILS_PER_PAGE
    const res = await supabaseAdmin
      .from('email_events')
      .select('id, email_id, to_addresses, from_address, subject, status, bounce_detail, sent_at, last_event_at', { count: 'exact' })
      .order('last_event_at', { ascending: false })
      .range(offset, offset + EMAILS_PER_PAGE - 1)
    error = res.error
    emails = (res.data || []) as EmailRow[]
    emailCount = res.count || 0
  } else if (isLogins) {
    const res = await supabaseAdmin
      .from('login_events')
      .select('id, user_id, email, name, role, portal, method, ip, city, region, country, user_agent, browser, os, device, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    error = res.error
    logins = (res.data || []) as LoginRow[]
  } else {
    let query = supabaseAdmin
      .from('audit_log')
      .select('id, actor_name, action, entity_type, entity_id, summary, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (selected && active !== 'all') {
      query = selected.prefix ? query.like('action', `${selected.key}%`) : query.eq('action', selected.key)
    }

    const res = await query
    error = res.error
    rows = (res.data || []) as AuditRow[]
  }

  const emailTotalPages = Math.max(1, Math.ceil(emailCount / EMAILS_PER_PAGE))

  return (
    <AuditClient
      active={active}
      tabs={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
      rows={rows}
      logins={logins}
      emails={emails}
      emailCount={emailCount}
      emailPage={emailPage}
      emailTotalPages={emailTotalPages}
      hasError={!!error}
    />
  )
}
