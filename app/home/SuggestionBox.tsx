'use client'

import { useState, useTransition } from 'react'
import { Check, Send } from 'lucide-react'
import { submitSuggestion } from './actions'

/* "Submit a Suggestion" form. Secondary-styled submit so the hero's Launch stays
   the single green primary of the view (DESIGN.md). */

export function SuggestionBox() {
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError('')
    startTransition(async () => {
      const res = await submitSuggestion(body)
      if (res.ok) {
        setDone(true)
        setBody('')
      } else {
        setError(res.error || 'Something went wrong.')
      }
    })
  }

  if (done) {
    return (
      <div className="px-5 pb-5">
        <div className="flex items-start gap-2.5 rounded-lg border border-hairline-soft bg-surface-soft px-3.5 py-3">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
            <Check size={13} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Thanks — your suggestion was sent.</p>
            <button
              onClick={() => setDone(false)}
              className="mt-1 text-[12.5px] font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Submit another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5">
      <textarea
        value={body}
        onChange={(e) => { setBody(e.target.value); setError('') }}
        rows={3}
        placeholder="Share an idea to improve how things run…"
        className="w-full resize-y rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint transition-colors hover:border-hairline-strong focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      {error && <p className="mt-1.5 text-[12px] text-rose-500">{error}</p>}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-ink-muted">Shared with leadership.</p>
        <button
          onClick={submit}
          disabled={pending || !body.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Send size={14} />
          {pending ? 'Sending…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
