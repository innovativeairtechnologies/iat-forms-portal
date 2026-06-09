'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function DashboardSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/admin/submissions?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search submissions by name, form, or keyword…"
        className="w-full pl-9 pr-4 py-2 text-[13px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:border-gray-300 dark:focus:border-zinc-600 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-gray-100 dark:focus:ring-gray-700/50 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all"
      />
    </form>
  )
}
