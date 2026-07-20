'use client'

import { useState, useTransition } from 'react'
import { Check, Send } from 'lucide-react'
import { submitSuggestion } from './actions'

/* Compact "Suggestion Box" for the bento tile. Secondary-styled submit — the
   dashboard has no single green primary, so a neutral button keeps it calm. */

export function SuggestionBox() {
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError('')
    startTransition(async () => {
      const res = await submitSuggestion(body)
      if (res.ok) { setDone(true); setBody('') }
      else setError(res.error || 'Something went wrong.')
    })
  }

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3.5 py-4 text-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Check size={16} />
        </span>
        <p className="text-[12.5px] font-semibold text-ink">Thanks — sent to leadership.</p>
        <button
          onClick={() => setDone(false)}
          className="text-[12px] font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 px-3.5 py-3">
      <textarea
        value={body}
        onChange={(e) => { setBody(e.target.value); setError('') }}
        placeholder="Have an idea to improve how things run at IAT?"
        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-hairline bg-surface px-3 py-2 text-[12px] leading-relaxed text-ink placeholder:text-ink-faint transition-colors hover:border-hairline-strong focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      <button
        onClick={submit}
        disabled={pending || !body.trim()}
        className="inline-flex h-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-hairline-strong bg-surface text-[12px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Send size={13} /> {pending ? 'Sending…' : 'Submit'}
      </button>
    </div>
  )
}
