import type { Metadata } from 'next'

import { Providers } from '@/components/providers/providers'
// Registers the auth()-backed token source for the server bundle.
import '@/lib/api/token-source.server'

import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Redaction Tools', template: '%s · Redaction Tools' },
  description: 'Catalog of redaction tools with benchmarks and a leaderboard.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
