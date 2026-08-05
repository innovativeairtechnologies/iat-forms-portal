// ─────────────────────────────────────────────────────────────────────────────
// lib/proposal-pdf.ts — the submittal-ready proposal document.
//
// Client-side jsPDF, like every other PDF in this product. There is no
// server-side renderer anywhere in the repo (no puppeteer, no @react-pdf) and
// this does not add one.
//
// ⚠️ lib/pdf.ts is NOT the base to build on: it is one monolithic function that
// renders a form submission as a label/value stack, on A4, with no tables, no
// logo and no running header. The real precedent for a submittal is
// public/tools/washdown-load-calculator.html — letter, an embedded logo, tables
// hand-rolled from doc.text at fixed x-offsets (jspdf-autotable is NOT
// installed), and a disclaimer footer. That idiom is what is ported here.
//
// ── Every number on this document is templated ──────────────────────────────
// Nothing in here reads from the AI-written prose. The figures come from the
// frozen `sizing_result` and, when present, the DryWare `verification`. Claude
// only ever wrote `cover_letter` and `scope`, and lib/proposals.ts flags any
// digit it managed to produce. That separation is the whole safety argument for
// the feature, so keep it: do not start interpolating numbers into prose here.
// ─────────────────────────────────────────────────────────────────────────────

import type { SizingResult } from './sizing'
import type { SizingVerification } from './desmod'
import type { Sections } from './proposals'

/** Letter, portrait, in mm. */
const PAGE_W = 216
const PAGE_H = 279
const M = 16
const CONTENT_W = PAGE_W - M * 2

const INK: [number, number, number] = [31, 30, 27]
const MUTED: [number, number, number] = [87, 84, 77]
const FAINT: [number, number, number] = [138, 134, 124]
const RULE: [number, number, number] = [214, 211, 204]
const BRAND: [number, number, number] = [8, 148, 71]
const WASH: [number, number, number] = [247, 246, 243]

export type ProposalPdfInput = {
  title: string
  customer_name: string
  job_name: string
  site_location?: string | null
  prepared_for?: string | null
  status: string
  sections: Sections
  sizing_result: SizingResult | null
  verification: SizingVerification | null
  /** Rendered into the footer so a printed copy can be traced back to a row. */
  reference: string
  preparedByName?: string | null
  dateLabel: string
}

/** The slice of jsPDF's surface this module uses. */
type JsPdfDoc = {
  setFont(name: string, style: string): void
  setFontSize(n: number): void
  setTextColor(r: number, g: number, b: number): void
  setDrawColor(r: number, g: number, b: number): void
  setFillColor(r: number, g: number, b: number): void
  setLineWidth(n: number): void
  text(text: string, x: number, y: number, opts?: object): void
  line(x1: number, y1: number, x2: number, y2: number): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  addImage(data: string, fmt: string, x: number, y: number, w: number, h: number): void
  splitTextToSize(text: string, w: number): string[]
  addPage(): void
  setPage(n: number): void
  saveGraphicsState(): void
  restoreGraphicsState(): void
  output(type: 'blob'): Blob
  internal: { getNumberOfPages: () => number }
}

function fmt(n: number | undefined | null, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/**
 * Fetch the logo and turn it into a data URL.
 *
 * Deliberately fetched rather than inlined as base64: the standalone HTML tools
 * embed theirs because they are single-file artifacts with no server, but this
 * runs inside the app, and a ~40KB base64 literal would sit in the client bundle
 * for every admin page that imports this module.
 */
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/iat-logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    // A missing logo must never cost the user their document.
    return null
  }
}

export async function generateProposalPDF(p: ProposalPdfInput): Promise<Blob> {
  // jsPDF ships a default export for the browser bundle and a named `jsPDF` for
  // the Node build. Accepting either is what lets scripts/verify-proposals.mjs
  // actually render a document instead of shipping this untested.
  const mod = (await import('jspdf')) as unknown as {
    default?: new (o: object) => JsPdfDoc
    jsPDF?: new (o: object) => JsPdfDoc
  }
  const JsPDF = mod.jsPDF ?? mod.default
  if (!JsPDF) throw new Error('jsPDF failed to load.')
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const approved = p.status === 'approved'
  const logo = await loadLogo()

  const setF = (style: 'normal' | 'bold', size: number, color: [number, number, number]) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
  }

  let y = M

  const rule = (atY: number) => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2])
    doc.setLineWidth(0.2)
    doc.line(M, atY, PAGE_W - M, atY)
  }

  /** Start a new page and re-draw the running header. Returns the new cursor. */
  const newPage = (): number => {
    doc.addPage()
    setF('normal', 8, FAINT)
    doc.text('Innovative Air Technologies', M, 12)
    doc.text(p.job_name || p.title, PAGE_W - M, 12, { align: 'right' })
    rule(14)
    return 22
  }

  /** Reserve vertical space, breaking the page when it will not fit. */
  const need = (mm: number) => {
    if (y + mm > PAGE_H - 22) y = newPage()
  }

  const heading = (label: string) => {
    need(16)
    setF('bold', 9, BRAND)
    doc.text(label.toUpperCase(), M, y)
    y += 2.5
    rule(y)
    y += 6
  }

  const paragraphs = (text: string) => {
    setF('normal', 10, MUTED)
    for (const block of text.split(/\n\s*\n/)) {
      const clean = block.trim()
      if (!clean) continue
      // Preserve single newlines inside a block (bulleted exclusions rely on it).
      for (const line of clean.split('\n')) {
        const wrapped = doc.splitTextToSize(line.trim(), CONTENT_W) as string[]
        for (const w of wrapped) {
          need(6)
          doc.text(w, M, y)
          y += 4.8
        }
      }
      y += 3
    }
  }

  /** A two-column label/value table. Column widths are fixed, like the HTML tools. */
  const table = (rows: [string, string][]) => {
    const labelW = 62
    for (const [label, value] of rows) {
      const wrapped = doc.splitTextToSize(value, CONTENT_W - labelW) as string[]
      need(wrapped.length * 4.8 + 2)
      setF('normal', 9, FAINT)
      doc.text(label, M, y)
      setF('normal', 9.5, INK)
      wrapped.forEach((w, i) => doc.text(w, M + labelW, y + i * 4.8))
      y += Math.max(wrapped.length * 4.8, 5) + 1.6
    }
    y += 2
  }

  // ── Page 1 header ──────────────────────────────────────────────────────────
  if (logo) {
    try {
      // Native aspect ratio of iat-logo.png, matching the standalone tools.
      const h = 11
      doc.addImage(logo, 'PNG', M, y - 2, h * (3020 / 3857) * 3.2, h)
    } catch {
      /* a bad image must not kill the export */
    }
  }
  setF('bold', 17, INK)
  doc.text('Equipment Proposal', PAGE_W - M, y + 4, { align: 'right' })
  setF('normal', 9, FAINT)
  doc.text(p.dateLabel, PAGE_W - M, y + 9.5, { align: 'right' })
  y += 18
  rule(y)
  y += 9

  // ── Identity block ─────────────────────────────────────────────────────────
  const meta: [string, string][] = [
    ['Prepared for', p.customer_name || '—'],
    ...(p.prepared_for ? ([['Attention', p.prepared_for]] as [string, string][]) : []),
    ['Project', p.job_name || '—'],
    ...(p.site_location ? ([['Site', p.site_location]] as [string, string][]) : []),
    ...(p.preparedByName ? ([['Prepared by', p.preparedByName]] as [string, string][]) : []),
  ]
  table(meta)

  // ── Cover letter ───────────────────────────────────────────────────────────
  if (p.sections.cover_letter.trim()) {
    heading('Introduction')
    paragraphs(p.sections.cover_letter)
  }

  // ── Scope ──────────────────────────────────────────────────────────────────
  if (p.sections.scope.trim()) {
    heading('Scope of supply')
    paragraphs(p.sections.scope)
  }

  const r = p.sizing_result
  const v = p.verification

  // ── Selected equipment ─────────────────────────────────────────────────────
  if (r) {
    heading('Selected equipment')
    const sel = r.selection
    table([
      ['Model', `${sel.unitsRequired > 1 ? `${sel.unitsRequired} × ` : ''}${sel.model}`],
      ['Nominal airflow', `${fmt(sel.nominalCfm)} CFM`],
      ['Design airflow', `${fmt(r.airflow.requiredCfm)} CFM`],
      ['Desiccant wheel', `${sel.wheelDiameterMm} × ${sel.wheelDepthMm} mm`],
      ['Wheel face area', `${fmt(sel.effectiveAreaFt2, 3)} ft²`],
      ['Process face velocity', `${fmt(sel.faceVelocityFpm)} fpm`],
      ['Reactivation', `${r.reactivation.label} at ${fmt(r.reactivation.tempF)} °F`],
    ])

    // ── Design conditions ────────────────────────────────────────────────────
    heading('Design conditions')
    const state = (label: string, s: { tempF: number; rh: number; grains: number; dewPointF: number }) =>
      [label, `${fmt(s.tempF, 1)} °F · ${fmt(s.rh)}% RH · ${fmt(s.grains, 1)} gr/lb · ${fmt(s.dewPointF, 1)} °F DP`] as [string, string]

    table([
      state('Entering the unit', r.entering),
      ...(r.airflow.freshAirCfm > 0 ? [state('Outside air', r.outsideAir)] : []),
      state('Space target', r.target),
      ['Site elevation', `${fmt(r.pressure, 2)} psia`],
    ])

    // ── Performance ──────────────────────────────────────────────────────────
    heading('Performance')

    const leaving = v ? v.leaving : r.leaving
    const perf: [string, string][] = [
      ['Leaving the unit', `${fmt(leaving.tempF, 1)} °F · ${fmt(leaving.grains, 2)} gr/lb · ${fmt(leaving.dewPointF, 1)} °F DP`],
      ['Grain depression', `${fmt(r.entering.grains - leaving.grains, 1)} gr/lb`],
      ['Moisture removal', v
        ? `${fmt(v.response.moistureRemovalLbsHr * r.selection.unitsRequired, 1)} lb/hr`
        : `${fmt(r.load.airstreamLbPerHour, 1)} lb/hr`],
      ['Reactivation heat', `${fmt(r.reactivation.heatBtuh)} BTU/hr (${fmt(r.reactivation.electricKw, 1)} kW)`],
    ]
    if (v) {
      perf.push(['Wheel rotation', `${fmt(v.response.rphOut, 1)} RPH`])
      perf.push(['Pressure drop', `${fmt(v.response.processDeltaP, 2)} in. w.g. process · ${fmt(v.response.reactDeltaP, 2)} reactivation`])
    }
    table(perf)

    // The provenance of the performance figures, stated on the document itself.
    need(18)
    doc.setFillColor(WASH[0], WASH[1], WASH[2])
    const basis = v
      ? 'Performance verified against the manufacturer’s desiccant wheel performance model. Final engineering review precedes release for construction.'
      : 'Preliminary selection. Psychrometrics are exact; desiccant wheel performance uses planning coefficients and has not been verified against the manufacturer’s performance model. Engineering confirms rotor performance before this is released.'
    const basisLines = doc.splitTextToSize(basis, CONTENT_W - 8) as string[]
    doc.rect(M, y - 4, CONTENT_W, basisLines.length * 4.2 + 7, 'F')
    setF('normal', 8.5, MUTED)
    basisLines.forEach((line, i) => doc.text(line, M + 4, y + i * 4.2))
    y += basisLines.length * 4.2 + 8
  }

  // ── Human sections ─────────────────────────────────────────────────────────
  if (p.sections.exclusions.trim()) {
    heading('Exclusions')
    paragraphs(p.sections.exclusions)
  }
  if (p.sections.notes.trim()) {
    heading('Notes')
    paragraphs(p.sections.notes)
  }

  // ── Footers, watermark, page numbers ───────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)

    if (!approved) {
      // The control that actually travels with the document. Drawn under nothing
      // (jsPDF has no z-order) but light enough to read through.
      doc.saveGraphicsState()
      setF('bold', 34, [226, 222, 216])
      doc.text('DRAFT — NOT FOR DISTRIBUTION', PAGE_W / 2, PAGE_H / 2, {
        align: 'center',
        angle: 38,
      })
      doc.restoreGraphicsState()
    }

    rule(PAGE_H - 16)
    setF('normal', 7.5, FAINT)
    doc.text('Innovative Air Technologies · dehumidifiers.com', M, PAGE_H - 11)
    doc.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 11, { align: 'right' })
    doc.text(
      approved ? `Ref ${p.reference}` : `Ref ${p.reference} · DRAFT`,
      PAGE_W / 2,
      PAGE_H - 11,
      { align: 'center' },
    )
  }

  return doc.output('blob')
}
