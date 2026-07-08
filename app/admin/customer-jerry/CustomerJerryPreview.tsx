'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import JerryWidget from '@/components/shared/JerryWidget'
import { CUSTOMER_JERRY_SUGGESTIONS } from '@/lib/jerry-questions'

// Internal QA surface: renders the EXACT customer Jerry (same suggestions, same
// /api handler under the hood) so staff can try it before customers do. Picking
// a customer grounds answers in that customer's equipment; the `key` on the
// widget resets the conversation whenever the selection changes.
export default function CustomerJerryPreview({ customers }: { customers: { id: string; company_name: string }[] }) {
  const [customerId, setCustomerId] = useState('')
  const endpoint = customerId
    ? `/api/admin/customer-jerry?customerId=${encodeURIComponent(customerId)}`
    : '/api/admin/customer-jerry'

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300">
      <div className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">Tools</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Customer Jerry</span>
          <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Preview</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex justify-center px-5 py-5">
        <div className="w-full max-w-2xl flex flex-col min-h-0 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Preview as customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-zinc-700 dark:text-zinc-200 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
            >
              <option value="">No customer (ungrounded — “no equipment on file”)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              This is exactly what a customer sees. Pick a customer to ground answers in their real equipment &amp; warranty data.
            </p>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <JerryWidget
              key={customerId || 'none'}
              apiEndpoint={endpoint}
              suggestions={CUSTOMER_JERRY_SUGGESTIONS}
              idleSubtitle="Internal preview of the customer-facing Jerry — answers from the manuals and the selected customer's equipment."
              footerNote="Preview only. Customer Jerry is read-only and never names a competitor."
              fullHeight
            />
          </div>
        </div>
      </div>
    </div>
  )
}
