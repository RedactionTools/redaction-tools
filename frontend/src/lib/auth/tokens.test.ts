import { describe, expect, it } from 'vitest'

import { EXPIRY_SKEW_MS, isAccessTokenExpired } from '@/lib/auth/tokens'

const NOW = 1_700_000_000_000

describe('isAccessTokenExpired', () => {
  it('is false for a token with plenty of life left', () => {
    expect(
      isAccessTokenExpired({ accessToken: 't', accessTokenExpiresAt: NOW + 600_000 }, NOW),
    ).toBe(false)
  })

  it('is true for a token that already expired', () => {
    expect(isAccessTokenExpired({ accessToken: 't', accessTokenExpiresAt: NOW - 1 }, NOW)).toBe(
      true,
    )
  })

  it('is true inside the skew window, so an in-flight request cannot 401', () => {
    const expiresAt = NOW + EXPIRY_SKEW_MS - 1

    expect(isAccessTokenExpired({ accessToken: 't', accessTokenExpiresAt: expiresAt }, NOW)).toBe(
      true,
    )
  })

  it('is true when there is no access token at all', () => {
    expect(isAccessTokenExpired({ accessTokenExpiresAt: NOW + 600_000 }, NOW)).toBe(true)
  })

  it('is true when the expiry is unknown', () => {
    expect(isAccessTokenExpired({ accessToken: 't' }, NOW)).toBe(true)
  })
})
