import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CheckCircle, ArrowLeft } from 'lucide-react'

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
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-3">
          {form?.title ? `${form.title} — Submitted` : 'Submitted!'}
        </h1>
        <p className="text-gray-500 text-base mb-8 leading-relaxed">
          {form?.success_message || 'Your submission has been received. The appropriate team will follow up shortly.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#0a7cff] hover:text-[#0066dd] font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Forms Portal
        </Link>
      </div>
    </div>
  )
}
