export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
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
      <div className="flex-1 min-h-0 flex justify-center px-5 py-5">
        <div className="w-full max-w-2xl flex flex-col min-h-0">
          <JerryWidget
            apiEndpoint="/api/admin/assistant"
            suggestions={[
              'How do I process a warranty claim?',
              "What's the reactivation heat setpoint?",
              'What can you help with?',
            ]}
            idleSubtitle="Ask about IAT's documentation, attach a photo or PDF for me to look at, or just try me out — this page isn't grounded in any one ticket."
            footerNote="Jerry can make mistakes — verify before acting. No live ticket or equipment lookup here."
            allowAttachments
            fullHeight
          />
        </div>
      </div>
    </div>
  )
}
