export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import JerryWidget from '@/components/shared/JerryWidget'

// A standalone, full-page "GPT style" Jerry — for internal Q&A or just trying
// Jerry out. Every admin-surface role can reach it (perm 'jerry' in
// lib/roles.ts), unlike the ticket-detail Jerry which is admin-write-gated by
// virtue of living on an admin-only ticket record. Deliberately NOT
// overflow-y-auto at the page level (unlike the list/detail pages): this page
// fixes its own height so the composer stays pinned at the bottom like a real
// chat surface, and only the message list scrolls.
export default async function JerryPage() {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300">
      {/* Top bar — matches the other standalone (non-list/detail) admin pages */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">Tools</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Jerry</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex justify-center px-5 py-5">
        <div className="w-full max-w-2xl flex flex-col min-h-0">
          <JerryWidget
            apiEndpoint="/api/admin/assistant"
            suggestions={[
              'How do I process a warranty claim?',
              "What's the reactivation heat setpoint?",
              'What can you help with?',
            ]}
            idleSubtitle="Ask about IAT's documentation, or just try me out — this page isn't grounded in any one ticket."
            footerNote="Jerry can make mistakes — verify before acting. No live ticket or equipment lookup here."
            fullHeight
          />
        </div>
      </div>
    </div>
  )
}
