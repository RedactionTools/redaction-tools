/**
 * The whole auth decision tree, kept free of next-auth so it can be unit
 * tested without booting the framework. `src/auth.ts` is the only thing that
 * knows this is a `jwt` callback; if next-auth's beta API shifts, the wiring
 * gets rewritten and this logic does not.
 */
import { exchangeGoogleIdToken, refreshTokenPair } from '@/lib/auth/allauth'
import { isAccessTokenExpired } from '@/lib/auth/tokens'

export type AuthTokenError = 'MissingIdToken' | 'TokenExchangeError' | 'RefreshTokenError'

export interface AuthTokenState {
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: number
  error?: AuthTokenError
}

export interface ProviderAccount {
  provider?: string
  id_token?: string
}

export interface ResolveAuthTokenDeps {
  exchange: typeof exchangeGoogleIdToken
  refresh: typeof refreshTokenPair
  now: () => number
}

const defaultDeps: ResolveAuthTokenDeps = {
  exchange: exchangeGoogleIdToken,
  refresh: refreshTokenPair,
  now: Date.now,
}

export async function resolveAuthToken<T extends AuthTokenState>(
  args: { token: T; account?: ProviderAccount | null },
  deps: ResolveAuthTokenDeps = defaultDeps,
): Promise<T & AuthTokenState> {
  const { token, account } = args

  // 1. Fresh sign-in. `account` is only passed on the first call after a
  //    successful provider login, which is why the exchange belongs here.
  if (account?.provider === 'google') {
    if (!account.id_token) {
      return { ...token, error: 'MissingIdToken' }
    }
    try {
      const pair = await deps.exchange(account.id_token)
      return { ...token, ...pair, error: undefined }
    } catch {
      return { ...token, error: 'TokenExchangeError' }
    }
  }

  // 2. Nothing to refresh with - a previous exchange must have failed.
  if (!token.refreshToken) return token

  // 3. Still valid (minus the skew window): no network call at all.
  if (!isAccessTokenExpired(token, deps.now())) return token

  // 4. Expired. allauth rotates, so the new refresh token must replace the old.
  try {
    const pair = await deps.refresh(token.refreshToken)
    return { ...token, ...pair, error: undefined }
  } catch {
    // Drop both tokens so the API mutator cannot send a stale bearer, and
    // surface the failure so the UI can force a re-login.
    return {
      ...token,
      accessToken: undefined,
      refreshToken: undefined,
      accessTokenExpiresAt: undefined,
      error: 'RefreshTokenError',
    }
  }
}
