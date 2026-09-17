'use client'

import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

// Registers the getSession()-backed token source for the browser bundle.
import '@/lib/api/token-source.client'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

export function Providers({ children }: { children: ReactNode }) {
  // SessionProvider must be outermost: the token source calls getSession(),
  // and everything under QueryProvider fetches through it.
  return (
    <SessionProvider>
      <QueryProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  )
}
