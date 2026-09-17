import { getSession } from 'next-auth/react'

import { setTokenSource } from '@/lib/api/token-source'
import { EXPIRY_SKEW_MS } from '@/lib/auth/tokens'

// getSession() is awaitable, unlike useSession(), so the first request cannot
// fire without a token during `status === 'loading'` and 401. The memo keeps
// the extra same-origin call to roughly once per access-token lifetime.
let cached: { token: string; expiresAt: number } | null = null

setTokenSource(async () => {
  if (cached && cached.expiresAt - EXPIRY_SKEW_MS > Date.now()) return cached.token

  const session = await getSession()
  if (!session?.accessToken || session.error) {
    cached = null
    return null
  }

  cached = { token: session.accessToken, expiresAt: session.accessTokenExpiresAt ?? 0 }
  return cached.token
})

export function clearCachedAccessToken(): void {
  cached = null
}
