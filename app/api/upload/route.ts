import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Public on purpose: file fields on public forms upload through here, so an
  // admin guard breaks them (it 401'd every non-admin form filler). Defenses
  // instead: per-IP rate limit + the size cap, type allowlist, and random
  // server-side filenames below.
  // max: 150 / 10 min — photo-heavy forms (e.g. SRV has ~31 photo fields) blew
  // through the old cap of 20 mid-submission, 429ing the rest of the form. This
  // fits ~5 full SRV forms per IP/window, with headroom for shared-office NAT.
  const limited = await rateLimit(req, { name: 'upload', max: 150, windowSeconds: 600 })
  if (limited) return limited

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error } = await supabaseAdmin.storage
      .from('form-uploads')
      .upload(fileName, buffer, { contentType: file.type, upsert: false })

    if (error) {
      console.error('Storage error:', error)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('form-uploads')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: urlData.publicUrl, fileName })
  } catch (err) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
