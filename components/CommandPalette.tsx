'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, Clock, Hash } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Form, Category } from '@/lib/supabase'

interface Props {
  forms: (Form & { categories: Category })[]
}

const RECENT_KEY = 'iat_recent_forms'

function getRecent(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

export function recordVisit(slug: string) {
  if (typeof window === 'undefined') return
  const recent = getRecent().filter((s) => s !== slug)
  localStorage.setItem(RECENT_KEY, JSON.stringify([slug, ...recent].slice(0, 5)))
}

export default function CommandPalette({ forms }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSlugs, setRecentSlugs] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setRecentSlugs(getRecent())
  }, [open])

  const results = query.trim()
    ? forms.filter(
        (f) =>
          f.title.toLowerCase().includes(query.toLowerCase()) ||
          f.description?.toLowerCase().includes(query.toLowerCase()) ||
          f.categories?.name?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : recentSlugs
        .map((slug) => forms.find((f) => f.slug === slug))
        .filter(Boolean) as (Form & { categories: Category })[]

  const navigate = useCallback((form: Form) => {
    recordVisit(form.slug)
    setOpen(false)
    setQuery('')
    router.push(`/forms/${form.slug}`)
  }, [router])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (!open) return
      if (e.key === 'Escape') { setOpen(false); setQuery(''); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        navigate(results[selectedIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, selectedIndex, navigate])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setOpen(false); setQuery('') }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search forms…"
                  className="flex-1 text-[15px] text-[#0a0a0b] placeholder:text-gray-300 outline-none bg-transparent"
                />
                <kbd className="text-[11px] text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                  esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[360px] overflow-y-auto">
                {results.length === 0 && query && (
                  <div className="py-10 text-center text-[13px] text-gray-400">
                    No forms match &ldquo;{query}&rdquo;
                  </div>
                )}

                {results.length === 0 && !query && (
                  <div className="py-10 text-center text-[13px] text-gray-400">
                    Start typing to search all {forms.length} forms
                  </div>
                )}

                {results.length > 0 && (
                  <div className="py-2">
                    {!query && recentSlugs.length > 0 && (
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-2">
                        Recent
                      </p>
                    )}
                    {results.map((form, i) => (
                      <button
                        key={form.id}
                        onClick={() => navigate(form)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                          selectedIndex === i ? 'bg-gray-50' : 'hover:bg-gray-50/60'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedIndex === i ? 'bg-[#f0faf4]' : 'bg-gray-100'
                        }`}>
                          {query
                            ? <Hash size={12} className={selectedIndex === i ? 'text-[#089447]' : 'text-gray-400'} />
                            : <Clock size={12} className={selectedIndex === i ? 'text-[#089447]' : 'text-gray-400'} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold truncate ${selectedIndex === i ? 'text-[#089447]' : 'text-[#0a0a0b]'}`}>
                            {form.title}
                          </p>
                          {form.categories?.name && (
                            <p className="text-[11px] text-gray-400 truncate">{form.categories.name}</p>
                          )}
                        </div>
                        <ArrowRight
                          size={14}
                          className={`flex-shrink-0 transition-all ${
                            selectedIndex === i ? 'text-[#089447] translate-x-0.5' : 'text-gray-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1 rounded font-mono">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1 rounded font-mono">↵</kbd> open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1 rounded font-mono">esc</kbd> close
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
