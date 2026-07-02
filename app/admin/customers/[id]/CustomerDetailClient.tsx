'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Boxes, Send, Trash2, ShieldCheck, ShieldOff, Copy, Check,
  Loader2, CheckCircle2, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { DetailShell, DetailTopBar, Card, CardHead, MetaRow } from '@/components/admin/detail-ui'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'
import { StatusPill } from '@/components/admin/list'
import { warrantyState } from '@/lib/equipment'
import type { Customer, Equipment } from '@/lib/supabase'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerDetailClient({
  customer,
  equipment,
  hasLogin,
  requestCount,
}: {
  customer: Customer
  equipment: Equipment[]
  hasLogin: boolean
  requestCount: number
}) {
  const router = useRouter()
  const [resending, setResending] = useState(false)
  const [resendResult, setResendResult] = useState<{ temp_password: string; email_sent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRemove, setShowRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [actionError, setActionError] = useState('')

  const resend = async () => {
    setResending(true)
    setActionError('')
    setResendResult(null)
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/resend-invite`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error || 'Could not resend the invite.')
        return
      }
      setResendResult({ temp_password: json.temp_password, email_sent: json.email_sent })
      router.refresh()
    } finally {
      setResending(false)
    }
  }

  const remove = async () => {
    setRemoving(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}/remove`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error || 'Could not remove portal access.')
        return
      }
      setShowRemove(false)
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  const copy = async () => {
    if (!resendResult) return
    await navigator.clipboard.writeText(`${customer.contact_email} / ${resendResult.temp_password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <DetailShell>
      <DetailTopBar crumbs={[{ label: 'Customers', href: '/admin/customers' }, { label: customer.company_name }]}>
        {customer.status === 'inactive' ? (
          <StatusPill tone="slate">Inactive</StatusPill>
        ) : (
          <StatusPill tone="emerald">Active</StatusPill>
        )}
        <DeleteRecordButton
          endpoint={`/api/admin/customers/${customer.id}`}
          entityLabel="customer"
          redirectTo="/admin/customers"
          warn="Deletes the company + its logins."
        />
      </DetailTopBar>

      <div className="mx-auto max-w-[1100px] p-5 lg:p-8">
        {/* Title */}
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Building2 size={20} className="text-zinc-500 dark:text-zinc-300" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">{customer.company_name}</h1>
            <p className="text-[13px] text-zinc-400">
              {equipment.length} unit{equipment.length === 1 ? '' : 's'} · {requestCount} request{requestCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main: linked equipment */}
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHead
                title="Equipment"
                icon={<Boxes size={14} />}
                action={<span className="text-[11px] font-medium text-zinc-400">{equipment.length}</span>}
              />
              {equipment.length ? (
                <div>
                  {equipment.map((e) => (
                    <Link
                      key={e.id}
                      href={`/admin/equipment/${e.id}`}
                      className="group flex items-center gap-3 border-t border-zinc-100 px-5 py-3 first:border-t-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                    >
                      <Boxes size={15} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-semibold text-zinc-800 group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                          {e.serial_number}
                        </p>
                        <p className="truncate text-[12px] text-zinc-400">
                          {e.model_number || '—'}
                          {e.location ? ` · ${e.location}` : ''}
                        </p>
                      </div>
                      {warrantyState(e) === 'in' ? (
                        <StatusPill tone="emerald">In warranty</StatusPill>
                      ) : warrantyState(e) === 'out' ? (
                        <StatusPill tone="rose">Out</StatusPill>
                      ) : null}
                      <ChevronRight size={14} className="shrink-0 text-zinc-300 group-hover:text-emerald-500 dark:text-zinc-600" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] text-zinc-400">No equipment linked to this customer yet.</p>
              )}
            </Card>
          </div>

          {/* Right rail: details + portal access */}
          <div className="space-y-5">
            <Card>
              <CardHead title="Details" />
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                <MetaRow label="Contact">{customer.primary_contact_name || '—'}</MetaRow>
                <MetaRow label="Email">{customer.contact_email || '—'}</MetaRow>
                <MetaRow label="Phone">{customer.phone || '—'}</MetaRow>
                <MetaRow label="Location">{customer.location || '—'}</MetaRow>
                <MetaRow label="Added">{fmtDate(customer.created_at)}</MetaRow>
              </div>
            </Card>

            <Card>
              <CardHead title="Portal access" icon={hasLogin ? <ShieldCheck size={14} /> : <ShieldOff size={14} />} />
              <div className="space-y-3 p-5">
                {resendResult ? (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={13} /> {resendResult.email_sent ? 'Invite re-sent' : 'New password set'}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] font-bold text-emerald-700 dark:text-emerald-300">{resendResult.temp_password}</span>
                      <button
                        onClick={copy}
                        className="flex h-7 items-center gap-1 rounded-md border border-emerald-200 px-2 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                    {hasLogin
                      ? `${customer.contact_email} can sign in at /login.`
                      : 'No active login. Re-send an invite to restore access.'}
                  </p>
                )}

                {actionError && !showRemove && <p className="text-[12px] text-rose-500">{actionError}</p>}

                <button
                  onClick={resend}
                  disabled={resending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2 text-[12.5px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {resending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {hasLogin ? 'Re-send invite' : 'Send invite'}
                </button>

                {customer.status !== 'inactive' && hasLogin && (
                  <button
                    onClick={() => {
                      setActionError('')
                      setShowRemove(true)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white py-2 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={13} /> Remove from portal
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Remove confirmation */}
      {showRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRemove(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                <AlertTriangle size={17} />
              </span>
              <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white">Remove from portal?</h3>
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">{customer.company_name}</span> will lose portal access and can no longer sign in. Their equipment and history are kept — you can re-invite later.
            </p>
            {actionError && <p className="mt-2 text-[12px] text-rose-500">{actionError}</p>}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setShowRemove(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={removing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {removing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </DetailShell>
  )
}
