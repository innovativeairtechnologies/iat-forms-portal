import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { RotateCcw } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import BackLink from '@/components/BackLink'

async function getForm(slug: string) {
  const { data } = await supabase
    .from('forms')
    .select('title, success_message')
    .eq('slug', slug)
    .single()
  return data
}

export default async function SuccessPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const form = await getForm(params.slug)

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-zinc-950">
      <PublicHeader formTitle={form?.title} />

      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">

          {/* Success card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card px-8 py-10 text-center">

            {/* Animated checkmark */}
            <div className="w-16 h-16 rounded-full bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="animate-[scale-in_0.3s_ease-out]">
                <path
                  d="M6 14.5l5.5 5.5L22 9"
                  stroke="#089447"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="text-[22px] font-bold text-[#0a0a0b] dark:text-white tracking-tight mb-1">
              Submitted successfully
            </h1>

            {form?.title && (
              <p className="text-[13px] font-medium text-[#089447] mb-4">{form.title}</p>
            )}

            {/* Message */}
            <p className="text-[14px] text-gray-400 dark:text-gray-500 leading-relaxed mb-8">
              {form?.success_message || 'Your submission has been received. The appropriate team will follow up with you shortly.'}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/forms/${params.slug}`}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <RotateCcw size={13} />
                Submit another response
              </Link>
              <BackLink
                label="Back"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-[#0a0a0b] dark:hover:text-white px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              />
            </div>
          </div>

          {/* Submitted timestamp */}
          <p className="text-center text-[11px] text-gray-300 dark:text-gray-700 mt-4">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}
