'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PLACEHOLDER = `Paste your form description here — section headers, question lists, bullet points, any format works.

Example:

  Employee Satisfaction Survey

  How satisfied are you with your current role?
  (select: Very Satisfied, Satisfied, Neutral, Dissatisfied, Very Dissatisfied) — required

  Do you feel your contributions are recognized?
  (radio: Yes, Somewhat, No) — required

  What improvements would you suggest? (open text)

  How would you rate communication from management? (rating 1–5)

  Additional comments`

export default function AIFormBuilderPage() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const build = async () => {
    if (!description.trim() || status === 'building' || status === 'success') return
    setStatus('building')
    setMessage('Analyzing your form description…')

    try {
      const res = await fetch('/api/forms/ai-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error || 'Something went wrong. Please try again.')
        return
      }

      setStatus('success')
      setMessage(`Built "${data.title}" with ${data.fieldCount} fields — opening editor…`)
      setTimeout(() => router.push(`/admin/forms/${data.id}/edit`), 1400)
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') build()
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Link
          href="/admin/forms"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          Forms
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-violet-500 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
              Build with AI
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Paste a form description — Claude will parse it and build the form for you.
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-3xl">

        {/* Terminal-style input */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">

          {/* Fake terminal title bar */}
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-b border-gray-100 dark:border-zinc-700 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-400/70" />
              <div className="w-3 h-3 rounded-full bg-amber-400/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
            </div>
            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 ml-1.5 select-none">
              form description
            </span>
          </div>

          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); if (status === 'error') setStatus('idle') }}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={status === 'building' || status === 'success'}
            rows={22}
            className="w-full px-5 py-4 text-[13px] font-mono leading-relaxed text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-900 placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none resize-none disabled:opacity-50 transition-opacity"
            autoFocus
          />
        </div>

        {/* Action row */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={build}
            disabled={!description.trim() || status === 'building' || status === 'success'}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {status === 'building' ? (
              <><Loader2 size={14} className="animate-spin" /> Building…</>
            ) : status === 'success' ? (
              <><CheckCircle2 size={14} /> Done!</>
            ) : (
              <><Sparkles size={14} /> Build Form</>
            )}
          </button>

          <span className="text-[11px] text-gray-300 dark:text-gray-600 select-none">
            or <kbd className="font-mono">⌘ Enter</kbd>
          </span>

          <AnimatePresence>
            {message && (
              <motion.p
                key={message}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[13px] flex items-center gap-1.5 ${
                  status === 'error'
                    ? 'text-red-500 dark:text-red-400'
                    : status === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400'
                }`}
              >
                {status === 'error'   && <AlertCircle  size={13} className="flex-shrink-0" />}
                {status === 'success' && <CheckCircle2 size={13} className="flex-shrink-0" />}
                {message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Tips</p>
          <ul className="space-y-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <li>• Paste raw from Word, email, PDF, or any source — format doesn&apos;t matter</li>
            <li>• Mention types inline — e.g. <code className="font-mono text-violet-500">(select: Yes, No)</code> or <code className="font-mono text-violet-500">(required)</code></li>
            <li>• Section headers and question numbers help Claude preserve order</li>
            <li>• Forms land in the editor as <strong>drafts</strong> — review fields and publish when ready</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
