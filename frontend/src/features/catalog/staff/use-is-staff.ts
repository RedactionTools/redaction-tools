'use client'

import { useSession } from 'next-auth/react'

import { useGetMe } from '@/lib/api/generated/auth/auth'

/**
 * Whether the reader may edit the page in place.
 *
 * Asked on the client because the tool page is public and cached - it is the
 * same HTML for everyone - and only of a signed-in reader, so an anonymous
 * visit costs no request. The answer is advisory: every write is refused by the
 * API for anyone who is not staff.
 */
export function useIsStaff(): boolean {
  const { data: session, status } = useSession()
  const signedIn = status === 'authenticated' && Boolean(session) && !session?.error
  const { data: user } = useGetMe({ query: { enabled: signedIn } })
  return signedIn && Boolean(user?.is_staff)
}
