'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Upload, Copy, Check, Loader2, Mail, Link2, X,
  CheckCircle2, Sparkles, Building2, Boxes, ArrowRight, AlertCircle,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

/* ────────────────────────────────────────────────────────────────────────────
   NewCustomerWizard — the customer-first "front door" from the whiteboard.

   Scan a Submittal PDF → review the customer + unit fields it pulled → Submit,
   which (via /api/admin/customers/invite) creates the customer account, the
   login, the equipment record, seeds the build/ship tracker, and emails the
   temp password. One shared component so the create-from-Submittal flow is
   identical from /admin/customers ("New Customer") and the equipment list
   ("New from Submittal"). Linking an EXISTING unit stays on the equipment
   detail page (CustomerPortalCard) — this is for creating new.
   ──────────────────────────────────────────────────────────────────────────── */

const inp = 'w-full text-[13px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1'

const EMPTY = {
  company_name: '',
  primary_contact_name: '',
  contact_email: '',
  phone: '',
  location: '',
  serial_number: '',
  model_number: '',
  voltage: '',
  ship_date: '',
  warranty_months: '',
  notes: '',
  seed_tracker: true,
}

export default function NewCustomerWizard({
  onClose,
  onCreated,
  initial,
  linkTicketId,
  linkRequestId,
  suggestedCustomerId,
  suggestedCustomerName,
}: {
  onClose: () => void
  onCreated?: (res: { customer_id: string | null; equipment_id: string | null }) => void
  /** Prefill the form — used when opened from an approved portal-access request. */
  initial?: Partial<typeof EMPTY>
  /** The ticket that triggered this invite; gets `customer_id` stamped on approve. */
  linkTicketId?: string
  /** The customer_portal_requests row to mark approved once the invite succeeds. */
  linkRequestId?: string
  /** A likely-existing company for this unit's serial — offers "attach instead". */
  suggestedCustomerId?: string | null
  suggestedCustomerName?: string | null
}) {
  const router = useRouter()
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  // Default OFF — attaching to an existing company is consequential, so the
  // admin has to actively opt in rather than merge by default off a guess.
  const [attachToExisting, setAttachToExisting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    temp_password: string
    login_url: string
    email_sent: boolean
    customer_id: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const scan = async (file: File | undefined) => {
    if (!file) return
    setScanning(true)
    setError('')
    try {
      // Upload straight to Storage via a signed URL (tiny JSON request for the
      // token, then the bytes go directly to Supabase) — bypasses Vercel's
      // ~4.5MB function body limit, which 413'd real-world Submittals before
      // the scan route's own size check ever ran.
      const uploadRes = await fetch('/api/admin/customers/submittal-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      })
      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok) {
        setError(uploadJson.error || 'Could not upload that file.')
        return
      }
      const sb = createSupabaseBrowser()
      const { error: uploadErr } = await sb.storage
        .from('admin-submittals')
        .uploadToSignedUrl(uploadJson.path, uploadJson.token, file, { contentType: file.type || undefined })
      if (uploadErr) {
        setError(uploadErr.message || 'Could not upload that file.')
        return
      }

      const res = await fetch('/api/admin/customers/extract-submittal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: uploadJson.path, media_type: file.type }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not scan that file.')
        return
      }
      const f = json.fields || {}
      // Only overwrite a field if the scan actually found something for it.
      setForm((prev) => ({
        ...prev,
        company_name: f.company_name || prev.company_name,
        primary_contact_name: f.primary_contact_name || prev.primary_contact_name,
        contact_email: f.contact_email || prev.contact_email,
        phone: f.phone || prev.phone,
        location: f.location || prev.location,
        serial_number: f.serial_number || prev.serial_number,
        model_number: f.model_number || prev.model_number,
        voltage: f.voltage || prev.voltage,
        ship_date: f.ship_date || prev.ship_date,
        warranty_months: f.warranty_months != null ? String(f.warranty_months) : prev.warranty_months,
        notes: f.notes || prev.notes,
      }))
    } catch {
      setError('Could not read that file.')
    } finally {
      setScanning(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const hasUnit = form.serial_number.trim().length > 0
      const res = await fetch('/api/admin/customers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name,
          primary_contact_name: form.primary_contact_name,
          contact_email: form.contact_email,
          phone: form.phone,
          customer_location: form.location,
          existing_customer_id: attachToExisting && suggestedCustomerId ? suggestedCustomerId : undefined,
          equipment: hasUnit
            ? {
                serial_number: form.serial_number,
                model_number: form.model_number,
                voltage: form.voltage,
                location: form.location,
                ship_date: form.ship_date || null,
                warranty_months: form.warranty_months ? Number(form.warranty_months) : undefined,
                notes: form.notes,
              }
            : undefined,
          seed_tracker: form.seed_tracker,
          link_ticket_id: linkTicketId,
          link_request_id: linkRequestId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not create the account.')
        return
      }
      onCreated?.({ customer_id: json.customer_id ?? null, equipment_id: json.equipment_id ?? null })
      setResult({
        temp_password: json.temp_password,
        login_url: json.login_url,
        email_sent: json.email_sent,
        customer_id: json.customer_id ?? null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(`${form.contact_email} / ${result.temp_password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const done = () => {
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">New customer</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 overflow-y-auto p-5">
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">Account created</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-emerald-700/80 dark:text-emerald-400/80">
                  <Mail size={12} />
                  {result.email_sent
                    ? `Login details emailed to ${form.contact_email}`
                    : 'Email not sent — share these credentials:'}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Email</span>
                <span className="truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-200">{form.contact_email}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Temp password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{result.temp_password}</span>
                  <button
                    onClick={copy}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-zinc-400">
              <Link2 size={11} /> They&apos;ll set their own password right after signing in.
            </p>

            <div className="flex items-center gap-2">
              {result.customer_id && (
                <button
                  onClick={() => {
                    onClose()
                    router.push(`/admin/customers/${result.customer_id}`)
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  View customer <ArrowRight size={13} />
                </button>
              )}
              <button onClick={done} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto p-5">
            {/* Submittal scan */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-zinc-900 dark:text-emerald-400">
                {scanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200">
                  {scanning ? 'Reading Submittal…' : 'Scan a Submittal PDF'}
                </p>
                <p className="text-[11px] text-zinc-400">Auto-fills everything below — review before sending.</p>
              </div>
              <Upload size={15} className="ml-auto shrink-0 text-zinc-400" />
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => scan(e.target.files?.[0])}
              />
            </label>

            {/* Possible existing customer match */}
            {suggestedCustomerId && suggestedCustomerName && (
              <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer dark:border-amber-900 dark:bg-amber-500/10">
                <input
                  type="checkbox"
                  checked={attachToExisting}
                  onChange={(e) => setAttachToExisting(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span className="text-[12.5px] text-amber-800 dark:text-amber-300">
                  <AlertCircle size={13} className="inline -mt-0.5 mr-1" />
                  This unit&apos;s serial number is already linked to <strong>{suggestedCustomerName}</strong>.
                  Attach this login to that company instead of creating a new one.
                </span>
              </label>
            )}

            {/* Customer */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Building2 size={13} />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Customer</span>
                {attachToExisting && suggestedCustomerId && (
                  <span className="text-[10px] font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
                    will attach to {suggestedCustomerName}
                  </span>
                )}
              </div>
              <div>
                <label className={lbl}>Company *</label>
                <input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className={inp} placeholder="Acme Foods" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Contact name</label>
                  <input value={form.primary_contact_name} onChange={(e) => set('primary_contact_name', e.target.value)} className={inp} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className={lbl}>Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inp} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Login email *</label>
                  <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inp} placeholder="jane@acme.com" />
                </div>
                <div>
                  <label className={lbl}>Location</label>
                  <input value={form.location} onChange={(e) => set('location', e.target.value)} className={inp} placeholder="City, ST" />
                </div>
              </div>
            </div>

            {/* Unit */}
            <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Boxes size={13} />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Unit</span>
                <span className="text-[10px] font-medium normal-case tracking-normal text-zinc-300 dark:text-zinc-600">optional</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Serial #</label>
                  <input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} className={inp} placeholder="USR-2024-0142" />
                </div>
                <div>
                  <label className={lbl}>Model #</label>
                  <input value={form.model_number} onChange={(e) => set('model_number', e.target.value)} className={inp} placeholder="Model" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>Voltage</label>
                  <input value={form.voltage} onChange={(e) => set('voltage', e.target.value)} className={inp} placeholder="460V" />
                </div>
                <div>
                  <label className={lbl}>Ship date</label>
                  <input type="date" value={form.ship_date} onChange={(e) => set('ship_date', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Warranty (mo)</label>
                  <input type="number" inputMode="numeric" value={form.warranty_months} onChange={(e) => set('warranty_months', e.target.value)} className={inp} placeholder="12" />
                </div>
              </div>
              {form.serial_number.trim() && (
                <p className="text-[11px] text-zinc-400">If this serial is already on file, it&apos;ll be linked to this customer.</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-[12.5px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={form.seed_tracker} onChange={(e) => set('seed_tracker', e.target.checked)} className="accent-emerald-600" />
              Start the build &amp; shipping tracker for this unit
            </label>

            {error && <p className="text-[12.5px] text-rose-500">{error}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button
                onClick={submit}
                disabled={submitting || !form.company_name.trim() || !form.contact_email.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating…
                  </>
                ) : (
                  <>Create account &amp; send invite</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
