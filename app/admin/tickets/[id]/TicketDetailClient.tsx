'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lightbulb, ExternalLink, BookOpen, Paperclip, Mail, User, Wrench, FileText, Snowflake, ClipboardCheck, Image as ImageIcon, MessageSquare, SlidersHorizontal, X, Loader2, Wind, Activity, ChevronDown, ShieldCheck } from 'lucide-react'
import type { Ticket, TicketNote, TicketNoteAttachment, Employee } from '@/lib/supabase'
import { updateTicket } from '../actions'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import dynamic from 'next/dynamic'
import { DetailShell, DetailTopBar, Card, CardHead, Field } from '@/components/admin/detail-ui'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'
import { StatusPill } from '@/components/admin/list'
import JerryWidget from '@/components/shared/JerryWidget'

const RichTextEditor = dynamic(() => import('@/components/shared/RichTextEditor'), { ssr: false })

const STATUS_OPTIONS: { value: Ticket['status']; label: string; cls: string }[] = [
  { value: 'open',        label: 'Open',        cls: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' },
  { value: 'resolved',    label: 'Resolved',    cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
  { value: 'closed',      label: 'Closed',      cls: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700' },
]

const PRIORITY_OPTIONS: { value: Ticket['priority']; label: string; cls: string }[] = [
  { value: 'low',  label: 'Low',  cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
  { value: 'med',  label: 'Med',  cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' },
  { value: 'high', label: 'High', cls: 'bg-rose-50 dark:bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-200 dark:border-rose-500/30' },
]

function YesNo({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
  return val
    ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Yes</span>
    : <span className="text-rose-500 font-medium">No</span>
}

/** A titled card whose body is padded — used for the read-only info sections. */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHead title={title} icon={icon} />
      <div className="px-5 py-2.5">{children}</div>
    </Card>
  )
}

/** A borderless titled group used inside the collapsed "Intake details" card — a
    lighter Section (no card chrome) so the folded diagnostic echoes read as one card. */
function IntakeGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800/50 first:border-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1">
        <span className="text-zinc-400 dark:text-zinc-500 flex-shrink-0">{icon}</span>
        <h4 className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">{title}</h4>
      </div>
      <div className="px-5 pb-2.5">{children}</div>
    </div>
  )
}

function formatNoteDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(n: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const isEmailFile = (name: string) => /\.(eml|msg)$/i.test(name)

type EmailPreview = {
  from: string
  to: string
  date: string | null
  subject: string
  html: string | null
  text: string | null
  attachments: { name: string; size: number }[]
}

// A note's attachments. Regular files are admin-gated download links (the route
// validates the path and 307s to a short-lived signed URL). Saved emails
// (.eml/.msg) instead open an inline preview so the team can read them without
// saving the file and launching Outlook.
function NoteAttachments({ ticketId, attachments }: { ticketId: string; attachments: TicketNoteAttachment[] }) {
  const [preview, setPreview] = useState<{ path: string; name: string } | null>(null)
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map(att => {
          const downloadHref = `/api/tickets/${ticketId}/attachments/download?path=${encodeURIComponent(att.path)}&name=${encodeURIComponent(att.name)}`
          const chipCls =
            'group inline-flex items-center gap-2 max-w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 hover:border-emerald-500 transition-colors'

          if (isEmailFile(att.name)) {
            return (
              <button
                key={att.path}
                type="button"
                onClick={() => setPreview({ path: att.path, name: att.name })}
                className={chipCls}
                title={`Preview ${att.name}`}
              >
                <Mail size={13} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="truncate text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{att.name}</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex-shrink-0">Preview</span>
              </button>
            )
          }

          return (
            <a
              key={att.path}
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className={chipCls}
              title={`Download ${att.name}`}
            >
              <Paperclip size={13} className="text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex-shrink-0 transition-colors" />
              <span className="truncate text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{att.name}</span>
              {att.size > 0 && <span className="text-[11px] text-zinc-400 flex-shrink-0">{formatBytes(att.size)}</span>}
            </a>
          )
        })}
      </div>
      {preview && <EmailPreviewModal ticketId={ticketId} att={preview} onClose={() => setPreview(null)} />}
    </>
  )
}

// Fetches the parsed email from the admin-gated preview route and shows it in a
// modal. The HTML body arrives already sanitized server-side.
function EmailPreviewModal({ ticketId, att, onClose }: { ticketId: string; att: { path: string; name: string }; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'error' | 'done'>('loading')
  const [data, setData] = useState<EmailPreview | null>(null)
  const [err, setErr] = useState('')

  const downloadHref = `/api/tickets/${ticketId}/attachments/download?path=${encodeURIComponent(att.path)}&name=${encodeURIComponent(att.name)}`

  useEffect(() => {
    let alive = true
    setState('loading')
    ;(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/attachments/preview?path=${encodeURIComponent(att.path)}&name=${encodeURIComponent(att.name)}`)
        const json = await res.json()
        if (!alive) return
        if (!res.ok) { setErr(json.error || 'Failed to load email'); setState('error'); return }
        setData(json as EmailPreview)
        setState('done')
      } catch {
        if (alive) { setErr('Failed to load email'); setState('error') }
      }
    })()
    return () => { alive = false }
  }, [ticketId, att.path, att.name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Mail size={15} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">Email preview</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <a href={downloadHref} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400">Download</a>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" aria-label="Close"><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {state === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-zinc-400">
              <Loader2 size={16} className="animate-spin" /> Loading email…
            </div>
          )}
          {state === 'error' && <p className="py-12 text-center text-[13px] text-rose-500">{err}</p>}
          {state === 'done' && data && (
            <div>
              <div className="mb-3 space-y-1 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">{data.subject}</p>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400"><span className="text-zinc-400 dark:text-zinc-500">From:</span> {data.from || '—'}</p>
                {data.to && <p className="text-[12px] text-zinc-500 dark:text-zinc-400"><span className="text-zinc-400 dark:text-zinc-500">To:</span> {data.to}</p>}
                {data.date && <p className="text-[12px] text-zinc-400">{new Date(data.date).toLocaleString()}</p>}
                {data.attachments.length > 0 && (
                  <p className="flex items-center gap-1.5 text-[12px] text-zinc-400"><Paperclip size={12} /> {data.attachments.map(a => a.name).join(', ')}</p>
                )}
              </div>
              {data.html ? (
                <div
                  className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200 [&_a]:text-emerald-600 [&_img]:max-w-full [&_table]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: data.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">{data.text || '(no body)'}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TicketDetailClient({
  ticket: initial,
  initialNotes,
  admins,
  equipmentId,
}: {
  ticket: Ticket
  initialNotes: TicketNote[]
  admins: Pick<Employee, 'id' | 'name'>[]
  equipmentId: string | null
}) {
  const [ticket, setTicket] = useState(initial)
  const [pendingStatus, setPendingStatus] = useState(initial.status)
  const [pendingPriority, setPendingPriority] = useState<Ticket['priority']>(initial.priority ?? 'med')
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(initial.owner_id ?? null)
  const [pendingResolvedReason, setPendingResolvedReason] = useState<string>(initial.resolved_reason ?? '')
  const [notes, setNotes] = useState<TicketNote[]>(initialNotes)
  const [updating, setUpdating] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Default UNCHECKED = internal, matching the locked-in server-side default
  // (migration 037) — an admin must explicitly opt a note into being visible
  // to the customer.
  const [replyToCustomer, setReplyToCustomer] = useState(false)

  // Pre-addressed reply to the customer, tagged with the ticket number in the
  // subject so a future inbound mailbox/webhook can thread responses straight
  // back onto this ticket (Kacy's "email TKT-… and have replies auto-file").
  const emailSubject = `IAT Support Ticket ${ticket.ticket_number} – ${ticket.brand === 'us_rotors' ? 'US Rotors support' : 'dehumidifier support'}`
  const emailBody =
    `Hi ${ticket.customer_name || 'there'},\n\n` +
    `Following up on your IAT support ticket ${ticket.ticket_number}.\n\n\n\n` +
    `Please keep this ticket number in the subject line so we can keep the conversation together.\n\n` +
    `Thank you,\nIAT Support`
  const emailCustomerHref = `mailto:${ticket.customer_email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

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

  const addNote = async (html: string, attachments: TicketNoteAttachment[]) => {
    setSavingNote(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html, attachments, visibility: replyToCustomer ? 'public' : 'internal' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setSaveError(j.error || 'Failed to save note')
        return
      }
      const data = await res.json()
      setNotes(prev => [...prev, data as TicketNote])
      setReplyToCustomer(false)
    } catch {
      setSaveError('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Upload one file to the private ticket-attachments bucket. Two steps: the
  // server hands out a one-shot signed upload URL (tiny JSON request), then the
  // browser uploads the bytes straight to Supabase Storage — bypassing Vercel's
  // ~4.5MB function body limit, which 413s larger PDFs/photos. The editor
  // collects the returned metadata and includes it when the note is saved.
  const uploadAttachment = async (file: File): Promise<TicketNoteAttachment> => {
    const res = await fetch(`/api/tickets/${ticket.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Upload failed')
    }
    const { path, token } = await res.json()

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.storage
      .from('ticket-attachments')
      .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined })
    if (error) throw new Error(error.message || 'Upload failed')

    return { path, name: file.name, type: file.type || '', size: file.size }
  }

  const submitted = new Date(ticket.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const pickerBtn = (selected: boolean, cls: string) =>
    `text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
      selected ? cls : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-200'
    }`

  return (
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'Tickets', href: '/admin/tickets' },
          { label: ticket.ticket_number },
        ]}
      >
        <DeleteRecordButton
          endpoint={`/api/tickets/${ticket.id}`}
          entityLabel="ticket"
          redirectTo="/admin/tickets"
        />
      </DetailTopBar>

      <div className="p-5 space-y-4">
        {/* Hero */}
        <div>
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Support Ticket</p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <h1 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight font-mono">
              {ticket.ticket_number}
            </h1>
            {ticket.request_type === 'warranty' && (
              <StatusPill tone="amber" icon={<ShieldCheck size={11} />}>Warranty Claim</StatusPill>
            )}
          </div>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
            {ticket.customer_name}
            {ticket.customer_company ? ` · ${ticket.customer_company}` : ''}
            {' · '}{submitted}
            {ticket.owner && ` · ${ticket.owner.name}`}
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* ── Main column ───────────────────────────────────────── */}
          <main className="flex-1 min-w-0 w-full space-y-4">

            {saveError && (
              <div className="text-[13px] text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-4 py-3">
                {saveError}
              </div>
            )}

            {/* Problem — the primary content, promoted to the top of the reading column */}
            <Section title="Problem Description" icon={<FileText size={14} />}>
              <p className="text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap py-1">
                {ticket.problem_description}
              </p>
              {(ticket.problem_started || ticket.onset || ticket.what_changed) && (
                <div className="mt-2">
                  {ticket.problem_started && <Field label="When it started">{ticket.problem_started}</Field>}
                  {ticket.onset && <Field label="Onset"><span className="capitalize">{ticket.onset}</span></Field>}
                  {ticket.what_changed && <Field label="Changed just before">{ticket.what_changed}</Field>}
                </div>
              )}
            </Section>

            {/* Status + Priority editor */}
            <Card>
              <CardHead
                title="Status & Priority"
                icon={<SlidersHorizontal size={14} />}
                action={hasUnsavedChanges ? (
                  <button
                    onClick={saveTicket}
                    disabled={updating}
                    className="text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-8 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {updating ? 'Saving…' : 'Update Ticket'}
                  </button>
                ) : undefined}
              />
              <div className="px-5 py-4">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">Status</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setPendingStatus(opt.value)} disabled={updating}
                      className={pickerBtn(pendingStatus === opt.value, opt.cls)}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">Priority</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setPendingPriority(opt.value)} disabled={updating}
                      className={pickerBtn(pendingPriority === opt.value, opt.cls)}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">Owner</p>
                <select
                  value={pendingOwnerId ?? ''}
                  onChange={e => setPendingOwnerId(e.target.value || null)}
                  disabled={updating}
                  className="text-[13px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all disabled:opacity-50 w-full sm:w-auto min-w-[180px]"
                >
                  <option value="">Unassigned</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.name}</option>
                  ))}
                </select>

                {pendingStatus === 'resolved' && (
                  <div className="mt-4">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
                      Resolution Reason <span className="text-rose-400">*</span>
                    </p>
                    <select
                      value={pendingResolvedReason}
                      onChange={e => setPendingResolvedReason(e.target.value)}
                      disabled={updating}
                      className={`text-[13px] bg-white dark:bg-zinc-900 border rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 transition-all disabled:opacity-50 w-full ${
                        resolvedReasonRequired
                          ? 'border-rose-300 dark:border-rose-700 focus:border-rose-400 focus:ring-rose-100 dark:focus:ring-rose-900/30'
                          : 'border-zinc-200 dark:border-zinc-700 focus:border-emerald-500/50 focus:ring-emerald-500/15'
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
                      <p className="text-[11px] text-rose-400 mt-1.5">A resolution reason is required to mark this ticket resolved.</p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Contact */}
            <Card>
              <CardHead
                title="Contact"
                icon={<User size={14} />}
                action={
                  <a
                    href={emailCustomerHref}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-8 rounded-lg transition-colors"
                    title={`Compose an email tagged with ${ticket.ticket_number}`}
                  >
                    <Mail size={13} /> Email customer
                  </a>
                }
              />
              <div className="px-5 py-2.5">
                <Field label="Name">{ticket.customer_name}</Field>
                {ticket.customer_company && <Field label="Company">{ticket.customer_company}</Field>}
                <Field label="Email">
                  <a href={`mailto:${ticket.customer_email}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    {ticket.customer_email}
                  </a>
                </Field>
                {ticket.customer_phone && (
                  <Field label="Phone">
                    <a href={`tel:${ticket.customer_phone}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                      {ticket.customer_phone}
                    </a>
                  </Field>
                )}
              </div>
            </Card>

            {/* Intake details — the read-only diagnostic-form echoes, folded into one
                progressively-disclosed card (collapsed by default to calm the page). */}
            <Card>
              <details className="group">
                <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer select-none list-none marker:content-none [&::-webkit-details-marker]:hidden">
                  <ClipboardCheck size={14} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                  <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Intake details</h3>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Equipment &amp; diagnostic checklist</span>
                  <ChevronDown size={14} className="ml-auto text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-zinc-200/70 dark:border-zinc-800/80 pb-2">
                  {/* Equipment */}
                  <IntakeGroup title="Equipment" icon={<Wrench size={14} />}>
                    <Field label="Serial Number">{ticket.serial_number}</Field>
                    <Field label="Model Number">{ticket.model_number}</Field>
                    <Field label="Voltage">{ticket.voltage}</Field>
                    {equipmentId && (
                      <Link href={`/admin/equipment/${equipmentId}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-3">
                        <ExternalLink size={12} />View unit in registry
                      </Link>
                    )}
                  </IntakeGroup>

                  {/* Current Status */}
                  {(ticket.unit_running !== null || ticket.has_alarms !== null) && (
                    <IntakeGroup title="Current Status" icon={<Activity size={14} />}>
                      <Field label="Unit running"><YesNo val={ticket.unit_running} /></Field>
                      <Field label="Active alarms"><YesNo val={ticket.has_alarms} /></Field>
                      {ticket.alarm_details && <Field label="Alarm details">{ticket.alarm_details}</Field>}
                    </IntakeGroup>
                  )}

                  {/* Cooling */}
                  <IntakeGroup title="Cooling Systems" icon={<Snowflake size={14} />}>
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
                  </IntakeGroup>

                  {/* Airflow & Reactivation */}
                  <IntakeGroup title="Airflow & Reactivation" icon={<Wind size={14} />}>
                    <Field label="Airflows balanced"><YesNo val={ticket.airflow_balanced} /></Field>
                    {ticket.process_airflow_cfm && <Field label="Process airflow">{ticket.process_airflow_cfm} CFM</Field>}
                    {ticket.react_airflow_cfm && <Field label="React airflow">{ticket.react_airflow_cfm} CFM</Field>}
                    {ticket.react_temp_f && <Field label="Reactivation temp">{ticket.react_temp_f} °F</Field>}
                    <Field label="React heat working"><YesNo val={ticket.react_heat_working} /></Field>
                    {ticket.react_heat_setpoint !== null && (
                      <Field label="Maintaining setpoint (285°F)"><YesNo val={ticket.react_heat_setpoint} /></Field>
                    )}
                  </IntakeGroup>

                  {/* Wheel & Seals */}
                  <IntakeGroup title="Wheel & Seals" icon={<ClipboardCheck size={14} />}>
                    {ticket.wheel_rotating && <Field label="Wheel rotating"><span className="capitalize">{ticket.wheel_rotating}</span></Field>}
                    {ticket.seal_light_leakage && <Field label="Seal light leakage"><span className="capitalize">{ticket.seal_light_leakage}</span></Field>}
                    <Field label="Seals good"><YesNo val={ticket.seals_good} /></Field>
                  </IntakeGroup>

                  {/* External Factors */}
                  {ticket.external_factors && ticket.external_factors.length > 0 && (
                    <IntakeGroup title="External Factors" icon={<FileText size={14} />}>
                      <ul className="py-1 space-y-1">
                        {ticket.external_factors.map((f, i) => (
                          <li key={i} className="text-[13px] text-zinc-700 dark:text-zinc-200">• {f}</li>
                        ))}
                      </ul>
                    </IntakeGroup>
                  )}
                </div>
              </details>
            </Card>

            {/* Photos */}
            {ticket.photo_urls && ticket.photo_urls.length > 0 && (
              <Section title={`Photos (${ticket.photo_urls.length})`} icon={<ImageIcon size={14} />}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-1">
                  {ticket.photo_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 transition-all"
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
            <Card>
              <CardHead title="Admin Notes" icon={<MessageSquare size={14} />} />
              <div className="px-5 py-4">
                {/* Legacy note from old system */}
                {ticket.notes && (
                  <div className="mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mb-2">Legacy note</p>
                    <p className="text-[13px] text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {ticket.notes}
                    </p>
                  </div>
                )}

                {/* Notes log */}
                {notes.length > 0 && (
                  <div className="space-y-4 mb-5">
                    {notes.map((note, idx) => (
                      <div key={note.id}>
                        {(idx > 0 || !!ticket.notes) && <div className="border-t border-zinc-100 dark:border-zinc-800/50 mb-4" />}
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-600">{formatNoteDate(note.created_at)}</p>
                          <StatusPill tone={note.visibility === 'public' ? 'emerald' : 'slate'}>
                            {note.visibility === 'public' ? 'Sent to customer' : 'Internal'}
                          </StatusPill>
                          <StatusPill tone={note.author_type === 'customer' ? 'sky' : 'slate'}>
                            {note.author_type === 'customer' ? 'Customer' : 'Admin'}
                          </StatusPill>
                        </div>
                        {note.content && (
                          <div
                            className="note-content text-[13px] text-zinc-700 dark:text-zinc-200"
                            dangerouslySetInnerHTML={{ __html: note.content }}
                          />
                        )}
                        {note.attachments && note.attachments.length > 0 && (
                          <NoteAttachments ticketId={ticket.id} attachments={note.attachments} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* New note editor — always visible */}
                {(notes.length > 0 || !!ticket.notes) && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 mt-2 pt-4 mb-3">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mb-3">New note</p>
                  </div>
                )}
                <label className="flex items-center gap-2 mb-2.5 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={replyToCustomer}
                    onChange={e => setReplyToCustomer(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-300">
                    Reply to customer <span className="text-zinc-400 dark:text-zinc-500 font-normal">— visible on their ticket page</span>
                  </span>
                </label>
                <RichTextEditor onSubmit={addNote} disabled={savingNote} onUpload={uploadAttachment} />
              </div>
            </Card>

          </main>

          {/* ── Right rail ────────────────────────────────────────── */}
          <aside className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[72px] space-y-4">

            {/* Jerry — internal assistant grounded in this ticket's equipment/problem context */}
            <JerryWidget
              apiEndpoint={`/api/admin/tickets/${ticket.id}/assistant`}
              suggestions={['Summarize this ticket', 'Suggest troubleshooting steps', 'Is this unit under warranty?']}
              idleSubtitle="Ask about this ticket's equipment or IAT's documentation — I answer from the manuals and show you the page."
              footerNote="Jerry can make mistakes — verify before acting."
            />

            {/* AI Recommendations */}
            <Card>
              <CardHead title="AI Recommendations" icon={<Lightbulb size={14} />} />
              <div className="px-5 py-4">
                {ticket.ai_recommendations && ticket.ai_recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {ticket.ai_recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      Shown to customer at submission
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-600">No recommendations generated for this ticket.</p>
                )}
              </div>
            </Card>

            {/* Knowledge base articles the customer viewed before submitting */}
            <Card>
              <CardHead title="KB Articles Viewed" icon={<BookOpen size={14} />} />
              <div className="px-5 py-4">
                {ticket.viewed_kb_articles && ticket.viewed_kb_articles.length > 0 ? (
                  <div className="space-y-3">
                    {ticket.viewed_kb_articles.map(v => (
                      <a key={v.slug} href={`/support/kb/${v.slug}`} target="_blank" rel="noopener noreferrer" className="block group">
                        <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {v.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Viewed {v.count}{v.count === 1 ? ' time' : ' times'}
                          {v.last_viewed_at ? ` · last ${formatNoteDate(v.last_viewed_at)}` : ''}
                        </p>
                      </a>
                    ))}
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      What the customer read before submitting
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-600 leading-relaxed">
                    No knowledge base articles were viewed before this ticket was submitted.
                  </p>
                )}
              </div>
            </Card>

          </aside>
        </div>
      </div>
    </DetailShell>
  )
}
