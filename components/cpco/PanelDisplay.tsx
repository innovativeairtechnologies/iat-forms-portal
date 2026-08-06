'use client'

import { cn } from '@/lib/utils'
import type { RenderedRow } from '@/lib/cpco'

/* The glass. Purely presentational — it takes rendered rows and draws them.

   Every glyph gets its own cell in a CSS grid, which is what keeps the columns
   honest: the alignment comes from the grid, not from the font, so a monospace
   fallback on someone's machine can't skew a mask. Colours live in the
   `.cpco-*` rules in globals.css; see the note there for why they are literal
   hex and outside the token system. */

export default function PanelDisplay({
  rows,
  off = false,
  className,
}: {
  rows: RenderedRow[]
  /** Backlight down while the controller restarts. */
  off?: boolean
  className?: string
}) {
  // A grid of single-character spans is noise to a screen reader, so the glass
  // is hidden from the accessibility tree and the same content is offered as
  // lines of text alongside it.
  const lines = rows.map(r => r.cells.map(c => c.ch).join('').replace(/\s+$/, ''))

  return (
    <div className={cn('cpco-bezel rounded-xl p-3', className)}>
      <div className={cn('cpco-lcd', off && 'cpco-lcd-off')} aria-hidden="true">
        {rows.map((row, ri) => (
          <div key={ri} className={cn('cpco-row', row.scale === 2 ? 'cpco-row-2' : 'cpco-row-1')}>
            {row.cells.map((cell, ci) => (
              <span
                key={ci}
                className={cn('cpco-cell', (cell.inverse || cell.cursor) && 'cpco-cell-on')}
              >
                {cell.ch === ' ' ? ' ' : cell.ch}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {off ? 'Controller restarting.' : `Display shows: ${lines.filter(Boolean).join('. ')}`}
      </p>
    </div>
  )
}
