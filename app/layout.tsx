import type { Metadata } from 'next'
import { Nunito_Sans } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

// Portal typeface — Nunito Sans, the geometric-humanist sans we use as a freely
// licensable stand-in for Avenir (Avenir itself isn't web-embeddable). Exposed as
// --font-sans; the Tailwind `sans` stack and globals.css body both read it.
const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'IAT Self-Service',
  description: 'Employee self-service portal for Innovative Air Technologies',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={nunitoSans.variable}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
