import 'server-only'

import { auth } from '@/auth'
import { setTokenSource } from '@/lib/api/token-source'

// Evaluated once per server process. auth() itself reads cookies() and is
// therefore per-request, so nothing leaks between requests.
setTokenSource(async () => {
  const session = await auth()
  if (!session || session.error) return null
  return session.accessToken ?? null
})
