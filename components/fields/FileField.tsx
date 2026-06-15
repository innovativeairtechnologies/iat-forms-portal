'use client'

import { useState, useRef } from 'react'
import type { FormField } from '@/lib/supabase'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
}

export default function FileField({ field, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      // Ask the server for a one-shot signed upload URL (tiny JSON request), then
      // upload the bytes straight to storage — bypasses Vercel's ~4.5MB function
      // body limit, which 413'd larger photos/PDFs.
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const sb = createSupabaseBrowser()
      const { error } = await sb.storage
        .from('form-uploads')
        .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined })
      if (error) throw new Error(error.message || 'Upload failed')

      onChange(data.url)
      setFileName(file.name)
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const clear = () => {
    onChange('')
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 p-4 border-2 border-green-200 bg-green-50 rounded-[8px]">
        <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
        <span className="text-sm text-green-800 flex-1 truncate">{fileName || 'File uploaded'}</span>
        <button onClick={clear} className="text-green-600 hover:text-red-500 transition-colors">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 hover:border-[#089447] rounded-[8px] p-8 text-center cursor-pointer transition-colors"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-[#089447] animate-spin" />
            <p className="text-sm text-gray-500">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Drag & drop or <span className="text-[#089447] font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400">PNG, JPG, GIF, PDF · max 10MB</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      {uploadError && <p className="mt-2 text-sm text-red-500">{uploadError}</p>}
    </div>
  )
}
