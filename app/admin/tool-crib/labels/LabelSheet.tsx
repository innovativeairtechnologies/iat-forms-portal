'use client'

import { useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, ChevronLeft } from 'lucide-react'
import { labelUrl, IAT_NAME, CRIB_SHORT_LABEL_MAX } from '@/lib/tool-crib'

type LabelTool = { id: string; tag_code: string; name: string; short_label: string | null }

/* Avery 5520 — weatherproof laser, 1" x 2-5/8", 30 per sheet (the 5160 grid in
   poly stock). Paper will not survive oil and abrasion in a tool crib.

   Geometry, which must sum exactly or every label drifts down the page:
     letter 8.5 x 11
     page padding  0.5in top/bottom, 0.1875in left/right
     label         2.625in x 1in,  3 across x 10 down
     column gutter 0.125in, no row gutter
     → width  3(2.625) + 2(0.125) + 2(0.1875) = 8.5   ✓
     → height 10(1) + 2(0.5)                  = 11    ✓ */
const SHEET_CSS = `
@media print {
  /* Isolate the sheet without needing to know what chrome surrounds it — the
     admin sidebar and top bar live outside this component. visibility (not
     display) preserves the grid geometry while blanking everything else. */
  body * { visibility: hidden !important; }
  #label-sheet, #label-sheet * { visibility: visible !important; }
  #label-sheet {
    position: absolute !important;
    left: 0 !important; top: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }
  @page { size: letter portrait; margin: 0; }
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
}
`

export default function LabelSheet({ tools, origin }: { tools: LabelTool[]; origin: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tools.map(t => t.id)))

  const chosen = tools.filter(t => selected.has(t.id))
  const toggle = (id: string) =>
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      <style dangerouslySetInnerHTML={{ __html: SHEET_CSS }} />

      {/* ── Controls (never printed) ── */}
      {/* Solid background — an opacity modifier on a semantic token compiles to
          nothing and left this bar transparent. See DESIGN.md §2.5. */}
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-hairline bg-canvas">
        <Link href="/admin/tool-crib" className="text-ink-faint hover:text-ink-secondary transition-colors -ml-1 p-1">
          <ChevronLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-[13px] text-ink truncate" style={{ fontWeight: 620 }}>Print labels</p>
          <p className="text-[11px] text-ink-faint truncate">Avery 5520 · 30 per sheet · {origin}</p>
        </div>
        <div className="flex-1" />
        <span className="text-[12px] text-ink-faint tabular-nums">{chosen.length} selected</span>
        <button
          onClick={() => window.print()}
          disabled={chosen.length === 0}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-brand-ink text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Printer size={14} />Print
        </button>
      </div>

      <div className="no-print px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setSelected(new Set(tools.map(t => t.id)))}
            className="text-[12px] font-semibold text-ink-secondary border border-hairline rounded-lg px-3 py-1.5 hover:bg-surface-soft transition-colors">
            Select all
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-[12px] font-semibold text-ink-secondary border border-hairline rounded-lg px-3 py-1.5 hover:bg-surface-soft transition-colors">
            Clear
          </button>
          <p className="ml-auto text-[12px] text-ink-muted">
            Load a sheet, print at <strong style={{ fontWeight: 600 }}>100% scale</strong> — “fit to page” will shift every label.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tools.map(t => {
            const on = selected.has(t.id)
            return (
              <button key={t.id} onClick={() => toggle(t.id)}
                className={`text-[12px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                  on ? 'border-brand bg-brand-soft text-brand' : 'border-hairline text-ink-faint hover:bg-surface-soft'
                }`}>
                {t.tag_code}
              </button>
            )
          })}
        </div>

        {tools.length === 0 && (
          <p className="py-10 text-center text-[13px] text-ink-muted">No tools to label yet.</p>
        )}
      </div>

      {/* ── The sheet itself ── */}
      <div className="px-5 pb-10">
        <div
          id="label-sheet"
          className="bg-white mx-auto"
          style={{
            width: '8.5in',
            minHeight: '11in',
            paddingTop: '0.5in',
            paddingBottom: '0.5in',
            paddingLeft: '0.1875in',
            paddingRight: '0.1875in',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 2.625in)',
            gridAutoRows: '1in',
            columnGap: '0.125in',
            rowGap: '0',
            justifyContent: 'center',
          }}
        >
          {chosen.map(t => {
            // Sticker descriptor. short_label is capped at CRIB_SHORT_LABEL_MAX
            // on the way in; the slice bounds the fallback name too so the
            // vertical text can never run past the QR.
            const descriptor = (t.short_label?.trim() || t.name).slice(0, CRIB_SHORT_LABEL_MAX)
            return (
              // box-sizing: border-box so the padding stays INSIDE the 2.625×1in
              // track — otherwise each label is padding-wider than its grid cell
              // and the whole sheet creeps out of alignment.
              <div key={t.id} style={{ width: '2.625in', height: '1in', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.06in', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  {/* Item code on top — centered over the QR, and the hand-readable
                      fallback for a damaged QR someone reads aloud and types. */}
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '10px', fontWeight: 700, color: '#000', letterSpacing: '0.02em', lineHeight: 1 }}>
                    {t.tag_code}
                  </div>

                  {/* QR, with the descriptor running top-to-bottom just off its
                      right edge. The descriptor is absolutely positioned so it
                      doesn't widen the block (keeps the code + company centred over
                      the QR), and its height is pinned to the QR so it can't run
                      past top or bottom. Level M — corner finder patterns aren't
                      error-corrected at any level, so protect the corners. */}
                  <div style={{ position: 'relative', width: '58px', height: '58px' }}>
                    <QRCodeSVG value={labelUrl(t.tag_code)} size={58} level="M" bgColor="#ffffff" fgColor="#000000" />
                    <div style={{
                      position: 'absolute', left: '100%', top: 0, height: '58px', marginLeft: '4px',
                      writingMode: 'vertical-rl', whiteSpace: 'nowrap', overflow: 'hidden',
                      display: 'flex', alignItems: 'center',
                      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '7px', fontWeight: 600, color: '#111', lineHeight: 1,
                    }}>
                      {descriptor}
                    </div>
                  </div>

                  {/* Company name stretched to EXACTLY the QR width (textLength +
                      lengthAdjust) so it sits flush under the code and never
                      overhangs. */}
                  <svg width={58} height={8} viewBox="0 0 58 8" style={{ display: 'block' }} aria-hidden="true">
                    <text
                      x="0" y="6.5"
                      textLength="58" lengthAdjust="spacingAndGlyphs"
                      fontFamily="Arial, Helvetica, sans-serif" fontSize="6.5" fontWeight={600} fill="#000"
                    >
                      {IAT_NAME}
                    </text>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
