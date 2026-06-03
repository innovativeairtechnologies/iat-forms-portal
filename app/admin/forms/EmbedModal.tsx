'use client'

import { useState } from 'react'
import { Code2, X, Copy, Check, ChevronDown } from 'lucide-react'

interface Props {
  formTitle: string
  formSlug: string
}

export default function EmbedModal({ formTitle, formSlug }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [height, setHeight] = useState('900')
  const [theme, setTheme] = useState<'white' | 'transparent'>('white')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'
  const embedUrl = `${appUrl}/forms/${formSlug}/embed`

  const snippet = `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  frameborder="0"
  scrolling="auto"
  style="border: none; border-radius: 12px; background: ${theme === 'white' ? '#ffffff' : 'transparent'};"
  title="${formTitle}"
></iframe>`

  const copy = async () => {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Get embed code"
        className="p-2 rounded-lg text-gray-400 hover:text-[#089447] hover:bg-[#f0faf4] transition-all"
      >
        <Code2 size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Code2 size={16} className="text-[#089447]" />
                  <h2 className="text-[15px] font-bold text-gray-900">Embed Form</h2>
                </div>
                <p className="text-[12px] text-gray-400 ml-6">{formTitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* Settings */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                  Height (px)
                </label>
                <div className="relative">
                  <select
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 outline-none focus:border-[#089447] appearance-none bg-white"
                  >
                    {['600', '700', '800', '900', '1000', '1200', '1500'].map((h) => (
                      <option key={h} value={h}>{h}px</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                  Background
                </label>
                <div className="relative">
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'white' | 'transparent')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 outline-none focus:border-[#089447] appearance-none bg-white"
                  >
                    <option value="white">White</option>
                    <option value="transparent">Transparent</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Code snippet */}
            <div className="bg-gray-950 rounded-xl p-4 mb-4 relative">
              <pre className="text-[12px] text-gray-300 font-mono whitespace-pre overflow-x-auto leading-relaxed">
                {snippet}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold rounded-xl transition-colors"
              >
                {copied ? <><Check size={14} />Copied!</> : <><Copy size={14} />Copy Code</>}
              </button>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 text-gray-600 text-[13px] font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Preview
              </a>
            </div>

            <p className="text-[11px] text-gray-400 mt-3 text-center">
              Paste this snippet anywhere on your website — job listings, landing pages, or contact pages.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
