'use client'

import { useState, useEffect } from 'react'
import { StickyNote, Send, Trash2, Loader2 } from 'lucide-react'

interface Note {
  id: string
  content: string
  created_at: string
}

export default function SubmissionNotes({ submissionId }: { submissionId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/submissions/${submissionId}/notes`)
      .then((r) => r.json())
      .then((data) => { setNotes(data || []); setLoading(false) })
  }, [submissionId])

  const addNote = async () => {
    if (!draft.trim()) return
    setSaving(true)
    const res = await fetch(`/api/submissions/${submissionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft }),
    })
    const note = await res.json()
    setNotes((prev) => [...prev, note])
    setDraft('')
    setSaving(false)
  }

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/submissions/${submissionId}/notes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId }),
    })
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-200/70 dark:border-zinc-800/80 flex items-center gap-2">
        <StickyNote size={14} className="text-zinc-400 dark:text-zinc-500" />
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Internal Notes</h3>
        {notes.length > 0 && (
          <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
            {notes.length}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {!loading && notes.length === 0 && (
          <p className="text-[12px] text-zinc-400 dark:text-zinc-600 text-center py-3">
            No notes yet. Add one below.
          </p>
        )}

        {notes.map((note) => (
          <div key={note.id} className="group bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg p-3.5">
            <p className="text-[13px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{note.content}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {new Date(note.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <button
                onClick={() => deleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-600 hover:text-rose-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote()
            }}
            placeholder="Add a note…"
            rows={2}
            className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
          />
          <button
            onClick={addNote}
            disabled={saving || !draft.trim()}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-40 self-end"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Ctrl / ⌘ + Enter to save</p>
      </div>
    </div>
  )
}
