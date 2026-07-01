'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { User, FileText, MessageSquare, Image as ImageIcon, Pencil } from 'lucide-react'
import type { Ticket, TicketNote, TicketNoteAttachment } from '@/lib/supabase'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { DetailShell, DetailTopBar, Card, CardHead } from '@/components/admin/detail-ui'
import { StatusPill, TICKET_STATUS, PRIORITY } from '@/components/admin/list'

const RichTextEditor = dynamic(() => import('@/components/shared/RichTextEditor'), { ssr: false })

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

// Read-only attachment chips — download only (no email preview modal on the
// customer side; the .eml/.msg preview is an internal admin convenience).
function NoteAttachments({ ticketId, attachments }: { ticketId: string; attachments: TicketNoteAttachment[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map(att => {
        const downloadHref = `/api/tickets/${ticketId}/attachments/download?path=${encodeURIComponent(att.path)}&name=${encodeURIComponent(att.name)}`
        return (
          <a
            key={att.path}
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 max-w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 hover:border-emerald-500 transition-colors"
            title={`Download ${att.name}`}
          >
            <span className="truncate text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{att.name}</span>
            {att.size > 0 && <span className="text-[11px] text-zinc-400 flex-shrink-0">{formatBytes(att.size)}</span>}
          </a>
        )
      })}
    </div>
  )
}

export default function CustomerTicketDetailClient({
  ticket,
  initialNotes,
}: {
  ticket: Ticket
  initialNotes: TicketNote[]
}) {
  const [notes, setNotes] = useState<TicketNote[]>(initialNotes)
  const [savingNote, setSavingNote] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Contact card — inline edit for phone + preferred contact method only.
  const [editingContact, setEditingContact] = useState(false)
  const [phone, setPhone] = useState(ticket.customer_phone || '')
  const [preferredMethod, setPreferredMethod] = useState<'email' | 'phone' | ''>(ticket.preferred_contact_method || '')
  const [contactState, setContactState] = useState<{ phone: string; method: 'email' | 'phone' | '' }>({
    phone: ticket.customer_phone || '',
    method: ticket.preferred_contact_method || '',
  })
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const saveContact = async () => {
    setSavingContact(true)
    setContactError(null)
    try {
      const res = await fetch(`/api/customer/tickets/${ticket.id}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_phone: phone.trim() || null,
          preferred_contact_method: preferredMethod || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setContactError(data.error || 'Failed to save contact info')
        return
      }
      setContactState({ phone: data.customer_phone || '', method: data.preferred_contact_method || '' })
      setEditingContact(false)
    } catch {
      setContactError('Failed to save contact info')
    } finally {
      setSavingContact(false)
    }
  }

  const addNote = async (html: string, attachments: TicketNoteAttachment[]) => {
    setSavingNote(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html, attachments }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setSaveError(j.error || 'Failed to save note')
        return
      }
      const data = await res.json()
      setNotes(prev => [...prev, data as TicketNote])
    } catch {
      setSaveError('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Same signed-upload-then-uploadToSignedUrl flow as the admin ticket page —
  // role-agnostic; the API route is now dual-auth-gated so it works here too.
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

  const statusMeta = TICKET_STATUS[ticket.status] || { label: ticket.status, tone: 'slate' as const }
  const priorityMeta = ticket.priority ? PRIORITY[ticket.priority] : null

  const submitted = new Date(ticket.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'My Requests', href: '/customer' },
          { label: ticket.ticket_number },
        ]}
      />

      <div className="p-5 space-y-4 max-w-4xl mx-auto">
        {/* Hero */}
        <div>
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Support Ticket</p>
          <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
            <h1 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight font-mono">
              {ticket.ticket_number}
            </h1>
            <StatusPill tone={statusMeta.tone}>{statusMeta.label}</StatusPill>
            {priorityMeta && <StatusPill tone="slate">{priorityMeta.label} priority</StatusPill>}
          </div>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">Submitted {submitted}</p>
        </div>

        {saveError && (
          <div className="text-[13px] text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}

        {/* Problem Description */}
        <Card>
          <CardHead title="Problem Description" icon={<FileText size={14} />} />
          <div className="px-5 py-2.5">
            <p className="text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap py-1">
              {ticket.problem_description}
            </p>
            {ticket.serial_number && (
              <p className="text-[12px] text-zinc-400 mt-2">
                Serial <span className="font-mono text-zinc-600 dark:text-zinc-300">{ticket.serial_number}</span>
                {ticket.model_number ? ` · Model ${ticket.model_number}` : ''}
                {ticket.voltage ? ` · ${ticket.voltage}` : ''}
              </p>
            )}
          </div>
        </Card>

        {/* Contact */}
        <Card>
          <CardHead
            title="Contact"
            icon={<User size={14} />}
            action={!editingContact ? (
              <button
                onClick={() => {
                  setPhone(contactState.phone)
                  setPreferredMethod(contactState.method)
                  setContactError(null)
                  setEditingContact(true)
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
            ) : undefined}
          />
          <div className="px-5 py-2.5">
            <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0">Name</span>
              <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1">{ticket.customer_name}</span>
            </div>
            {ticket.customer_company && (
              <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
                <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0">Company</span>
                <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1">{ticket.customer_company}</span>
              </div>
            )}
            <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0">Email</span>
              <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1">{ticket.customer_email}</span>
            </div>

            {editingContact ? (
              <div className="pt-3 space-y-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Phone</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(555) 555-1234"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-zinc-700 dark:text-zinc-200 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Preferred contact method</label>
                  <select
                    value={preferredMethod}
                    onChange={e => setPreferredMethod(e.target.value as 'email' | 'phone' | '')}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-zinc-700 dark:text-zinc-200 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
                  >
                    <option value="">No preference</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                {contactError && <p className="text-[12px] text-rose-500">{contactError}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={saveContact}
                    disabled={savingContact}
                    className="text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-8 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingContact ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingContact(false)}
                    disabled={savingContact}
                    className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-3 h-8 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {contactState.phone && (
                  <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0">Phone</span>
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1">{contactState.phone}</span>
                  </div>
                )}
                <div className="flex gap-3 py-2 last:border-0">
                  <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0">Preferred contact</span>
                  <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1 capitalize">
                    {contactState.method || 'No preference'}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Photos */}
        {ticket.photo_urls && ticket.photo_urls.length > 0 && (
          <Card>
            <CardHead title={`Photos (${ticket.photo_urls.length})`} icon={<ImageIcon size={14} />} />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-5">
              {ticket.photo_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Reply thread */}
        <Card>
          <CardHead title="Messages" icon={<MessageSquare size={14} />} />
          <div className="px-5 py-4">
            {notes.length > 0 ? (
              <div className="space-y-4 mb-5">
                {notes.map((note, idx) => (
                  <div key={note.id}>
                    {idx > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800/50 mb-4" />}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                        {note.author_type === 'customer' ? 'You' : 'IAT Team'}
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{formatNoteDate(note.created_at)}</span>
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
            ) : (
              <p className="text-[13px] text-zinc-400 mb-4">No messages yet. Send a note below and our team will reply here.</p>
            )}

            <RichTextEditor onSubmit={addNote} disabled={savingNote} onUpload={uploadAttachment} />
          </div>
        </Card>
      </div>
    </DetailShell>
  )
}
