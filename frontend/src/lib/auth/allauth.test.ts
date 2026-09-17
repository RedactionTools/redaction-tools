import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AllauthError, exchangeGoogleIdToken, refreshTokenPair } from '@/lib/auth/allauth'
import { DEFAULT_ACCESS_TOKEN_TTL_MS } from '@/lib/auth/tokens'

const NOW = 1_700_000_000_000
const EXP_SECONDS = 1_700_000_900

function jwtWithExp(exp?: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(exp === undefined ? {} : { exp })}.signature`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.setSystemTime(NOW)
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('exchangeGoogleIdToken', () => {
  it('posts the provider-token payload allauth expects', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ meta: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r1' } }),
    )

    await exchangeGoogleIdToken('google-id-token')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://localhost:8007/_allauth/app/v1/auth/provider/token')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      provider: 'google',
      process: 'login',
      token: { client_id: 'test-google-client-id', id_token: 'google-id-token' },
    })
  })

  it('marks the call TLS-terminated, or SECURE_SSL_REDIRECT 301s the POST into a bodyless GET', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ meta: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r1' } }),
    )

    await exchangeGoogleIdToken('gid')

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('X-Forwarded-Proto')).toBe('https')
  })

  it('takes the expiry from the access token rather than assuming a lifetime', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ meta: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r1' } }),
    )

    const pair = await exchangeGoogleIdToken('gid')

    expect(pair.accessTokenExpiresAt).toBe(EXP_SECONDS * 1000)
    expect(pair.refreshToken).toBe('r1')
  })

  it('falls back to the default lifetime when the token has no exp claim', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ meta: { access_token: jwtWithExp(), refresh_token: 'r1' } }),
    )

    const pair = await exchangeGoogleIdToken('gid')

    expect(pair.accessTokenExpiresAt).toBe(NOW + DEFAULT_ACCESS_TOKEN_TTL_MS)
  })

  it('throws AllauthError carrying the status on a failed exchange', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ status: 400 }, 400))

    await expect(exchangeGoogleIdToken('gid')).rejects.toMatchObject({
      name: 'AllauthError',
      status: 400,
    })
  })

  it('throws when the response shape is unexpected', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}))

    await expect(exchangeGoogleIdToken('gid')).rejects.toBeInstanceOf(AllauthError)
  })
})

describe('refreshTokenPair', () => {
  it('posts the refresh token to the rotation endpoint', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r2' } }),
    )

    await refreshTokenPair('r1')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://localhost:8007/_allauth/app/v1/tokens/refresh')
    expect(JSON.parse(init?.body as string)).toEqual({ refresh_token: 'r1' })
  })

  it('marks the rotation call TLS-terminated too', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r2' } }),
    )

    await refreshTokenPair('r1')

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('X-Forwarded-Proto')).toBe('https')
  })

  it('returns the ROTATED refresh token, not the one it was given', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { access_token: jwtWithExp(EXP_SECONDS), refresh_token: 'r2' } }),
    )

    const pair = await refreshTokenPair('r1')

    expect(pair.refreshToken).toBe('r2')
    expect(pair.accessTokenExpiresAt).toBe(EXP_SECONDS * 1000)
  })

  it('throws AllauthError when the refresh token is rejected', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ status: 400 }, 400))

    await expect(refreshTokenPair('stale')).rejects.toMatchObject({ status: 400 })
  })
})
