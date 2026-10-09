import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { confirmEmailLogin } from '@/lib/auth/email-login'

const NOW = 1_700_000_000_000
const EXP_SECONDS = 1_700_000_900

function jwtWithExp(exp: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode({ exp })}.signature`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const tokenBody = () => ({
  access_token: jwtWithExp(EXP_SECONDS),
  refresh_token: 'r1',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: 'u1', email: 'reader@example.com', name: 'Reader', is_staff: false },
})

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.setSystemTime(NOW)
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('confirmEmailLogin', () => {
  it('trades the emailed code for our token pair', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenBody()))

    const { tokens, user } = await confirmEmailLogin({
      email: 'reader@example.com',
      code: '042917',
    })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('http://localhost:8007/api/v1/auth/email-login/confirm')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'reader@example.com',
      code: '042917',
    })
    expect(tokens).toEqual({
      accessToken: tokenBody().access_token,
      refreshToken: 'r1',
      accessTokenExpiresAt: EXP_SECONDS * 1000,
    })
    expect(user).toEqual({ id: 'u1', email: 'reader@example.com', name: 'Reader' })
  })

  it('trades the link token the same way', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenBody()))

    await confirmEmailLogin({ token: 'link-token' })

    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({ token: 'link-token' })
  })

  it('throws on a wrong or expired code', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ detail: 'wrong' }, 400))

    await expect(confirmEmailLogin({ token: 'stale' })).rejects.toBeInstanceOf(ApiError)
  })
})
