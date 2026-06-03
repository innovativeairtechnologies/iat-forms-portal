import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

async function getForm(slug: string) {
  const { data } = await supabase
    .from('forms')
    .select('title, success_message')
    .eq('slug', slug)
    .single()
  return data
}

export default async function SuccessPage({ params }: { params: { slug: string } }) {
  const form = await getForm(params.slug)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Check mark */}
        <div className="w-14 h-14 rounded-full bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center mx-auto mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#089447" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-[22px] font-bold text-[#0a0a0b] dark:text-white tracking-tight mb-3">
          {form?.title ? `${form.title} Submitted` : 'Submitted!'}
        </h1>
        <p className="text-[14px] text-gray-400 leading-relaxed mb-8">
          {form?.success_message || 'Your submission has been received. The appropriate team will follow up shortly.'}
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] text-gray-400 hover:text-[#0a0a0b] dark:hover:text-white font-medium transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Forms Portal
        </Link>
      </div>
    </div>
  )
}
