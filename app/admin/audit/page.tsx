export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import {
  ChevronRight, ShieldCheck, UserCog, FileCheck2, Trash2,
  CalendarCheck, History, Filter, Inbox, UserPlus, UserMinus,
  UserCheck, Wallet, RefreshCw, FilePlus, Power, PowerOff, Ticket,
  Eye, Flag, ArrowRightLeft,
} from 'lucide-react'

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

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initialsOf(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// Visual treatment per action key.
const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
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

// Filter chips shown above the table. `prefix` filters match a family of
// actions (e.g. every `form.*` or `employee.*`); the rest match exactly.
const FILTERS: { key: string; label: string; prefix?: boolean }[] = [
  { key: 'all', label: 'All activity' },
  { key: 'role.update', label: 'Role changes' },
  { key: 'form.', label: 'Forms', prefix: true },
  { key: 'submission.', label: 'Submissions', prefix: true },
  { key: 'ticket.', label: 'Tickets', prefix: true },
  { key: 'request.review', label: 'Time off' },
  { key: 'employee.', label: 'Employees', prefix: true },
  { key: 'accrual.', label: 'Accrual', prefix: true },
]

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { action?: string }
}) {
  const selected = FILTERS.find((f) => f.key === searchParams.action)
  const active = selected ? selected.key : 'all'

  let query = supabaseAdmin
    .from('audit_log')
    .select('id, actor_name, action, entity_type, entity_id, summary, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (selected && active !== 'all') {
    query = selected.prefix ? query.like('action', `${selected.key}%`) : query.eq('action', selected.key)
  }

  const { data, error } = await query
  const rows = (data || []) as AuditRow[]

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">System</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Audit Log</span>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h1 className="text-[18px] font-bold text-zinc-900 dark:text-white leading-tight">Audit Log</h1>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              An immutable record of consequential admin actions — who did what, and when.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-zinc-400 dark:text-zinc-600" />
          {FILTERS.map((f) => {
            const isActive = f.key === active || (f.key === 'all' && active === 'all')
            return (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/admin/audit' : `/admin/audit?action=${f.key}`}
                className={
                  'text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ' +
                  (isActive
                    ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200')
                }
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        {/* Log */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none overflow-hidden">
          {error ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Couldn&apos;t load the audit log.</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                If this table doesn&apos;t exist yet, run migration <code className="font-mono">020_audit_log.sql</code>.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <History size={22} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-2.5" />
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No activity recorded yet</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                Admin actions will appear here as they happen.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {rows.map((r) => {
                const meta = ACTION_META[r.action] || FALLBACK_META
                const Icon = meta.icon
                return (
                  <li key={r.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
                      <Icon size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-800 dark:text-zinc-100 truncate">{r.summary}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span className="font-medium text-zinc-500 dark:text-zinc-400">{r.actor_name || 'Unknown'}</span>
                        <span>·</span>
                        <span className="font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="hidden sm:flex w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-300">
                        {initialsOf(r.actor_name)}
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums w-16 text-right" title={new Date(r.created_at).toLocaleString()}>
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {rows.length >= 200 && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center">
            Showing the 200 most recent entries.
          </p>
        )}
      </div>
    </div>
  )
}
