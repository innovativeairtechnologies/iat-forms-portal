'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

interface Props {
  formTitle?: string
}

export default function PublicHeader({ formTitle }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800">
      <div className="max-w-2xl mx-auto px-6 h-13 flex items-center justify-between gap-4" style={{ height: '52px' }}>
        <Link href="/" className="flex items-center gap-2 group min-w-0 flex-1">
          <div className="w-6 h-6 rounded-md bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06] dark:border-white/10">
            <Image
              src="/iat-logo.png"
              alt="IAT"
              width={15}
              height={15}
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
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
