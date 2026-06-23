import Link from 'next/link'
import Logo from '@/components/Logo'
import { ChevronLeft, ArrowRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { renderKbBody } from '@/lib/kb-render'
import KbViewTracker from '@/components/support/KbViewTracker'

export const dynamic = 'force-dynamic'

export default async function KbArticlePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { data: article } = await supabaseAdmin
    .from('kb_articles')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!article) notFound()

  const bodyHtml = renderKbBody(article.body)

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Records this view in the visitor's browser for later ticket context. */}
      <KbViewTracker slug={article.slug} title={article.title} />

      {/* Header */}
      <header className="sticky top-0 z-20 h-14 flex items-center border-b border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-[760px] mx-auto px-6 w-full flex items-center gap-2">
          <Link href="/support/kb" className="flex items-center gap-2 no-underline">
            <Logo size={28} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">IAT</span>
              <span className="text-[14px] text-gray-300 dark:text-gray-600">/</span>
              <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">Knowledge Base</span>
            </div>
          </Link>
        </div>
      </header>

      <article className="max-w-[760px] mx-auto px-6 py-10 pb-20">

        <Link
          href="/support/kb"
          className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ChevronLeft size={14} /> All guides
        </Link>

        {article.category && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#089447]">{article.category}</span>
        )}
        <h1 className="text-[clamp(26px,4vw,34px)] font-bold tracking-[-0.5px] text-gray-900 dark:text-white mt-1.5 mb-3">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="text-[15px] text-gray-400 leading-relaxed mb-8">{article.excerpt}</p>
        )}

        <div
          className="kb-content text-gray-700 dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Still stuck → submit a ticket */}
        <div className="mt-12 pt-6 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[13px] text-gray-400">Didn&apos;t solve it?</p>
          <Link
            href="/support/equipment-support"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-all"
          >
            Submit a support ticket <ArrowRight size={14} />
          </Link>
        </div>
      </article>
    </div>
  )
}
