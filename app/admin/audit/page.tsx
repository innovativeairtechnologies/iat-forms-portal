export const dynamic = 'force-dynamic'

import type { LucideIcon } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import {
  UserCog, FileCheck2, Trash2,
  CalendarCheck, History, Inbox, UserPlus, UserMinus,
  UserCheck, Wallet, RefreshCw, FilePlus, Power, PowerOff, Ticket,
  Eye, Flag, ArrowRightLeft, LogIn, MapPin, Monitor, Smartphone, Tablet, Globe,
} from 'lucide-react'
import { ListPageHeader, IdentityCell, tabCx, timeAgo } from '@/components/admin/list'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/audit — accountability trail
   Immutable record of consequential admin actions (table: audit_log, mig 020).
   Server component, theme-aware to match the operations dashboard.
   ──────────────────────────────────────────────────────────────────────────── */

type AuditRow = {
  id: string
  actor_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

type LoginRow = {
  id: string
  user_id: string | null
  email: string | null
  name: string | null
  role: string | null
  portal: string | null
  method: string | null
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  user_agent: string | null
  browser: string | null
  os: string | null
  device: string | null
  created_at: string
}

// Visual treatment per portal/role, reused for the login feed.
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  admin:    { label: 'Admin',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  employee: { label: 'Employee', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  customer: { label: 'Customer', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
}
const ROLE_FALLBACK = { label: 'User', color: '#71717a', bg: 'rgba(113,113,122,0.12)' }

const METHOD_LABEL: Record<string, string> = {
  password: 'Password',
  magic_link: 'Magic link',
  invite: 'Invite link',
  recovery: 'Password reset',
}

function deviceIcon(device: string | null): LucideIcon {
  if (device === 'mobile') return Smartphone
  if (device === 'tablet') return Tablet
  return Monitor
}

function locationOf(r: LoginRow): string | null {
  const parts = [r.city, r.region || r.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function deviceLabel(r: LoginRow): string | null {
  const parts = [r.browser, r.os].filter(Boolean)
  return parts.length ? parts.join(' · ') : (r.device || null)
}

// Visual treatment per action key.
const ACTION_META: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  'role.update':         { label: 'Role change',     icon: UserCog,       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'form.create':         { label: 'Form created',    icon: FilePlus,      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'form.approve':        { label: 'Form approved',   icon: FileCheck2,    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'form.activate':       { label: 'Form activated',  icon: Power,         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'form.pause':          { label: 'Form paused',     icon: PowerOff,      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'form.delete':         { label: 'Form deleted',    icon: Trash2,        color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
  'request.review':      { label: 'Time-off review', icon: CalendarCheck, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'ticket.status':       { label: 'Ticket',          icon: Ticket,        color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
  'ticket.priority':     { label: 'Priority change', icon: Flag,          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'ticket.owner':        { label: 'Reassigned',      icon: ArrowRightLeft, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  'submission.status':   { label: 'Submission',      icon: Inbox,         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'submission.read':     { label: 'Marked read',     icon: Eye,           color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'employee.invite':     { label: 'New account',     icon: UserPlus,      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'employee.deactivate': { label: 'Offboarded',      icon: UserMinus,     color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
  'employee.reactivate': { label: 'Reactivated',     icon: UserCheck,     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'accrual.adjust':      { label: 'Balance change',  icon: Wallet,        color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  'accrual.run':         { label: 'Accrual run',     icon: RefreshCw,     color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
}
const FALLBACK_META = { label: 'Action', icon: History, color: '#71717a', bg: 'rgba(113,113,122,0.12)' }

// Filter tabs shown in the header. `prefix` filters match a family of actions
// (e.g. every `form.*` or `employee.*`); the rest match exactly.
const FILTERS: { key: string; label: string; prefix?: boolean }[] = [
  { key: 'all', label: 'All activity' },
  { key: 'logins', label: 'Logins' },
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
    searchParams: Promise<{ action?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const selected = FILTERS.find((f) => f.key === searchParams.action)
  const active = selected ? selected.key : 'all'
  const isLogins = active === 'logins'

  // Login feed reads a separate table (login_events, mig 031); everything else
  // reads the admin-action trail (audit_log, mig 020).
  let rows: AuditRow[] = []
  let logins: LoginRow[] = []
  let error: unknown = null

  if (isLogins) {
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

  const totalCount = isLogins ? logins.length : rows.length

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Page header */}
      <ListPageHeader
        overline="System"
        title="Audit Log"
        count={
          isLogins
            ? 'Every sign-in across all portals — who logged in, from where, and on what device.'
            : 'An immutable record of consequential admin actions — who did what, and when.'
        }
      >
        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => {
            const isActive = f.key === active
            return (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/admin/audit' : `/admin/audit?action=${f.key}`}
                className={tabCx(isActive)}
              >
                {f.label}
              </Link>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">
        {/* Log */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none overflow-hidden">
          {error ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Couldn&apos;t load the {isLogins ? 'login activity' : 'audit log'}.
              </p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                If this table doesn&apos;t exist yet, run migration{' '}
                <code className="font-mono">{isLogins ? '031_login_events.sql' : '020_audit_log.sql'}</code>.
              </p>
            </div>
          ) : isLogins ? (
            logins.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <LogIn size={22} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-2.5" />
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No sign-ins recorded yet</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                  Logins across every portal will appear here as they happen.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {logins.map((r) => {
                  const meta = ROLE_META[r.role || ''] || ROLE_FALLBACK
                  const DeviceIcon = deviceIcon(r.device)
                  const location = locationOf(r)
                  const device = deviceLabel(r)
                  const method = METHOD_LABEL[r.method || '']
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 min-h-[52px] py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <IdentityCell
                          leading={
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
                              <LogIn size={14} />
                            </span>
                          }
                          title={r.name || r.email || 'Unknown user'}
                          subtitle={method ? `Signed in · ${method}` : 'Signed in'}
                        />
                      </div>
                      {/* Where + how — kept intact for the login trail */}
                      <div className="hidden sm:flex items-center justify-end gap-x-2.5 gap-y-0.5 max-w-[46%] text-[11px] text-zinc-400 dark:text-zinc-500 flex-wrap">
                        <span className="font-medium" style={{ color: meta.color }}>{meta.label}</span>
                        {location && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{location}</span>
                        )}
                        {r.ip && (
                          <span className="flex items-center gap-1 font-mono"><Globe size={11} />{r.ip}</span>
                        )}
                        {device && (
                          <span className="flex items-center gap-1"><DeviceIcon size={11} />{device}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums w-12 text-right flex-shrink-0" title={new Date(r.created_at).toLocaleString()}>
                        {timeAgo(r.created_at)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )
          ) : rows.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <History size={22} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-2.5" />
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No activity recorded yet</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                Admin actions will appear here as they happen.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {rows.map((r) => {
                const meta = ACTION_META[r.action] || FALLBACK_META
                const Icon = meta.icon
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 min-h-[52px] py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <IdentityCell
                        leading={
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
                            <Icon size={14} />
                          </span>
                        }
                        title={r.actor_name || 'System'}
                        subtitle={r.summary}
                      />
                    </div>
                    <span className="hidden sm:inline text-[11px] font-medium flex-shrink-0" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums w-12 text-right flex-shrink-0" title={new Date(r.created_at).toLocaleString()}>
                      {timeAgo(r.created_at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {totalCount >= 200 && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center mt-4">
            Showing the 200 most recent entries.
          </p>
        )}
      </div>
    </div>
  )
}
