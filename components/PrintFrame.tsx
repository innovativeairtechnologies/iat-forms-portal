import React from 'react'

// Shared chrome for the standalone print views (/print/*). On screen it shows a
// centered white "sheet" on a grey backdrop with a sticky toolbar; the toolbar is
// hidden when printing and the sheet goes full-bleed so only the content prints.
// Colors are intentionally light-only (no dark: variants) so output is print-ready.

const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #ffffff !important; }
}
`

export default function PrintFrame({ toolbar, children }: { toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {toolbar !== undefined && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden">
          {toolbar}
        </div>
      )}
      <div className="mx-auto my-0 max-w-[820px] bg-white px-10 py-10 shadow-sm sm:my-6 print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {children}
      </div>
    </div>
  )
}
