'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Lightbulb, ExternalLink, User, Wrench, FileText, Activity,
  Wind, Disc3, Building2, Image as ImageIcon, SlidersHorizontal,
} from 'lucide-react'
import type { TroubleshootingIntake } from '@/lib/supabase'
import { updateTroubleshootingStatus } from '../actions'
import { DetailShell, DetailTopBar, Card, CardHead } from '@/components/admin/detail-ui'

const STATUS_OPTIONS: { value: TroubleshootingIntake['status']; label: string; cls: string }[] = [
  { value: 'new',      label: 'New',      cls: 'bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/30' },
  { value: 'reviewed', label: 'Reviewed', cls: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' },
  { value: 'closed',   label: 'Closed',   cls: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
]

function YesNo({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
  return val
    ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Yes</span>
    : <span className="text-rose-500 font-medium">No</span>
}

// Tri-state with semantics: for wheel rotating, Yes = good; for seal light
// leakage, Yes (light visible) = bad → pass goodIsYes={false}.
function TriVal({ val, goodIsYes = true }: { val: string | null | undefined; goodIsYes?: boolean }) {
  if (!val) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
  if (val === 'unsure') return <span className="text-amber-500 font-medium">Not sure</span>
  const yes = val === 'yes'
  const good = goodIsYes ? yes : !yes
  return <span className={`font-medium ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{yes ? 'Yes' : 'No'}</span>
}

const onsetLabel = (v: string | null) =>
  v === 'sudden' ? 'Sudden' : v === 'gradual' ? 'Gradual' : v === 'unsure' ? 'Not sure' : '—'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
      <span className="text-[12px] text-zinc-400 dark:text-zinc-500 w-44 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 flex-1 min-w-0 break-words">{children}</span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHead title={title} icon={icon} />
      <div className="px-5 py-2.5">{children}</div>
    </Card>
  )
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—')

export default function TroubleshootingDetailClient({
  intake: initial,
  equipmentId,
}: {
  intake: TroubleshootingIntake
  equipmentId: string | null
}) {
  const [intake, setIntake] = useState(initial)
  const [pendingStatus, setPendingStatus] = useState(initial.status)
  const [updating, setUpdating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasUnsavedChanges = pendingStatus !== intake.status

  const save = async () => {
    if (updating || !hasUnsavedChanges) return
    setUpdating(true)
    setSaveError(null)
    const { error } = await updateTroubleshootingStatus(intake.id, pendingStatus)
    setUpdating(false)
    if (error) { setSaveError(error); return }
    setIntake(t => ({ ...t, status: pendingStatus }))
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === intake.status)
  const submitted = new Date(intake.created_at).toLocaleDateString('en-US', {
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
          { label: 'Troubleshooting', href: '/admin/troubleshooting' },
          { label: intake.reference_number },
        ]}
      >
        <span className={`inline-flex items-center text-[12px] font-semibold px-3 h-7 rounded-full border ${currentStatus?.cls}`}>
          {currentStatus?.label}
        </span>
      </DetailTopBar>

      <div className="p-5 space-y-4">
        {/* Hero */}
        <div>
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Troubleshooting Checklist</p>
          <h1 className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-tight font-mono mt-0.5">
            {intake.reference_number}
          </h1>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
            {intake.customer_name}
            {intake.customer_company ? ` · ${intake.customer_company}` : ''}
            {' · '}{submitted}
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

            {/* Status editor */}
            <Card>
              <CardHead
                title="Status"
                icon={<SlidersHorizontal size={14} />}
                action={hasUnsavedChanges ? (
                  <button
                    onClick={save}
                    disabled={updating}
                    className="text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3 h-8 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {updating ? 'Saving…' : 'Update Status'}
                  </button>
                ) : undefined}
              />
              <div className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setPendingStatus(opt.value)} disabled={updating}
                      className={pickerBtn(pendingStatus === opt.value, opt.cls)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Contact */}
            <Section title="Contact" icon={<User size={14} />}>
              <Field label="Name">{intake.customer_name}</Field>
              {intake.customer_company && <Field label="Company">{intake.customer_company}</Field>}
              <Field label="Email">
                <a href={`mailto:${intake.customer_email}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                  {intake.customer_email}
                </a>
              </Field>
              {intake.customer_phone && (
                <Field label="Phone">
                  <a href={`tel:${intake.customer_phone}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    {intake.customer_phone}
                  </a>
                </Field>
              )}
            </Section>

            {/* Equipment */}
            <Section title="Equipment" icon={<Wrench size={14} />}>
              <Field label="Serial Number">{intake.serial_number}</Field>
              <Field label="Model Number">{dash(intake.model_number)}</Field>
              <Field label="Voltage">{dash(intake.voltage)}</Field>
              {equipmentId && (
                <Link href={`/admin/equipment/${equipmentId}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-3">
                  <ExternalLink size={12} />View unit in registry
                </Link>
              )}
            </Section>

            {/* Problem */}
            <Section title="Problem" icon={<FileText size={14} />}>
              <p className="text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap py-1 mb-1">
                {intake.problem_description}
              </p>
              <Field label="When it started">{dash(intake.problem_started)}</Field>
              <Field label="Onset">{onsetLabel(intake.onset)}</Field>
              {intake.what_changed && <Field label="Changed just before">{intake.what_changed}</Field>}
            </Section>

            {/* Current Status */}
            <Section title="Current Status" icon={<Activity size={14} />}>
              <Field label="Unit running"><YesNo val={intake.unit_running} /></Field>
              <Field label="Active alarms"><YesNo val={intake.has_alarms} /></Field>
              {intake.alarm_details && <Field label="Alarm details">{intake.alarm_details}</Field>}
            </Section>

            {/* Airflow & Reactivation */}
            <Section title="Airflow & Reactivation" icon={<Wind size={14} />}>
              <Field label="Process airflow">{intake.process_airflow_cfm ? `${intake.process_airflow_cfm} CFM` : '—'}</Field>
              <Field label="React airflow">{intake.react_airflow_cfm ? `${intake.react_airflow_cfm} CFM` : '—'}</Field>
              <Field label="Reactivation temp">{intake.react_temp_f ? `${intake.react_temp_f} °F` : '—'}</Field>
            </Section>

            {/* Wheel & Seals */}
            <Section title="Wheel & Seals" icon={<Disc3 size={14} />}>
              <Field label="Wheel rotating"><TriVal val={intake.wheel_rotating} /></Field>
              <Field label="Seal light leakage"><TriVal val={intake.seal_light_leakage} goodIsYes={false} /></Field>
            </Section>

            {/* External Factors */}
            <Section title="External Factors" icon={<Building2 size={14} />}>
              {intake.external_factors && intake.external_factors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {intake.external_factors.map(f => (
                    <span key={f} className="text-[12px] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md px-2 py-1">{f}</span>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-zinc-400 dark:text-zinc-600 py-1">None reported</p>
              )}
            </Section>

            {/* Photos */}
            {intake.photo_urls && intake.photo_urls.length > 0 && (
              <Section title={`Photos (${intake.photo_urls.length})`} icon={<ImageIcon size={14} />}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-1">
                  {intake.photo_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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

          </main>

          {/* ── Right rail ────────────────────────────────────────── */}
          <aside className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[72px] space-y-4">
            <Card>
              <CardHead title="AI Recommendations" icon={<Lightbulb size={14} />} />
              <div className="px-5 py-4">
                {intake.ai_recommendations && intake.ai_recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {intake.ai_recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      Shown to the customer at submission
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-600">No recommendations generated for this case.</p>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </DetailShell>
  )
}
