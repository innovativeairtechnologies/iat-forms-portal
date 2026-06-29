'use client'

import { Printer } from 'lucide-react'

/** Opens the browser print dialog (which also offers "Save as PDF"). Hidden in the
 *  printed output by its parent's `print:hidden` toolbar. */
export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-500"
    >
      <Printer size={15} /> {label}
    </button>
  )
}
