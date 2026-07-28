export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
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
      {/* Full-height immersive scene — the client fixes its own height (the
          reactor stays centered; the corner panel scrolls internally). */}
      <div className="flex-1 min-h-0">
        <KnowledgeReactorClient />
      </div>
    </div>
  )
}
