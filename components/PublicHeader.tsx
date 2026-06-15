'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'

interface Props {
  formTitle?: string
}

export default function PublicHeader({ formTitle }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800">
      <div className="max-w-2xl mx-auto px-6 h-13 flex items-center justify-between gap-4" style={{ height: '52px' }}>
        <Link href="/forms" className="flex items-center gap-2 group min-w-0 flex-1">
          <Logo size={18} className="flex-shrink-0" />
          <div className="flex items-center gap-1 text-[13px] min-w-0">
            <span className="font-bold text-[#0a0a0b] dark:text-white group-hover:text-[#089447] dark:group-hover:text-[#089447] transition-colors flex-shrink-0">
              IAT
            </span>
            <ChevronRight size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
            <span className="font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">Forms</span>
            {formTitle && (
              <>
                <ChevronRight size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
                <span className="text-gray-500 dark:text-gray-400 truncate">{formTitle}</span>
              </>
            )}
          </div>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
