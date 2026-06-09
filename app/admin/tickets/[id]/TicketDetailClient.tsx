'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Lightbulb } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Ticket, TicketNote, Employee } from '@/lib/supabase'
import { updateTicket } from '../actions'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('@/components/admin/RichTextEditor'), { ssr: false })

const STATUS_OPTIONS: { value: Ticket['status']; label: string; cls: string }[] = [
  { value: 'open',        label: 'Open',        cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { value: 'resolved',    label: 'Resolved',    cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' },
  { value: 'closed',      label: 'Closed',      cls: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
]

const PRIORITY_OPTIONS: { value: Ticket['priority']; label: string; cls: string }[] = [
  { value: 'low',  label: 'Low',  cls: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' },
  { value: 'med',  label: 'Med',  cls: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  { value: 'high', label: 'High', cls: 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800' },
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

function formatNoteDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TicketDetailClient({
  ticket: initial,
  initialNotes,
  admins,
}: {
  ticket: Ticket
  initialNotes: TicketNote[]
  admins: Pick<Employee, 'id' | 'name'>[]
}) {
  const router = useRouter()
  const [ticket, setTicket] = useState(initial)
  const [pendingStatus, setPendingStatus] = useState(initial.status)
  const [pendingPriority, setPendingPriority] = useState<Ticket['priority']>(initial.priority ?? 'med')
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(initial.owner_id ?? null)
  const [pendingResolvedReason, setPendingResolvedReason] = useState<string>(initial.resolved_reason ?? '')
  const [notes, setNotes] = useState<TicketNote[]>(initialNotes)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasUnsavedChanges =
    pendingStatus !== ticket.status ||
    pendingPriority !== (ticket.priority ?? 'med') ||
    pendingOwnerId !== (ticket.owner_id ?? null) ||
    pendingResolvedReason !== (ticket.resolved_reason ?? '')

  const resolvedReasonRequired = pendingStatus === 'resolved' && !pendingResolvedReason

  const saveTicket = async () => {
    if (updating || !hasUnsavedChanges || resolvedReasonRequired) return
    setUpdating(true)
    setSaveError(null)
    const { error } = await updateTicket(ticket.id, {
      status: pendingStatus,
      priority: pendingPriority,
      owner_id: pendingOwnerId,
      resolved_reason: pendingStatus === 'resolved' ? pendingResolvedReason : null,
    })
    setUpdating(false)
    if (error) { setSaveError(error); return }
    const owner = admins.find(a => a.id === pendingOwnerId)
    const resolvedReason = pendingStatus === 'resolved' ? pendingResolvedReason : null
    setTicket(t => ({ ...t, status: pendingStatus, priority: pendingPriority, owner_id: pendingOwnerId, resolved_reason: resolvedReason, owner: owner ? { ...owner } as Employee : undefined }))
  }

  const addNote = async (html: string) => {
    setSavingNote(true)
    setSaveError(null)
    const sb = createSupabaseBrowser()
    const { data, error } = await sb
      .from('ticket_notes')
      .insert({ ticket_id: ticket.id, content: html })
      .select()
      .single()
    setSavingNote(false)
    if (error) { setSaveError(error.message); return }
    if (data) setNotes(prev => [...prev, data as TicketNote])
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === ticket.status)
  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === (ticket.priority ?? 'med'))
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
              {ticket.owner && ` · ${ticket.owner.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full border ${currentPriority?.cls}`}>
              {currentPriority?.label}
            </span>
            <span className={`inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full border ${currentStatus?.cls}`}>
              {currentStatus?.label}
            </span>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="flex gap-6 items-start max-w-6xl">

        {/* ── Left column ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

        {saveError && (
          <div className="mb-4 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}

        {/* Status + Priority update */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">Status &amp; Priority</p>
            {hasUnsavedChanges && (
              <button
                onClick={saveTicket}
                disabled={updating}
                className="text-[12px] font-semibold bg-[#089447] hover:bg-[#077a3c] text-white px-3.5 py-1.5 rounded-xl disabled:opacity-50 transition-all"
              >
                {updating ? 'Saving…' : 'Update Ticket'}
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Status</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPendingStatus(opt.value)}
                disabled={updating}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                  pendingStatus === opt.value
                    ? opt.cls
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Priority</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRIORITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPendingPriority(opt.value)}
                disabled={updating}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                  pendingPriority === opt.value
                    ? opt.cls
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Owner</p>
          <select
            value={pendingOwnerId ?? ''}
            onChange={e => setPendingOwnerId(e.target.value || null)}
            disabled={updating}
            className="text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 outline-none focus:border-gray-300 dark:focus:border-gray-600 transition-all disabled:opacity-50 w-full sm:w-auto min-w-[180px]"
          >
            <option value="">Unassigned</option>
            {admins.map(admin => (
              <option key={admin.id} value={admin.id}>{admin.name}</option>
            ))}
          </select>

          {pendingStatus === 'resolved' && (
            <div className="mt-4">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
                Resolution Reason <span className="text-red-400">*</span>
              </p>
              <select
                value={pendingResolvedReason}
                onChange={e => setPendingResolvedReason(e.target.value)}
                disabled={updating}
                className={`text-[13px] bg-gray-50 dark:bg-gray-800 border rounded-xl px-3 py-2 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 transition-all disabled:opacity-50 w-full ${
                  resolvedReasonRequired
                    ? 'border-red-300 dark:border-red-700 focus:border-red-400 focus:ring-red-100 dark:focus:ring-red-900/30'
                    : 'border-gray-100 dark:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 focus:ring-gray-100 dark:focus:ring-gray-800'
                }`}
              >
                <option value="">Select a reason…</option>
                <option>Technician on-site repair completed</option>
                <option>Remote troubleshooting resolved issue</option>
                <option>Customer resolved with provided guidance</option>
                <option>Replacement part installed</option>
                <option>Software / controls update applied</option>
                <option>Cooling system serviced</option>
                <option>Airflow rebalanced</option>
                <option>Seal / gasket replaced</option>
                <option>Electrical fault corrected</option>
                <option>Warranty replacement completed</option>
                <option>No fault found – unit operating normally</option>
                <option>Customer training provided</option>
                <option>Preventive maintenance performed</option>
                <option>Issue resolved by customer prior to contact</option>
                <option>Referred to third-party service</option>
              </select>
              {resolvedReasonRequired && (
                <p className="text-[11px] text-red-400 mt-1.5">A resolution reason is required to mark this ticket resolved.</p>
              )}
            </div>
          )}
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

        {/* Photos */}
        {ticket.photo_urls && ticket.photo_urls.length > 0 && (
          <Section title={`Photos (${ticket.photo_urls.length})`}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {ticket.photo_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-[#089447] transition-all"
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-[11px] font-semibold drop-shadow transition-opacity">
                      Open ↗
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Admin Notes Log */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-4">Admin Notes</p>

          {/* Legacy note from old system */}
          {ticket.notes && (
            <div className="mb-4 pb-4 border-b border-gray-50 dark:border-gray-800">
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mb-2">Legacy note</p>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {ticket.notes}
              </p>
            </div>
          )}

          {/* Notes log */}
          {notes.length > 0 && (
            <div className="space-y-4 mb-5">
              {notes.map((note, idx) => (
                <div key={note.id}>
                  {(idx > 0 || !!ticket.notes) && <div className="border-t border-gray-50 dark:border-gray-800 mb-4" />}
                  <p className="text-[11px] text-gray-300 dark:text-gray-600 mb-2">{formatNoteDate(note.created_at)}</p>
                  <div
                    className="note-content text-[13px] text-gray-700 dark:text-gray-200"
                    dangerouslySetInnerHTML={{ __html: note.content }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* New note editor — always visible */}
          {(notes.length > 0 || !!ticket.notes) && (
            <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-4 mb-3">
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mb-3">New note</p>
            </div>
          )}
          <RichTextEditor onSubmit={addNote} disabled={savingNote} />
        </div>

        </div>{/* end left column */}

        {/* ── Right column ──────────────────────────────────────── */}
        <div className="w-72 xl:w-80 flex-shrink-0 sticky top-8 space-y-4">

          {/* AI Recommendations */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <Lightbulb size={13} className="text-amber-500" />
              </div>
              <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">AI Recommendations</p>
            </div>
            {ticket.ai_recommendations && ticket.ai_recommendations.length > 0 ? (
              <div className="space-y-3">
                {ticket.ai_recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[12px] text-gray-600 dark:text-gray-300 leading-relaxed">{rec}</p>
                  </div>
                ))}
                <p className="text-[11px] text-gray-300 dark:text-gray-600 pt-1 border-t border-gray-50 dark:border-gray-800 mt-1">
                  Shown to customer at submission
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-gray-300 dark:text-gray-600">No recommendations generated for this ticket.</p>
            )}
          </div>

          {/* Items Reviewed */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-3">Items Reviewed</p>
            <p className="text-[12px] text-gray-300 dark:text-gray-600 leading-relaxed">
              Knowledge base coming soon. Article tracking will appear here once enabled.
            </p>
          </div>

        </div>{/* end right column */}

        </div>{/* end flex row */}
      </div>
    </div>
  )
}
