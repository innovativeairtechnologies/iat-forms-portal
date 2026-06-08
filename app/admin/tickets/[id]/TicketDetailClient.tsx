'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Ticket } from '@/lib/supabase'

const STATUS_OPTIONS: { value: Ticket['status']; label: string; cls: string }[] = [
  { value: 'open',        label: 'Open',        cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { value: 'resolved',    label: 'Resolved',    cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' },
  { value: 'closed',      label: 'Closed',      cls: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
]

function YesNo({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined) return <span className="text-gray-300 dark:text-gray-600">—</span>
  return val
    ? <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
    : <span className="text-red-500 font-medium">No</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-[12px] text-gray-400 w-44 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200 flex-1">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-4">
      <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

export default function TicketDetailClient({ ticket: initial }: { ticket: Ticket }) {
  const router = useRouter()
  const [ticket, setTicket] = useState(initial)
  const [notes, setNotes] = useState(initial.notes || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const updateStatus = async (status: Ticket['status']) => {
    if (saving || ticket.status === status) return
    setSaving(true)
    setSaveError(null)
    const sb = createSupabaseBrowser()
    const { error } = await sb.from('tickets').update({ status }).eq('id', ticket.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setTicket(t => ({ ...t, status }))
    startTransition(() => router.refresh())
  }

  const saveNotes = async () => {
    setSaving(true)
    setSaveError(null)
    const sb = createSupabaseBrowser()
    const { error } = await sb.from('tickets').update({ notes }).eq('id', ticket.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setTicket(t => ({ ...t, notes }))
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === ticket.status)
  const submitted = new Date(ticket.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={() => router.push('/admin/tickets')}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-4 transition-colors"
        >
          <ChevronLeft size={14} /> Back to Tickets
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Support</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight font-mono">
              {ticket.ticket_number}
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {ticket.customer_name}
              {ticket.customer_company ? ` · ${ticket.customer_company}` : ''}
              {' · '}{submitted}
            </p>
          </div>
          <span className={`inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full border flex-shrink-0 ${currentStatus?.cls}`}>
            {currentStatus?.label}
          </span>
        </div>
      </div>

      <div className="p-8 max-w-3xl">

        {saveError && (
          <div className="mb-4 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}

        {/* Status update */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-4">
          <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-3">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateStatus(opt.value)}
                disabled={saving}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                  ticket.status === opt.value
                    ? opt.cls + ' cursor-default'
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact */}
        <Section title="Contact">
          <Field label="Name">{ticket.customer_name}</Field>
          {ticket.customer_company && <Field label="Company">{ticket.customer_company}</Field>}
          <Field label="Email">
            <a href={`mailto:${ticket.customer_email}`} className="text-[#089447] hover:underline">
              {ticket.customer_email}
            </a>
          </Field>
          {ticket.customer_phone && (
            <Field label="Phone">
              <a href={`tel:${ticket.customer_phone}`} className="text-[#089447] hover:underline">
                {ticket.customer_phone}
              </a>
            </Field>
          )}
        </Section>

        {/* Equipment */}
        <Section title="Equipment">
          <Field label="Serial Number">{ticket.serial_number}</Field>
          <Field label="Model Number">{ticket.model_number}</Field>
          <Field label="Voltage">{ticket.voltage}</Field>
        </Section>

        {/* Problem */}
        <Section title="Problem Description">
          <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {ticket.problem_description}
          </p>
        </Section>

        {/* Cooling */}
        <Section title="Cooling Systems">
          <Field label="Pre cooling installed"><YesNo val={ticket.pre_cooling} /></Field>
          {ticket.pre_cooling && <>
            <Field label="Pre cooling type">{ticket.pre_cooling_type || '—'}</Field>
            <Field label="Pre cooling working"><YesNo val={ticket.pre_cooling_working} /></Field>
          </>}
          <Field label="Post cooling installed"><YesNo val={ticket.post_cooling} /></Field>
          {ticket.post_cooling && <>
            <Field label="Post cooling type">{ticket.post_cooling_type || '—'}</Field>
            <Field label="Post cooling working"><YesNo val={ticket.post_cooling_working} /></Field>
          </>}
        </Section>

        {/* System Checks */}
        <Section title="System Checks">
          <Field label="Airflows balanced"><YesNo val={ticket.airflow_balanced} /></Field>
          {ticket.airflow_balanced === false && <>
            <Field label="Process airflow">
              {ticket.process_airflow_cfm ? `${ticket.process_airflow_cfm} CFM` : '—'}
            </Field>
            <Field label="React airflow">
              {ticket.react_airflow_cfm ? `${ticket.react_airflow_cfm} CFM` : '—'}
            </Field>
          </>}
          <Field label="React heat working"><YesNo val={ticket.react_heat_working} /></Field>
          {ticket.react_heat_working && (
            <Field label="Maintaining setpoint (285°F)"><YesNo val={ticket.react_heat_setpoint} /></Field>
          )}
          <Field label="Seals good"><YesNo val={ticket.seals_good} /></Field>
        </Section>

        {/* Admin notes */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-3">Admin Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add internal notes…"
            rows={4}
            className="w-full text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-700 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 outline-none focus:border-gray-300 dark:focus:border-gray-600 resize-none transition-all font-[inherit]"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={saveNotes}
              disabled={saving || notes === (ticket.notes || '')}
              className="text-[13px] font-semibold bg-[#089447] hover:bg-[#077a3c] text-white px-4 py-2 rounded-xl disabled:opacity-40 transition-all"
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
