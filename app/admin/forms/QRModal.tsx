'use client'

import { useState, useRef } from 'react'
import { QrCode, X, Copy, Check, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  formTitle: string
  formSlug: string
}

export default function QRModal({ formTitle, formSlug }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const formUrl = `${appUrl}/forms/${formSlug}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const print = () => {
    if (!printRef.current) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>${formTitle} QR Code</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
        h1 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #111; }
        p { font-size: 12px; color: #888; margin-bottom: 24px; }
        svg { width: 240px; height: 240px; }
      </style></head>
      <body>
        <h1>${formTitle}</h1>
        <p>${formUrl}</p>
        ${printRef.current.innerHTML}
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="QR Code / Share Link"
        className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
      >
        <QrCode size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{formTitle}</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Share link & QR code</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-5 p-4 bg-gray-50 rounded-xl" ref={printRef}>
              <QRCodeSVG
                value={formUrl}
                size={180}
                bgColor="#f9fafb"
                fgColor="#1a1a2e"
                level="M"
              />
            </div>

            {/* URL */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-[12px] text-gray-600 font-mono truncate">{formUrl}</p>
              </div>
              <button
                onClick={copyLink}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[12px] font-semibold rounded-lg transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Print */}
            <button
              onClick={print}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Printer size={14} />
              Print QR Code
            </button>
          </div>
        </div>
      )}
    </>
  )
}
