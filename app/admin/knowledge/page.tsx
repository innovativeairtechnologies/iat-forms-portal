export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getAdminUser } from '@/lib/admin-auth'
import KnowledgeReactorClient from '@/components/admin/KnowledgeReactorClient'

// "Jerry's Brain" — a page where staff drag-and-drop documents straight into the
// RAG knowledge pool (kb_documents / kb_chunks). Each file is read by Claude,
// chunked + competitor-scrubbed, and stored, so Jerry can cite it in future
// answers. Admin-only (feeding the shared brain is a privileged write; the
// middleware also fail-closes this route to admin).
export default async function KnowledgePage() {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300">
      <div className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">Tools</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Jerry&apos;s Brain</span>
        </div>
      </div>
      {/* Full-height immersive scene — the client fixes its own height (the
          reactor stays centered; the corner panel scrolls internally). */}
      <div className="flex-1 min-h-0">
        <KnowledgeReactorClient />
      </div>
    </div>
  )
}
