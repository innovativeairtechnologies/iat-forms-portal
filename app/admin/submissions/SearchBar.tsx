'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchBar({ current }: { current?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateSearch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('search', value)
    else params.delete('search')
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }, [router, pathname, searchParams])

  return (
    <div className="relative flex-1 max-w-sm">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input
        type="text"
        defaultValue={current || ''}
        onChange={(e) => updateSearch(e.target.value)}
        placeholder="Search submissions…"
        className="w-full pl-8 pr-8 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-[13px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-400 bg-white dark:bg-zinc-800 placeholder:text-gray-400 dark:placeholder:text-gray-600"
      />
      {current && (
        <button
          onClick={() => updateSearch('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={13} />
        </button>
      )}
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}
