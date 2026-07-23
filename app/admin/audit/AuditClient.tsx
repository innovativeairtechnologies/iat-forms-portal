'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  UserCog, FileCheck2, Trash2, CalendarCheck, History, Inbox, UserPlus, UserMinus,
  UserCheck, Wallet, RefreshCw, FilePlus, Power, PowerOff, Ticket,
  Eye, Flag, ArrowRightLeft, LogIn, MapPin, Monitor, Smartphone, Tablet, Globe,
  Mail, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusPill, tabCx, timeAgo, type Tone } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, CardTable, Row,
  Pagination, usePagedList, ToneAvatar, TagPill, CARD_TONE,
} from '@/components/admin/list-card'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/audit — accountability trail, rendered in the shared one-card pattern.
   Data still flows from the server page (page.tsx): the tabs are server <Link>s
   that re-run the per-tab query, so each tab keeps its "200 most recent OF THIS
   TYPE" semantics, and the Emails feed keeps paginating server-side (it's the one
   feed that grows unbounded). The Audit + Logins tabs load their full set (≤200)
   so they paginate client-side via usePagedList.
   ──────────────────────────────────────────────────────────────────────────── */

export type AuditRow = {
  id: string
  actor_name: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

export type LoginRow = {
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

export type EmailRow = {
  id: string
  email_id: string
  to_addresses: string[] | null
  from_address: string | null
  subject: string | null
  status: string
  bounce_detail: string | null
  sent_at: string | null
  last_event_at: string
}

// ── Presentation metadata (colors expressed as shared Tones, not raw hex) ──────

// Email delivery status → Tone pill, using the shared soft-wash system.
const EMAIL_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  sent:             { label: 'Sent',       tone: 'slate' },
  delivery_delayed: { label: 'Delayed',    tone: 'amber' },
  delivered:        { label: 'Delivered',  tone: 'emerald' },
  opened:           { label: 'Opened',     tone: 'sky' },
  clicked:          { label: 'Clicked',    tone: 'sky' },
  bounced:          { label: 'Bounced',    tone: 'rose' },
  complained:       { label: 'Complained', tone: 'rose' },
}
const EMAIL_STATUS_FALLBACK = { label: 'Sent', tone: 'slate' as Tone }

// Visual treatment per portal/role, reused for the login feed.
const ROLE_META: Record<string, { label: string; tone: Tone }> = {
  admin:    { label: 'Admin',    tone: 'violet' },
  employee: { label: 'Employee', tone: 'emerald' },
  customer: { label: 'Customer', tone: 'sky' },
}
const ROLE_FALLBACK = { label: 'User', tone: 'slate' as Tone }

const METHOD_LABEL: Record<string, string> = {
  password: 'Password',
  magic_link: 'Magic link',
  invite: 'Invite link',
  recovery: 'Password reset',
}

// Visual treatment per action key.
const ACTION_META: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  'role.update':         { label: 'Role change',     icon: UserCog,        tone: 'violet' },
  'form.create':         { label: 'Form created',    icon: FilePlus,       tone: 'emerald' },
  'form.approve':        { label: 'Form approved',   icon: FileCheck2,     tone: 'emerald' },
  'form.activate':       { label: 'Form activated',  icon: Power,          tone: 'emerald' },
  'form.pause':          { label: 'Form paused',     icon: PowerOff,       tone: 'amber' },
  'form.delete':         { label: 'Form deleted',    icon: Trash2,         tone: 'rose' },
  'request.review':      { label: 'Time-off review', icon: CalendarCheck,  tone: 'amber' },
  'ticket.status':       { label: 'Ticket',          icon: Ticket,         tone: 'rose' },
  'ticket.priority':     { label: 'Priority change', icon: Flag,           tone: 'amber' },
  'ticket.owner':        { label: 'Reassigned',      icon: ArrowRightLeft, tone: 'sky' },
  'submission.status':   { label: 'Submission',      icon: Inbox,          tone: 'sky' },
  'submission.read':     { label: 'Marked read',     icon: Eye,            tone: 'sky' },
  'employee.invite':     { label: 'New account',     icon: UserPlus,       tone: 'emerald' },
  'employee.deactivate': { label: 'Offboarded',      icon: UserMinus,      tone: 'rose' },
  'employee.reactivate': { label: 'Reactivated',     icon: UserCheck,      tone: 'emerald' },
  'accrual.adjust':      { label: 'Balance change',  icon: Wallet,         tone: 'sky' },
  'accrual.run':         { label: 'Accrual run',     icon: RefreshCw,      tone: 'sky' },
}
const FALLBACK_META = { label: 'Action', icon: History, tone: 'slate' as Tone }

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

// Column templates — one per tab shape. Extra columns collapse below `sm` (their
// cells are `hidden sm:*`, and the mobile track count matches the visible cells).
const COLS_AUDIT = 'grid-cols-[minmax(0,1fr)_64px] sm:grid-cols-[minmax(0,1fr)_150px_64px]'
const COLS_LOGINS = 'grid-cols-[minmax(0,1fr)_64px] sm:grid-cols-[minmax(0,1fr)_112px_minmax(0,260px)_64px]'
const COLS_EMAILS = 'grid-cols-[minmax(0,1fr)_120px_64px]'

export default function AuditClient({
  active, tabs, rows, logins, emails, emailCount, emailPage, emailTotalPages, hasError,
}: {
  active: string
  tabs: { key: string; label: string }[]
  rows: AuditRow[]
  logins: LoginRow[]
  emails: EmailRow[]
  emailCount: number
  emailPage: number
  emailTotalPages: number
  hasError: boolean
}) {
  const isLogins = active === 'logins'
  const isEmails = active === 'emails'

  // Client-side pagination over the whole set for the Audit + Logins tabs (both
  // loaded whole, ≤200). Emails paginate server-side, so this runs on 0 there —
  // usePagedList is a hook and must run unconditionally.
  const feedLength = isEmails ? 0 : isLogins ? logins.length : rows.length
  const paged = usePagedList(feedLength, { initialPerPage: 10, resetKey: active })

  const pagedLogins = logins.slice(paged.start, paged.end)
  const pagedRows = rows.slice(paged.start, paged.end)

  const isEmpty = !hasError && (isEmails ? emails.length === 0 : feedLength === 0)

  const countText = isEmails
    ? `Every email the portal has sent — kept permanently, beyond Resend's 30-day window.${emailCount ? ` ${emailCount} total.` : ''}`
    : isLogins
    ? 'Every sign-in across all portals — who logged in, from where, and on what device.'
    : 'An immutable record of consequential admin actions — who did what, and when.'

  const errLabel = isEmails ? 'email history' : isLogins ? 'login activity' : 'audit log'
  const errFile = isEmails ? '049_email_events.sql' : isLogins ? '031_login_events.sql' : '020_audit_log.sql'

  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="System" title="Audit Log" count={countText} />

        {/* Filter tabs — server <Link>s so each tab re-runs its own query. */}
        <div className="px-5 border-b border-hairline">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((f) => (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/admin/audit' : `/admin/audit?action=${f.key}`}
                className={tabCx(f.key === active)}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {hasError ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[13px] text-ink-secondary">Couldn&apos;t load the {errLabel}.</p>
            <p className="text-[11px] text-ink-muted mt-1">
              If this table doesn&apos;t exist yet, run migration <code className="font-mono">{errFile}</code>.
            </p>
          </div>
        ) : isEmpty ? (
          <StateBlock
            icon={isEmails ? Mail : isLogins ? LogIn : History}
            title={isEmails ? 'No emails captured yet' : isLogins ? 'No sign-ins recorded yet' : 'No activity recorded yet'}
            hint={
              isEmails
                ? 'This fills in once the Resend webhook is connected — every email the portal sends will be recorded here permanently.'
                : isLogins
                ? 'Logins across every portal will appear here as they happen.'
                : 'Admin actions will appear here as they happen.'
            }
          />
        ) : isEmails ? (
          <>
            <CardTable
              cols={COLS_EMAILS}
              minWidth={520}
              head={
                <>
                  <span>Email</span>
                  <span>Status</span>
                  <span className="justify-self-end">When</span>
                </>
              }
            >
              {emails.map((r) => {
                const meta = EMAIL_STATUS_META[r.status] || EMAIL_STATUS_FALLBACK
                const recipients = (r.to_addresses || []).filter(Boolean)
                const recipientLabel =
                  recipients.length === 0 ? 'Unknown recipient'
                  : recipients.length === 1 ? recipients[0]
                  : `${recipients[0]} +${recipients.length - 1}`
                return (
                  <Row key={r.id} cols={COLS_EMAILS}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-strong text-ink-muted">
                        <Mail size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{r.subject || '(no subject)'}</p>
                        <p className="text-[11.5px] text-ink-muted truncate">
                          {r.bounce_detail ? `${recipientLabel} · ${r.bounce_detail}` : recipientLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center min-w-0">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </div>
                    <span
                      className="justify-self-end text-right text-[11px] text-ink-muted tabular-nums"
                      title={new Date(r.last_event_at).toLocaleString()}
                    >
                      {timeAgo(r.last_event_at)}
                    </span>
                  </Row>
                )
              })}
            </CardTable>

            {/* Emails paginate server-side — the one feed that grows unbounded. */}
            {emailTotalPages > 1 && (
              <div className="flex items-center gap-4 px-5 py-3.5 border-t border-hairline flex-wrap">
                <span className="text-[12.5px] text-ink-muted">
                  Page <b className="font-semibold text-ink-secondary tabular-nums">{emailPage}</b> of{' '}
                  <b className="font-semibold text-ink-secondary tabular-nums">{emailTotalPages}</b> ·{' '}
                  <span className="tabular-nums">{emailCount}</span> total
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1.5">
                  {emailPage > 1 && (
                    <Link
                      href={`/admin/audit?action=emails&page=${emailPage - 1}`}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-hairline bg-surface-soft text-[12px] font-medium text-ink-secondary hover:border-hairline-strong transition-colors"
                    >
                      <ChevronLeft size={13} /> Prev
                    </Link>
                  )}
                  {emailPage < emailTotalPages && (
                    <Link
                      href={`/admin/audit?action=emails&page=${emailPage + 1}`}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-hairline bg-surface-soft text-[12px] font-medium text-ink-secondary hover:border-hairline-strong transition-colors"
                    >
                      Next <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : isLogins ? (
          <>
            <CardTable
              cols={COLS_LOGINS}
              minWidth={760}
              head={
                <>
                  <span>User</span>
                  <span className="hidden sm:block">Role</span>
                  <span className="hidden sm:block">Session</span>
                  <span className="justify-self-end">When</span>
                </>
              }
            >
              {pagedLogins.map((r) => {
                const meta = ROLE_META[r.role || ''] || ROLE_FALLBACK
                const DeviceIcon = deviceIcon(r.device)
                const location = locationOf(r)
                const device = deviceLabel(r)
                const method = METHOD_LABEL[r.method || '']
                return (
                  <Row key={r.id} cols={COLS_LOGINS}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ToneAvatar name={r.name || r.email || 'User'} size={28} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{r.name || r.email || 'Unknown user'}</p>
                        <p className="text-[11.5px] text-ink-muted truncate">{method ? `Signed in · ${method}` : 'Signed in'}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center min-w-0">
                      <TagPill tone={meta.tone}>{meta.label}</TagPill>
                    </div>
                    <div className="hidden sm:flex items-center justify-end gap-x-2.5 gap-y-0.5 flex-wrap text-[11px] text-ink-muted min-w-0">
                      {location && (
                        <span className="flex items-center gap-1 min-w-0"><MapPin size={11} className="flex-shrink-0" /><span className="truncate">{location}</span></span>
                      )}
                      {r.ip && (
                        <span className="flex items-center gap-1 font-mono"><Globe size={11} className="flex-shrink-0" />{r.ip}</span>
                      )}
                      {device && (
                        <span className="flex items-center gap-1 min-w-0"><DeviceIcon size={11} className="flex-shrink-0" /><span className="truncate">{device}</span></span>
                      )}
                    </div>
                    <span
                      className="justify-self-end text-right text-[11px] text-ink-muted tabular-nums"
                      title={new Date(r.created_at).toLocaleString()}
                    >
                      {timeAgo(r.created_at)}
                    </span>
                  </Row>
                )
              })}
            </CardTable>

            {feedLength >= 200 && <CapNote />}
            <Pagination
              page={paged.page}
              perPage={paged.perPage}
              total={feedLength}
              totalPages={paged.totalPages}
              onPage={paged.setPage}
              onPerPage={paged.setPerPage}
              unit="sign-ins"
            />
          </>
        ) : (
          <>
            <CardTable
              cols={COLS_AUDIT}
              minWidth={560}
              head={
                <>
                  <span>Activity</span>
                  <span className="hidden sm:block">Action</span>
                  <span className="justify-self-end">When</span>
                </>
              }
            >
              {pagedRows.map((r) => {
                const meta = ACTION_META[r.action] || FALLBACK_META
                const Icon = meta.icon
                const t = CARD_TONE[meta.tone]
                return (
                  <Row key={r.id} cols={COLS_AUDIT}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', t.bg, t.fg)}>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{r.actor_name || 'System'}</p>
                        <p className="text-[11.5px] text-ink-muted truncate">{r.summary}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center min-w-0">
                      <TagPill tone={meta.tone}>{meta.label}</TagPill>
                    </div>
                    <span
                      className="justify-self-end text-right text-[11px] text-ink-muted tabular-nums"
                      title={new Date(r.created_at).toLocaleString()}
                    >
                      {timeAgo(r.created_at)}
                    </span>
                  </Row>
                )
              })}
            </CardTable>

            {feedLength >= 200 && <CapNote />}
            <Pagination
              page={paged.page}
              perPage={paged.perPage}
              total={feedLength}
              totalPages={paged.totalPages}
              onPage={paged.setPage}
              onPerPage={paged.setPerPage}
              unit="entries"
            />
          </>
        )}
      </ListCard>
    </ListCardPage>
  )
}

// The server query caps each feed at the 200 most recent rows; this preserves
// the original page's "you're seeing a capped window" note.
function CapNote() {
  return <p className="px-5 pt-3 text-center text-[11px] text-ink-faint">Only the 200 most recent entries are loaded.</p>
}

function StateBlock({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: ReactNode }) {
  return (
    <div className="px-5 py-16 text-center">
      <Icon size={22} className="text-ink-faint mx-auto mb-2.5" />
      <p className="text-[13px] text-ink-secondary">{title}</p>
      <p className="text-[11px] text-ink-muted mt-1 max-w-md mx-auto">{hint}</p>
    </div>
  )
}
