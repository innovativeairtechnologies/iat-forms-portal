'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const OPTIONS = [
  { id: 'light', label: 'Light', icon: <Sun  size={13} /> },
  { id: 'dark',  label: 'Dark',  icon: <Moon size={13} /> },
] as const

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-7 w-[62px]" />

  return (
    <div className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 dark:bg-zinc-800 ${className ?? ''}`}>
      {OPTIONS.map(({ id, label, icon }) => {
        const active = theme === id
        return (
          <button
            key={id}
            onClick={() => setTheme(id)}
            title={`${label} theme`}
            aria-label={`${label} theme`}
            aria-pressed={active}
            className={`flex items-center justify-center w-7 h-6 rounded-md transition-all ${
              active
                ? 'bg-[#089447]/15 text-[#089447] shadow-sm'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}
