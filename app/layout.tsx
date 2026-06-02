import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IAT Forms Portal',
  description: 'Internal forms portal for Industrial Air Technology',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
