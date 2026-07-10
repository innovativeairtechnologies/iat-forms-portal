import * as XLSX from 'xlsx'

/* ────────────────────────────────────────────────────────────────────────────
   monday.com "Sales Forecasting" export → deals rows.

   The sales team's board exports as one sheet laid out in GROUP BLOCKS:

     Sales Forecasting | | This spreadsheet was created using monday.com   ← banner
     MAIN Sales Forecasting | | Try it free →                              ← group header
     Name | Subitems | Person | Date Quoted | Won/Lost | ... | Notes       ← column header
     <deal rows>
     (blank Name) | ... | <sum> | <avg> | <sum> | ...                      ← group summary
     (blank row)
     JACOB Sales Forecasting                                               ← next group
     …

   This module is pure (no network, no Supabase) so the API route, the one-off
   backfill script, and tests all share the exact same parsing brain. Columns
   map 1:1 onto the `deals` table (migration 043 was modeled on this board);
   `Weighted` is intentionally dropped — it's always derived from
   total_cost × confidence (see lib/deals.ts) and never persisted.

   Tolerances (real exports are messy):
     • blank Total Cost / Confidence → 0, with a warning naming the row
     • dates arrive as JS Dates (cellDates) or 'YYYY-MM-DD…' strings
     • Won/Lost matched case-insensitively; anything else → open (null)
     • unknown extra columns are ignored; header row is matched by name,
       not position, so column reordering in monday survives
   ──────────────────────────────────────────────────────────────────────────── */

export type ImportedDeal = {
  customer: string
  group_name: string
  assigned_to: string | null
  date_quoted: string | null // YYYY-MM-DD
  status: 'Won' | 'Lost' | null
  unit_model: string | null
  job_name: string | null
  total_cost: number
  confidence: number // 0–100 integer
  projected: string | null
  rep: string | null
  rep_contact: string | null
  notes: string | null
}

export type ImportGroup = {
  name: string
  count: number
  totalCost: number
  weighted: number
}

export type ImportResult = {
  deals: ImportedDeal[]
  groups: ImportGroup[]
  warnings: string[]
  sheetName: string
}

// Header labels as they appear in the export → our field keys.
const HEADER_MAP: Record<string, keyof ImportedDeal | 'weighted' | 'subitems'> = {
  'name': 'customer',
  'subitems': 'subitems',
  'person': 'assigned_to',
  'date quoted': 'date_quoted',
  'won/lost': 'status',
  'unit model': 'unit_model',
  'job name': 'job_name',
  'total cost': 'total_cost',
  'confidence': 'confidence',
  'weighted': 'weighted',
  'projected': 'projected',
  'rep': 'rep',
  'rep contact name': 'rep_contact',
  'rep contact': 'rep_contact',
  'notes': 'notes',
}

const GROUP_HEADER_RE = /^(.+?)\s+Sales Forecasting\s*$/i

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())

function toDateOnly(v: unknown): { value: string | null; bad?: boolean } {
  if (v === null || v === undefined || v === '') return { value: null }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // cellDates gives UTC-anchored dates (e.g. 2025-04-10T04:00Z for an
    // Eastern-timezone sheet) — the UTC calendar date is the intended one.
    const y = v.getUTCFullYear()
    const m = String(v.getUTCMonth() + 1).padStart(2, '0')
    const d = String(v.getUTCDate()).padStart(2, '0')
    return { value: `${y}-${m}-${d}` }
  }
  const s = str(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return { value: `${m[1]}-${m[2]}-${m[3]}` }
  return { value: null, bad: true }
}

function toStatus(v: unknown): 'Won' | 'Lost' | null {
  const s = str(v).toLowerCase()
  if (s === 'won') return 'Won'
  if (s === 'lost') return 'Lost'
  return null
}

/** Parse a monday.com Sales Forecasting export. Throws with a human-readable
 *  message if the workbook doesn't look like one at all. */
export function parseSalesForecastXlsx(data: Uint8Array | ArrayBuffer): ImportResult {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(data, { type: 'array', cellDates: true })
  } catch {
    throw new Error('That file could not be read as an Excel workbook (.xlsx).')
  }
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('The workbook has no sheets.')
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  })

  const warnings: string[] = []
  const deals: ImportedDeal[] = []
  const groupMap = new Map<string, ImportGroup>()

  let currentGroup: string | null = null
  // Column index → field key, rebuilt at each group's header row so a
  // reordered/renamed board still lands in the right fields.
  let colMap: (keyof ImportedDeal | 'weighted' | 'subitems' | null)[] = []

  const isBlankRow = (r: unknown[]) => r.every((c) => c === null || c === undefined || str(c) === '')

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || isBlankRow(row)) continue
    const first = str(row[0])

    // Group header — "MAIN Sales Forecasting" (the banner row's bare
    // "Sales Forecasting" has no prefix, so the regex skips it).
    const gm = first.match(GROUP_HEADER_RE)
    if (gm) {
      currentGroup = gm[1].trim().toUpperCase()
      if (!groupMap.has(currentGroup)) {
        groupMap.set(currentGroup, { name: currentGroup, count: 0, totalCost: 0, weighted: 0 })
      }
      continue
    }

    // Column header row — remap columns by name.
    const lowerFirst = first.toLowerCase()
    if (lowerFirst === 'name' && row.some((c) => str(c).toLowerCase() === 'total cost')) {
      colMap = row.map((c) => HEADER_MAP[str(c).toLowerCase()] ?? null)
      continue
    }

    // Banner / ad rows from monday.
    if (first === 'Sales Forecasting') continue

    // Group summary rows have a blank Name (they carry sums we recompute
    // ourselves); anything else nameless is noise either way.
    if (!first) continue

    if (!currentGroup || colMap.length === 0) {
      warnings.push(`Row ${i + 1} ("${first}") appears before any group header — skipped.`)
      continue
    }

    const deal: ImportedDeal = {
      customer: first,
      group_name: currentGroup,
      assigned_to: null,
      date_quoted: null,
      status: null,
      unit_model: null,
      job_name: null,
      total_cost: 0,
      confidence: 0,
      projected: null,
      rep: null,
      rep_contact: null,
      notes: null,
    }

    for (let c = 0; c < colMap.length; c++) {
      const key = colMap[c]
      if (!key || key === 'subitems' || key === 'weighted' || key === 'customer') continue
      const raw = row[c]
      switch (key) {
        case 'total_cost': {
          const n = Number(raw)
          if (raw === null || str(raw) === '' || !Number.isFinite(n)) {
            if (str(raw) !== '') warnings.push(`Row ${i + 1} ("${first}"): Total Cost "${str(raw)}" isn't a number — imported as $0.`)
            else warnings.push(`Row ${i + 1} ("${first}"): blank Total Cost — imported as $0.`)
            deal.total_cost = 0
          } else {
            deal.total_cost = Math.max(0, n)
          }
          break
        }
        case 'confidence': {
          const n = Number(raw)
          if (raw === null || str(raw) === '' || !Number.isFinite(n)) {
            if (str(raw) !== '') warnings.push(`Row ${i + 1} ("${first}"): Confidence "${str(raw)}" isn't a number — imported as 0%.`)
            deal.confidence = 0
          } else {
            deal.confidence = Math.round(Math.min(100, Math.max(0, n)))
          }
          break
        }
        case 'date_quoted': {
          const d = toDateOnly(raw)
          if (d.bad) warnings.push(`Row ${i + 1} ("${first}"): Date Quoted "${str(raw)}" not recognized — left blank.`)
          deal.date_quoted = d.value
          break
        }
        case 'status': {
          const s = toStatus(raw)
          if (!s && str(raw)) warnings.push(`Row ${i + 1} ("${first}"): Won/Lost "${str(raw)}" not recognized — imported as open.`)
          deal.status = s
          break
        }
        case 'group_name':
          break // group comes from the block header, never a cell
        default: {
          // free-text fields
          const s = str(raw)
          deal[key] = (s === '' ? null : s) as never
          break
        }
      }
    }

    deals.push(deal)
    const g = groupMap.get(currentGroup)!
    g.count++
    g.totalCost += deal.total_cost
    g.weighted += deal.total_cost * (deal.confidence / 100)
  }

  if (deals.length === 0) {
    throw new Error(
      'No deals found. Expected a monday.com "Sales Forecasting" export: group header rows ' +
      '("MAIN Sales Forecasting", …) each followed by a Name/Total Cost/Confidence table.',
    )
  }

  return { deals, groups: [...groupMap.values()], warnings, sheetName }
}
