import { describe, expect, it, vi } from 'vitest'

import { resolveAuthToken, type ResolveAuthTokenDeps } from '@/lib/auth/resolve-token'
import type { TokenPair } from '@/lib/auth/tokens'

const NOW = 1_700_000_000_000

const freshPair: TokenPair = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  accessTokenExpiresAt: NOW + 900_000,
}

function deps(overrides: Partial<ResolveAuthTokenDeps> = {}): ResolveAuthTokenDeps {
  return {
    exchange: vi.fn().mockResolvedValue(freshPair),
    refresh: vi.fn().mockResolvedValue(freshPair),
    now: () => NOW,
    ...overrides,
  }
}

describe('resolveAuthToken on sign-in', () => {
  it('exchanges the Google id token for our own pair', async () => {
    const d = deps()

    const result = await resolveAuthToken(
      { token: {}, account: { provider: 'google', id_token: 'gid' } },
      d,
    )

    expect(d.exchange).toHaveBeenCalledWith('gid')
    expect(result).toMatchObject(freshPair)
    expect(result.error).toBeUndefined()
  })

  it('reports MissingIdToken without calling allauth', async () => {
    const d = deps()

    const result = await resolveAuthToken({ token: {}, account: { provider: 'google' } }, d)

    expect(d.exchange).not.toHaveBeenCalled()
    expect(result.error).toBe('MissingIdToken')
  })

  it('reports TokenExchangeError when allauth rejects the id token', async () => {
    const d = deps({ exchange: vi.fn().mockRejectedValue(new Error('boom')) })

    const result = await resolveAuthToken(
      { token: {}, account: { provider: 'google', id_token: 'gid' } },
      d,
    )

    expect(result.error).toBe('TokenExchangeError')
  })
})

describe('resolveAuthToken on subsequent calls', () => {
  it('returns an unexpired token untouched and makes no network call', async () => {
    const d = deps()
    const token = {
      accessToken: 'still-good',
      refreshToken: 'r1',
      accessTokenExpiresAt: NOW + 600_000,
    }

    const result = await resolveAuthToken({ token }, d)

    expect(result).toEqual(token)
    expect(d.refresh).not.toHaveBeenCalled()
  })

  it('rotates an expired token and keeps the new refresh token', async () => {
    const d = deps()
    const token = { accessToken: 'stale', refreshToken: 'r1', accessTokenExpiresAt: NOW - 1 }

    const result = await resolveAuthToken({ token }, d)

    expect(d.refresh).toHaveBeenCalledWith('r1')
    expect(result.refreshToken).toBe('new-refresh')
    expect(result.error).toBeUndefined()
  })

  it('clears both tokens when the refresh is rejected, so no stale bearer is sent', async () => {
    const d = deps({ refresh: vi.fn().mockRejectedValue(new Error('400')) })
    const token = { accessToken: 'stale', refreshToken: 'r1', accessTokenExpiresAt: NOW - 1 }

    const result = await resolveAuthToken({ token }, d)

    expect(result.error).toBe('RefreshTokenError')
    expect(result.accessToken).toBeUndefined()
    expect(result.refreshToken).toBeUndefined()
  })

  it('leaves a token with no refresh token alone', async () => {
    const d = deps()

    const result = await resolveAuthToken({ token: { error: 'TokenExchangeError' } }, d)

    expect(d.refresh).not.toHaveBeenCalled()
    expect(result.error).toBe('TokenExchangeError')
  })

  it('ignores an account from a provider we do not handle', async () => {
    const d = deps()
    const token = { accessToken: 'a', refreshToken: 'r1', accessTokenExpiresAt: NOW + 600_000 }

    const result = await resolveAuthToken({ token, account: { provider: 'github' } }, d)

    expect(d.exchange).not.toHaveBeenCalled()
    expect(result).toEqual(token)
  })
})
