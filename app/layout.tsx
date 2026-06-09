import type { Metadata } from 'next'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'IAT Self-Service',
  description: 'Employee self-service portal for Innovative Air Technologies',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
