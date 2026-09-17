export interface TokenPair {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds, read from the access token's own `exp` claim. */
  accessTokenExpiresAt: number
}

/** Refresh this far ahead of real expiry so an in-flight request cannot 401. */
export const EXPIRY_SKEW_MS = 30_000

/**
 * Fallback when an access token carries no readable `exp`. Matches the
 * backend's JWT_ACCESS_TOKEN_LIFETIME default of 900 seconds.
 */
export const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

export function isAccessTokenExpired(
  token: { accessToken?: string; accessTokenExpiresAt?: number },
  now: number = Date.now(),
): boolean {
  if (!token.accessToken || token.accessTokenExpiresAt === undefined) return true
  return token.accessTokenExpiresAt - EXPIRY_SKEW_MS <= now
}
