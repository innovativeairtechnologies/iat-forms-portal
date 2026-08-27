// ─── RFQ PDF ──────────────────────────────────────────────────────────────────
//
// Two documents in one file, and the split is deliberate:
//
//   Page 1     The TAKEAWAY. A single-page infographic of their own numbers —
//              what they asked for, where their moisture comes from, what happens
//              now, and who to talk to. Designed to survive being pinned to a wall.
//              Built FIRST because jsPDF cannot reorder pages.
//   Pages 2+   The RECORD. Everything the customer told us, laid out the way an
//              application engineer reads it. This is what our sales desk prints
//              and the customer forwards to their engineer.
//
// ⚠️ The record FLOWS (2026-08-26). Its sections used to take a page each, which is
// how a short survey still ran to five pages with a third of each one blank. They
// now continue on the current page when the next block fits — so EVERY block needs
// an ensure() reserve. An unguarded one does not wrap, it draws off the sheet.
//
// Vector throughout (jsPDF primitives, no html2canvas), so the file stays around
// 200 KB, prints crisply at any size, and the text is selectable and searchable.
//
// Runs in the browser only — it reaches for <canvas> to downscale the logo.

import {
  type LoadEstimate,
  type ProcessEstimate,
  type RfqData,
  TIGHTNESS_RATES,
  VAPOR_BARRIER_PERMS,
  type TightnessBand,
  type VaporClass,
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
  /** Left end of the header fade — the mark's green, deepened so white text holds. */
  brandGreenDeep: [30, 86, 49] as RGB,
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
  // The full-colour mark, for the header tiles. Transparent PNG, so it keeps its
  // alpha through the canvas hop and sits on the white tile rather than a box.
  const logoColor = await loadLogo('/iat-logo-transparent.png')

  // The application render, so the space page shows the room rather than only an
  // abstract box. Fetched in parallel with nothing else because it is the only
  // remote asset; it resolves to null for an unmapped application (indoor pool
  // has no artwork) and for any network or CORS failure, and every consumer
  // falls back to the drawn box. A picture must never cost someone their PDF.
  const roomImage = isRoom ? await loadRoomRender(data) : null

  const ctx: Ctx = { doc, data, meta, load, proc, logoLight, logoColor, isRoom, roomImage }

  // The takeaway leads. It used to close the document, but the person opening
  // this wants their own numbers first — the detail pages behind it are the
  // evidence, not the headline. jsPDF has no page-reorder, so it is simply built
  // first; the first page of a new document already exists, hence no addPage.
  takeawayPage(ctx, { first: true })
  // The record now FLOWS from the cover instead of one section per page — see
  // section(). Each returns the y it finished at, and the next decides from that
  // whether it fits underneath or needs a page.
  let y = coverPage(ctx, { newPage: true })
  y = isRoom ? spacePage(ctx, y) : processPage(ctx, y)
  if (isRoom) y = loadsPage(ctx, y)
  equipmentPage(ctx, y)

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
  /** Full-colour mark for the header tiles. See markTile. */
  logoColor: string | null
  isRoom: boolean
  /** JPEG data URL of the application render, or null. See loadRoomRender. */
  roomImage: string | null
}

// ─── Page 1 · Cover ───────────────────────────────────────────────────────────

function coverPage({ doc, data, meta, load, proc, logoLight, logoColor, isRoom }: Ctx, opts?: { newPage?: boolean }) {
  if (opts?.newPage) doc.addPage()
  paper(doc)

  // Header band — pine, with a ghosted mark bleeding off the right edge below
  // the reference chip (the two used to overlap).
  // 66 -> 48 (owner, 2026-08-26: fewer pages). Four lines of text did not need
  // sixty-six millimetres, and every millimetre here is one the record cannot use.
  gradientBand(doc, 0, 0, PAGE_W, 40, C.brandGreenDeep, C.brandNavy)
  ghostMark(doc, logoLight, PAGE_W - 26, 25, 21)

  // ⚠️ CENTRED ON THE TEXT BLOCK, NOT THE BAND. The type runs from the overline cap
  // (~8.7) to the second address line (~37.6) and centres at 23.1; the tile at y = 6
  // centred at 12.5 and sat visibly high. Move any of those lines and move this.
  markTile(doc, logoColor, M, 15, 13.5, 16)

  overline(doc, COMPANY.name.toUpperCase(), M + 17, 11, C.onNavyStrong)
  text(doc, 'Request for Quote', M + 17, 20, { size: 18, weight: 'bold', color: C.white })
  text(doc, `Moisture Survey · ${isRoom ? 'Room Dehumidification' : 'Process Dehumidification'}`,
    M + 17, 25.5, { size: 9, color: C.onNavy })

  // Address on the cover too, low in the band where the ghosted mark is faintest.
  // Same two lines as page 1, from the same constants — a document that prints two
  // different addresses is worse than one that prints none.
  //
  // 🔴 THESE WERE AT 48 AND 53.5 AND PRINTED OUTSIDE THE BAND. When the band came
  // down from 66mm to 48mm on 2026-08-26 the mark, title and subtitle were moved up
  // with it and these two were not, so they landed on white below the pine and read
  // as the address falling out of the header. Anything positioned here is measured
  // against the band height above — move one, move all of them.
  text(doc, companyAddressLine(), M + 17, 31.5, { size: 7.4, color: C.onNavy })
  text(doc, companyContactLine(), M + 17, 36, { size: 7.4, color: C.onNavy })

  // Reference chip, right
  const chipW = 52
  fill(doc, [255, 255, 255])
  doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.1 }))
  doc.roundedRect(PAGE_W - M - chipW, 9, chipW, 16, 2.5, 2.5, 'F')
  doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }))
  overline(doc, meta.submitted ? 'REFERENCE' : 'DRAFT PREVIEW', PAGE_W - M - chipW + 5, 15, C.onNavy)
  // ⚠️ A DRAFT NAMES THE PROJECT, not the reference. `meta.reference` is the string
  // "PREVIEW" before submission, which under a "DRAFT PREVIEW" overline printed the
  // word twice and told the reader nothing. Submitted documents still show the real
  // reference, which is the whole point of the chip.
  text(doc, truncate(doc, meta.submitted ? meta.reference : (data.projectName || 'Untitled project'), chipW - 10, 10.5),
    PAGE_W - M - chipW + 5, 21.5, { size: 10.5, weight: 'bold', color: C.white })
  text(doc, meta.submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    PAGE_W - M, 31.5, { size: 8, color: C.onNavy, align: 'right' })

  // Project identity
  let y = 50
  overline(doc, 'PROJECT', M, y, C.inkMuted)
  y += 6.5
  // wrapped() returns the next free baseline, so a two-line project name pushes
  // the tags down instead of printing on top of them.
  y = wrapped(doc, data.projectName || 'Untitled project', M, y, CW - 4, {
    size: 17, weight: 'bold', color: C.ink, leading: 7.6,
  })
  y += 2

  const appLabel = applicationLabel(data)
  tag(doc, appLabel, M, y, C.greenSoft, [7, 100, 52])
  if (data.location) tag(doc, data.location, M + textW(doc, appLabel, 8.5, 'bold') + 14, y, C.paper, C.inkSoft)
  y += 11

  // ⚠️ "What we're protecting: <driver>" printed here and was removed on 2026-08-27.
  // presetFor() went with it - the application tag reads applicationLabel(), not the
  // preset, so nothing on this page needs it any more.

  // ⚠️ "AT A GLANCE" AND THE TWO KEY PANELS WERE HERE (owner, 2026-08-26: get the
  // document to two or three pages).
  //
  // The tile row went because it was the third telling of the same numbers — the
  // takeaway page opens with YOUR TARGET CONDITION and WHERE YOUR MOISTURE COMES
  // FROM, which is the target condition and the dominant driver already.
  //
  // WHO TO TALK TO and PROJECT DETAIL moved to the takeaway page, into the space
  // the removed panels left there. Nothing was dropped: contactRows/projectRows
  // now live in contactPanels(), called from takeawayPage().
  if (data.purpose) {
    softPanel(doc, M, y, CW, 0, C.paper)
    const inner = wrapped(doc, data.purpose, M + 6, y + 10.5, CW - 12, { size: 9.5, color: C.inkSoft, leading: 5 })
    const boxH = inner - y + 3
    softPanel(doc, M, y, CW, boxH, C.paper)
    accentEdge(doc, M, y, boxH, C.green)
    overline(doc, 'IN THEIR WORDS', M + 6, y + 7, C.inkMuted)
    wrapped(doc, data.purpose, M + 6, y + 12, CW - 12, { size: 9.5, color: C.inkSoft, leading: 5 })
    y += boxH
  }
  return y
}

/**
 * WHO TO TALK TO + PROJECT DETAIL, side by side. Lived on the cover until
 * 2026-08-26; drawn on the takeaway page now. Returns the height it used.
 */
function contactPanels(ctx: Ctx, y: number): number {
  const { doc, data } = ctx
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
    ['Elevation', data.elevationFt ? fmt(numOf(data.elevationFt)) + ' ft above sea level' : ''],
    // No longer asked (2026-08-27). Kept for surveys taken before that, and
    // dropped from the panel entirely when blank rather than printing an empty row.
    ...(data.dateRequired ? [['Quote needed by', formatDate(data.dateRequired)] as [string, string]] : []),
    ['Expected order', formatDate(data.dateClose)],
    ['Engineering firm', data.engineeringFirm],
    ['Engineer contact', data.engineerContact],
  ]
  const h = Math.max(panelHeight(contactRows.length), panelHeight(projectRows.length))
  keyPanel(doc, 'WHO TO TALK TO', contactRows, M, y, colW, h)
  keyPanel(doc, 'PROJECT DETAIL', projectRows, M + colW + 6, y, colW, h)
  return h
}

// ─── Page 2 · The space (room track) ──────────────────────────────────────────

function spacePage(ctx: Ctx, startY: number): number {
  const { doc, data, load, roomImage } = ctx
  // 62 is cardH below — the room card is drawn first and does not split.
  let y = section(ctx, startY, 62, 'The space', 'Geometry, envelope and design conditions')

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
  // 76 -> 62 (owner, 2026-08-26). The render still fills the column width; what
  // went was the air under it.
  const cardH = 62

  card(doc, M, y, diagW, cardH)
  // Volume mode has no measured length/width, so the heading has to stop claiming
  // these were dimensions someone gave us. roomDims() supplies the derived pair.
  const g = roomDims(data)
  const derived = roomDimsAreDerived(data)
  overline(doc, derived ? 'ROOM SIZE (FROM VOLUME)' : 'ROOM DIMENSIONS', M + 6, y + 8, C.inkMuted)
  roomDiagram(doc, M + 6, y + 12, diagW - 12, 46, g.L, g.W, g.H, roomImage)

  const vol = load?.volumeCuFt ?? 0
  const floorArea = g.L * g.W
  const wallArea = 2 * (g.L + g.W) * g.H
  keyPanel(doc, 'THE NUMBERS', [
    ['Floor area', floorArea ? `${fmt(floorArea)} sq.ft` : ''],
    ['Wall area', wallArea ? `${fmt(wallArea)} sq.ft` : ''],
    ['Volume', vol ? `${fmt(vol)} cu.ft` : ''],
    ['Envelope total', floorArea ? `${fmt(wallArea + floorArea * 2)} sq.ft` : ''],
  ], factsX, y, factsW, cardH)
  // cardH still has to be cleared — it is what moves y PAST the two cards. Only
  // the trailing gap came down (5 → 1), because subhead() now draws a rule that
  // does the separating.
  y += cardH + 1

  // Design conditions — the table an engineer looks for first
  const elev = numOf(data.elevationFt)
  const rows: string[][] = [
    condRow('Inside the room (target)', numOf(data.targetTempF), numOf(data.targetRhPct), elev, conditionEntered(data, 'target')),
    condRow('Surrounding space', numOf(data.surroundTempF), numOf(data.surroundRhPct), elev, conditionEntered(data, 'surround')),
    condRow('Outdoor summer design', numOf(data.outdoorTempF), numOf(data.outdoorRhPct), elev, conditionEntered(data, 'outdoor')),
  ]
  // ⚠️ GUARD ADDED 2026-08-26. Before the record flowed, every section began at
  // y = 46 on a page of its own, so this block could not overflow. It can now -
  // and an unguarded block does not wrap, it draws straight off the bottom of the
  // sheet. The first run after the change put this one at y = 282.8 on a 279.4mm
  // page. EVERY block in a flowing section needs a reserve.
  // 4 below the overline, the table, then the note and its air: measured at 21.
  // ⚠️ RESERVE THE START, NOT THE WHOLE TABLE. table() splits across pages now,
  // so booking its full height would send it to a fresh page and leave this one
  // ending in white — the behaviour removed on 2026-08-27. Header plus two rows.
  y = subhead(ctx, y, 'DESIGN CONDITIONS', tableH(2), 'The space', 'Design conditions')
  y = table(ctx, M, y, CW,
    ['Condition', 'Dry bulb', 'Rel. humidity', 'Grains', 'Dew point'],
    rows, [0.4, 0.15, 0.15, 0.15, 0.15], { title: 'The space', sub: 'Design conditions' })
  y += 3
  // Same guard and the same reason as the process track: this note carries
  // sourceNote(), which grows with the station string, and had no reserve.
  const condNote = `Loads scale with the difference in grains between inside and out, not with relative humidity, which means a different amount of water at every temperature.${sourceNote(data)}`
  y = ensure(ctx, y, noteH(doc, condNote, CW), 'The space', 'Design conditions')
  y = note(doc, condNote, M, y, CW)
  y += 4

  // Envelope
  // Tightness sets the whole infiltration line (Loose is 6× Tight) and used to be
  // recorded nowhere on the document — only inside a breakdown-bar caption. The
  // rate is spelled out because the band name alone does not say what was assumed.
  // ⚠️ MIRRORS estimateLoad EXACTLY, down to reading the typed figure only when
  // 'Custom' is the selected band. If these two ever disagree the document prints
  // one assumption and the quote is built on another.
  const typedRate = data.tightness === 'Custom' ? numOf(data.tightnessCustom) : 0
  const leakRate = typedRate > 0
    ? typedRate
    : TIGHTNESS_RATES[data.tightness as TightnessBand] ?? TIGHTNESS_RATES.Average
  // Same three-way read as estimateLoad: a class from the table, the typed figure
  // when 'Custom' is chosen, and nothing for None or unanswered.
  const retarderPerm = data.vaporBarrier === 'Custom'
    ? numOf(data.vaporBarrierCustom)
    : data.vaporBarrier === 'None' || !data.vaporBarrier ? 0
      : VAPOR_BARRIER_PERMS[data.vaporBarrier as VaporClass] ?? 0
  const envelopeRows: string[][] = [
    ['Walls', data.wallMaterial],
    ['Roof / ceiling', data.ceilingMaterial],
    ['Floor', data.floorMaterial],
    ['Vapor retarder', retarderPerm > 0
      ? `${data.vaporBarrier} — ${retarderPerm.toFixed(2)} grains/hr/sq.ft/inHg`
      : data.vaporBarrier === 'None' ? 'None — no retarder credited'
        : 'Not stated — no retarder credited'],
    ['Space around the room', data.surroundSource === 'outdoor'
      ? 'Outside air — the outdoor design condition'
      : data.surroundSource === 'manual'
        ? 'Box in a box — surrounded by another conditioned space'
        : 'Not stated'],
    ['Building tightness', `${typedRate > 0 ? 'Entered' : data.tightness} — ${leakRate} cu.ft/hr per sq.ft of exterior wall`],
  ]
  // ⚠️ REWRITTEN 2026-08-27. This used to reserve the whole table and carried a
  // long note about not over-reserving, because over-reserving emitted a near-empty
  // continuation page. table() SPLITS now, so the trade-off is gone: reserve the
  // start — the 4mm under the overline plus a header and two rows — and let the
  // table run onto the next page mid-way if that is where it ends up.
  //
  // tableH() already allows for the header row, so the count passed is DATA rows.
  y = subhead(ctx, y, 'CONSTRUCTION & ENVELOPE', tableH(2), 'The space', 'Construction and envelope')
  y = table(ctx, M, y, CW, ['Element', 'Material / rating'], envelopeRows, [0.34, 0.66], { title: 'The space', sub: 'Construction and envelope' })
  y += 5

  // Openings
  // Doors used to close this page. They now open the load page instead — they
  // are almost always the dominant load, so they belong beside the breakdown
  // that says so rather than filed under geometry. It also stops a two-door
  // survey from spilling a near-empty continuation page out of this one.
  return y
}

// ─── Page 2 · The process (process track) ─────────────────────────────────────

function processPage(ctx: Ctx, startY: number): number {
  const { doc, data, proc } = ctx
  // The leaving-air card is 42 plus its 8 of air below.
  let y = section(ctx, startY, 50, 'The process', 'Leaving-air specification and airstream')
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
  // +45, not +50: the card is 42 tall and subhead() draws a rule under it, so
  // the 8mm of trailing air that used to do the separating is no longer needed.
  y += 45

  // ⚠️ GUARD ADDED 2026-08-26. Before the record flowed, every section began at
  // y = 46 on a page of its own, so this block could not overflow. It can now -
  // and an unguarded block does not wrap, it draws straight off the bottom of the
  // sheet. The first run after the change put this one at y = 282.8 on a 279.4mm
  // page. EVERY block in a flowing section needs a reserve.
  y = subhead(ctx, y, 'THE AIRSTREAM', tableH(2), 'The process', 'The airstream')
  y = table(ctx, M, y, CW, ['Parameter', 'Value'], [
    ['Process airflow', data.processCfm ? `${fmt(numOf(data.processCfm))} cfm` : '—'],
    ['Air source', data.airSource + (data.mixOutdoorPct ? ` (${data.mixOutdoorPct}% outdoor air)` : '')],
    ['Entering air (estimated)', proc ? `${fmtGrains(proc.enteringGrains)} gr/lb` : '—'],
    ['Grain depression required', proc ? `${fmtGrains(proc.depression)} gr/lb` : '—'],
    ['Water removed (estimated)', proc?.complete ? `${fmt(proc.lbPerHr, 1)} lb/hr  ·  ${fmt(proc.lbPerHr * 24 * 0.9586)} pints per day` : '—'],
  ], [0.4, 0.6], { title: 'The process', sub: 'The airstream' })
  // +4, not +9: subhead()'s rule separates this from the block above.
  y += 4

  y = subhead(ctx, y, 'DESIGN CONDITIONS', tableH(2), 'The process', 'Design conditions')
  y = table(ctx, M, y, CW,
    ['Condition', 'Dry bulb', 'Rel. humidity', 'Grains', 'Dew point'],
    [
      condRow('Return / room air', numOf(data.surroundTempF), numOf(data.surroundRhPct), elev, conditionEntered(data, 'surround')),
      condRow('Outdoor summer design', numOf(data.outdoorTempF), numOf(data.outdoorRhPct), elev, conditionEntered(data, 'outdoor')),
    ], [0.4, 0.15, 0.15, 0.15, 0.15], { title: 'The process', sub: 'Design conditions' })
  y += 3
  // Hoisted: the reserve and the draw must measure the SAME string, and a nested
  // template in an argument list is how generated edits to this file break.
  const procNote = `A desiccant wheel is sized on the grain depression it has to deliver, not on relative humidity. Where a specification is written as a dew point, that is the number we design to.${sourceNote(data)}`
  // ⚠️ RESERVE IT. This note had no guard and drew wherever y landed. At HEAD it
  // finished flush against the disclaimer band, so a longer sourceNote() — a
  // distant ASHRAE station makes that string longer — would have run under it.
  y = ensure(ctx, y, noteH(doc, procNote, CW), 'The process', 'Design conditions')
  y = note(doc, procNote, M, y, CW)
  y += 6

  if (data.purpose || data.notes) {
    // Free text, so measure it rather than reserve a guess.
    y = ensure(ctx, y, SUBHEAD_H + wrapLines(doc, [data.purpose, data.notes].filter(Boolean).join(' '), CW, { size: 9.5 }).length * 5,
      'The process', 'Process notes')
    y = subheadAt(ctx, y, 'PROCESS NOTES')
    y = wrapped(doc, [data.purpose, data.notes].filter(Boolean).join('\n\n'), M, y, CW, { size: 9.5, color: C.inkSoft, leading: 5 })
  }
  return y
}

// ─── Page 3 · Loads (room track) ──────────────────────────────────────────────

function loadsPage(ctx: Ctx, startY: number): number {
  const { doc, data, load } = ctx
  if (!load) return startY
  // The doors table is first, and an empty survey still draws one row.
  // Header plus two rows — the doors table splits, so a long one no longer has to
  // start on a page of its own.
  // ⚠️ SUBHEAD_H, not 4. The first thing under this heading is a subhead() and
  // then the doors table, so the reserve has to cover both — otherwise the
  // section header strands at the foot of a page with its content overleaf, which
  // is exactly what it did on the first render after subheads went in.
  let y = section(ctx, startY, SUBHEAD_H + tableH(2),
    'Where the moisture comes from', 'Openings, internal loads and the preliminary estimate')

  y = subhead(ctx, y, 'DOORS & OPENINGS', tableH(2), 'Where the moisture comes from', 'Doors and openings')
  if (data.doors.length) {
    y = table(ctx, M, y, CW,
      ['Opening', 'Size', 'Opens/hr', 'Seconds open', 'Opens onto'],
      data.doors.map(d => [
        d.label,
        `${fmt(d.widthFt)} × ${fmt(d.heightFt)} ft`,
        // A continuously-open aperture has no cycle to report — printing the stored
        // opensPerHour/secondsOpen here would contradict the load it was charged.
        d.continuouslyOpen ? 'Continuous' : fmt(d.opensPerHour),
        d.continuouslyOpen ? '—' : fmt(d.secondsOpen),
        d.exposure,
      ]), [0.32, 0.16, 0.14, 0.18, 0.2], { title: 'Where the moisture comes from', sub: 'Doors and openings' })
  } else {
    y = emptyRow(doc, M, y, CW, 'No doors or openings recorded.')
  }
  y += 3

  // ⚠️ GUARD ADDED 2026-08-26. Before the record flowed, every section began at
  // y = 46 on a page of its own, so this block could not overflow. It can now -
  // and an unguarded block does not wrap, it draws straight off the bottom of the
  // sheet. The first run after the change put this one at y = 282.8 on a 279.4mm
  // page. EVERY block in a flowing section needs a reserve.
  y = subhead(ctx, y, 'INTERNAL LOADS RECORDED', tableH(2), 'Where the moisture comes from', 'Internal loads')
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

  y = table(ctx, M, y, CW, ['Source', 'What you told us'], [
    // Numeric test, not truthiness: occupants defaults to the STRING '0' since
    // 2026-08-26, which is truthy and would have printed "0 × " with no activity.
    ['People', Number(data.occupants) > 0 ? `${data.occupants} × ${data.activity.toLowerCase()}` : 'None recorded'],
    ['Product / process moisture', data.productLoadLbHr ? `${data.productLoadLbHr} lb of water per hour${data.productDescription ? ` (${data.productDescription})` : ''}` : 'None recorded'],
    ['Unvented combustion', data.gasCfh ? `${data.gasCfh} cu.ft/hr of gas` : 'None recorded'],
    ['Open water / wet surfaces', data.wetAreaSqFt ? `${data.wetAreaSqFt} sq.ft at ${data.wetWaterTempF}°F` : 'None recorded'],
    ['Ventilation air in', data.ventCfm ? `${fmt(numOf(data.ventCfm))} cfm · ${ventDetail}` : 'None recorded'],
    // The condition rides on the exhaust row instead when exhaust is what drives the
    // make-up air — estimateLoad takes max(vent, exhaust), so either can be the term.
    ['Exhaust air out', data.exhaustCfm
      ? `${fmt(numOf(data.exhaustCfm))} cfm${data.ventCfm ? '' : ` · ${ventDetail}`}`
      : 'None recorded'],
  ], [0.34, 0.66], { title: 'Where the moisture comes from', sub: 'Internal loads' })
  y += 4

  // Overline plus two bars. The bars split now, so booking the whole block is what
  // used to leave up to 53mm blank at the foot of a page.
  y = subhead(ctx, y, 'ESTIMATED BREAKDOWN', 2 * 9.4, 'Where the moisture comes from', 'Estimated breakdown')
  y = loadBars(ctx, M, y, CW, load, { title: 'Where the moisture comes from', sub: 'Estimated breakdown' })
  y += 3

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
  // The tiles do not split, so they carry their own reserve now the bars no longer
  // book one on their behalf.
  y = ensure(ctx, y, 24 + 12, 'Where the moisture comes from', 'Estimated totals')
  y = tileRow(doc, totals, M, y, CW)
  y += 3

  // ⚠️ CONDITIONAL, because the old sentence is FALSE for a room-load survey — it
  // asserted the opposite of what that survey had just been charged.
  text(doc, load.ventTarget === 'room'
      ? 'Makeup air is counted inside the room load here, because it is delivered into the space untreated. That is why the dry air figure is higher than the internal sources alone would suggest.'
      : 'Ventilation air is carried separately on purpose: the dehumidifier dries it before it reaches the room, so folding it into the room total would oversize the system.',
    M, y + 4, { size: 7, color: C.inkMuted })
  // The old rose "PRELIMINARY ESTIMATE" panel lived here. It is gone because
  // stampEveryPage() now prints the disclaimer on every page — two copies on
  // this one page would read as boilerplate rather than as a caution.
  // +10 clears the note drawn at y + 4 just above.
  return y + 10
}

// ─── Page 4 · Equipment & utilities ───────────────────────────────────────────

function equipmentPage(ctx: Ctx, startY: number): number {
  const { doc, data } = ctx
  // panelHeight(5) = 54 — the two key panels are the first block and sit side by side.
  let y = section(ctx, startY, 54, 'Equipment & utilities', 'Everything that shapes the unit we quote')

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
  y += h + 3

  y = subhead(ctx, y, 'AIR TREATMENT', tableH(2), 'Equipment & utilities', 'Air treatment')
  y = table(ctx, M, y, CW, ['Item', 'Selection'], [
    ['Regeneration air source', data.regenAirSource + (data.regenIndoorConditions ? ` (${data.regenIndoorConditions})` : '')],
    ['Pre-filter', data.prefilterMerv],
    ['Final filter', data.finalMerv],
    ['Cooling', data.coolingType],
    ['Heating', data.heatingType],
    ['Sensible load (if known)', data.sensibleLoadBtuh ? `${fmt(numOf(data.sensibleLoadBtuh))} BTU/hr` : 'Not stated'],
    ...(ctx.isRoom ? [] : [['Air source', data.airSource] as [string, string]]),
  ], [0.34, 0.66], { title: 'Equipment & utilities', sub: 'Air treatment' })
  y += 4

  if (data.notes) {
    // Free text, so measure it rather than reserve a guess.
    // +2 rather than +6: this is the last block in the document, so trailing air
    // here buys nothing and can cost a whole page.
    y = ensure(ctx, y, SUBHEAD_H + wrapLines(doc, data.notes, CW, { size: 9.5 }).length * 5 + 2,
      'Equipment & utilities', 'Additional notes')
    y = subheadAt(ctx, y, 'ADDITIONAL NOTES')
    y = wrapped(doc, data.notes, M, y, CW, { size: 9.5, color: C.inkSoft, leading: 5 })
    y += 6
  }

  // ⚠️ THE "NOTES FROM OUR ENGINEERING TEAM" PANEL WAS HERE and was removed on
  // 2026-08-27 to shorten the document. It carried four standing notes from IAT
  // paper quote request - freeze protection, DX vs chilled water, the vapor
  // retarder classes and a request for drawings - roughly 45mm of identical text
  // on every survey ever produced.
  //
  // Recoverable from git if it is wanted back: it read from a local `notes` array
  // and nothing else referenced it.
  return y
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
  bars: 40,
  next: 52,     // what happens now - full width since the ref table went
  gap: 3,
}
// 24+3 +46+3 +40+3 +52 = 171, comfortably clear of FOOTER_BAND_TOP (246.4).
//
// It used to be 218. The formula panel (34), the reference table that shared a row
// with "what happens next" (45) and the closing strip (14) came out on 2026-08-26,
// and "what happens next" grew from 45 to 52 taking the full width. The slack is
// deliberate - this page is a summary, and the room at the foot of it is what stops
// it reading like a form.
//
// The amber headline band (17 + 3) came out on 2026-08-25 with the load figure it
// carried, which is where the extra ~20mm of slack came from. Kept as slack rather
// than redistributed: this page's whole guarantee is that it never runs to two
// pages, and nothing here reflows.

function takeawayPage(ctx: Ctx, opts?: { first?: boolean }) {
  const { doc, data, load, proc, logoLight, logoColor, isRoom, roomImage } = ctx
  if (!opts?.first) doc.addPage()
  paper(doc, C.white)

  // Title block
  gradientBand(doc, 0, 0, PAGE_W, T.band, C.brandGreenDeep, C.brandNavy)
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
  // ⚠️ CENTRED ON THE TEXT BLOCK. The overline cap sits near 5.7 and the project
  // line descends to about 22, centring at 13.9; y = 4 put the tile at 11.7.
  markTile(doc, logoColor, M, 6.2, 12, 15.3)
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
  // ⚠️ A two-line caption explaining the four units sat here and was removed on
  // 2026-08-27. The four figures speak for themselves at this size.

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

  // ⚠️ PANEL 3 "THE MATH BEHIND YOUR NUMBER" WAS HERE, and was REMOVED on
  // 2026-08-26 at the owner request, together with panel 5 "TYPICAL TARGET
  // CONDITIONS" and the closing "ONE NUMBER TO REMEMBER" strip.
  //
  // formulaLine(), which drew the substituted equation, went with it rather than
  // being left as dead code. It is in git history if the working ever comes back.
  //
  // The surviving panels were RENUMBERED 1-2-3-4. The numbers are on the page in
  // front of the reader, so a gap in them reads as a missing section.

  // ── Where the moisture comes from · or the five system types ──
  if (isRoom && load && load.lines.length) {
    panelHead(doc, M, y, CW, T.bars, '3', 'WHERE YOUR MOISTURE COMES FROM', C.teal, C.tealSoft)
    miniBars(doc, M + 7, y + 15, CW - 14, load)
  } else {
    panelHead(doc, M, y, CW, T.bars, '3', 'THE FIVE KINDS OF DESICCANT SYSTEM', C.teal, C.tealSoft)
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

  // ── What happens now · full width, the reference table beside it having gone ──
  //
  // This was the five-step Chapter-7 design procedure. Replaced 2026-08-26 with a
  // thank-you and the one commitment worth making at this point: a human, soon.
  panelHead(doc, M, y, CW, T.next, '4', 'WHAT HAPPENS NOW', C.green, C.greenSoft)
  const nextBody = [
    "Thank you for taking the time to put this together. Everything on these pages is now with our "
    + "application engineers, and it is exactly the detail that lets us size this properly rather than "
    + "estimate around the gaps.",
    "Someone from IAT will be in touch within one business day to talk it through, answer anything you "
    + "are unsure of, and confirm the details before any equipment is selected.",
  ]
  let ny = y + 18
  for (const para of nextBody) {
    ny = wrapped(doc, para, M + 8, ny, CW - 16, { size: 9.2, color: C.inkSoft, leading: 5 }) + 3.5
  }
  y += T.next + T.gap

  // ── Who to talk to · project detail ──
  // Moved here from the cover on 2026-08-26. They fit in the room the removed
  // formula panel and reference table left behind, and putting them on the page
  // the customer actually keeps is where they were always most use.
  contactPanels(ctx, y)
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
const tableH = (rows: number) => 7 + rows * 6.4

/**
 * Start a section of the flowing record.
 *
 * ⚠️ EACH OF THESE USED TO FORCE A PAGE OF ITS OWN, which is how a survey with two
 * doors and no notes still ran to five pages with a third of each one empty. A
 * section now CONTINUES the current page when the block that follows will fit, and
 * only takes a fresh page when it will not — so the document is as long as the
 * survey is, not as long as the list of headings. (Owner, 2026-08-26: get it to
 * two or three pages.)
 *
 * `needed` is the height of the FIRST block after the heading, measured the same
 * way ensure() wants it. Under-state it and a heading can strand itself at the
 * foot of a page with its content overleaf — the one failure mode here.
 */
function section(ctx: Ctx, y: number, needed: number, title: string, sub: string): number {
  const HEAD = 11
  if (y + HEAD + needed > CONTENT_BOTTOM) {
    newPage(ctx, title, sub)
    return 46
  }
  const { doc } = ctx
  const top = y + 5
  // A quiet inline heading rather than a second full-width band: the page already
  // carries one at its top, and two of them read as two documents.
  fill(doc, C.brandGreenDeep)
  doc.roundedRect(M, top - 4.6, 2.4, 10.4, 1.2, 1.2, 'F')
  text(doc, title, M + 6.5, top + 1, { size: 12, weight: 'bold', color: C.ink })
  text(doc, sub, M + 6.5, top + 6.4, { size: 7.6, color: C.inkMuted })
  return top + 10
}

/**
 * Height a subhead() occupies, from its rule down to the first line of content.
 * Rule at yy, label baseline at yy + 5.2 (cap top 2.9mm clear of the rule),
 * content 3.4mm under the baseline — the same air the bare overline left.
 */
const SUBHEAD_H = 8.6

/**
 * Opens a sub-section INSIDE a section(): a hairline across the column with a
 * short accent over its left end, then the small-caps label beneath it.
 *
 * These were bare `overline()` calls with 3–4mm under them, which put a 6.6pt
 * grey label in open space between two tables. It read as a caption on the table
 * ABOVE rather than a heading for the one below, and directly under a section()
 * header the two collided (owner, 2026-08-27: make each section look more
 * separate).
 *
 * ⚠️ IT RESERVES ITS OWN HEIGHT. `needed` is the first block AFTER the label,
 * measured the way ensure() wants it — so pass `tableH(n)`, not `4 + tableH(n)`;
 * the 4 that used to be added by hand is inside SUBHEAD_H now. Under-state it and
 * a heading strands at the foot of a page with its table overleaf.
 *
 * ⚠️ THE CALLERS' GAPS CAME DOWN WHEN THIS WENT IN. The rule now does the
 * separating that whitespace alone was doing, so the `y += 3..5` before each of
 * these was cut to +1. This document was squeezed from five pages to four on
 * 2026-08-27 and must not grow back — if you add height here, take it out of the
 * gaps, and re-render before believing it fits.
 */
function subhead(ctx: Ctx, y: number, label: string, needed: number, title: string, sub: string): number {
  return subheadAt(ctx, ensure(ctx, y, SUBHEAD_H + needed, title, sub), label)
}

/**
 * subhead() without the reserve — for the two free-text blocks that measure their
 * own wrapped height and call ensure() themselves. They must book SUBHEAD_H for
 * this heading in that reserve; passing the old hand-written 5 leaves it 3.6mm
 * short and can strand the label.
 */
function subheadAt(ctx: Ctx, y: number, label: string): number {
  const { doc } = ctx
  stroke(doc, C.hair)
  doc.setLineWidth(0.2)
  doc.line(M, y, M + CW, y)
  // The company's green over the left of the rule — the section() bar's accent at
  // sub-section weight, so the two headings read as one system rather than two.
  fill(doc, C.brandGreenDeep)
  doc.rect(M, y - 0.3, 11, 0.6, 'F')
  // inkSoft, not inkMuted: at 6.6pt the muted grey disappeared against the tables.
  overline(doc, label, M, y + 5.2, C.inkSoft)
  return y + SUBHEAD_H
}

function newPage(ctx: Ctx, title: string, sub: string) {
  const { doc } = ctx
  doc.addPage()
  paper(doc)
  gradientBand(doc, 0, 0, PAGE_W, 30, C.brandGreenDeep, C.brandNavy)
  // ⚠️ THE MARK IS CENTRED ON THE TEXT BLOCK, NOT ON THE BAND. The title sits at
  // 16 and the sub at 22.5, so the type runs roughly 11 to 24 and centres at 17.7.
  // At y = 7 the tile centred at 14 and read as sitting high. Move the type, move
  // this with it.
  markTile(doc, ctx.logoColor, M, 10.7, 11, 14)
  text(doc, title, M + 16, 16, { size: 14, weight: 'bold', color: C.white })
  text(doc, sub, M + 16, 22.5, { size: 8.5, color: C.onNavy })
  // Same reasoning as the cover chip: before submission `meta.reference` is the
  // literal string "PREVIEW", which sat directly above the project name and said
  // nothing. A draft is labelled as one; a submitted document carries its reference.
  text(doc, ctx.meta.submitted ? ctx.meta.reference : 'DRAFT', PAGE_W - M, 16,
    { size: 9, weight: 'bold', color: C.onNavy, align: 'right' })
  // The project name on EVERY page (owner, 2026-08-27), so a sheet that gets
  // separated from the rest can still be identified. Truncated against the space
  // left by the title on the same line.
  text(doc, truncate(doc, ctx.data.projectName || 'Untitled project', CW * 0.42, 8), PAGE_W - M, 22.5,
    { size: 8, color: C.onNavy, align: 'right' })
}

/**
 * A large, ghosted IAT mark bleeding off the right edge of a header band.
 * Earlier this was three abstract rounded bars standing in for the swoosh; they
 * read as blobs and collided with the reference chip. The real mark at 8% is
 * both more on-brand and impossible to mistake for content.
 */
/**
 * A horizontal fade, drawn as interpolated strips.
 *
 * jsPDF has no linear-gradient primitive, so this is the standard workaround:
 * lay down N thin rectangles stepping the colour from `from` to `to`. 0.6mm
 * strips over a letter width is ~360 rects per band — invisible seams, and a few
 * KB once the content stream is compressed.
 *
 * ⚠️ Each strip is drawn 0.15mm WIDER than its step. Butt-jointed rectangles leave
 * hairline gaps where the rasteriser rounds to device pixels, which prints as fine
 * vertical lines across the band — visible on paper, easy to miss on screen.
 */
function gradientBand(doc: Doc, x: number, y: number, w: number, h: number, from: RGB, to: RGB) {
  const step = 0.6
  const n = Math.max(1, Math.ceil(w / step))
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1)
    fill(doc, [
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ] as RGB)
    doc.rect(x + i * step, y, step + 0.15, h, 'F')
  }
}

/**
 * The full-colour mark on a white tile.
 *
 * ⚠️ THE TILE IS NOT DECORATION. The mark is green → silver → blue; on a green-to-
 * navy band its own colours sit within a few shades of the field behind it and it
 * disappears. The white tile is what lets the colour logo be used at all — the
 * alternative is the white knockout, which is what this replaced.
 */
function markTile(doc: Doc, logo: string | null, x: number, y: number, w: number, h: number) {
  const pad = 2.2
  fill(doc, C.white)
  doc.roundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 1.8, 1.8, 'F')
  if (logo) doc.addImage(logo, 'PNG', x, y, w, h)
}

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
  // 30 -> 26 (owner, 2026-08-27: less dead space). The sub-line is capped at two
  // lines at 2.9 leading and sits at y + 23, so 26 still clears it.
  const h = 24
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
  let ry = y + 12.5
  for (const [k, v] of rows) {
    text(doc, k, x + 6, ry, { size: 7.6, color: C.inkMuted })
    text(doc, truncate(doc, v || '—', w - 12 - 34, 8.4), x + 34, ry, { size: 8.4, weight: v ? 'bold' : 'normal', color: v ? C.ink : C.inkMuted })
    ry += 6.4
  }
}

const panelHeight = (rows: number) => 12.5 + rows * 6.4

/**
 * A table that SPLITS ACROSS PAGES rather than jumping to the next one whole.
 *
 * 🔴 THIS IS WHY THE PAGES USED TO END IN WHITE SPACE. A table was atomic: if the
 * remaining room could not hold all of it, ensure() sent the entire block to a
 * fresh page and left whatever was left of the current one blank — 20 to 35mm at
 * the foot of most pages, four times over. It now draws as many rows as fit, takes
 * a page, repeats the header and carries on.
 *
 * ⚠️ The caller's ensure() reserve must therefore be SMALL — header plus a row or
 * two, enough that starting here is not absurd — not the whole table. Reserving the
 * full height reintroduces exactly the behaviour this removes.
 */
function table(
  ctx: Ctx, x: number, y: number, w: number,
  head: string[], rows: string[][], widths: number[],
  cont: { title: string; sub: string },
): number {
  const { doc } = ctx
  const rowH = 6.4
  const headH = 7

  const drawHead = (hy: number) => {
    fill(doc, C.paper)
    doc.roundedRect(x, hy, w, headH, 2, 2, 'F')
    doc.rect(x, hy + headH - 2, w, 2, 'F')
    let cx = x + 4
    head.forEach((hd, i) => {
      text(doc, hd.toUpperCase(), cx, hy + 4.9, { size: 6.3, weight: 'bold', color: C.inkMuted, spacing: 0.3 })
      cx += widths[i] * w
    })
  }
  const close = (top: number, bottom: number) => {
    stroke(doc, C.hair)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, top, w, bottom - top, 2, 2, 'D')
  }

  let top = y
  drawHead(top)
  let ry = top + headH

  rows.forEach((r, ri) => {
    // No room for another row: close this fragment, take a page, repeat the header.
    if (ry + rowH > CONTENT_BOTTOM) {
      close(top, ry)
      newPage(ctx, `${cont.title} (continued)`, cont.sub)
      top = 46
      drawHead(top)
      ry = top + headH
    }
    if (ri % 2 === 1) {
      fill(doc, [252, 251, 249])
      doc.rect(x, ry, w, rowH, 'F')
    }
    hair(doc, x, ry, x + w, ry)
    let tx = x + 4
    r.forEach((cell, ci) => {
      const cellW = widths[ci] * w - 5
      text(doc, truncate(doc, cell || '—', cellW, 8), tx, ry + 4.6, {
        size: 8,
        weight: ci === 0 ? 'bold' : 'normal',
        color: cell ? (ci === 0 ? C.ink : C.inkSoft) : C.inkMuted,
      })
      tx += widths[ci] * w
    })
    ry += rowH
  })

  close(top, ry)
  return ry
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

/**
 * The breakdown bars. SPLITS ACROSS PAGES, same reasoning as table(): this was the
 * largest atomic block left at ~78mm, and on a short survey it jumped a whole page
 * and left 53mm blank behind it.
 */
function loadBars(ctx: Ctx, x: number, y: number, w: number, load: LoadEstimate, cont: { title: string; sub: string }): number {
  const { doc } = ctx
  const pitch = 9.4
  const max = Math.max(...load.lines.map(l => l.grainsPerHour), 1)
  const totalRaw = load.lines.reduce((s, l) => s + l.grainsPerHour, 0) || 1
  const labelW = 62
  const valueW = 34
  const barW = w - labelW - valueW
  let ry = y
  const sorted = [...load.lines].sort((a, b) => b.grainsPerHour - a.grainsPerHour)
  for (const line of sorted) {
    if (ry + pitch > CONTENT_BOTTOM) {
      newPage(ctx, `${cont.title} (continued)`, cont.sub)
      ry = 46
    }
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
    ry += pitch
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


/** Info callout that sizes itself to its copy; returns the y below the box. */
/** Type and geometry of note(), in ONE place so a reserve cannot drift from it. */
const NOTE_OPTS = { size: 7.2, color: [40, 70, 120] as RGB, leading: 3.4 }

/**
 * The height note() will occupy, so ensure() can be asked before drawing one.
 * These notes carry sourceNote(), which grows with the ASHRAE station string —
 * measure it rather than reserving a guess.
 */
function noteH(doc: Doc, body: string, w: number): number {
  return Math.max(wrapLines(doc, body, w - 14, NOTE_OPTS).length * NOTE_OPTS.leading + 5.5, 10)
}

function note(doc: Doc, body: string, x: number, y: number, w: number): number {
  const opts = NOTE_OPTS
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
  const outdoor = data.outdoorSource
    // The middot reads as a separator on screen and as noise in a sentence.
    ? ` Outdoor design conditions are ${san(data.outdoorSource.replace(/\s*·\s*/g, ", "))}.`
    : ''
  // Says out loud, on the customer's own copy, whether the target is theirs or
  // ours. Since 2026-08-26 the survey no longer pre-fills it, so 'typical' means
  // they were shown the figures and accepted them for budget purposes — which is
  // exactly the caveat that has to travel with the document.
  const target = data.targetSource === 'typical'
    ? ' The target condition above is the typical figure for this application, accepted for budget purposes rather than measured on site.'
    : data.targetSource === 'entered'
      ? ' The target condition above was given by you.'
      : ''
  return `${outdoor}${target}`
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
    .replace('Air leakage through the shell', 'Infiltration')
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
