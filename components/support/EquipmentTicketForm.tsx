'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Script from 'next/script'
import Logo from '@/components/Logo'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, CheckCircle, Check, Lightbulb,
  RotateCcw, Upload, X, Loader2, ImageIcon, Info, Camera, ChevronDown,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { getKbViews, clearKbViews } from '@/lib/kb-views'
import { SampleLabelThumb } from './SampleLabelThumb'
import RequestAccountCta from './RequestAccountCta'

// ─── Types ───────────────────────────────────────────────────────────────────
// This is the UNIFIED support form — the former "Equipment Support Ticket" and
// "Troubleshooting Checklist" merged into one (Kacy's call). It submits to the
// ticket pipeline (TKT-) and carries both the equipment-ticket fields and the
// checklist's richer diagnostics + live coaching.

type Brand = 'iat' | 'us_rotors'
type Tri = 'yes' | 'no' | 'unsure' | ''
type Onset = 'sudden' | 'gradual' | 'unsure' | ''

type FormData = {
  brand: Brand
  customer_name: string
  customer_company: string
  customer_email: string
  customer_phone: string
  serial_number: string
  model_number: string
  voltage: string
  problem_description: string
  problem_started: string
  onset: Onset
  what_changed: string
  unit_running: boolean | null
  has_alarms: boolean | null
  alarm_details: string
  pre_cooling: boolean | null
  pre_cooling_type: string
  pre_cooling_working: boolean | null
  post_cooling: boolean | null
  post_cooling_type: string
  post_cooling_working: boolean | null
  airflow_balanced: boolean | 'unsure' | null
  process_airflow_cfm: string
  react_airflow_cfm: string
  react_temp_f: string
  react_heat_working: boolean | null
  wheel_rotating: Tri
  seal_light_leakage: Tri
  external_factors: string[]
}

const EMPTY: FormData = {
  brand: 'iat',
  customer_name: '', customer_company: '', customer_email: '', customer_phone: '',
  serial_number: '', model_number: '', voltage: '',
  problem_description: '', problem_started: '',
  onset: '', what_changed: '',
  unit_running: null, has_alarms: null, alarm_details: '',
  pre_cooling: null, pre_cooling_type: '', pre_cooling_working: null,
  post_cooling: null, post_cooling_type: '', post_cooling_working: null,
  airflow_balanced: null, process_airflow_cfm: '', react_airflow_cfm: '', react_temp_f: '',
  react_heat_working: null,
  wheel_rotating: '', seal_light_leakage: '',
  external_factors: [],
}

// Optional context for a logged-in portal customer — lets the public support form
// prefill their account + unit details. Anonymous visitors pass null (form unchanged).
export type SupportCustomerContext = {
  email: string
  name: string | null
  company: string | null
  phone: string | null
  units: Array<{
    id: string
    serial_number: string
    model_number: string | null
    voltage: string | null
    location: string | null
  }>
}

// Seed the wizard from a logged-in customer's context: always their contact info,
// plus the unit details when they own exactly one (multi-unit customers pick a unit).
function seedForm(ctx: SupportCustomerContext | null): FormData {
  if (!ctx) return EMPTY
  const one = ctx.units.length === 1 ? ctx.units[0] : null
  return {
    ...EMPTY,
    customer_email: ctx.email || '',
    customer_name: ctx.name || '',
    customer_company: ctx.company || '',
    customer_phone: ctx.phone || '',
    serial_number: one?.serial_number || '',
    model_number: one?.model_number || '',
    voltage: one?.voltage || '',
  }
}

// reCAPTCHA v3 (invisible, score-based) — scoped to this form only for now. Unset
// in env until the user adds it, at which point the script loads + a token is
// sent with the submission; the server (lib/recaptcha.ts) fails open either way.
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

// Must match the whitelist in app/api/tickets/route.ts exactly.
const EXTERNAL_FACTORS = [
  'Room construction changes',
  'Door openings',
  'People load change',
  'Process moisture load change',
  'Building pressure',
  'New equipment / process changes',
  'Weather changes',
]

// Common pre-/post-cooling coil types on IAT desiccant units. "Other…" reveals a
// free-text box, so the dropdown narrows the usual answers without losing the rare one.
const COOLING_TYPES = [
  'Chilled water coil',
  'DX (direct expansion)',
  'Glycol coil',
  'Evaporative / adiabatic',
  'City / well water',
  'Cooling tower water',
]

// Each visual step maps to a component key. US Rotors (a bare desiccant rotor,
// not a full IAT unit) skips the Cooling step; the wheel/airflow/seal diagnostics
// still apply.
type StepKey =
  | 'contact' | 'equipment' | 'problem' | 'onset' | 'status'
  | 'cooling' | 'airflow' | 'seals' | 'factors' | 'photos' | 'analysis'

const IAT_STEPS: StepKey[] = ['contact', 'equipment', 'problem', 'onset', 'status', 'cooling', 'airflow', 'seals', 'factors', 'photos', 'analysis']
const ROTOR_STEPS: StepKey[] = ['contact', 'equipment', 'problem', 'onset', 'status', 'airflow', 'seals', 'factors', 'photos', 'analysis']

const STEP_LABELS: Record<StepKey, string> = {
  contact: 'Contact', equipment: 'Equipment', problem: 'Problem', onset: 'Onset',
  status: 'Status', cooling: 'Cooling', airflow: 'Airflow', seals: 'Seals',
  factors: 'Factors', photos: 'Photos', analysis: 'Analysis',
}

// Downscale a chosen photo to a JPEG data URL before sending it to the OCR
// endpoint — keeps the request under Vercel's ~4.5MB body cap and speeds the
// vision call. (HEIC can't be decoded by <canvas>, so those throw and the caller
// falls back to "enter manually".)
async function fileToResizedDataUrl(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('decode failed'))
    i.src = dataUrl
  })
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

// Process:react airflow ratio + which application band it falls in.
function airflowRatio(processStr: string, reactStr: string): { label: string; band: string } | null {
  const p = parseFloat(processStr), r = parseFloat(reactStr)
  if (!isFinite(p) || !isFinite(r) || p <= 0 || r <= 0) return null
  const ratio = p / r
  const rounded = Math.round(ratio * 10) / 10
  let band: string
  if (ratio < 2.5)       band = 'lower than the usual ~3:1 — worth double-checking the readings'
  else if (ratio <= 3.5) band = 'right in the typical ~3:1 range for most applications'
  else if (ratio <= 5.5) band = 'typical for lower-grain applications (4–5:1)'
  else if (ratio <= 7.5) band = 'typical only for very low-grain applications (6–7:1)'
  else                   band = 'higher than usual (>7:1) — worth double-checking the readings'
  return { label: `${rounded}:1`, band }
}

// ─── Field sub-components ──────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder, type = 'text', required, hint, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean; hint?: string; autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
      />
    </div>
  )
}

// Styled native dropdown matching InputField. With `allowOther`, an "Other…" choice
// reveals a free-text box; a stored value that isn't a preset is treated as "Other".
function SelectField({
  label, value, onChange, options, placeholder = 'Select…', hint, required, allowOther = false, otherPlaceholder,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
  placeholder?: string; hint?: string; required?: boolean; allowOther?: boolean; otherPlaceholder?: string
}) {
  const presetMatch = options.includes(value)
  const [otherMode, setOtherMode] = useState(allowOther && value !== '' && !presetMatch)
  const selectValue = otherMode ? '__other__' : presetMatch ? value : ''
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <div className="relative">
        <select
          value={selectValue}
          onChange={e => {
            const v = e.target.value
            if (v === '__other__') { setOtherMode(true); onChange('') }
            else { setOtherMode(false); onChange(v) }
          }}
          className={`w-full appearance-none text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-3.5 pr-9 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all cursor-pointer ${
            selectValue === '' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          {allowOther && <option value="__other__">Other…</option>}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
      {otherMode && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={otherPlaceholder || 'Please specify'}
          autoFocus
          className="mt-2 w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
        />
      )}
    </div>
  )
}

function TextareaField({
  label, value, onChange, placeholder, required, hint, rows = 5, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; hint?: string; rows?: number; autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all resize-none leading-relaxed"
      />
    </div>
  )
}

function BoolField({
  label, value, onChange, hint,
}: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void; hint?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
              value === v
                ? v
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

function TriBoolField({
  label, value, onChange, hint,
}: {
  label: string; value: boolean | 'unsure' | null; onChange: (v: boolean | 'unsure' | null) => void; hint?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
              value === v
                ? v
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(value === 'unsure' ? null : 'unsure')}
          className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
            value === 'unsure'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Not Sure
        </button>
      </div>
    </div>
  )
}

type Tone = 'good' | 'bad' | 'unsure' | 'neutral'
const TONE_SELECTED: Record<Tone, string> = {
  good:    'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700',
  bad:     'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700',
  unsure:  'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  neutral: 'bg-[#089447]/10 dark:bg-[#089447]/20 text-[#089447] border-[#089447]/50',
}
const TONE_IDLE =
  'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'

// Single-select button group. Click the active option again to clear it.
function ChoiceField({
  label, hint, value, options, onChange,
}: {
  label: string; hint?: string; value: string
  options: { value: string; label: string; tone?: Tone }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(opt => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? '' : opt.value)}
              className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                selected ? TONE_SELECTED[opt.tone ?? 'neutral'] : TONE_IDLE
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Multi-select checklist.
function MultiChoiceField({
  label, hint, values, options, onChange,
}: {
  label: string; hint?: string; values: string[]; options: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt])
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex flex-col gap-2" role="group" aria-label={label}>
        {options.map(opt => {
          const checked = values.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(opt)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium border text-left transition-all ${
                checked
                  ? 'bg-[#089447]/8 dark:bg-[#089447]/15 border-[#089447]/40 text-gray-800 dark:text-gray-100'
                  : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-all ${
                checked ? 'bg-[#089447] border-[#089447]' : 'border-gray-300 dark:border-zinc-600'
              }`}>
                {checked && <Check size={11} strokeWidth={3} className="text-white" />}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Collapsed-or-open "learn more" disclosure. Defaults OPEN per Kacy — collapsed
// tips got overlooked.
function Coaching({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/30">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
        <Lightbulb size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 flex-1">{label}</span>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-0.5 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

// Short, auto-shown note that reacts to an entered value.
function CoachNote({ tone = 'amber', children }: { tone?: 'amber' | 'sky'; children: React.ReactNode }) {
  const cls = tone === 'sky'
    ? 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/40'
    : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40'
  return (
    <div className={`flex items-start gap-2 text-[12px] rounded-xl border px-3 py-2 leading-relaxed ${cls}`}>
      <Info size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

// Signed-in customer's account + equipment, shown atop the public support form.
// Picking a unit fills serial / model / voltage; everything stays editable.
function CustomerEquipmentCard({
  ctx, selectedSerial, onPick,
}: {
  ctx: SupportCustomerContext
  selectedSerial: string
  onPick: (u: SupportCustomerContext['units'][number]) => void
}) {
  return (
    <div className="w-full max-w-xl mb-6 rounded-2xl border border-[#089447]/25 bg-[#089447]/[0.06] dark:bg-[#089447]/10 p-4">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle size={15} className="text-[#089447] flex-shrink-0" />
        <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">Your account &amp; equipment</p>
        <span className="ml-auto max-w-[45%] truncate text-[11px] text-gray-400">{ctx.email}</span>
      </div>
      <p className="text-[11.5px] text-gray-400 mb-3">
        {ctx.units.length
          ? 'Pick a unit to fill in its details — you can still edit anything below.'
          : 'Your contact details are filled in below.'}
      </p>
      {ctx.units.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {ctx.units.map((u) => {
            const active = !!selectedSerial && u.serial_number === selectedSerial
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onPick(u)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                  active
                    ? 'border-[#089447] bg-white dark:bg-zinc-900'
                    : 'border-gray-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/40 hover:border-[#089447]/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">{u.serial_number}</p>
                  <p className="truncate text-[11px] text-gray-400">
                    {u.model_number || 'Unknown model'}
                    {u.location ? ` · ${u.location}` : ''}
                  </p>
                </div>
                <span className={`flex-shrink-0 text-[11px] font-semibold ${active ? 'text-[#089447]' : 'text-gray-400'}`}>
                  {active ? 'Selected' : 'Use this'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

type Stage = 'form' | 'loading' | 'success'

export default function EquipmentTicketForm({ customerContext = null }: { customerContext?: SupportCustomerContext | null }) {
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<FormData>(() => seedForm(customerContext))
  const [photos, setPhotos] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('form')
  const [ticketNumber, setTicketNumber] = useState('')
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const steps = form.brand === 'us_rotors' ? ROTOR_STEPS : IAT_STEPS
  const totalSteps = steps.length
  const stepKey = steps[step - 1]

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  // Brand toggle retired (the support form is IAT-only now). Kept for reference if US
  // Rotors support returns:
  // const setBrand = (brand: Brand) => {
  //   setForm({ ...EMPTY, brand }); setStep(1); setDir(1)
  //   setRecommendations([]); setAnalyzed(false); setAnalyzeError(null)
  // }

  // Live AI tips from the answers so far, when the customer reaches the Analysis
  // step. Stateless; the submit reuses these tips so there's no second model call.
  const analyze = useCallback(async () => {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/tickets/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, airflow_balanced: form.airflow_balanced === 'unsure' ? null : form.airflow_balanced }),
      })
      const json = await res.json()
      setRecommendations(Array.isArray(json.recommendations) ? json.recommendations : [])
      setAnalyzed(true)
    } catch {
      setAnalyzeError('We could not generate suggestions right now — you can still submit and our team will follow up.')
    } finally {
      setAnalyzing(false)
    }
  }, [form])

  // Auto-run once when they land on the Analysis step. The analyzeError guard
  // prevents an auto-retry loop on persistent failure (manual retry clears it).
  useEffect(() => {
    if (stepKey === 'analysis' && !analyzed && !analyzing && !analyzeError) analyze()
  }, [stepKey, analyzed, analyzing, analyzeError, analyze])

  const canAdvance = () => {
    if (stepKey === 'contact') {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())
      return !!form.customer_name.trim() && emailOk
    }
    if (stepKey === 'equipment') return !!form.serial_number.trim() && !!form.model_number.trim()
    if (stepKey === 'problem') return !!form.problem_description.trim()
    return true
  }

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }
  const handleNext = () => { if (canAdvance() && step < totalSteps) go(step + 1) }
  const handleBack = () => { if (step > 1) go(step - 1) }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPhotos(prev => [...prev, ...valid].slice(0, 8))
  }

  const handleSubmit = async () => {
    if (!canAdvance()) return
    setStage('loading')
    setError(null)

    const photo_urls: string[] = []
    if (photos.length > 0) {
      const sb = createSupabaseBrowser()
      const failed: string[] = []
      for (const file of photos) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error: upErr } = await sb.storage.from('ticket-photos').upload(filename, file, { upsert: false })
        if (upErr || !data) {
          console.error('[ticket] photo upload failed:', file.name, upErr)
          failed.push(file.name)
          continue
        }
        const { data: pub } = sb.storage.from('ticket-photos').getPublicUrl(data.path)
        if (pub?.publicUrl) photo_urls.push(pub.publicUrl)
        else failed.push(file.name)
      }
      if (failed.length) {
        setError(
          `We couldn't upload ${failed.length} of ${photos.length} photo${photos.length === 1 ? '' : 's'} (${failed.join(', ')}). Please retry, or remove ${failed.length === 1 ? 'it' : 'them'} to continue — the rest of your details are saved.`
        )
        setStage('form')
        return
      }
    }

    try {
      // Invisible reCAPTCHA v3 — only runs if a site key is configured (see
      // RECAPTCHA_SITE_KEY above); otherwise no token is sent and the server
      // (lib/recaptcha.ts) skips verification entirely. A grecaptcha hiccup
      // must never block a real submission, so this is best-effort.
      let recaptcha_token: string | undefined
      if (RECAPTCHA_SITE_KEY) {
        try {
          await new Promise<void>(resolve => window.grecaptcha?.ready(resolve) ?? resolve())
          recaptcha_token = await window.grecaptcha?.execute(RECAPTCHA_SITE_KEY, { action: 'submit_ticket' })
        } catch (recaptchaErr) {
          console.error('[ticket] reCAPTCHA token fetch failed:', recaptchaErr)
        }
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          airflow_balanced: form.airflow_balanced === 'unsure' ? null : form.airflow_balanced,
          photo_urls,
          ai_recommendations: recommendations,
          viewed_kb_articles: getKbViews(),
          brand: form.brand,
          ...(recaptcha_token ? { recaptcha_token } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setTicketNumber(json.ticket_number)
      if (Array.isArray(json.ai_recommendations)) setRecommendations(json.ai_recommendations)
      clearKbViews()
      setStage('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-[#089447] animate-spin" />
          <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-200">Submitting your ticket…</p>
          <p className="text-[13px] text-gray-400">Saving your case and alerting our team</p>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (stage === 'success') {
    // Logged-in customers came from their portal — send them back there, not to
    // the public /support flow. customerContext is the only reliable signal
    // (both flows render this same component at the same /support URL).
    const isCustomer = !!customerContext
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
          <Logo size={28} className="flex-shrink-0" />
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        </header>

        <div className="flex-1 flex items-start justify-center py-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.10)' }}
          >
            <div className="bg-gradient-to-r from-[#089447]/10 to-[#089447]/5 dark:from-[#089447]/20 dark:to-[#089447]/5 px-8 py-8 border-b border-[#089447]/10 dark:border-[#089447]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#089447]/10 dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-[#089447]" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#089447]/70 uppercase tracking-widest mb-0.5">Ticket Submitted</p>
                  <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">You&apos;re all set!</h1>
                </div>
              </div>
              <div className="bg-white/60 dark:bg-zinc-900/60 rounded-xl px-4 py-3 border border-[#089447]/15">
                <p className="text-[11px] text-gray-400 mb-0.5">Your ticket number</p>
                <p className="text-[20px] font-bold font-mono text-[#089447] tracking-wider">{ticketNumber}</p>
              </div>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Our service team will reach out to <strong className="text-gray-700 dark:text-gray-200">{form.customer_email}</strong> shortly.
              </p>
              <Link
                href={isCustomer ? '/customer' : `/support/status?ticket=${encodeURIComponent(ticketNumber)}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#089447] hover:text-[#077a3c] mt-3 transition-colors"
              >
                {isCustomer ? 'View this in my portal' : "Track this ticket's status"}
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800">
              <RequestAccountCta
                ticketNumber={ticketNumber}
                email={form.customer_email}
                suppress={!!customerContext}
              />
            </div>

            {recommendations.length > 0 && (
              <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">While you wait, try these steps</p>
                    <p className="text-[11px] text-gray-400">Based on the information you provided</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900/30">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-3">
                  These are AI-generated suggestions. If unsure, wait for your service technician.
                </p>
              </div>
            )}

            <div className="px-8 py-5 flex items-center justify-between gap-4">
              <button
                onClick={() => { setForm(seedForm(customerContext)); setPhotos([]); setStep(1); setStage('form'); setRecommendations([]); setAnalyzed(false); setAnalyzeError(null) }}
                className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <RotateCcw size={14} />
                Submit another ticket
              </button>
              <Link
                href={isCustomer ? '/customer' : '/support'}
                className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-all"
              >
                {isCustomer ? 'Back to my portal' : 'Back to support'}
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">

      {/* reCAPTCHA v3 (invisible) — only loads once a site key is configured;
          scoped to this form for now. See lib/recaptcha.ts for the server side. */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
        <Logo size={28} className="flex-shrink-0" />
        <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        <span className="text-gray-200 dark:text-gray-700 mx-1">/</span>
        <span className="text-[14px] text-gray-400">Submit a Ticket</span>
      </header>

      <div className="flex-1 flex flex-col items-center py-10 px-4">

        {customerContext && (
          <CustomerEquipmentCard
            ctx={customerContext}
            selectedSerial={form.serial_number}
            onPick={(u) =>
              setForm((f) => ({
                ...f,
                serial_number: u.serial_number,
                model_number: u.model_number || '',
                voltage: u.voltage || '',
              }))
            }
          />
        )}

        {/* Brand toggle removed — the support form is IAT Equipment only now (US Rotors
            option retired). The `brand` field defaults to 'iat'; re-add a toggle here if
            US Rotors support returns. */}

        {/* Progress */}
        <div className="w-full max-w-xl mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((key, i) => {
              const n = i + 1
              const done = n < step
              const active = n === step
              return (
                <div key={key} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    done
                      ? 'bg-[#089447] text-white'
                      : active
                        ? 'bg-[#089447]/10 dark:bg-[#089447]/20 text-[#089447] border-2 border-[#089447]'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-gray-600'
                  }`}>
                    {done ? <CheckCircle size={12} strokeWidth={3} /> : n}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block transition-colors ${
                    active ? 'text-[#089447]' : done ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'
                  }`}>{STEP_LABELS[key]}</span>
                </div>
              )
            })}
          </div>
          <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full mt-1">
            <div
              className="h-full bg-[#089447] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-7"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {stepKey === 'contact'   && <StepContact form={form} set={set} />}
              {stepKey === 'equipment' && <StepEquipment form={form} set={set} />}
              {stepKey === 'problem'   && <StepProblem form={form} set={set} />}
              {stepKey === 'onset'     && <StepOnset form={form} set={set} />}
              {stepKey === 'status'    && <StepStatus form={form} set={set} />}
              {stepKey === 'cooling'   && <StepCooling form={form} set={set} />}
              {stepKey === 'airflow'   && <StepAirflow form={form} set={set} />}
              {stepKey === 'seals'     && <StepSeals form={form} set={set} />}
              {stepKey === 'factors'   && <StepFactors form={form} set={set} />}
              {stepKey === 'photos'    && <StepPhotos photos={photos} setPhotos={setPhotos} fileInputRef={fileInputRef} handleFiles={handleFiles} />}
              {stepKey === 'analysis'  && <StepAiAnalysis recommendations={recommendations} analyzing={analyzing} analyzed={analyzed} error={analyzeError} onRetry={analyze} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full max-w-xl mt-3 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="w-full max-w-xl flex items-center justify-between mt-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-0 transition-all"
          >
            <ArrowLeft size={15} /> Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-40 px-5 py-2.5 rounded-xl transition-all"
            >
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-all"
            >
              Submit Ticket <ArrowRight size={15} />
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-6">
          Step {step} of {totalSteps}
        </p>
      </div>
    </div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

type SetFn = <K extends keyof FormData>(key: K, val: FormData[K]) => void

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
      <p className="text-[13px] text-gray-400">{sub}</p>
    </div>
  )
}

function StepContact({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Contact Information" sub="We'll use this to follow up on your ticket." />
      <InputField label="Full Name" value={form.customer_name} onChange={v => set('customer_name', v)} placeholder="Jane Smith" required autoFocus />
      <InputField label="Company / Organization" value={form.customer_company} onChange={v => set('customer_company', v)} placeholder="Acme Corp" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Email Address" value={form.customer_email} onChange={v => set('customer_email', v)} placeholder="jane@acme.com" type="email" required />
        <InputField label="Phone Number" value={form.customer_phone} onChange={v => set('customer_phone', v)} placeholder="(555) 000-0000" type="tel" />
      </div>
    </div>
  )
}

function StepEquipment({ form, set }: { form: FormData; set: SetFn }) {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [scanMsg, setScanMsg] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  const onScan = async (file: File | undefined) => {
    if (!file) return
    setScanState('scanning')
    setScanMsg('')
    try {
      const image = await fileToResizedDataUrl(file)
      const res = await fetch('/api/ocr-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Scan failed')

      const got: string[] = []
      if (json.serial_number) { set('serial_number', json.serial_number); got.push('serial #') }
      if (json.model_number)  { set('model_number',  json.model_number);  got.push('model #') }
      if (json.voltage)       { set('voltage',       json.voltage);       got.push('voltage') }

      if (got.length) {
        setScanState('done')
        setScanMsg(`Filled ${got.join(', ')} from your photo — please double-check the values below.`)
      } else {
        setScanState('error')
        setScanMsg("Couldn't read the label clearly. Please enter the details manually.")
      }
    } catch (e) {
      setScanState('error')
      setScanMsg(e instanceof Error ? e.message : 'Scan failed. Please enter the details manually.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Equipment Details</h2>
          <p className="text-[13px] text-gray-400">Found on the label affixed to your unit.</p>
        </div>
        <SampleLabelThumb />
      </div>

      {/* Scan-the-label shortcut (Claude vision auto-fill) */}
      <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/60 dark:bg-zinc-800/40 px-4 py-3">
        <button
          type="button"
          onClick={() => scanRef.current?.click()}
          disabled={scanState === 'scanning'}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-60 px-4 py-2 rounded-xl transition-all"
        >
          {scanState === 'scanning' ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          {scanState === 'scanning' ? 'Reading label…' : 'Scan label'}
        </button>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Snap a photo of the unit&apos;s nameplate and we&apos;ll fill in the details for you.
        </p>
        {scanMsg && (
          <p className={`text-[12px] mt-2 leading-relaxed ${scanState === 'error' ? 'text-amber-600 dark:text-amber-400' : 'text-[#089447]'}`}>
            {scanMsg}
          </p>
        )}
        <input
          ref={scanRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => onScan(e.target.files?.[0])}
        />
      </div>

      <InputField label="Serial Number" value={form.serial_number} onChange={v => set('serial_number', v)} placeholder="e.g. 26-1234" required autoFocus />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Model Number" value={form.model_number} onChange={v => set('model_number', v)} placeholder="e.g. IAT-5000" required />
        <InputField label="Operating Voltage" value={form.voltage} onChange={v => set('voltage', v)} placeholder="e.g. 460V / 3-phase" />
      </div>
    </div>
  )
}

function StepProblem({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Describe the Problem" sub="Be specific — what's happening, when it started, and any error codes or unusual behavior." />
      <TextareaField
        label="What's happening?"
        value={form.problem_description}
        onChange={v => set('problem_description', v)}
        placeholder="Describe what's happening with your unit…"
        required
        rows={6}
        autoFocus
      />
      <InputField label="When did it start?" value={form.problem_started} onChange={v => set('problem_started', v)} placeholder="e.g. Last Tuesday, about 3 days ago" hint="A rough date or timeframe is fine." />
    </div>
  )
}

function StepOnset({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Sudden or Gradual?" sub="This is the single most useful clue — it points us at very different causes." />
      <ChoiceField
        label="Did performance drop suddenly, or fade gradually?"
        value={form.onset}
        onChange={v => set('onset', v as Onset)}
        options={[
          { value: 'sudden', label: 'Suddenly' },
          { value: 'gradual', label: 'Gradually' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      <InputField label="Anything change right before it started?" value={form.what_changed} onChange={v => set('what_changed', v)} placeholder="e.g. New process line, power outage, weather, filter change…" hint="Optional — even small changes can matter." />
      <Coaching label="What sudden vs. gradual usually points to">
        <p><strong className="text-gray-600 dark:text-gray-300">Sudden</strong> → heater failure · fan failure · power outage · control or sensor issue · VFD fault.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Gradual</strong> → dirty filters · desiccant wheel aging · airflow drift · seal wear · coil fouling · a changed room/process load.</p>
      </Coaching>
    </div>
  )
}

function StepStatus({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Current Status" sub="What's the unit doing right now?" />
      <BoolField label="Is the unit currently running?" value={form.unit_running} onChange={v => set('unit_running', v)} />
      <BoolField label="Any active alarms or fault messages?" value={form.has_alarms} onChange={v => set('has_alarms', v)} />
      {form.has_alarms === true && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-1">
          <InputField label="Alarm / fault details" value={form.alarm_details} onChange={v => set('alarm_details', v)} placeholder="e.g. E04 high-temp fault on the controller" hint="Include any codes shown on the display." />
        </motion.div>
      )}
    </div>
  )
}

function StepCooling({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Cooling Systems" sub="Pre-cooling sits on the incoming process air; post-cooling on the outgoing side." />
      <BoolField label="Is a pre-cooling system installed?" value={form.pre_cooling} onChange={v => set('pre_cooling', v)} />
      {form.pre_cooling === true && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-1">
          <SelectField label="Pre-cooling type" value={form.pre_cooling_type} onChange={v => set('pre_cooling_type', v)} options={COOLING_TYPES} allowOther otherPlaceholder="Describe the pre-cooling type" />
          <BoolField label="Is the pre-cooling system currently operational?" value={form.pre_cooling_working} onChange={v => set('pre_cooling_working', v)} />
        </motion.div>
      )}
      <div className="border-t border-gray-100 dark:border-zinc-800 pt-5">
        <BoolField label="Is a post-cooling system installed?" value={form.post_cooling} onChange={v => set('post_cooling', v)} />
        {form.post_cooling === true && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
            <SelectField label="Post-cooling type" value={form.post_cooling_type} onChange={v => set('post_cooling_type', v)} options={COOLING_TYPES} allowOther otherPlaceholder="Describe the post-cooling type" />
            <BoolField label="Is the post-cooling system currently operational?" value={form.post_cooling_working} onChange={v => set('post_cooling_working', v)} />
          </motion.div>
        )}
      </div>
    </div>
  )
}

function StepAirflow({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Airflow & Reactivation" sub="Record current readings where you can — they help a lot." />
      <TriBoolField
        label="Are the process and react airflows balanced?"
        value={form.airflow_balanced}
        onChange={v => set('airflow_balanced', v)}
        hint="Not sure how to check? Select “Not Sure” for quick step-by-step guidance."
      />
      {form.airflow_balanced === 'unsure' && <AirflowHelp />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Process airflow (CFM)" value={form.process_airflow_cfm} onChange={v => set('process_airflow_cfm', v)} placeholder="e.g. 1200" type="number" />
        <InputField label="React airflow (CFM)" value={form.react_airflow_cfm} onChange={v => set('react_airflow_cfm', v)} placeholder="e.g. 350" type="number" />
      </div>
      <InputField label="Reactivation temperature (°F)" value={form.react_temp_f} onChange={v => set('react_temp_f', v)} placeholder="e.g. 285" type="number" hint="Usually shown on the controller display." />
      {(() => {
        const r = airflowRatio(form.process_airflow_cfm, form.react_airflow_cfm)
        return r ? <CoachNote tone="sky">Process : React airflow ≈ <strong>{r.label}</strong> — {r.band}.</CoachNote> : null
      })()}
      {Number(form.react_temp_f) > 320 && (
        <CoachNote>A reactivation temp above ~320°F often points to an airflow restriction — worth checking filters and process airflow.</CoachNote>
      )}
      <BoolField label="Is the react heat zone working?" value={form.react_heat_working} onChange={v => set('react_heat_working', v)} />
      <Coaching label="What good airflow & reactivation look like">
        <p><strong className="text-gray-600 dark:text-gray-300">Airflow ratio (process : react):</strong> ≈3:1 for most applications, 4–5:1 for lower grain, 6–7:1 for very low grain.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Reactivation temp:</strong> ~285°F is the usual design target. More airflow runs cooler, less airflow runs hotter; sustained readings above ~320°F usually signal an airflow problem.</p>
      </Coaching>
    </div>
  )
}

// Reference photo for a diagnostic step. Until IAT supplies the real images, drop
// them into /public/support/ and pass `src` — otherwise it shows a labeled placeholder.
function ReferencePhoto({ src, caption }: { src?: string; caption: string }) {
  return (
    <figure className="min-w-0 flex-1 text-center">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={caption} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-gray-300 dark:text-zinc-600">
            <ImageIcon size={22} />
            <span className="text-[10px] font-medium">Photo coming soon</span>
          </div>
        )}
      </div>
      <figcaption className="mt-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{caption}</figcaption>
    </figure>
  )
}

function StepSeals({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Wheel & Seals" sub="A quick visual check of the desiccant wheel and its seals." />

      {/* Reference photos so the customer knows exactly what they're looking at.
          Swap `src` in once IAT provides the real wheel/seal images. */}
      <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/20 p-3.5">
        <p className="mb-2.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300">What to look for</p>
        <div className="flex gap-3">
          <ReferencePhoto caption="Desiccant wheel" />
          <ReferencePhoto caption="Wheel seals" />
        </div>
      </div>
      <ChoiceField
        label="Is the desiccant wheel rotating?"
        value={form.wheel_rotating}
        onChange={v => set('wheel_rotating', v as Tri)}
        options={[
          { value: 'yes', label: 'Yes', tone: 'good' },
          { value: 'no', label: 'No', tone: 'bad' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      <ChoiceField
        label="Any visible light leakage at the seals?"
        hint="Look along the seal edges with the unit lit from the other side. Visible light means air is bypassing the wheel."
        value={form.seal_light_leakage}
        onChange={v => set('seal_light_leakage', v as Tri)}
        options={[
          { value: 'yes', label: 'Yes — light visible', tone: 'bad' },
          { value: 'no', label: 'No leakage', tone: 'good' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      {form.wheel_rotating === 'no' && (
        <CoachNote>If the wheel isn&apos;t turning, the unit can&apos;t dry the air — the drive motor, belt, and chain/coupling are the first things to check.</CoachNote>
      )}
      {form.seal_light_leakage === 'yes' && (
        <CoachNote>Visible light means process air is bypassing the wheel instead of being dried — the seals likely need adjustment or replacement.</CoachNote>
      )}
      <Coaching label="Wheel & seal health — what to look for">
        <p><strong className="text-gray-600 dark:text-gray-300">Rotation:</strong> the wheel should turn steadily without slipping, ideally at the speed on your submittal/design data.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Desiccant age:</strong> wheels are the opposite of fine wine — the media slowly degrades with age, which gradually cuts drying capacity.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Seals (business-card test):</strong> a card should <em>barely</em> slide through — too loose means leakage. Standard units have 6 seals; purge units have 8.</p>
      </Coaching>
    </div>
  )
}

function StepFactors({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="External Factors" sub="Sometimes the unit is fine and the load changed. Select anything that applies." />
      <MultiChoiceField
        label="Has anything changed in the space or process?"
        values={form.external_factors}
        options={EXTERNAL_FACTORS}
        onChange={v => set('external_factors', v)}
      />
    </div>
  )
}

// "How to check airflow balance" panel, shown when the customer picks "Not Sure".
// TODO: swap this generic copy for Kacy's unit-specific guidance (Compact vs rotor
// vs IDP differ) once provided.
function AirflowHelp() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/60 dark:bg-sky-950/20 px-4 py-3.5"
    >
      <div className="flex items-center gap-2 mb-2">
        <Info size={15} className="text-sky-500 flex-shrink-0" />
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">How to check airflow balance</p>
      </div>
      <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
        <li>Find the process and reactivation (react) airflow readings — many units display these on the control panel, or you can measure at the duct with an anemometer.</li>
        <li>Look up the design CFM for each on your unit&apos;s spec label or original submittal.</li>
        <li>Compare measured vs. design: airflows are balanced when each is within about 10% of its design CFM and the process/react split matches spec.</li>
        <li>If a reading looks off, check for closed or blocked dampers, dirty filters, and a loose or slipping blower belt.</li>
      </ol>
      <p className="mt-2.5 text-[11px] text-gray-400">
        General guidance — Compact, rotor, and IDP units can differ. Still unsure? Leave this as “Not Sure” and our support team will walk you through it.
      </p>
    </motion.div>
  )
}

function StepPhotos({
  photos, setPhotos, fileInputRef, handleFiles,
}: {
  photos: File[]
  setPhotos: React.Dispatch<React.SetStateAction<File[]>>
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFiles: (files: FileList | null) => void
}) {
  const removePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Photos <span className="text-gray-300 dark:text-gray-600 font-normal text-[15px]">(optional)</span></h2>
        <p className="text-[13px] text-gray-400">Photos of the unit, the control panel, and any error displays help our team a lot.</p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#089447] hover:bg-[#089447]/3 transition-all mb-4"
      >
        <Upload size={22} className="text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">Click to upload or drag &amp; drop</p>
        <p className="text-[11px] text-gray-300 dark:text-gray-600">PNG, JPG, HEIC up to 8 files</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((file, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                <button
                  onClick={e => { e.stopPropagation(); removePhoto(i) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center transition-all hover:bg-red-50 hover:text-red-500"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
          {photos.length < 8 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600 hover:border-[#089447] hover:text-[#089447] transition-all"
            >
              <ImageIcon size={16} />
              <span className="text-[10px] font-medium">Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StepAiAnalysis({
  recommendations, analyzing, analyzed, error, onRetry,
}: {
  recommendations: string[]
  analyzing: boolean
  analyzed: boolean
  error: string | null
  onRetry: () => void
}) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-500" /> AI Quick Analysis
        </h2>
        <p className="text-[13px] text-gray-400">Based on your answers — a few safe things you can check now while our team reviews your case.</p>
      </div>

      {analyzing && (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/40 rounded-xl px-4 py-5 border border-gray-100 dark:border-zinc-800">
          <Loader2 size={18} className="text-[#089447] animate-spin flex-shrink-0" />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Analyzing your answers…</p>
        </div>
      )}

      {!analyzing && error && (
        <div className="text-[13px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-4">
          <p className="mb-2">{error}</p>
          <button type="button" onClick={onRetry} className="text-[13px] font-semibold text-[#089447] hover:text-[#077a3c]">Try again</button>
        </div>
      )}

      {!analyzing && !error && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900/30">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{rec}</p>
            </div>
          ))}
          <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">AI-generated suggestions — if unsure, wait for your service technician. Submit below and our team will follow up.</p>
        </div>
      )}

      {!analyzing && !error && analyzed && recommendations.length === 0 && (
        <div className="text-[13px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-4">
          No specific automated suggestions for this combination — our team will review your details and follow up. Go ahead and submit.
        </div>
      )}
    </div>
  )
}
