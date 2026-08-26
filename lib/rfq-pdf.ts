// ─── RFQ PDF ──────────────────────────────────────────────────────────────────
//
// Two documents in one file, and the split is deliberate:
//
//   Pages 1-4  The RECORD. Everything the customer told us, laid out the way an
//              application engineer reads it. This is the page our sales desk
//              prints and the customer forwards to their engineer.
//   Last page  The TAKEAWAY. A single-page infographic of their own numbers —
//              what they asked for, where their moisture comes from, and what
//              happens next. Designed to survive being pinned to a wall.
//
// Vector throughout (jsPDF primitives, no html2canvas), so the file stays around
// 200 KB, prints crisply at any size, and the text is selectable and searchable.
//
// Runs in the browser only — it reaches for <canvas> to downscale the logo.

import {
  type LoadEstimate,
  type ProcessEstimate,
  type RfqData,
  ROOM_PRESETS,
  TIGHTNESS_RATES,
  applicationLabel,
  conditionEntered,
  dewPointF,
  estimateLoad,
  estimateProcess,
  fmt,
  fmtDewPoint,
  fmtGrains,
  grains,
  presetFor,
  roomDims,
  roomDimsAreDerived,
  ROOM_RENDER_EDGES,
} from './rfq'
import { COMPANY, companyAddressLine, companyContactLine } from './company'
import { renderAsset, renderAssetUrl } from './render-assets'
import { renderKeyForPreset } from './rfq-renders'

type RGB = [number, number, number]

// Warm, high-contrast print palette. Anchored on the IAT mark, which is green →
// silver → blue, so green and blue are both "on brand" here; amber is the one
// borrowed accent and it only ever marks the thing we want read first.
const C = {
  // ── The company's own colours ──
  // SAMPLED FROM THE MARK, not chosen: public/iat-logo.png, 2026-08-26. Averaging
  // its non-grey pixels gives blue #3b5fa8 and green #56b043 over a silver
  // #c0c0c0 — the mark reads blue → silver → green, and blue is what IAT has
  // always led with on paper.
  //
  // ⚠️ THIS IS NOT THE SAME GREEN AS C.pine/C.green. Those are the PORTAL's
  // "Quiet Precision" emerald (DESIGN.md `--brand` #089447), which is a screen
  // system, not the company's letterhead. The header bands used to be pine and
  // were changed on 2026-08-26 at the owner's request — "use more of our
  // traditional colour scheme versus the green".
  brandNavy: [30, 58, 110] as RGB,     // band field, deep enough for white text
  brandBlue: [59, 95, 168] as RGB,     // the mark's blue
  brandSilver: [192, 192, 192] as RGB, // the mark's silver
  brandLime: [86, 176, 67] as RGB,     // the mark's green
  /** Muted text on a brandNavy band — the silver, warmed toward the mark's blue. */
  onNavy: [166, 190, 224] as RGB,
  /** Slightly brighter, for the small-caps overline above a title. */
  onNavyStrong: [190, 208, 235] as RGB,

  pine: [10, 46, 30] as RGB,
  pineDeep: [6, 30, 20] as RGB,
  green: [8, 148, 71] as RGB,
  greenLight: [64, 180, 110] as RGB,
  greenSoft: [232, 246, 237] as RGB,
  navy: [30, 58, 110] as RGB,
  blue: [45, 110, 200] as RGB,
  blueSoft: [230, 240, 252] as RGB,
  amber: [200, 110, 10] as RGB,
  amberSoft: [253, 240, 216] as RGB,
  violet: [110, 78, 180] as RGB,
  violetSoft: [239, 235, 250] as RGB,
  rose: [190, 60, 70] as RGB,
  roseSoft: [252, 235, 236] as RGB,
  teal: [16, 130, 140] as RGB,
  tealSoft: [226, 243, 244] as RGB,
  ink: [28, 30, 27] as RGB,
  inkSoft: [88, 88, 82] as RGB,
  inkMuted: [136, 133, 124] as RGB,
  hair: [224, 221, 214] as RGB,
  hairSoft: [238, 236, 230] as RGB,
  paper: [248, 247, 244] as RGB,
  white: [255, 255, 255] as RGB,
}

const PAGE_W = 215.9
const PAGE_H = 279.4
const M = 14
const CW = PAGE_W - M * 2

type Doc = import('jspdf').jsPDF

export type RfqPdfMeta = {
  reference: string
  submittedAt: Date
  /** Set when the RFQ has been sent to IAT; a local preview says so instead. */
  submitted: boolean
}

export async function generateRfqPdf(data: RfqData, meta: RfqPdfMeta): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true })

  const isRoom = data.track === 'room'
  const load = isRoom ? estimateLoad(data) : null
  const proc = !isRoom ? estimateProcess(data) : null

  // Only the white mark is drawn — every band it sits on is pine. The
  // full-color mark was fetched here too until the takeaway page stopped using
  // it; re-add it if a light-background placement ever needs it.
  const logoLight = await loadLogo('/iat-logo-white.png')

  // The application render, so the space page shows the room rather than only an
  // abstract box. Fetched in parallel with nothing else because it is the only
  // remote asset; it resolves to null for an unmapped application (indoor pool
  // has no artwork) and for any network or CORS failure, and every consumer
  // falls back to the drawn box. A picture must never cost someone their PDF.
  const roomImage = isRoom ? await loadRoomRender(data) : null

  const ctx: Ctx = { doc, data, meta, load, proc, logoLight, isRoom, roomImage }

  // The takeaway leads. It used to close the document, but the person opening
  // this wants their own numbers first — the detail pages behind it are the
  // evidence, not the headline. jsPDF has no page-reorder, so it is simply built
  // first; the first page of a new document already exists, hence no addPage.
  takeawayPage(ctx, { first: true })
  coverPage(ctx, { newPage: true })
  isRoom ? spacePage(ctx) : processPage(ctx)
  if (isRoom) loadsPage(ctx)
  equipmentPage(ctx)

  stampEveryPage(doc, meta)
  return doc.output('blob')
}

type Ctx = {
  doc: Doc
  data: RfqData
  meta: RfqPdfMeta
  load: LoadEstimate | null
  proc: ProcessEstimate | null
  logoLight: string | null
  isRoom: boolean
  /** JPEG data URL of the application render, or null. See loadRoomRender. */
  roomImage: string | null
}

// ─── Page 1 · Cover ───────────────────────────────────────────────────────────

function coverPage({ doc, data, meta, load, proc, logoLight, isRoom }: Ctx, opts?: { newPage?: boolean }) {
  if (opts?.newPage) doc.addPage()
  paper(doc)

  // Header band — pine, with a ghosted mark bleeding off the right edge below
  // the reference chip (the two used to overlap).
  fill(doc, C.brandNavy)
  doc.rect(0, 0, PAGE_W, 66, 'F')
  ghostMark(doc, logoLight, PAGE_W - 26, 40, 34)

  if (logoLight) doc.addImage(logoLight, 'PNG', M, 13, 12.5, 16)

  overline(doc, COMPANY.name.toUpperCase(), M + 18, 19, C.onNavyStrong)
  text(doc, 'Request for Quote', M + 18, 28.5, { size: 20, weight: 'bold', color: C.white })
  text(doc, `Moisture Survey · ${isRoom ? 'Room Dehumidification' : 'Process Dehumidification'}`,
    M + 18, 35, { size: 9.5, color: C.onNavy })

  // Address on the cover too, low in the band where the ghosted mark is faintest.
  // Same two lines as page 1, from the same constants — a document that prints two
  // different addresses is worse than one that prints none.
  text(doc, companyAddressLine(), M + 18, 48, { size: 7.6, color: C.onNavy })
  text(doc, companyContactLine(), M + 18, 53.5, { size: 7.6, color: C.onNavy })

  // Reference chip, right
  const chipW = 52
  fill(doc, [255, 255, 255])
  doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.1 }))
  doc.roundedRect(PAGE_W - M - chipW, 13, chipW, 17, 2.5, 2.5, 'F')
  doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }))
  overline(doc, meta.submitted ? 'REFERENCE' : 'DRAFT PREVIEW', PAGE_W - M - chipW + 5, 19, C.onNavy)
  text(doc, meta.reference, PAGE_W - M - chipW + 5, 26, { size: 11, weight: 'bold', color: C.white })
  text(doc, meta.submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    PAGE_W - M, 35, { size: 8.5, color: C.onNavy, align: 'right' })

  // Project identity
  let y = 80
  overline(doc, 'PROJECT', M, y, C.inkMuted)
  y += 8
  // wrapped() returns the next free baseline, so a two-line project name pushes
  // the tags down instead of printing on top of them.
  y = wrapped(doc, data.projectName || 'Untitled project', M, y, CW - 4, {
    size: 19, weight: 'bold', color: C.ink, leading: 8.5,
  })
  y += 3

  const preset = presetFor(data)
  const appLabel = applicationLabel(data)
  tag(doc, appLabel, M, y, C.greenSoft, [7, 100, 52])
  if (data.location) tag(doc, data.location, M + textW(doc, appLabel, 8.5, 'bold') + 14, y, C.paper, C.inkSoft)
  y += 13

  if (preset?.driver) {
    text(doc, `What we're protecting:  ${preset.driver}`, M, y, { size: 9, color: C.inkSoft })
    y += 8
  }

  // ── At a glance ──
  overline(doc, 'AT A GLANCE', M, y, C.inkMuted)
  y += 5

  const tiles: TileSpec[] = isRoom && load
    ? [
        { label: 'Target condition', value: `${fmt(numOf(data.targetTempF))}°F`, sub: `${enteredPrefix(data, 'target')}${fmt(numOf(data.targetRhPct))}% rh · ${fmtGrains(load.roomGrains)} gr/lb`, tone: C.green, soft: C.greenSoft },
        // ⚠️ The "Estimated load" tile was here — N lb/hr and "About N pints of water
        // a day" — and came out on 2026-08-26 with the page-1 panel and the load
        // page's "Total to remove" tile. It was the same figure a third time, which
        // is why removing the other two alone did not achieve what was asked.
        //
        // Still calculated, still on the record in rfq_requests.summary. The room
        // load is an ESTIMATE OF THE CUSTOMER'S BUILDING, resting on assumed
        // tightness, permeation and door traffic; handing it over at survey stage
        // reads as a quantity we have committed to. That is the whole reason it is
        // gone from the customer's copy. Do not reinstate it on any page.
        { label: 'Biggest driver', value: load.dominant ? shortDriver(load.dominant.label) : '—', sub: load.dominant && load.complete ? `${pct(load.dominant.grainsPerHour, load.lines.reduce((s, l) => s + l.grainsPerHour, 0))} of the room load` : 'Preliminary', tone: C.amber, soft: C.amberSoft, small: true },
      ]
    : proc
      ? [
          { label: 'Leaving air', value: `${fmt(numOf(data.leavingTempF))}°F`, sub: `${enteredPrefix(data, 'leaving')}${fmtGrains(proc.leavingGrains)} gr/lb`, tone: C.green, soft: C.greenSoft },
          { label: 'Leaving dew point', value: fmtDewPoint(proc.leavingDewPointF), sub: `${fmt(proc.leavingRhPct, 1)}% rh at the leaving temp`, tone: C.blue, soft: C.blueSoft },
          { label: 'Process airflow', value: fmt(proc.cfm), unit: 'cfm', sub: data.airSource, tone: C.violet, soft: C.violetSoft },
          { label: 'Moisture removed', value: proc.complete ? fmt(proc.lbPerHr, 1) : '—', unit: 'lb/hr', sub: proc.complete ? `${fmtGrains(proc.depression)} gr/lb of drying` : 'Preliminary', tone: C.amber, soft: C.amberSoft },
        ]
      : []

  y = tileRow(doc, tiles, M, y, CW)
  y += 9

  // ── Contact / project detail, two columns ──
  const colW = (CW - 6) / 2
  const contactRows: [string, string][] = [
    ['Company', data.company],
    ['Contact', data.contactName],
    ['Email', data.email],
    ['Phone', data.phone],
    ['End user', data.endUser],
  ]
  const projectRows: [string, string][] = [
    ['Location', data.location],
    ['Elevation', data.elevationFt ? `${fmt(numOf(data.elevationFt))} ft above sea level` : ''],
    ['Quote needed by', formatDate(data.dateRequired)],
    ['Expected order', formatDate(data.dateClose)],
    ['Engineering firm', data.engineeringFirm],
    ['Engineer contact', data.engineerContact],
  ]

  const hA = panelHeight(contactRows.length)
  const hB = panelHeight(projectRows.length)
  const h = Math.max(hA, hB)
  keyPanel(doc, 'WHO TO TALK TO', contactRows, M, y, colW, h)
  keyPanel(doc, 'PROJECT DETAIL', projectRows, M + colW + 6, y, colW, h)
  y += h + 8

  if (data.purpose) {
    softPanel(doc, M, y, CW, 0, C.paper)
    const inner = wrapped(doc, data.purpose, M + 6, y + 12, CW - 12, { size: 9.5, color: C.inkSoft, leading: 5 })
    const boxH = inner - y + 6
    softPanel(doc, M, y, CW, boxH, C.paper)
    accentEdge(doc, M, y, boxH, C.green)
    overline(doc, 'IN THEIR WORDS', M + 6, y + 7, C.inkMuted)
    wrapped(doc, data.purpose, M + 6, y + 13.5, CW - 12, { size: 9.5, color: C.inkSoft, leading: 5 })
  }
}

// ─── Page 2 · The space (room track) ──────────────────────────────────────────

function spacePage(ctx: Ctx) {
  const { doc, data, load, roomImage } = ctx
  newPage(ctx, 'The space', 'Geometry, envelope and design conditions')
  let y = 46

  // Room diagram + facts, side by side.
  //
  // The card grew from 62mm to 76mm when the render went in: at 46mm of drawing
  // height the picture fits to 52mm wide and reads as a thumbnail, at 60mm it
  // fills the column width instead and the callouts have somewhere to sit. The
  // 14mm comes out of this page's slack, which had roughly 60mm of it; the
  // envelope section below still calls ensure(), so an unusually long survey
  // spills to a continuation page exactly as before rather than overrunning.
  const diagW = CW * 0.52
  const factsX = M + diagW + 6
  const factsW = CW - diagW - 6
  const cardH = 76

  card(doc, M, y, diagW, cardH)
  // Volume mode has no measured length/width, so the heading has to stop claiming
  // these were dimensions someone gave us. roomDims() supplies the derived pair.
  const g = roomDims(data)
  const derived = roomDimsAreDerived(data)
  overline(doc, derived ? 'ROOM SIZE (FROM VOLUME)' : 'ROOM DIMENSIONS', M + 6, y + 8, C.inkMuted)
  roomDiagram(doc, M + 6, y + 12, diagW - 12, 60, g.L, g.W, g.H, roomImage)

  const vol = load?.volumeCuFt ?? 0
  const floorArea = g.L * g.W
  const wallArea = 2 * (g.L + g.W) * g.H
  keyPanel(doc, 'THE NUMBERS', [
    ['Floor area', floorArea ? `${fmt(floorArea)} sq.ft` : ''],
    ['Wall area', wallArea ? `${fmt(wallArea)} sq.ft` : ''],
    ['Volume', vol ? `${fmt(vol)} cu.ft` : ''],
    ['Envelope total', floorArea ? `${fmt(wallArea + floorArea * 2)} sq.ft` : ''],
  ], factsX, y, factsW, cardH)
  y += cardH + 8

  // Design conditions — the table an engineer looks for first
  overline(doc, 'DESIGN CONDITIONS', M, y, C.inkMuted)
  y += 4
  const elev = numOf(data.elevationFt)
  const rows: string[][] = [
    condRow('Inside the room (target)', numOf(data.targetTempF), numOf(data.targetRhPct), elev, conditionEntered(data, 'target')),
    condRow('Surrounding space', numOf(data.surroundTempF), numOf(data.surroundRhPct), elev, conditionEntered(data, 'surround')),
    condRow('Outdoor summer design', numOf(data.outdoorTempF), numOf(data.outdoorRhPct), elev, conditionEntered(data, 'outdoor')),
  ]
  y = table(doc, M, y, CW,
    ['Condition', 'Dry bulb', 'Rel. humidity', 'Grains', 'Dew point'],
    rows, [0.4, 0.15, 0.15, 0.15, 0.15])
  y += 3
  y = note(doc, `Loads scale with the difference in grains between inside and out, not with relative humidity, which means a different amount of water at every temperature.${sourceNote(data)}`, M, y, CW)
  y += 6

  // Envelope
  // Tightness sets the whole infiltration line (Loose is 6× Tight) and used to be
  // recorded nowhere on the document — only inside a breakdown-bar caption. The
  // rate is spelled out because the band name alone does not say what was assumed.
  // The `??` fallback mirrors estimateLoad exactly, so a survey stored under a
  // retired band prints the rate the math actually used rather than a blank.
  const leakRate = TIGHTNESS_RATES[data.tightness] ?? TIGHTNESS_RATES.Average
  const envelopeRows: string[][] = [
    ['Walls', data.wallMaterial],
    ['Roof / ceiling', data.ceilingMaterial],
    ['Floor', data.floorMaterial],
    ['Vapor barrier', data.vaporBarrier],
    ['Building tightness', `${data.tightness} — ${leakRate} cu.ft/hr per sq.ft of envelope`],
  ]
  // Reserve exactly what this block draws: the 4mm below the overline, plus the
  // table. tableH() ALREADY allows for the header row, so the count passed is the
  // DATA rows — asking for tableH(rows + 1) double-counts it.
  //
  // ⚠️ This is the last block on the page, so over-reserving does not shuffle
  // anything down, it emits a whole continuation page holding one short table.
  // At 9 + tableH(6) = 65mm against the 59.1mm a typical room survey leaves, it
  // did that on EVERY room-track PDF — which is exactly what moving the doors
  // table to the load page was meant to prevent. Measured, not estimated: the
  // block is 52mm and clears CONTENT_BOTTOM by 7.1mm.
  y = ensure(ctx, y, 4 + tableH(envelopeRows.length), 'The space', 'Construction and envelope')
  overline(doc, 'CONSTRUCTION & ENVELOPE', M, y, C.inkMuted)
  y += 4
  y = table(doc, M, y, CW, ['Element', 'Material / rating'], envelopeRows, [0.34, 0.66])
  y += 9

  // Openings
  // Doors used to close this page. They now open the load page instead — they
  // are almost always the dominant load, so they belong beside the breakdown
  // that says so rather than filed under geometry. It also stops a two-door
  // survey from spilling a near-empty continuation page out of this one.
}

// ─── Page 2 · The process (process track) ─────────────────────────────────────

function processPage(ctx: Ctx) {
  const { doc, data, proc } = ctx
  newPage(ctx, 'The process', 'Leaving-air specification and airstream')
  let y = 46
  const elev = numOf(data.elevationFt)

  // Big leaving-air spec block
  card(doc, M, y, CW, 42, C.brandNavy)
  overline(doc, 'REQUIRED LEAVING AIR OFF THE DEHUMIDIFIER', M + 8, y + 10, C.onNavy)
  const specs: [string, string, string][] = [
    [`${fmt(numOf(data.leavingTempF))}°F`, 'dry bulb', ''],
    [fmtGrains(proc?.leavingGrains ?? 0), 'gr/lb', 'grains of water per pound of dry air'],
    [fmtDewPoint(proc?.leavingDewPointF ?? -100), 'dew point', ''],
    [`${fmt(proc?.leavingRhPct ?? 0, 1)}%`, 'rh at temp', ''],
  ]
  specs.forEach(([v, l], i) => {
    const x = M + 8 + i * ((CW - 16) / 4)
    text(doc, v, x, y + 26, { size: 17, weight: 'bold', color: C.white })
    text(doc, l, x, y + 33, { size: 8, color: C.onNavy })
  })
  y += 50

  overline(doc, 'THE AIRSTREAM', M, y, C.inkMuted)
  y += 4
  y = table(doc, M, y, CW, ['Parameter', 'Value'], [
    ['Process airflow', data.processCfm ? `${fmt(numOf(data.processCfm))} cfm` : '—'],
    ['Air source', data.airSource + (data.mixOutdoorPct ? ` (${data.mixOutdoorPct}% outdoor air)` : '')],
    ['Entering air (estimated)', proc ? `${fmtGrains(proc.enteringGrains)} gr/lb` : '—'],
    ['Grain depression required', proc ? `${fmtGrains(proc.depression)} gr/lb` : '—'],
    ['Water removed (estimated)', proc?.complete ? `${fmt(proc.lbPerHr, 1)} lb/hr  ·  ${fmt(proc.lbPerHr * 24 * 0.9586)} pints per day` : '—'],
  ], [0.4, 0.6])
  y += 9

  y = ensure(ctx, y, 9 + tableH(2) + 16, 'The process', 'Design conditions')
  overline(doc, 'DESIGN CONDITIONS', M, y, C.inkMuted)
  y += 4
  y = table(doc, M, y, CW,
    ['Condition', 'Dry bulb', 'Rel. humidity', 'Grains', 'Dew point'],
    [
      condRow('Return / room air', numOf(data.surroundTempF), numOf(data.surroundRhPct), elev, conditionEntered(data, 'surround')),
      condRow('Outdoor summer design', numOf(data.outdoorTempF), numOf(data.outdoorRhPct), elev, conditionEntered(data, 'outdoor')),
    ], [0.4, 0.15, 0.15, 0.15, 0.15])
  y += 3
  y = note(doc, `A desiccant wheel is sized on the grain depression it has to deliver, not on relative humidity. Where a specification is written as a dew point, that is the number we design to.${sourceNote(data)}`, M, y, CW)
  y += 6

  if (data.purpose || data.notes) {
    overline(doc, 'PROCESS NOTES', M, y, C.inkMuted)
    y += 5
    y = wrapped(doc, [data.purpose, data.notes].filter(Boolean).join('\n\n'), M, y, CW, { size: 9.5, color: C.inkSoft, leading: 5 })
  }
}

// ─── Page 3 · Loads (room track) ──────────────────────────────────────────────

function loadsPage(ctx: Ctx) {
  const { doc, data, load } = ctx
  if (!load) return
  newPage(ctx, 'Where the moisture comes from', 'Openings, internal loads and the preliminary estimate')
  let y = 46

  overline(doc, 'DOORS & OPENINGS', M, y, C.inkMuted)
  y += 4
  if (data.doors.length) {
    y = table(doc, M, y, CW,
      ['Opening', 'Size', 'Opens/hr', 'Seconds open', 'Opens onto'],
      data.doors.map(d => [
        d.label,
        `${fmt(d.widthFt)} × ${fmt(d.heightFt)} ft`,
        // A continuously-open aperture has no cycle to report — printing the stored
        // opensPerHour/secondsOpen here would contradict the load it was charged.
        d.continuouslyOpen ? 'Continuous' : fmt(d.opensPerHour),
        d.continuouslyOpen ? '—' : fmt(d.secondsOpen),
        d.exposure,
      ]), [0.32, 0.16, 0.14, 0.18, 0.2])
  } else {
    y = emptyRow(doc, M, y, CW, 'No doors or openings recorded.')
  }
  y += 5

  overline(doc, 'INTERNAL LOADS RECORDED', M, y, C.inkMuted)
  y += 4
  // ⚠️ NO NEW ROW HERE — the condition rides on the row that already exists.
  //
  // The make-up air's condition has to be on the record: the customer cannot check
  // the estimate without it, and "outdoor design" against a pre-treated deck is a
  // ~20x swing on the same cfm. But this table sits directly above the ESTIMATED
  // BREAKDOWN block, and that block's ensure() reserve is HONEST — measured at
  // 97.4mm actual against 96.4mm reserved, i.e. very slightly under. So there is no
  // slack to reclaim, and every row added here costs 8mm of real estate.
  //
  // A separate "Makeup air" row spilled the breakdown onto a continuation page for
  // any survey with a second opening, or with the air counted as room load. Folding
  // the same text into "Ventilation air in" costs nothing. WHERE the load lands is
  // already on the page — it is the sub-line of the Makeup air load tile below.
  const ventWhen = data.ventRhPct
    ? `${fmt(numOf(data.ventTempF))}°F · ${conditionEntered(data, 'vent')}`
    : 'outdoor design'
  const ventDetail = `${ventWhen}, ${fmtGrains(load.ventGrains)} gr/lb`

  y = table(doc, M, y, CW, ['Source', 'What you told us'], [
    ['People', data.occupants ? `${data.occupants} × ${data.activity.toLowerCase()}` : 'None recorded'],
    ['Product / process moisture', data.productLoadLbHr ? `${data.productLoadLbHr} lb of water per hour${data.productDescription ? ` (${data.productDescription})` : ''}` : 'None recorded'],
    ['Unvented combustion', data.gasCfh ? `${data.gasCfh} cu.ft/hr of gas` : 'None recorded'],
    ['Open water / wet surfaces', data.wetAreaSqFt ? `${data.wetAreaSqFt} sq.ft at ${data.wetWaterTempF}°F` : 'None recorded'],
    ['Ventilation air in', data.ventCfm ? `${fmt(numOf(data.ventCfm))} cfm · ${ventDetail}` : 'None recorded'],
    // The condition rides on the exhaust row instead when exhaust is what drives the
    // make-up air — estimateLoad takes max(vent, exhaust), so either can be the term.
    ['Exhaust air out', data.exhaustCfm
      ? `${fmt(numOf(data.exhaustCfm))} cfm${data.ventCfm ? '' : ` · ${ventDetail}`}`
      : 'None recorded'],
  ], [0.34, 0.66])
  y += 6

  y = ensure(ctx, y, 10 + load.lines.length * 10.6 + 44, 'Where the moisture comes from', 'Estimated breakdown')
  overline(doc, 'ESTIMATED BREAKDOWN', M, y, C.inkMuted)
  y += 5
  y = loadBars(doc, M, y, CW, load)
  y += 5

  // Totals strip
  const totals: TileSpec[] = [
    { label: 'Room internal load', value: fmt(load.internalGrPerHr), unit: 'gr/hr', sub: `${fmt(load.internalGrPerHr / 7000, 1)} lb/hr, includes ${Math.round(load.safetyFactor * 100)}% safety factor`, tone: C.green, soft: C.greenSoft },
    // ⚠️ Shows ventGrPerHr, NOT ventilationGrPerHr. The latter is zero when the air
    // is counted as room load, so the old tile would have read "0 gr/hr" for a
    // survey whose make-up air was the single largest term in the breakdown above.
    { label: 'Makeup air load', value: fmt(load.ventGrPerHr), unit: 'gr/hr',
      sub: load.ventGrPerHr <= 0
        ? 'No makeup air recorded'
        : load.ventTarget === 'room'
          ? 'Delivered into the room — included in the room load'
          : 'Dried upstream, kept out of the room total',
      tone: C.blue, soft: C.blueSoft },
    // ⚠️ The amber "Total to remove" tile was here and came out on 2026-08-25, with
    // the page-1 headline panel, at the owner's request. Still calculated, still on
    // the record in rfq_requests.summary — off the customer's copy only. The two
    // component loads stay: they are what the breakdown bars above are made of.
  ]
  y = tileRow(doc, totals, M, y, CW)
  y += 8

  // ⚠️ CONDITIONAL, because the old sentence is FALSE for a room-load survey — it
  // asserted the opposite of what that survey had just been charged.
  text(doc, load.ventTarget === 'room'
      ? 'Makeup air is counted inside the room load here, because it is delivered into the space untreated. That is why the dry air figure is higher than the internal sources alone would suggest.'
      : 'Ventilation air is carried separately on purpose: the dehumidifier dries it before it reaches the room, so folding it into the room total would oversize the system.',
    M, y + 4, { size: 7, color: C.inkMuted })
  // The old rose "PRELIMINARY ESTIMATE" panel lived here. It is gone because
  // stampEveryPage() now prints the disclaimer on every page — two copies on
  // this one page would read as boilerplate rather than as a caution.
}

// ─── Page 4 · Equipment & utilities ───────────────────────────────────────────

function equipmentPage(ctx: Ctx) {
  const { doc, data } = ctx
  newPage(ctx, 'Equipment & utilities', 'Everything that shapes the unit we quote')
  let y = 46

  const colW = (CW - 6) / 2
  const left: [string, string][] = [
    ['Install location', data.installLocation],
    ['Cabinet construction', data.construction],
    ['Size / weight limits', data.sizeRestrictions || 'None stated'],
    ['Operating schedule', data.runtime],
    ['Environment', data.environmentClean + (data.contaminants ? ` (${data.contaminants})` : '')],
  ]
  const right: [string, string][] = [
    ['Electrical', data.voltage],
    ['Chilled water', data.chilledWaterEwt ? `${data.chilledWaterEwt}°F entering` : 'Not available'],
    ['Hot water', data.hotWaterEwt ? `${data.hotWaterEwt}°F entering` : 'Not available'],
    ['Steam', data.steamPsi ? `${data.steamPsi} psi` : 'Not available'],
    ['Regeneration heat', data.regenSource],
  ]
  const h = Math.max(panelHeight(left.length), panelHeight(right.length))
  keyPanel(doc, 'THE UNIT', left, M, y, colW, h)
  keyPanel(doc, 'UTILITIES AVAILABLE', right, M + colW + 6, y, colW, h)
  y += h + 9

  y = ensure(ctx, y, 9 + tableH(7), 'Equipment & utilities', 'Air treatment')
  overline(doc, 'AIR TREATMENT', M, y, C.inkMuted)
  y += 4
  y = table(doc, M, y, CW, ['Item', 'Selection'], [
    ['Regeneration air source', data.regenAirSource + (data.regenIndoorConditions ? ` (${data.regenIndoorConditions})` : '')],
    ['Pre-filter', data.prefilterMerv],
    ['Final filter', data.finalMerv],
    ['Cooling', data.coolingType],
    ['Heating', data.heatingType],
    ['Sensible load (if known)', data.sensibleLoadBtuh ? `${fmt(numOf(data.sensibleLoadBtuh))} BTU/hr` : 'Not stated'],
    ...(ctx.isRoom ? [] : [['Air source', data.airSource] as [string, string]]),
  ], [0.34, 0.66])
  y += 9

  if (data.notes) {
    overline(doc, 'ADDITIONAL NOTES', M, y, C.inkMuted)
    y += 5
    y = wrapped(doc, data.notes, M, y, CW, { size: 9.5, color: C.inkSoft, leading: 5 })
    y += 6
  }

  // Standing engineering notes carried over from IAT's paper quote request.
  const notes: [string, string][] = [
    ['Freeze protection', 'Chilled-water, hot-water and steam coils exposed to freezing air need a cold-weather mitigation strategy: gas or electric pre-heat, and/or drainable coils. All water coils should be externally piped so they can be isolated and drained.'],
    ['DX vs chilled water', 'Where DX cooling is selected over chilled water, some variation in leaving-air or space conditions may be experienced.'],
    ['Vapor retarder classes', 'Class I is polyethylene. Class II is kraft-faced fiberglass batt. Class III is latex-painted gypsum board.'],
    ['Drawings help', 'A plan or sketch showing dimensions, door locations and openings lets us skip a round of questions.'],
  ]
  const bodyOpts = { size: 7.8, color: C.inkMuted, leading: 3.6 }
  // Measure first: a fixed 62 mm box left dead space on a short answer and ran
  // the last note off the panel on a long one.
  const boxH = 12 + notes.reduce(
    (h, [, b]) => h + 4 + wrapLines(doc, b, CW - 12, bodyOpts).length * bodyOpts.leading + 3, 0
  )
  const boxY = Math.min(Math.max(y, 186), CONTENT_BOTTOM - boxH)
  softPanel(doc, M, boxY, CW, boxH, C.paper)
  overline(doc, 'NOTES FROM OUR ENGINEERING TEAM', M + 6, boxY + 8, C.inkMuted)
  let ny = boxY + 15
  for (const [t, b] of notes) {
    text(doc, t, M + 6, ny, { size: 8.5, weight: 'bold', color: C.ink })
    ny = wrapped(doc, b, M + 6, ny + 4, CW - 12, bodyOpts) + 3
  }
}

// ─── Last page · The takeaway infographic ─────────────────────────────────────
// The whole page is laid out against a fixed vertical budget, because it must
// stay ONE page no matter how long the project name is or how many load lines
// there are. Every band below is a constant and they sum to 249 mm, clearing
// CONTENT_BOTTOM so the per-page disclaimer band has room. Change one and
// re-check the total — nothing here reflows.
const T = {
  band: 24,
  duo: 46,      // target condition + the space
  formula: 34,
  bars: 40,
  ref: 45,      // typical conditions + what happens next
  strip: 14,
  gap: 3,
}
// 24+3 +46+3 +34+3 +40+3 +45+3 +14 = 218, clearing FOOTER_BAND_TOP (246.4).
//
// The amber headline band (17 + 3) came out on 2026-08-25 with the load figure it
// carried, which is where the extra ~20mm of slack came from. Kept as slack rather
// than redistributed: this page's whole guarantee is that it never runs to two
// pages, and nothing here reflows.

function takeawayPage(ctx: Ctx, opts?: { first?: boolean }) {
  const { doc, data, load, proc, logoLight, isRoom, roomImage } = ctx
  if (!opts?.first) doc.addPage()
  paper(doc, C.white)

  // Title block
  fill(doc, C.brandNavy)
  doc.rect(0, 0, PAGE_W, T.band, 'F')
  // ── Letterhead ──
  // The document opens on this page, so it carries the company identity: mark,
  // name, address and web address, on the pine band. Asked for 2026-08-25.
  //
  // ⚠️ NO ghostMark HERE, unlike the cover. The faded mark bled across the right
  // third of this band, which is where the address block now sits — a 0.08-opacity
  // logo behind 6.6pt text reads as a printing fault. The cover page keeps it,
  // because nothing competes for that space there.
  //
  // ⚠️ The band is T.band = 24mm and CANNOT GROW: this page is laid out against a
  // fixed vertical budget that already clears CONTENT_BOTTOM by about 4mm. Three
  // stacked lines on the left and two on the right is what fits. If anything is
  // added here, take the room from within the band, not from the page.
  if (logoLight) doc.addImage(logoLight, 'PNG', M, 4, 12, 15.3)
  overline(doc, COMPANY.name.toUpperCase(), M + 17.5, 8, C.onNavyStrong)
  text(doc, 'YOUR DEHUMIDIFICATION SNAPSHOT', M + 17.5, 15,
    { size: 12.5, weight: 'bold', color: C.white, spacing: 0.25 })
  text(doc, truncate(doc, `${data.projectName || 'Your project'}  ·  ${applicationLabel(data)}`, CW - 78, 8),
    M + 17.5, 20.5, { size: 8, color: C.onNavy })

  // Address block, right-aligned against the margin.
  text(doc, companyAddressLine(), PAGE_W - M, 11.5,
    { size: 6.8, color: C.onNavy, align: 'right' })
  text(doc, companyContactLine(), PAGE_W - M, 16,
    { size: 6.8, color: C.onNavy, align: 'right' })

  let y = T.band + T.gap

  // ⚠️ THE AMBER "You need roughly N lb of water removed every hour" PANEL WAS HERE,
  // and was REMOVED on 2026-08-25 at the owner's request — along with the "Total to
  // remove" tile on the load page. The figure is still calculated and still stored
  // on the record (rfq_requests.summary); it is only off the CUSTOMER's copy.
  //
  // Do not reinstate it as "the one thing to remember". It led the document with a
  // preliminary lb/hr the customer could read as a quantity we had committed to,
  // which is the opposite of what a survey is for. T.headline and its gap are gone
  // from the budget with it — see the sum above the T block.

  // ── Left: the target in four units · Right: the room / the airstream ──
  const halfW = (CW - 6) / 2
  const rx = M + halfW + 6

  panelHead(doc, M, y, halfW, T.duo, '1', 'YOUR TARGET CONDITION', C.green, C.greenSoft)
  const quad: [string, string][] = isRoom && load
    ? [
        [`${fmt(numOf(data.targetTempF))}°F`, 'temperature'],
        [`${fmt(numOf(data.targetRhPct))}%`, 'relative humidity'],
        [fmtGrains(load.roomGrains), 'grains / lb'],
        [fmtDewPoint(load.roomDewPointF), 'dew point'],
      ]
    : proc
      ? [
          [`${fmt(numOf(data.leavingTempF))}°F`, 'leaving temperature'],
          [fmtGrains(proc.leavingGrains), 'grains / lb'],
          [fmtDewPoint(proc.leavingDewPointF), 'leaving dew point'],
          [fmt(proc.cfm), 'cfm process air'],
        ]
      : []
  quad.forEach(([v, l], i) => {
    const x = M + 7 + (i % 2) * (halfW / 2 - 2)
    const yy = y + 21 + Math.floor(i / 2) * 11.5
    text(doc, v, x, yy, { size: 13.5, weight: 'bold', color: C.ink })
    text(doc, l, x, yy + 4.4, { size: 7.2, color: C.inkMuted })
  })
  wrapped(doc,
    isRoom
      ? 'Four ways of saying the same thing. Grains and dew point are the two that size equipment. Relative humidity on its own cannot.'
      : 'A process is specified by the air leaving the dehumidifier. Dew point is the honest unit: it does not move when the temperature does.',
    M + 7, y + 41, halfW - 14, { size: 6.8, color: C.inkMuted, leading: 2.9, maxLines: 2 })

  panelHead(doc, rx, y, halfW, T.duo, '2', isRoom ? 'YOUR SPACE' : 'YOUR AIRSTREAM', C.blue, C.blueSoft)
  if (isRoom) {
    const t = roomDims(data)
    // The same application render the space page shows, so the takeaway opens on
    // the customer's own room rather than a generic box. Callouts are OFF here:
    // this panel is 46mm on a page with a fixed vertical budget, and the callout
    // padding would shrink the picture to a 17.8mm stamp. The dimensions are
    // printed as text directly below instead.
    //
    // Falls back to the drawn box whenever roomImage is null — an unmapped
    // application (indoor pool has no artwork) or any fetch/CORS failure. A
    // picture must never cost someone their PDF.
    roomDiagram(doc, rx + 6, y + 12, halfW - 12, 27, t.L, t.W, t.H, roomImage, { callouts: false })
    const v = load?.volumeCuFt ?? 0
    text(doc, v ? `${fmt(v)} cu.ft` : 'Size not given', rx + 6, y + 42, { size: 9, weight: 'bold', color: C.ink })
    if (v) {
      // san() everywhere — jsPDF's Helvetica is WinAnsi and drops anything else
      // silently. '×' is in WinAnsi; 'assumed' is spelled out rather than using a
      // symbol for the same reason.
      text(doc, roomDimsAreDerived(data)
          ? `${fmt(t.L)} × ${fmt(t.W)} × ${fmt(t.H)} ft assumed`
          : `${fmt(t.L)} × ${fmt(t.W)} × ${fmt(t.H)} ft`,
        rx + halfW - 6, y + 42, { size: 8, color: C.inkMuted, align: 'right' })
    }
  } else {
    airstreamDiagram(doc, rx + 6, y + 13, halfW - 12, 27, proc)
  }
  y += T.duo + T.gap

  // ── The formula, with their own numbers substituted in ──
  panelHead(doc, M, y, CW, T.formula, '3', isRoom ? 'THE MATH BEHIND YOUR NUMBER' : 'THE MATH BEHIND YOUR WHEEL', C.violet, C.violetSoft)
  if (isRoom && load) {
    formulaLine(doc, M + 7, y + 18,
      'Dry air (cfm)  =',
      { top: 'moisture load (gr/hr)', bottom: 'density × 60 × grain difference' },
      `${fmt(load.internalGrPerHr)}  ÷  ( 0.075 × 60 × ${fmtGrains(load.roomGrains - load.supplyGrains)} )  =  ${fmt(load.dryAirCfm)} cfm`)
  } else if (proc) {
    formulaLine(doc, M + 7, y + 18,
      'Water removed (lb/hr)  =',
      { top: 'cfm × density × 60 × grain depression', bottom: '7,000 grains per pound' },
      `${fmt(proc.cfm)} × 0.075 × 60 × ${fmtGrains(proc.depression)}  ÷  7,000  =  ${fmt(proc.lbPerHr, 1)} lb/hr`)
  }
  y += T.formula + T.gap

  // ── Where the moisture comes from · or the five system types ──
  if (isRoom && load && load.lines.length) {
    panelHead(doc, M, y, CW, T.bars, '4', 'WHERE YOUR MOISTURE COMES FROM', C.teal, C.tealSoft)
    miniBars(doc, M + 7, y + 15, CW - 14, load)
  } else {
    panelHead(doc, M, y, CW, T.bars, '4', 'THE FIVE KINDS OF DESICCANT SYSTEM', C.teal, C.tealSoft)
    const kinds: [string, string][] = [
      ['Passive storage', 'Archives, vaults, layup (doors rarely open)'],
      ['Active storage', 'Warehouses, cold storage (heavy door traffic)'],
      ['Commercial HVAC', 'Supermarkets, rinks, pools (comfort plus humidity)'],
      ['Industrial HVAC', 'Tight tolerance, 24/7, high-value process'],
      ['Product drying', 'Removing water from the product, not the room'],
    ]
    let ky = y + 17
    kinds.forEach(([k, v]) => {
      fill(doc, C.teal); doc.circle(M + 9, ky - 1.2, 1.1, 'F')
      text(doc, k, M + 13, ky, { size: 8, weight: 'bold', color: C.ink })
      text(doc, v, M + 58, ky, { size: 7.8, color: C.inkMuted })
      ky += 5.2
    })
  }
  y += T.bars + T.gap

  // ── Quick reference · what happens next ──
  const refW = CW * 0.46
  const nextX = M + refW + 6
  const nextW = CW - refW - 6

  panelHead(doc, M, y, refW, T.ref, '5', 'TYPICAL TARGET CONDITIONS', C.navy, C.blueSoft)
  // Their own application is always the first row, so the highlighted line is
  // theirs rather than a generic chart they have to hunt through. Four rows is
  // what T.ref affords once the caption is allowed for.
  const refKeys = ['warehouse', 'cold-storage', 'pharma', 'dry-room']
  const refRows = [
    ...ROOM_PRESETS.filter(p => p.key === data.application && !p.key.startsWith('other')),
    ...ROOM_PRESETS.filter(p => refKeys.includes(p.key) && p.key !== data.application),
  ].slice(0, 4)
  let ry = y + 16
  text(doc, 'Application', M + 7, ry, { size: 6.6, weight: 'bold', color: C.inkMuted })
  text(doc, '°F', M + refW - 30, ry, { size: 6.6, weight: 'bold', color: C.inkMuted, align: 'right' })
  text(doc, '%rh', M + refW - 19, ry, { size: 6.6, weight: 'bold', color: C.inkMuted, align: 'right' })
  text(doc, 'gr/lb', M + refW - 6, ry, { size: 6.6, weight: 'bold', color: C.inkMuted, align: 'right' })
  ry += 1.6
  hair(doc, M + 7, ry, M + refW - 6, ry)
  ry += 5
  for (const p of refRows) {
    // Their own application is highlighted, so the table reads as "here is where
    // you sit" rather than as a generic chart.
    const mine = p.key === data.application
    if (mine) {
      fill(doc, C.greenSoft)
      doc.roundedRect(M + 5, ry - 3.9, refW - 10, 6.1, 1, 1, 'F')
    }
    text(doc, truncate(doc, p.label, refW - 42, 7.4), M + 7, ry,
      { size: 7.4, weight: mine ? 'bold' : 'normal', color: mine ? [7, 100, 52] : C.inkSoft })
    text(doc, String(p.tempF), M + refW - 30, ry, { size: 7.4, color: C.inkSoft, align: 'right' })
    text(doc, String(p.rhPct), M + refW - 19, ry, { size: 7.4, color: C.inkSoft, align: 'right' })
    text(doc, fmtGrains(grains(p.tempF, p.rhPct, 0)), M + refW - 6, ry, { size: 7.4, color: C.inkSoft, align: 'right' })
    ry += 5.5
  }
  text(doc, 'Starting points, not specifications.', M + 7, y + T.ref - 2.5, { size: 6.4, color: C.inkMuted })

  // Chapter-7 design procedure, in the customer's language.
  panelHead(doc, nextX, y, nextW, T.ref, '6', 'WHAT HAPPENS NEXT', C.green, C.greenSoft)
  const steps = [
    'Confirm the purpose: what the humidity is hurting.',
    'Agree the control level and its tolerance.',
    'Calculate the heat and moisture loads.',
    'Select, size and position the components.',
    'Select and locate the controls.',
  ]
  let sy = y + 18
  steps.forEach((s, i) => {
    fill(doc, C.green)
    doc.circle(nextX + 9, sy - 1.3, 2.4, 'F')
    text(doc, String(i + 1), nextX + 9, sy + 0.3, { size: 6.2, weight: 'bold', color: C.white, align: 'center' })
    text(doc, truncate(doc, s, nextW - 20, 7.8), nextX + 14.5, sy, { size: 7.8, color: C.inkSoft })
    sy += 6.2
  })
  y += T.ref + T.gap

  // ── Key takeaway strip ──
  fill(doc, C.brandNavy)
  doc.roundedRect(M, y, CW, T.strip, 3, 3, 'F')
  text(doc, 'ONE NUMBER TO REMEMBER', PAGE_W / 2, y + 6,
    { size: 6.6, weight: 'bold', color: C.onNavy, align: 'center', spacing: 0.5 })
  const takeaway = isRoom && load?.complete
    ? `${fmt(load.dryAirCfm)} cfm of dry air at ${fmtGrains(load.supplyGrains)} gr/lb holds this room at ${fmt(numOf(data.targetRhPct))}% rh`
    : proc?.complete
      ? `${fmt(proc.cfm)} cfm at ${fmtGrains(proc.leavingGrains)} gr/lb  ·  ${fmtDewPoint(proc.leavingDewPointF)} dew point`
      : 'Send this to IAT and we will put the numbers to it'
  text(doc, truncate(doc, takeaway, CW - 12, 9.6), PAGE_W / 2, y + 12,
    { size: 9.6, weight: 'bold', color: C.white, align: 'center' })

  // No footer lines here any more — stampEveryPage() carries the disclaimer and
  // the credit on every page, this one included.
}
// ─── Drawing helpers ──────────────────────────────────────────────────────────

function paper(doc: Doc, color: RGB = C.white) {
  fill(doc, color)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
}

/**
 * Page-break guard for the flowing record pages. Their content is variable —
 * a survey with eight doors is much taller than one with none — and every page
 * now reserves its bottom for the disclaimer band, so a section that would cross
 * CONTENT_BOTTOM continues on a fresh page instead of printing underneath it.
 *
 * Call it with the height of the block you are ABOUT to draw, and use the y it
 * returns.
 */
function ensure(ctx: Ctx, y: number, needed: number, title: string, sub: string): number {
  if (y + needed <= CONTENT_BOTTOM) return y
  newPage(ctx, `${title} (continued)`, sub)
  return 46
}

/** Height a table() call will occupy, so ensure() can be asked before drawing. */
const tableH = (rows: number) => 8 + rows * 8

function newPage(ctx: Ctx, title: string, sub: string) {
  const { doc } = ctx
  doc.addPage()
  paper(doc)
  fill(doc, C.brandNavy)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  if (ctx.logoLight) doc.addImage(ctx.logoLight, 'PNG', M, 7, 11, 14)
  text(doc, title, M + 16, 16, { size: 14, weight: 'bold', color: C.white })
  text(doc, sub, M + 16, 22.5, { size: 8.5, color: C.onNavy })
  text(doc, ctx.meta.reference, PAGE_W - M, 16, { size: 9, weight: 'bold', color: C.onNavy, align: 'right' })
}

/**
 * A large, ghosted IAT mark bleeding off the right edge of a header band.
 * Earlier this was three abstract rounded bars standing in for the swoosh; they
 * read as blobs and collided with the reference chip. The real mark at 8% is
 * both more on-brand and impossible to mistake for content.
 */
function ghostMark(doc: Doc, logo: string | null, x: number, y: number, h: number) {
  if (!logo) return
  const g = doc as unknown as { GState: new (o: object) => object }
  doc.setGState(new g.GState({ opacity: 0.08 }))
  doc.addImage(logo, 'PNG', x, y, h * (3020 / 3857), h)
  doc.setGState(new g.GState({ opacity: 1 }))
}

type TileSpec = { label: string; value: string; unit?: string; sub: string; tone: RGB; soft: RGB; small?: boolean }

function tileRow(doc: Doc, tiles: TileSpec[], x: number, y: number, w: number): number {
  if (!tiles.length) return y
  const gap = 4
  const tw = (w - gap * (tiles.length - 1)) / tiles.length
  const h = 30
  tiles.forEach((t, i) => {
    const tx = x + i * (tw + gap)
    fill(doc, t.soft)
    doc.roundedRect(tx, y, tw, h, 2.5, 2.5, 'F')
    fill(doc, t.tone)
    doc.roundedRect(tx, y, 1.6, h, 0.8, 0.8, 'F')
    text(doc, t.label.toUpperCase(), tx + 5, y + 7, { size: 6.4, weight: 'bold', color: t.tone, spacing: 0.35 })
    const vSize = t.small ? 10 : 14
    const value = t.small ? truncate(doc, t.value, tw - 10, vSize) : t.value
    text(doc, value, tx + 5, y + 17.5, { size: vSize, weight: 'bold', color: C.ink })
    if (t.unit) {
      text(doc, t.unit, tx + 5 + textW(doc, value, vSize, 'bold') + 1.5, y + 17.5, { size: 7.5, color: C.inkMuted })
    }
    wrapped(doc, t.sub, tx + 5, y + 23, tw - 9, { size: 6.6, color: C.inkMuted, leading: 2.9, maxLines: 2 })
  })
  return y + h
}

function card(doc: Doc, x: number, y: number, w: number, h: number, bg: RGB = C.white) {
  fill(doc, bg)
  stroke(doc, bg === C.white ? C.hair : bg)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD')
}

function softPanel(doc: Doc, x: number, y: number, w: number, h: number, bg: RGB) {
  if (h <= 0) return
  fill(doc, bg)
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F')
}

function accentEdge(doc: Doc, x: number, y: number, h: number, color: RGB) {
  fill(doc, color)
  doc.roundedRect(x, y, 1.6, h, 0.8, 0.8, 'F')
}

/** Numbered panel with a tinted head bar — the infographic's repeating unit. */
function panelHead(doc: Doc, x: number, y: number, w: number, h: number, n: string, title: string, tone: RGB, soft: RGB) {
  fill(doc, C.white)
  stroke(doc, C.hair)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 3, 3, 'FD')
  fill(doc, soft)
  doc.roundedRect(x, y, w, 11, 3, 3, 'F')
  doc.rect(x, y + 8, w, 3, 'F')
  fill(doc, tone)
  doc.roundedRect(x + 4, y + 2.6, 5.8, 5.8, 1.4, 1.4, 'F')
  text(doc, n, x + 6.9, y + 6.8, { size: 6.8, weight: 'bold', color: C.white, align: 'center' })
  text(doc, title, x + 13, y + 7, { size: 7.6, weight: 'bold', color: tone, spacing: 0.3 })
}

function keyPanel(doc: Doc, title: string, rows: [string, string][], x: number, y: number, w: number, h: number) {
  card(doc, x, y, w, h)
  overline(doc, title, x + 6, y + 8, C.inkMuted)
  let ry = y + 16
  for (const [k, v] of rows) {
    text(doc, k, x + 6, ry, { size: 7.6, color: C.inkMuted })
    text(doc, truncate(doc, v || '—', w - 12 - 34, 8.4), x + 34, ry, { size: 8.4, weight: v ? 'bold' : 'normal', color: v ? C.ink : C.inkMuted })
    ry += 7.6
  }
}

const panelHeight = (rows: number) => 16 + rows * 7.6

function table(doc: Doc, x: number, y: number, w: number, head: string[], rows: string[][], widths: number[]): number {
  const rowH = 8
  const headH = 8
  const total = headH + rows.length * rowH

  fill(doc, C.paper)
  doc.roundedRect(x, y, w, headH, 2, 2, 'F')
  doc.rect(x, y + headH - 2, w, 2, 'F')
  let cx = x + 4
  head.forEach((hd, i) => {
    text(doc, hd.toUpperCase(), cx, y + 5.4, { size: 6.3, weight: 'bold', color: C.inkMuted, spacing: 0.3 })
    cx += widths[i] * w
  })

  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH
    if (ri % 2 === 1) {
      fill(doc, [252, 251, 249])
      doc.rect(x, ry, w, rowH, 'F')
    }
    hair(doc, x, ry, x + w, ry)
    let tx = x + 4
    r.forEach((cell, ci) => {
      const cellW = widths[ci] * w - 5
      text(doc, truncate(doc, cell || '—', cellW, 8), tx, ry + 5.4, {
        size: 8,
        weight: ci === 0 ? 'bold' : 'normal',
        color: cell ? (ci === 0 ? C.ink : C.inkSoft) : C.inkMuted,
      })
      tx += widths[ci] * w
    })
  })
  stroke(doc, C.hair)
  doc.setLineWidth(0.25)
  doc.roundedRect(x, y, w, total, 2, 2, 'D')
  return y + total
}

function emptyRow(doc: Doc, x: number, y: number, w: number, label: string): number {
  softPanel(doc, x, y, w, 12, C.paper)
  text(doc, label, x + 6, y + 7.5, { size: 8.5, color: C.inkMuted })
  return y + 12
}

const BAR_COLORS: Record<string, [RGB, RGB]> = {
  doors: [C.amber, C.amberSoft],
  infiltration: [C.blue, C.blueSoft],
  permeation: [C.teal, C.tealSoft],
  people: [C.violet, C.violetSoft],
  product: [C.green, C.greenSoft],
  gas: [C.rose, C.roseSoft],
  wet: [C.navy, C.blueSoft],
}

function loadBars(doc: Doc, x: number, y: number, w: number, load: LoadEstimate): number {
  const max = Math.max(...load.lines.map(l => l.grainsPerHour), 1)
  const totalRaw = load.lines.reduce((s, l) => s + l.grainsPerHour, 0) || 1
  const labelW = 62
  const valueW = 34
  const barW = w - labelW - valueW
  let ry = y
  const sorted = [...load.lines].sort((a, b) => b.grainsPerHour - a.grainsPerHour)
  for (const line of sorted) {
    const [tone, soft] = BAR_COLORS[line.key] ?? [C.inkMuted, C.paper]
    text(doc, truncate(doc, line.label, labelW - 4, 7.8), x, ry + 3.6, { size: 7.8, weight: 'bold', color: C.ink })
    text(doc, truncate(doc, line.detail, labelW - 4, 6.4), x, ry + 7.4, { size: 6.4, color: C.inkMuted })
    fill(doc, soft)
    doc.roundedRect(x + labelW, ry, barW, 5.4, 1.2, 1.2, 'F')
    const bw = Math.max((line.grainsPerHour / max) * barW, line.grainsPerHour > 0 ? 1.6 : 0)
    if (bw > 0) {
      fill(doc, tone)
      doc.roundedRect(x + labelW, ry, bw, 5.4, 1.2, 1.2, 'F')
    }
    text(doc, `${fmt(line.grainsPerHour)} gr/hr`, x + w, ry + 3.9, { size: 7.4, weight: 'bold', color: C.ink, align: 'right' })
    text(doc, pct(line.grainsPerHour, totalRaw), x + w, ry + 7.8, { size: 6.4, color: C.inkMuted, align: 'right' })
    ry += 10.6
  }
  return ry
}

/**
 * Compact bar block for the infographic page. Capped at five rows and pitched
 * to fit inside T.bars — the panel is a fixed height because the page is a
 * fixed height, so this must never grow past it.
 */
function miniBars(doc: Doc, x: number, y: number, w: number, load: LoadEstimate) {
  const sorted = [...load.lines].sort((a, b) => b.grainsPerHour - a.grainsPerHour).slice(0, 5)
  const max = Math.max(...sorted.map(l => l.grainsPerHour), 1)
  const totalRaw = load.lines.reduce((s, l) => s + l.grainsPerHour, 0) || 1
  const labelW = 58
  const barW = w - labelW - 26
  let ry = y
  for (const line of sorted) {
    const [tone, soft] = BAR_COLORS[line.key] ?? [C.inkMuted, C.paper]
    text(doc, truncate(doc, shortDriver(line.label), labelW - 4, 7.4), x, ry + 3.9, { size: 7.4, color: C.inkSoft })
    fill(doc, soft)
    doc.roundedRect(x + labelW, ry + 0.6, barW, 4.6, 1, 1, 'F')
    const bw = Math.max((line.grainsPerHour / max) * barW, line.grainsPerHour > 0 ? 1.4 : 0)
    if (bw > 0) {
      fill(doc, tone)
      doc.roundedRect(x + labelW, ry + 0.6, bw, 4.6, 1, 1, 'F')
    }
    text(doc, pct(line.grainsPerHour, totalRaw), x + w, ry + 4.1, { size: 7.2, weight: 'bold', color: C.ink, align: 'right' })
    ry += 5.0
  }
}

/** Isometric room box with L / W / H callouts. */
/**
 * The room, dimensioned.
 *
 * Two modes. With `image` it draws the application render and calls the sizes out
 * around it; without one it falls back to the abstract isometric box that was
 * here first, which is still what an unmapped application (indoor pool) and any
 * failed fetch get.
 *
 * ⚠️ The two modes use DIFFERENT conventions for width, on purpose. The box has a
 * real isometric depth edge, so width belongs on it. A photograph has no such
 * edge, so the render mode puts width along the TOP and keeps length on the
 * bottom and height up the left — the same three-edge convention the wizard's
 * on-screen overlay uses (see DimensionOverlay in RfqWizard.tsx). A customer
 * reads the screen and this page side by side; they must not disagree.
 */
function roomDiagram(
  doc: Doc, x: number, y: number, w: number, h: number,
  L: number, W: number, H: number, image?: string | null,
  opts?: { callouts?: boolean },
) {
  if (image) {
    roomPhotoDiagram(doc, x, y, w, h, L, W, H, image, opts?.callouts !== false)
    return
  }
  const pad = 12
  const bx = x + pad
  const by = y + 6
  const bw = w - pad * 2
  const bh = h - 16
  const d = Math.min(bw, bh) * 0.28 // depth offset

  const fw = bw - d
  const fh = bh - d
  const fy = by + d

  // Top face
  fill(doc, [236, 244, 239])
  stroke(doc, C.hair)
  doc.setLineWidth(0.3)
  doc.lines([[d, -d], [fw, 0], [-d, d]], bx, fy, [1, 1], 'FD', true)
  // Right face
  fill(doc, [226, 236, 231])
  doc.lines([[d, -d], [0, fh], [-d, d]], bx + fw, fy, [1, 1], 'FD', true)
  // Front face
  fill(doc, C.white)
  doc.rect(bx, fy, fw, fh, 'FD')

  // Dimension callouts
  const g = doc as unknown as { GState: new (o: object) => object }
  stroke(doc, C.green)
  doc.setLineWidth(0.4)
  // Length across the bottom
  doc.line(bx, fy + fh + 4, bx + fw, fy + fh + 4)
  tick(doc, bx, fy + fh + 4)
  tick(doc, bx + fw, fy + fh + 4)
  text(doc, L ? `${fmt(L)} ft` : 'length', bx + fw / 2, fy + fh + 8.5, { size: 7.2, weight: 'bold', color: C.green, align: 'center' })
  // Height up the left
  doc.line(bx - 4, fy, bx - 4, fy + fh)
  tick(doc, bx - 4, fy, true)
  tick(doc, bx - 4, fy + fh, true)
  text(doc, H ? `${fmt(H)} ft` : 'height', bx - 5.5, fy + fh / 2, { size: 7.2, weight: 'bold', color: C.green, align: 'right' })
  // Width along the top-right depth edge
  doc.line(bx + fw + 1.5, fy - 1.5, bx + fw + d + 1.5, fy - d - 1.5)
  text(doc, W ? `${fmt(W)} ft` : 'width', bx + fw + d + 3, fy - d - 1, { size: 7.2, weight: 'bold', color: C.green })

  doc.setGState(new g.GState({ opacity: 1 }))
}

/** Render mode for roomDiagram: the picture, with L/W/H called out around it. */
function roomPhotoDiagram(
  doc: Doc, x: number, y: number, w: number, h: number,
  L: number, W: number, H: number, image: string, callouts = true,
) {
  // Room for the callouts. Left is widest because the height label is rotated
  // upright there rather than laid along the line.
  //
  // Without them the picture takes the whole slot instead. That is not a
  // cosmetic choice — the callout padding costs 17mm in each direction, which is
  // most of the takeaway panel: at that size the render comes out 17.8 x 10mm
  // and the labels are unreadable, against 42.7 x 24mm with the padding dropped.
  // The takeaway panel already prints the volume and the L x W x H underneath,
  // so callouts there would repeat that in a space too small to read.
  const padL = callouts ? 12 : 1.5
  const padR = callouts ? 5 : 1.5
  const padT = callouts ? 7 : 1.5
  const padB = callouts ? 10 : 1.5
  const availW = w - padL - padR
  const availH = h - padT - padB

  // Every asset in the `rooms` set is 1920x1080, so the fit is a fixed 16:9.
  const iw = Math.min(availW, availH * (16 / 9))
  const ih = iw * (9 / 16)
  const ix = x + padL + (availW - iw) / 2
  const iy = y + padT + (availH - ih) / 2

  doc.addImage(image, 'JPEG', ix, iy, iw, ih)
  stroke(doc, C.hair)
  doc.setLineWidth(0.3)
  doc.rect(ix, iy, iw, ih, 'S')
  if (!callouts) return

  stroke(doc, C.green)
  doc.setLineWidth(0.4)

  // ── Callouts along the room's own edges, standing just outside it ──
  // Same three edges and the same geometry as the wizard's DimensionOverlay
  // (ROOM_RENDER_EDGES in lib/rfq.ts). The customer reads the screen and this
  // page side by side, so they have to match — do not change one alone.
  const E = ROOM_RENDER_EDGES
  const pt = (p: { x: number; y: number }) => ({ x: ix + p.x * iw, y: iy + p.y * ih })
  const leftTop = pt(E.leftTop), apex = pt(E.apex), leftBot = pt(E.leftBot), floorPt = pt(E.floor)
  const OFFSET = 0.0125 * iw
  const GAP = 2.4

  const edge = (
    a: { x: number; y: number }, b: { x: number; y: number }, label: string, side: 1 | -1,
  ) => {
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * side, ny = (dx / len) * side   // outward perpendicular
    const p = { x: a.x + nx * OFFSET, y: a.y + ny * OFFSET }
    const q = { x: b.x + nx * OFFSET, y: b.y + ny * OFFSET }
    doc.line(p.x, p.y, q.x, q.y)
    const T = 1.1
    doc.line(p.x - nx * T, p.y - ny * T, p.x + nx * T, p.y + ny * T)
    doc.line(q.x - nx * T, q.y - ny * T, q.x + nx * T, q.y + ny * T)
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI
    if (deg > 90) deg -= 180
    if (deg < -90) deg += 180
    // jsPDF measures the angle COUNTER-clockwise while screen y runs down, so the
    // sign flips relative to the SVG rotate() the wizard uses.
    text(doc, label, (p.x + q.x) / 2 + nx * GAP, (p.y + q.y) / 2 + ny * GAP,
      { size: 7, weight: 'bold', color: C.green, align: 'center', angle: -deg })
  }

  // ⚠️ The signs differ: for the downward vertical the raw normal points INTO the
  // room, so height takes +1 where width takes -1. See the wizard's note.
  if (W) edge(leftTop, apex, `${fmt(W)} ft wide`, -1)
  if (H) edge(leftTop, leftBot, `${fmt(H)} ft high`, 1)
  if (L) edge(leftBot, floorPt, `${fmt(L)} ft long`, 1)
}

function tick(doc: Doc, x: number, y: number, horizontal = false) {
  if (horizontal) doc.line(x - 1.2, y, x + 1.2, y)
  else doc.line(x, y - 1.2, x, y + 1.2)
}

/** Entering → wheel → leaving, for the process track. */
function airstreamDiagram(doc: Doc, x: number, y: number, w: number, h: number, proc: ProcessEstimate | null) {
  const boxW = (w - 12) / 3
  const boxes: [string, string, RGB, RGB][] = [
    ['ENTERING', proc ? `${fmtGrains(proc.enteringGrains)} gr/lb` : '—', C.blue, C.blueSoft],
    ['DESICCANT', 'wheel', C.green, C.greenSoft],
    ['LEAVING', proc ? `${fmtGrains(proc.leavingGrains)} gr/lb` : '—', C.amber, C.amberSoft],
  ]
  boxes.forEach(([label, val, tone, soft], i) => {
    const bx = x + i * (boxW + 6)
    fill(doc, soft)
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F')
    text(doc, label, bx + boxW / 2, y + 7, { size: 6, weight: 'bold', color: tone, align: 'center', spacing: 0.3 })
    text(doc, val, bx + boxW / 2, y + 15, { size: 9, weight: 'bold', color: C.ink, align: 'center' })
    if (i < 2) {
      stroke(doc, C.inkMuted)
      doc.setLineWidth(0.4)
      doc.line(bx + boxW + 1, y + 11, bx + boxW + 4.5, y + 11)
      fill(doc, C.inkMuted)
      doc.triangle(bx + boxW + 4.4, y + 9.6, bx + boxW + 4.4, y + 12.4, bx + boxW + 6, y + 11, 'F')
    }
  })
  if (proc?.complete) {
    text(doc, `${fmtGrains(proc.depression)} gr/lb removed  ·  ${fmt(proc.cfm)} cfm  ·  ${fmt(proc.lbPerHr, 1)} lb of water an hour`,
      x + w / 2, y + 30, { size: 7.4, color: C.inkMuted, align: 'center' })
  }
}

/**
 * A stacked fraction — the general form — with the customer's own numbers
 * substituted underneath. Seeing the arithmetic done with their figures is what
 * turns the estimate from a black box into something they can check.
 */
function formulaLine(doc: Doc, x: number, y: number, lead: string, frac: { top: string; bottom: string }, substituted: string) {
  text(doc, lead, x, y, { size: 9, weight: 'bold', color: C.ink })
  const fx = x + textW(doc, lead, 9, 'bold') + 4
  const barW = Math.max(textW(doc, frac.top, 7.4), textW(doc, frac.bottom, 7.4)) + 4
  text(doc, frac.top, fx + barW / 2, y - 2, { size: 7.4, color: C.violet, align: 'center' })
  stroke(doc, C.violet)
  doc.setLineWidth(0.35)
  doc.line(fx, y + 0.6, fx + barW, y + 0.6)
  text(doc, frac.bottom, fx + barW / 2, y + 4.6, { size: 7.4, color: C.violet, align: 'center' })

  const boxW = CW - 14
  fill(doc, C.violetSoft)
  doc.roundedRect(x, y + 7.5, boxW, 8.5, 1.8, 1.8, 'F')
  text(doc, truncate(doc, substituted, boxW - 8, 8.4), x + 4, y + 13, { size: 8.4, weight: 'bold', color: [80, 55, 140] })
}

/** Info callout that sizes itself to its copy; returns the y below the box. */
function note(doc: Doc, body: string, x: number, y: number, w: number): number {
  const opts = { size: 7.2, color: [40, 70, 120] as RGB, leading: 3.4 }
  const lines = wrapLines(doc, body, w - 14, opts)
  const h = Math.max(lines.length * opts.leading + 5.5, 10)
  fill(doc, C.blueSoft)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  fill(doc, C.blue)
  doc.circle(x + 5, y + h / 2, 1.6, 'F')
  text(doc, 'i', x + 5, y + h / 2 + 1.4, { size: 5.6, weight: 'bold', color: C.white, align: 'center' })
  wrapped(doc, body, x + 9.5, y + 4.4, w - 14, opts)
  return y + h
}

// ─── Text primitives ──────────────────────────────────────────────────────────

type TextOpts = {
  size?: number
  weight?: 'normal' | 'bold'
  color?: RGB
  align?: 'left' | 'center' | 'right'
  spacing?: number
  /** Degrees counter-clockwise — used only by the watermark. */
  angle?: number
}

/**
 * jsPDF's built-in Helvetica is WinAnsi-encoded. Anything outside that set does
 * not fall back — it renders as a wrong glyph, silently. `≈` came out as `ʺH`
 * and `′` as a stray `2` before this existed, so every string on its way to the
 * page passes through here. Characters that ARE in WinAnsi (· × — ° ’ ½) are
 * left alone.
 */
function san(s: string): string {
  return String(s)
    .replace(/[≈]/g, '~')
    .replace(/[′‵]/g, "'")
    .replace(/[″‶]/g, '"')
    .replace(/[→]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[−–]/g, '-')
    .replace(/[‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[…]/g, '...')
    .replace(/[   ]/g, ' ')
}

function text(doc: Doc, s: string, x: number, y: number, o: TextOpts = {}) {
  doc.setFont('helvetica', o.weight ?? 'normal')
  doc.setFontSize(o.size ?? 9)
  const c = o.color ?? C.ink
  doc.setTextColor(c[0], c[1], c[2])
  if (o.spacing) doc.setCharSpace(o.spacing)
  doc.text(san(s), x, y, { align: o.align ?? 'left', ...(o.angle ? { angle: o.angle } : {}) })
  if (o.spacing) doc.setCharSpace(0)
}

/**
 * Draws a wrapped block and returns the baseline for the NEXT line — so callers
 * can keep stacking without adding a leading of their own.
 */
function wrapped(
  doc: Doc, s: string, x: number, y: number, w: number,
  o: TextOpts & { leading?: number; maxLines?: number } = {}
): number {
  const lead = o.leading ?? (o.size ?? 9) * 0.45
  if (!s) return y
  const lines = wrapLines(doc, s, w, o)
  lines.forEach((ln, i) => text(doc, ln, x, y + i * lead, o))
  return y + lines.length * lead
}

function wrapLines(
  doc: Doc, s: string, w: number,
  o: TextOpts & { maxLines?: number } = {}
): string[] {
  doc.setFont('helvetica', o.weight ?? 'normal')
  doc.setFontSize(o.size ?? 9)
  let lines = doc.splitTextToSize(san(s), w) as string[]
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines)
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+\S*$/, '') + '...'
  }
  return lines
}

function overline(doc: Doc, s: string, x: number, y: number, color: RGB) {
  text(doc, s, x, y, { size: 6.6, weight: 'bold', color, spacing: 0.4 })
}

function tag(doc: Doc, s: string, x: number, y: number, bg: RGB, fg: RGB) {
  const w = textW(doc, s, 8.5, 'bold') + 8
  fill(doc, bg)
  doc.roundedRect(x, y - 4.6, w, 7.4, 3.7, 3.7, 'F')
  text(doc, s, x + 4, y, { size: 8.5, weight: 'bold', color: fg })
}

function textW(doc: Doc, s: string, size: number, weight: 'normal' | 'bold' = 'normal'): number {
  doc.setFont('helvetica', weight)
  doc.setFontSize(size)
  return doc.getTextWidth(san(s))
}

function truncate(doc: Doc, s: string, maxW: number, size: number): string {
  if (!s) return ''
  if (textW(doc, s, size) <= maxW) return s
  let out = s
  while (out.length > 1 && textW(doc, out + '...', size) > maxW) out = out.slice(0, -1)
  return out + '...'
}

function fill(doc: Doc, c: RGB) { doc.setFillColor(c[0], c[1], c[2]) }
function stroke(doc: Doc, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]) }
function hair(doc: Doc, x1: number, y1: number, x2: number, y2: number) {
  stroke(doc, C.hairSoft)
  doc.setLineWidth(0.2)
  doc.line(x1, y1, x2, y2)
}

/** The exact wording IAT requires on every page of a preliminary document. */
const PAGE_DISCLAIMER =
  'Preliminary selections and performance readouts are provided for planning purposes only and should be validated by IAT or a qualified professional engineer prior to final design or commitment.'

/** Top of the per-page disclaimer band — no page content may cross this line. */
const FOOTER_BAND_TOP = PAGE_H - 29
/** Where flowing page content must stop, with a little air above the band. */
const CONTENT_BOTTOM = FOOTER_BAND_TOP - 4

/**
 * Applied to every page after all content is laid out: the diagonal PRELIMINARY
 * watermark, the highlighted disclaimer band, and the page meta line.
 *
 * The watermark goes on TOP rather than underneath, because the pages are built
 * from opaque white cards — drawn first it would only survive in the gutters
 * between them, which reads as a rendering fault rather than a stamp.
 *
 * WATERMARK_OPACITY is the one knob. It was 0.07, raised to 0.10 on 2026-08-17
 * because the stamp read as almost nothing on a printed page — screen contrast
 * flatters it, toner does not. This is the ceiling worth having: it has to stay
 * legible over white without competing with the body text sitting on top of it,
 * and it must still disappear into the dark pine bands rather than smearing them.
 * Nudge this constant rather than the color, so there is one number to reason
 * about if it is ever wrong again.
 */
const WATERMARK_OPACITY = 0.10
function stampEveryPage(doc: Doc, meta: RfqPdfMeta) {
  const pages = doc.getNumberOfPages()
  const g = doc as unknown as { GState: new (o: object) => object }
  const bodyOpts = { size: 6.9, color: [124, 74, 12] as RGB, leading: 3.3 }
  const lines = wrapLines(doc, PAGE_DISCLAIMER, CW - 34, bodyOpts)
  const bandH = lines.length * bodyOpts.leading + 6
  const bandY = FOOTER_BAND_TOP

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)

    doc.setGState(new g.GState({ opacity: WATERMARK_OPACITY }))
    text(doc, 'PRELIMINARY', PAGE_W / 2, PAGE_H / 2 + 26, {
      size: 62, weight: 'bold', color: [90, 90, 84], align: 'center', angle: 32,
    })
    doc.setGState(new g.GState({ opacity: 1 }))

    fill(doc, C.amberSoft)
    doc.roundedRect(M, bandY, CW, bandH, 2, 2, 'F')
    accentEdge(doc, M, bandY, bandH, C.amber)
    text(doc, 'PRELIMINARY', M + 6, bandY + 5.6, { size: 6.2, weight: 'bold', color: C.amber, spacing: 0.4 })
    wrapped(doc, PAGE_DISCLAIMER, M + 28, bandY + 4.6, CW - 34, bodyOpts)

    text(doc, `Innovative Air Technologies  ·  Request for Quote ${meta.reference}`, M, PAGE_H - 12,
      { size: 7, color: C.inkMuted })
    text(doc, `Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 12, { size: 7, color: C.inkMuted, align: 'right' })
  }
  doc.setPage(1)
}

// ─── Small utilities ──────────────────────────────────────────────────────────

/**
 * A design-conditions row. When the customer answered in something other than
 * %rh, their own reading is appended to the label — their document should show
 * the number they typed, not only our conversion of it.
 */
/**
 * Where the outdoor design condition came from, as a sentence to append to the
 * design-conditions note. Empty when nobody looked it up — in which case the
 * figures are the customer's own or the template default, and claiming a source
 * would be worse than claiming none.
 */
function sourceNote(data: RfqData): string {
  return data.outdoorSource
    // The middot reads as a separator on screen and as noise in a sentence.
    ? ` Outdoor design conditions are ${san(data.outdoorSource.replace(/\s*·\s*/g, ", "))}.`
    : ''
}

function condRow(label: string, t: number, rh: number, elev: number, entered?: string): string[] {
  if (!t && !rh) return [label, '—', '—', '—', '—']
  const shown = entered && !entered.endsWith('% rh') ? `${label} (entered ${entered})` : label
  return [
    shown,
    `${fmt(t)}°F`,
    `${fmt(rh, rh < 10 ? 1 : 0)}%`,
    `${fmtGrains(grains(t, rh, elev))} gr/lb`,
    fmtDewPoint(dewPointF(t, rh, elev)),
  ]
}

/**
 * `"35 °F dp · "` when the answer came in a unit other than the canonical one,
 * otherwise empty — so a tile leads with the customer's own reading and follows
 * with our conversion, rather than silently replacing what they typed.
 */
function enteredPrefix(data: RfqData, key: Parameters<typeof conditionEntered>[1]): string {
  const entered = conditionEntered(data, key)
  const canonical = key === 'leaving' ? 'gr/lb' : '% rh'
  return entered === '—' || entered.endsWith(canonical) ? '' : `${entered} · `
}

function numOf(v: string): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function pct(part: number, whole: number): string {
  if (!whole) return '—'
  const p = (part / whole) * 100
  return p < 1 ? '<1%' : `${Math.round(p)}%`
}

function shortDriver(label: string): string {
  return label
    .replace('Permeation through walls, roof and floor', 'Envelope permeation')
    .replace('Air leakage through the shell', 'Shell air leakage')
    .replace('Doors and openings', 'Doors & openings')
    .replace('People in the space', 'People')
    .replace('Product, packaging and process', 'Product & process')
    .replace('Wet surfaces and open water', 'Open water')
}

function formatDate(v: string): string {
  if (!v) return ''
  const d = new Date(v + (v.length === 10 ? 'T12:00:00' : ''))
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Fetch a logo and downscale it through a canvas before embedding. The source
 * marks are 3020×3857 (1.4 MB); at the ~16 mm we draw them, 200 px is already
 * past 300 dpi, and it keeps the finished PDF near 200 KB instead of 4 MB.
 */
async function loadLogo(src: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('logo load failed'))
      img.src = src
    })
    const h = 200
    const w = Math.round((img.width / img.height) * h)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const cx = canvas.getContext('2d')
    if (!cx) return null
    cx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    // A missing logo must never stop someone getting their PDF.
    return null
  }
}

/**
 * The application render, as a JPEG data URL jsPDF can place.
 *
 * ⚠️ Three things here are not optional:
 *
 * 1. **JPEG, not PNG.** The assets are photographic 3D renders. loadLogo emits
 *    PNG because a flat two-color mark compresses to nothing that way; the same
 *    treatment on a render costs roughly a megabyte per PDF.
 * 2. **crossOrigin = 'anonymous'.** These come from the public `render-assets`
 *    bucket, a different origin. Without it the canvas is tainted and
 *    toDataURL() throws a SecurityError instead of returning anything. The
 *    bucket does send `Access-Control-Allow-Origin: *`, which is what makes this
 *    work at all — verified, not assumed.
 * 3. **jsPDF cannot read webp.** The bucket stores webp, so it has to go through
 *    a canvas regardless; that is the same hop that re-encodes it to JPEG.
 *
 * 860px wide is about 250 dpi in the ~87mm slot on the space page. Past that the
 * file grows and nothing looks better on paper.
 */
async function loadRoomRender(data: RfqData): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const asset = renderAsset('rooms', renderKeyForPreset(presetFor(data)?.key) ?? '')
  if (!asset) return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('render load failed'))
      img.src = renderAssetUrl(asset)
    })
    const w = 860
    const h = Math.round((img.height / img.width) * w)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const cx = canvas.getContext('2d')
    if (!cx) return null
    cx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return null
  }
}
