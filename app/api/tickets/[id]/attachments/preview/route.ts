import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import PostalMime from 'postal-mime'
import MsgReader from '@kenjiuno/msgreader'
import sanitizeHtml from 'sanitize-html'

// Parses a saved .eml / .msg ticket-note attachment server-side and returns its
// sender / subject / date / body so the admin can read it inline — no "save the
// file, then open Outlook" round-trip (Kacy's #4). Admin-gated and path-scoped
// to this ticket, mirroring the sibling download route. The HTML body is
// sanitized here (server side) before it's handed back, since the admin renders
// it with dangerouslySetInnerHTML.

type EmailPreview = {
  from: string
  to: string
  date: string | null
  subject: string
  html: string | null
  text: string | null
  attachments: { name: string; size: number }[]
}

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span', 'b', 'i', 'em', 'strong', 'u', 's', 'a',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'font',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'align', 'valign'],
      font: ['color'],
    },
    // No javascript:/data: — only safe link/image schemes survive.
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  })
}

const addr = (a: { name?: string | null; address?: string | null } | null | undefined): string => {
  if (!a) return ''
  if (a.name && a.address) return `${a.name} <${a.address}>`
  return a.name || a.address || ''
}

async function parseEml(ab: ArrayBuffer): Promise<EmailPreview> {
  const email = await new PostalMime().parse(ab)
  return {
    from: addr(email.from),
    to: Array.isArray(email.to) ? email.to.map(addr).filter(Boolean).join(', ') : '',
    date: email.date || null,
    subject: email.subject || '(no subject)',
    html: email.html ? sanitize(email.html) : null,
    text: email.text || null,
    attachments: (email.attachments || []).map((a) => ({
      name: a.filename || 'attachment',
      size: a.content ? (a.content as ArrayBuffer).byteLength ?? 0 : 0,
    })),
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseMsg(ab: ArrayBuffer): EmailPreview {
  const reader = new MsgReader(ab)
  const d = reader.getFileData() as any
  if (!d || d.error) throw new Error(d?.error || 'msg parse failed')
  const recips: any[] = Array.isArray(d.recipients) ? d.recipients : []
  return {
    from: d.senderName
      ? `${d.senderName}${d.senderEmail ? ` <${d.senderEmail}>` : ''}`
      : d.senderEmail || '',
    to: recips
      .map((r) => (r.name ? `${r.name}${r.email ? ` <${r.email}>` : ''}` : r.email || ''))
      .filter(Boolean)
      .join(', '),
    date: d.messageDeliveryTime || d.clientSubmitTime || null,
    subject: d.subject || '(no subject)',
    html: null, // .msg HTML bodies live in compressed RTF; the plain body is reliable.
    text: d.body || '',
    attachments: (Array.isArray(d.attachments) ? d.attachments : []).map((a: any) => ({
      name: a.fileName || a.name || 'attachment',
      size: a.contentLength || 0,
    })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const err = await requireAdminAuth()
  if (err) return err

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!path || !path.startsWith(`${params.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const name = (req.nextUrl.searchParams.get('name') || '').toLowerCase()
  const isMsg = name.endsWith('.msg')
  const isEml = name.endsWith('.eml')
  if (!isMsg && !isEml) {
    return NextResponse.json({ error: 'Not an email file' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage.from('ticket-attachments').download(path)
  if (error || !data) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

  try {
    const ab = await data.arrayBuffer()
    const email = isMsg ? parseMsg(ab) : await parseEml(ab)
    return NextResponse.json(email)
  } catch (e) {
    console.error('[attachment preview] parse failed:', e)
    return NextResponse.json({ error: 'Could not preview this email. Try downloading it instead.' }, { status: 422 })
  }
}
