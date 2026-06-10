'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { Category, Form } from '@/lib/supabase'
import ThemeToggle from './ThemeToggle'
import FormsBrowser from './FormsBrowser'

interface Props {
  categories: Category[]
  forms: (Form & { categories: Category })[]
}

export default function FormsPortal({ categories, forms }: Props) {
  const visibleCategories = categories.filter((c) => forms.some((f) => f.category_id === c.id))

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/forms" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-card-sm border border-black/[0.06] dark:border-black/10">
              <Image src="/iat-logo.png" alt="IAT" width={20} height={20} style={{ mixBlendMode: 'multiply' }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[#0a0a0b] dark:text-white tracking-tight group-hover:text-[#089447] transition-colors">IAT</span>
              <span className="text-gray-300 dark:text-gray-600 text-sm">/</span>
              <span className="text-[15px] text-gray-500 dark:text-gray-400 font-medium">Forms</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6">

        {/* Hero */}
        <div className="pt-14 pb-8 text-center">
          <h1 className="text-[36px] sm:text-[46px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-none mb-2.5">
            Submit a Request
          </h1>
          <p className="text-[15px] text-gray-400">
            {forms.length} forms across {visibleCategories.length} categories
          </p>
        </div>

        <FormsBrowser categories={categories} forms={forms} />
      </div>
    </div>
  )
}
