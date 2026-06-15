import Link from 'next/link'
import Logo from '@/components/Logo'
import { ArrowRight, BookOpen, ChevronLeft } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function KbIndexPage() {
  const { data } = await supabaseAdmin
    .from('kb_articles')
    .select('title, slug, excerpt, category')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  const articles = data ?? []

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Header */}
      <header className="sticky top-0 z-20 h-14 flex items-center border-b border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-[900px] mx-auto px-6 w-full flex items-center gap-2">
          <Link href="/support" className="flex items-center gap-2 no-underline">
            <Logo size={28} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">IAT</span>
              <span className="text-[14px] text-gray-300 dark:text-gray-600">/</span>
              <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">Knowledge Base</span>
            </div>
          </Link>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-6 py-10 pb-20">

        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ChevronLeft size={14} /> Back to support
        </Link>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-gray-500 dark:text-gray-400" />
          </div>
          <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Knowledge Base</h1>
        </div>
        <p className="text-[14px] text-gray-400 mb-8 leading-relaxed">
          Troubleshooting guides for IAT equipment. Try these before submitting a ticket — and they&apos;ll help
          our team pick up right where you left off.
        </p>

        {articles.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {articles.map(a => (
              <Link
                key={a.slug}
                href={`/support/kb/${a.slug}`}
                className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col text-left transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              >
                {a.category && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#089447] mb-2">{a.category}</span>
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug">{a.title}</p>
                  <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400" />
                </div>
                {a.excerpt && <p className="text-[12px] text-gray-400 leading-relaxed">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-gray-400">No published articles yet. Check back soon.</p>
        )}
      </div>
    </div>
  )
}
