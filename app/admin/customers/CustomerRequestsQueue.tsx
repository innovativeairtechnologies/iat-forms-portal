'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Mail, Phone, Ticket as TicketIcon, CheckCircle2, XCircle,
  AlertCircle, Clock, Building2, Link2,
} from 'lucide-react'
import { StatusPill, timeAgo } from '@/components/admin/list'
import NewCustomerWizard from '@/components/admin/NewCustomerWizard'

export type CustomerPortalRequestRow = {
  id: string
  ticket_id: string
  requested_email: string
  requested_company: string | null
  requested_contact_name: string | null
  requested_phone: string | null
  suggested_customer_id: string | null
  status: 'pending' | 'approved' | 'denied'
  decided_by: string | null
  decided_at: string | null
  deny_reason: string | null
  resulting_customer_id: string | null
  created_at: string
  tickets: {
    id: string
    ticket_number: string
    serial_number: string | null
    model_number: string | null
    problem_description: string | null
  } | null
  suggested: { id: string; company_name: string } | null
}

type Filter = 'pending' | 'approved' | 'denied' | 'all'

export default function CustomerRequestsQueue({ requests }: { requests: CustomerPortalRequestRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('pending')
  const [wizardFor, setWizardFor] = useState<CustomerPortalRequestRow | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const submitDeny = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const res = await fetch(`/api/admin/customer-portal-requests/${id}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: denyReason.trim() || undefined }),
    })
    setActionLoading(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setActionError(d.error || 'Could not deny the request.')
      return
    }
    setDenyingId(null)
    setDenyReason('')
    router.refresh()
  }

  return (
    <div>
      {/* Sub-filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800">
        {(['pending', 'approved', 'denied', 'all'] as Filter[]).map((f) => {
          const count = f === 'all' ? requests.length : requests.filter((r) => r.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all capitalize ${
                filter === f
                  ? 'border-emerald-500 text-zinc-900 dark:text-white'
                  : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {f} <span className={`text-[11px] tabular-nums ${filter === f ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {actionError && (
        <div className="mb-4 text-[13px] text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-900 rounded-xl px-4 py-3">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-12 text-center">
          <Mail size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No {filter !== 'all' ? filter : ''} requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Building2 size={15} className="text-zinc-500 dark:text-zinc-400" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">
                        {r.requested_company || r.requested_contact_name || r.requested_email}
                      </p>
                      <p className="text-[12px] text-zinc-400 truncate">
                        {r.requested_contact_name || '—'} · {timeAgo(r.created_at)} ago
                      </p>
                    </div>
                  </div>
                  {r.status === 'pending' && <StatusPill tone="amber" icon={<Clock size={11} />}>Pending</StatusPill>}
                  {r.status === 'approved' && <StatusPill tone="emerald" icon={<CheckCircle2 size={11} />}>Approved</StatusPill>}
                  {r.status === 'denied' && <StatusPill tone="rose" icon={<XCircle size={11} />}>Denied</StatusPill>}
                </div>

                {/* Details */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide mb-0.5">Email</p>
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-200 truncate">
                      <Mail size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                      {r.requested_email}
                    </p>
                  </div>
                  {r.requested_phone && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide mb-0.5">Phone</p>
                      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-200">
                        <Phone size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                        {r.requested_phone}
                      </p>
                    </div>
                  )}
                  {r.tickets && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide mb-0.5">Ticket</p>
                      <Link
                        href={`/admin/tickets/${r.tickets.id}`}
                        className="flex items-center gap-1.5 text-[12.5px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 truncate"
                      >
                        <TicketIcon size={12} className="flex-shrink-0" />
                        {r.tickets.ticket_number}
                      </Link>
                    </div>
                  )}
                </div>

                {r.tickets?.problem_description && (
                  <p className="mt-3 text-[12.5px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3.5 py-2.5 truncate">
                    &ldquo;{r.tickets.problem_description}&rdquo;
                  </p>
                )}

                {r.suggested && r.status === 'pending' && (
                  <div className="mt-3 flex items-center gap-2 text-[12.5px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900 rounded-lg px-3.5 py-2.5">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    Possible match: <strong>{r.suggested.company_name}</strong> already has portal access for this unit's serial number — Approve will offer to attach instead of creating a new company.
                  </div>
                )}

                {r.status === 'denied' && r.deny_reason && (
                  <p className="mt-3 text-[12.5px] text-zinc-400 italic">Reason: &ldquo;{r.deny_reason}&rdquo;</p>
                )}

                {/* Actions */}
                {r.status === 'pending' && (
                  <div className="mt-4">
                    {denyingId === r.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="flex-1 text-[12.5px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 outline-none focus:border-rose-400"
                        />
                        <button
                          onClick={() => submitDeny(r.id)}
                          disabled={actionLoading === r.id}
                          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-semibold px-3.5 py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          {actionLoading === r.id ? 'Denying…' : 'Confirm deny'}
                        </button>
                        <button
                          onClick={() => { setDenyingId(null); setDenyReason('') }}
                          className="text-[13px] font-medium text-zinc-500 hover:text-zinc-700 px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWizardFor(r)}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-all shadow-sm"
                        >
                          <Link2 size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => setDenyingId(r.id)}
                          className="flex items-center gap-2 bg-white hover:bg-rose-50 dark:bg-transparent dark:hover:bg-rose-500/10 text-rose-500 border border-rose-200 dark:border-rose-900 text-[13px] font-semibold px-4 py-2 rounded-lg transition-all"
                        >
                          <XCircle size={14} />
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {wizardFor && (
        <NewCustomerWizard
          onClose={() => setWizardFor(null)}
          onCreated={() => { setWizardFor(null); router.refresh() }}
          initial={{
            company_name: wizardFor.requested_company ?? '',
            primary_contact_name: wizardFor.requested_contact_name ?? '',
            contact_email: wizardFor.requested_email,
            phone: wizardFor.requested_phone ?? '',
            serial_number: wizardFor.tickets?.serial_number ?? '',
            model_number: wizardFor.tickets?.model_number ?? '',
          }}
          linkTicketId={wizardFor.ticket_id}
          linkRequestId={wizardFor.id}
          suggestedCustomerId={wizardFor.suggested_customer_id}
          suggestedCustomerName={wizardFor.suggested?.company_name ?? null}
        />
      )}
    </div>
  )
}
