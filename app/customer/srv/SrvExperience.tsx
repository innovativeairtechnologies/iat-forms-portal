'use client'

/**
 * Interactive Start-Up Readiness Verification.
 *
 * Instead of a 60-page checklist, the customer walks around a 3D model of
 * their unit and taps numbered balloons (styled after the outline drawing's
 * item callouts) to complete each SRV section in place: one-tap Pass/Fail,
 * camera-first photo capture, recorded readings. A list view covers WebGL-less
 * devices and anyone who prefers a plain checklist.
 *
 * Flow: intro (project info + unit configuration) → unit (3D + section
 * panels) → certify (summary + signature) → done. Progress autosaves to
 * localStorage so a contractor can leave the mechanical room and pick up later.
 */

import { useCallback, useEffect, useMemo, useRef, useState, Component, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Box, CheckCircle2, ClipboardCheck, List, Loader2, Pen, RotateCcw, Trash2,
} from 'lucide-react'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import SectionPanel from '@/components/customer/srv/SectionPanel'
import type { SceneHotspot, HotspotState } from '@/components/customer/srv/UnitScene'
import {
  SRV_SECTIONS, SRV_CONFIG_QUESTIONS,
  type SrvConfig, type SrvProjectInfo, type SrvSectionAnswers,
  applicableSections, sectionProgress, overallProgress,
} from '@/lib/srv'

const UnitScene = dynamic(() => import('@/components/customer/srv/UnitScene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <Loader2 size={26} className="animate-spin text-emerald-600" />
        <p className="text-[13px] font-medium">Loading your unit…</p>
      </div>
    </div>
  ),
})

// react-signature-canvas touches `document` at import time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any

export type SrvUnitOption = {
  id: string
  model_number: string
  serial_number: string
  location: string | null
}

export type SrvPrefill = {
  companyName: string
  contactName: string
  email: string
  phone: string
  location: string
  units: SrvUnitOption[]
}

type Stage = 'intro' | 'unit' | 'certify' | 'done'

type Draft = {
  v: 1
  stage: Stage
  project: SrvProjectInfo
  config: SrvConfig
  sections: Record<string, SrvSectionAnswers>
  certName: string
  certCompany: string
}

/** Cross-device draft loaded server-side from form_drafts. */
export type SrvServerDraft = { draft: Draft; updated_at: string | null }

/** A returned submission reopened for revision (?resume=<id>). */
export type SrvRevision = {
  priorId: string
  reviewerNotes: string
  revisionNumber: number
  project: SrvProjectInfo
  config: SrvConfig
  sections: Record<string, SrvSectionAnswers>
}

const EMPTY_ANSWERS: SrvSectionAnswers = { items: {}, photos: {} }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** WebGL can fail on old devices / remote-desktop sessions — fall back to the list view. */
class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function SrvExperience({
  prefill, serverDraft = null, revision = null,
}: {
  prefill: SrvPrefill
  serverDraft?: SrvServerDraft | null
  revision?: SrvRevision | null
}) {
  const { setTheme } = useTheme()
  // Revisions keep their local fallback under the prior submission's key so an
  // interrupted revision resumes from the same email link.
  const draftKey = revision
    ? `iat-srv-draft:rev:${revision.priorId}`
    : `iat-srv-draft:${prefill.email || 'anon'}`

  // Initial state precedence: revision (returned submission) > server draft
  // (cross-device) > blank prefill. localStorage (device fallback) is merged in
  // an effect below since it's client-only.
  const seed = revision ?? serverDraft?.draft ?? null
  const [stage, setStage] = useState<Stage>(
    revision ? 'unit' : serverDraft?.draft.stage === 'unit' || serverDraft?.draft.stage === 'certify' ? 'unit' : 'intro'
  )
  const [project, setProject] = useState<SrvProjectInfo>(
    seed?.project ?? {
      project_name: '',
      customer: prefill.companyName,
      model_number: prefill.units[0]?.model_number || '',
      serial_number: prefill.units[0]?.serial_number || '',
      installation_address: prefill.units[0]?.location || prefill.location || '',
      date_inspected: todayISO(),
      inspected_by: prefill.contactName,
      phone: prefill.phone,
      email: prefill.email,
    }
  )
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(prefill.units[0]?.id ?? null)
  const [config, setConfig] = useState<SrvConfig>(seed?.config ?? { has_gas: false, has_coils: false, has_refrigeration: false })
  const [sections, setSections] = useState<Record<string, SrvSectionAnswers>>(seed?.sections ?? {})
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [listMode, setListMode] = useState(false)
  const [introTried, setIntroTried] = useState(false)
  const [certName, setCertName] = useState(serverDraft?.draft.certName || prefill.contactName)
  const [certCompany, setCertCompany] = useState(serverDraft?.draft.certCompany || prefill.companyName)
  const [signature, setSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resumed, setResumed] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigRef = useRef<any>(null)

  // Customer portal is light-first (mirrors CustomerDashboard).
  useEffect(() => {
    try { if (!localStorage.getItem('theme')) setTheme('light') } catch { /* noop */ }
  }, [setTheme])

  // ── Draft: restore once, then autosave ──────────────────────────────────────
  // localStorage is the device-local fallback. When a server draft was loaded
  // (cross-device resume) it wins and localStorage is skipped; in revision mode
  // the rev-scoped local key restores in-progress fixes over the prefill.
  useEffect(() => {
    if (serverDraft) { setResumed(true); return }
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw) as Draft
      if (d?.v !== 1) return
      setProject(d.project)
      setConfig(d.config)
      setSections(d.sections || {})
      setCertName(d.certName || prefill.contactName)
      setCertCompany(d.certCompany || prefill.companyName)
      if (revision || d.stage === 'unit' || d.stage === 'certify') setStage('unit')
      const hasProgress = Object.keys(d.sections || {}).length > 0 || d.project.project_name
      if (hasProgress && !revision) setResumed(true)
    } catch { /* corrupt draft — start fresh */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (stage === 'done') return
    const d: Draft = { v: 1, stage, project, config, sections, certName, certCompany }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(d))
      } catch { /* storage full/blocked — autosave is best-effort */ }
    }, 400)
    // Server copy (cross-device). Fire-and-forget; localStorage still covers
    // signal loss. Revisions stay local — their source of truth is the
    // returned submission, not a fresh draft. No server row until there's
    // actual progress (a blank page-load shouldn't create drafts).
    const hasProgress = stage !== 'intro' || project.project_name.trim() !== '' || Object.keys(sections).length > 0
    const ts = revision || !hasProgress
      ? null
      : setTimeout(() => {
          fetch('/api/customer/srv/draft', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft: d }),
          }).catch(() => { /* offline — localStorage has it */ })
        }, 1500)
    return () => { clearTimeout(t); if (ts) clearTimeout(ts) }
  }, [stage, project, config, sections, certName, certCompany, draftKey, revision])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const applicable = useMemo(() => applicableSections(config), [config])
  const progress = overallProgress(config, sections)
  const allComplete = progress.done === progress.total
  const totalFailures = applicable.reduce(
    (n, s) => n + sectionProgress(s, sections[s.key]).failures, 0)

  const hotspots: SceneHotspot[] = useMemo(
    () =>
      applicable.map((s) => {
        const p = sectionProgress(s, sections[s.key])
        const state: HotspotState = p.complete ? 'done' : p.answered + p.photosDone + p.readingsDone > 0 ? 'partial' : 'todo'
        return { key: s.key, number: s.number, label: s.shortTitle, state, failures: p.failures }
      }),
    [applicable, sections]
  )

  const projectValid = (Object.keys(project) as Array<keyof SrvProjectInfo>).every((k) => project[k].trim() !== '')

  const updateSection = useCallback((key: string, update: (prev: SrvSectionAnswers) => SrvSectionAnswers) => {
    setSections((prev) => ({ ...prev, [key]: update(prev[key] || EMPTY_ANSWERS) }))
  }, [])

  const pickUnit = (u: SrvUnitOption) => {
    setSelectedUnitId(u.id)
    setProject((p) => ({
      ...p,
      model_number: u.model_number,
      serial_number: u.serial_number,
      installation_address: u.location || p.installation_address,
    }))
  }

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/customer/srv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project, config, sections,
          certification: { name: certName, company: certCompany, signature, date: todayISO() },
          prior_id: revision?.priorId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed — please try again.')
      try { localStorage.removeItem(draftKey) } catch { /* noop */ }
      setStage('done')
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const openedSection = openSection ? SRV_SECTIONS.find((s) => s.key === openSection) : null

  // ── Shared shell ────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-800 dark:bg-[#0a0a0b] dark:text-zinc-200">
      <header className="sticky top-0 z-30 h-14 flex-shrink-0 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link
              href="/customer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              aria-label="Back to portal"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2.5">
              <Logo size={24} className="flex-shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">Start-Up Readiness</span>
                <span className="hidden text-[12px] text-zinc-400 sm:inline">· {prefill.companyName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stage === 'unit' && (
              <button
                type="button"
                onClick={() => setListMode((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {listMode ? <Box size={14} /> : <List size={14} />}
                {listMode ? '3D view' : 'List view'}
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Stage: intro ── */}
      {stage === 'intro' && (
        <main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-8">
          <div className="mb-6">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600">Before we schedule your start-up</p>
            <h1 className="text-[26px] font-bold tracking-tight text-zinc-900 dark:text-white">Start-Up Readiness Verification</h1>
            <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Walk around a 3D model of your unit and verify each system — most items are a single tap, plus a
              photo where we need proof. It takes about 15 minutes at the unit.
            </p>
          </div>

          {resumed && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
                <RotateCcw size={14} /> Welcome back — your earlier progress was saved{serverDraft ? ' to your account' : ' on this device'}.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try { localStorage.removeItem(draftKey) } catch { /* noop */ }
                  try { await fetch('/api/customer/srv/draft', { method: 'DELETE' }) } catch { /* noop */ }
                  window.location.reload()
                }}
                className="flex flex-shrink-0 items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <Trash2 size={12} /> Start over
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Important:</strong> start-up services are not scheduled until this completed verification and all
            required photos are received by IAT — a minimum of <strong>7 calendar days</strong> before your requested
            start-up date. Incomplete items may result in delays, additional trip charges, or rescheduling.
          </div>

          {/* Unit picker */}
          {prefill.units.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-[13px] font-bold text-zinc-900 dark:text-white">Which unit is this for?</h2>
              <div className="flex flex-wrap gap-2">
                {prefill.units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pickUnit(u)}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      selectedUnitId === u.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'
                    }`}
                  >
                    <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{u.model_number || 'IAT unit'}</p>
                    <p className="text-[11px] text-zinc-400">SN {u.serial_number}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Project info */}
          <div className="mt-6">
            <h2 className="mb-2 text-[13px] font-bold text-zinc-900 dark:text-white">Project information</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['project_name', 'Project name', 'e.g. Line 3 dehumidifier — Building B'],
                ['customer', 'Customer / company', ''],
                ['model_number', 'Unit model number', 'From the unit nameplate'],
                ['serial_number', 'Unit serial number', 'From the unit nameplate'],
                ['installation_address', 'Installation address', 'Street, city, state'],
                ['inspected_by', 'Inspected by', ''],
                ['phone', 'Phone number', ''],
                ['email', 'Email address', ''],
                ['date_inspected', 'Date inspected', ''],
              ] as Array<[keyof SrvProjectInfo, string, string]>).map(([key, label, ph]) => {
                const missing = introTried && !project[key].trim()
                return (
                  <label key={key} className={key === 'installation_address' ? 'sm:col-span-2' : ''}>
                    <span className={`mb-1 block text-[11px] font-semibold ${missing ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {label}{missing ? ' — required' : ''}
                    </span>
                    <input
                      type={key === 'date_inspected' ? 'date' : key === 'email' ? 'email' : 'text'}
                      value={project[key]}
                      placeholder={ph}
                      onChange={(e) => setProject((p) => ({ ...p, [key]: e.target.value }))}
                      className={`h-10 w-full rounded-lg border bg-white px-3 text-[13px] text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 ${
                        missing ? 'border-red-300 dark:border-red-900' : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          {/* Unit configuration */}
          <div className="mt-6">
            <h2 className="mb-1 text-[13px] font-bold text-zinc-900 dark:text-white">Unit configuration</h2>
            <p className="mb-2.5 text-[12px] text-zinc-400">Only the systems your unit actually has are verified — this keeps the checklist short.</p>
            <div className="space-y-2">
              {SRV_CONFIG_QUESTIONS.map((q) => {
                const section = SRV_SECTIONS.find((s) => s.conditional?.key === q.key)
                return (
                  <div key={q.key} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">{section?.conditional?.question || q.label}</p>
                    <div className="flex flex-shrink-0 gap-1">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => setConfig((c) => ({ ...c, [q.key]: v }))}
                          className={`h-8 rounded-lg border px-3.5 text-[12px] font-bold transition-colors ${
                            config[q.key] === v
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'
                          }`}
                        >
                          {v ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIntroTried(true)
              if (projectValid) setStage('unit')
            }}
            className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-bold text-white transition-colors hover:bg-emerald-500 sm:w-auto sm:px-8"
          >
            Walk up to the unit <ArrowRight size={16} />
          </button>
          {introTried && !projectValid && (
            <p className="mt-2 text-[12px] font-medium text-red-500">Fill in the highlighted fields first.</p>
          )}
        </main>
      )}

      {/* ── Stage: unit (3D or list) ── */}
      {stage === 'unit' && (
        <main className="relative flex flex-1 flex-col">
          {revision && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="mx-auto max-w-[1200px]">
                <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">
                  Revision {revision.revisionNumber} — IAT returned your verification with notes:
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-amber-700 dark:text-amber-400/90">
                  {revision.reviewerNotes || 'Update the flagged items below, then re-sign and resubmit.'}
                </p>
              </div>
            </div>
          )}
          {listMode ? (
            <div className="mx-auto w-full max-w-[760px] flex-1 px-5 py-6">
              <p className="mb-4 text-[13px] text-zinc-400">Complete each section below — tap to open.</p>
              <div className="space-y-2">
                {applicable.map((s) => {
                  const p = sectionProgress(s, sections[s.key])
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setOpenSection(s.key)}
                      className="flex w-full items-center gap-3.5 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-bold ${
                        p.complete ? 'border-emerald-500 bg-emerald-500 text-white' : p.answered > 0 ? 'border-amber-500 text-amber-600' : 'border-zinc-300 text-zinc-500 dark:border-zinc-600'
                      }`}>
                        {p.complete ? <CheckCircle2 size={16} /> : s.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-zinc-900 dark:text-white">{s.title}</span>
                        <span className="block text-[12px] text-zinc-400">
                          {p.answered + p.photosDone + p.readingsDone}/{p.total + p.photosTotal + p.readingsTotal} complete
                          {p.failures > 0 ? ` · ${p.failures} failed` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            // Explicit height (not min-height): the r3f canvas resizes to its
            // container, and a flex/min-height chain measures as 0 → 300×150 canvas.
            <div className="relative bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-black" style={{ height: 'calc(100dvh - 118px)' }}>
              <SceneBoundary onFail={() => setListMode(true)}>
                <UnitScene hotspots={hotspots} selectedKey={openSection} onSelect={setOpenSection} />
              </SceneBoundary>
              <p className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12px] font-medium text-zinc-500 shadow-sm backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-400">
                Drag to walk around · tap a numbered point to verify it
              </p>
            </div>
          )}

          {/* Bottom bar */}
          <div className="sticky bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
            <div className="mx-auto flex max-w-[1200px] items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <p className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {progress.done} of {progress.total} sections complete
                    {totalFailures > 0 && <span className="ml-2 font-bold text-red-500">{totalFailures} flagged</span>}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!allComplete}
                onClick={() => setStage('certify')}
                className={`flex h-11 flex-shrink-0 items-center gap-2 rounded-xl px-5 text-[14px] font-bold transition-colors ${
                  allComplete
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : 'cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                }`}
              >
                <Pen size={14} /> Review & sign
              </button>
            </div>
          </div>

          <AnimatePresence>
            {openedSection && (
              <SectionPanel
                key={openedSection.key}
                section={openedSection}
                answers={sections[openedSection.key] || EMPTY_ANSWERS}
                onChange={(update) => updateSection(openedSection.key, update)}
                onClose={() => setOpenSection(null)}
              />
            )}
          </AnimatePresence>
        </main>
      )}

      {/* ── Stage: certify ── */}
      {stage === 'certify' && (
        <main className="mx-auto w-full max-w-[640px] flex-1 px-5 py-8">
          <button
            type="button"
            onClick={() => setStage('unit')}
            className="mb-5 flex items-center gap-1.5 text-[13px] font-semibold text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ArrowLeft size={14} /> Back to the unit
          </button>

          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">Review & certify</h1>
          <p className="mt-1 text-[13px] text-zinc-400">{project.project_name} · {project.model_number} · SN {project.serial_number}</p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {applicable.map((s) => {
              const p = sectionProgress(s, sections[s.key])
              return (
                <div key={s.key} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-0 dark:border-zinc-800">
                  <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-500" />
                  <p className="flex-1 text-[13px] font-medium text-zinc-700 dark:text-zinc-200">{s.number}. {s.title}</p>
                  {p.failures > 0 ? (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      {p.failures} failed
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-zinc-300 dark:text-zinc-600">all pass</span>
                  )}
                </div>
              )
            })}
          </div>

          {totalFailures > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              You can still submit with failed items — IAT will review them with you and confirm what must be
              resolved before your start-up is scheduled.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white">Customer certification</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
              I certify that the above items have been completed and verified. I understand that failure to complete
              these requirements may result in start-up delays, additional charges, or rescheduling of service.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Your name</span>
                <input
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Company</span>
                <input
                  value={certCompany}
                  onChange={(e) => setCertCompany(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Signature</span>
                {signature && (
                  <button
                    type="button"
                    onClick={() => { sigRef.current?.clear(); setSignature('') }}
                    className="text-[11px] font-semibold text-red-500 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border-2 border-zinc-200 bg-white dark:border-zinc-700">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#18181b"
                  onEnd={() => {
                    // setTimeout, not rAF: the canvas needs a beat to commit the
                    // stroke, but rAF never fires in a hidden/throttled tab.
                    setTimeout(() => {
                      const c = sigRef.current
                      if (c && !c.isEmpty()) setSignature(c.toDataURL('image/png'))
                    }, 50)
                  }}
                  canvasProps={{ className: 'w-full touch-none', style: { width: '100%', height: '140px', display: 'block' } }}
                />
              </div>
            </div>

            {submitError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">{submitError}</p>
            )}

            <button
              type="button"
              disabled={submitting || !certName.trim() || !certCompany.trim() || !signature}
              onClick={submit}
              className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-colors ${
                submitting || !certName.trim() || !certCompany.trim() || !signature
                  ? 'cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              {submitting ? 'Submitting…' : 'Submit verification'}
            </button>
          </div>
        </main>
      )}

      {/* ── Stage: done ── */}
      {stage === 'done' && (
        <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50"
          >
            <CheckCircle2 size={32} className="text-emerald-600" />
          </motion.div>
          <h1 className="mt-5 text-[22px] font-bold tracking-tight text-zinc-900 dark:text-white">
            {revision ? `Revision ${revision.revisionNumber} received` : 'Verification received'}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {revision
              ? 'Thank you — IAT will re-review the updated items and confirm your start-up date, or follow up if anything is still outstanding.'
              : 'Thank you — IAT will review your responses and photos and confirm your start-up date, or contact you about any outstanding items. Start-up is scheduled only after this review is complete.'}
          </p>
          <Link
            href="/customer"
            className="mt-7 flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-[14px] font-bold text-white transition-colors hover:bg-emerald-500"
          >
            Back to my portal
          </Link>
        </main>
      )}
    </div>
  )
}
