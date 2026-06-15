'use client'

import { useEffect } from 'react'
import { recordKbView } from '@/lib/kb-views'

// Renders nothing — records (in the visitor's browser) that this KB article was
// opened. The recorded list is later attached to a support ticket on submit so
// the support team can see what documentation the customer already tried.
export default function KbViewTracker({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    recordKbView(slug, title)
  }, [slug, title])

  return null
}
