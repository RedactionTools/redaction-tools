'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import posthog from 'posthog-js'
import { useEffect, useRef, type ReactNode } from 'react'

// Registers the getSession()-backed token source for the browser bundle.
import '@/lib/api/token-source.client'
import { useGetMe } from '@/lib/api/generated/auth/auth'

import { QueryProvider } from './query-provider'
import { ThemeProvider } from './theme-provider'

function PostHogIdentity() {
  const { data: session, status } = useSession()
  const previousUserId = useRef<string | null>(null)
  const isAuthenticated = status === 'authenticated' && Boolean(session) && !session.error
  const isSignedOut = status === 'unauthenticated' || Boolean(session?.error)
  const { data: user } = useGetMe({ query: { enabled: isAuthenticated } })

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return

    if (!isAuthenticated) {
      if (isSignedOut && previousUserId.current) {
        posthog.reset()
        previousUserId.current = null
      }
      return
    }

    if (!user) return

    if (previousUserId.current && previousUserId.current !== user.id) {
      posthog.reset()
    }

    if (previousUserId.current !== user.id) {
      posthog.identify(user.id, { email: user.email, name: user.name })
      previousUserId.current = user.id
    }
  }, [isAuthenticated, isSignedOut, user])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  // SessionProvider must be outermost: the token source calls getSession(),
  // and everything under QueryProvider fetches through it.
  return (
    <SessionProvider>
      <QueryProvider>
        <PostHogIdentity />
        <ThemeProvider>{children}</ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  )
}
