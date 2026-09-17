import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { customFetch } from '@/lib/api/fetcher'
import { setTokenSource } from '@/lib/api/token-source'

let fetchSpy: ReturnType<typeof vi.spyOn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'ok' }))
})

describe('customFetch', () => {
  it('prepends the API origin to the spec-relative path', async () => {
    await customFetch('/api/v1/health', { method: 'GET' })

    expect(fetchSpy.mock.calls[0][0]).toBe('http://localhost:8007/api/v1/health')
  })

  it('returns the parsed body, not the response envelope', async () => {
    await expect(customFetch('/api/v1/health', { method: 'GET' })).resolves.toEqual({
      status: 'ok',
    })
  })

  it('attaches the bearer token from the registered source', async () => {
    setTokenSource(() => 'access-token')

    await customFetch('/api/v1/auth/me', { method: 'GET' })

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-token')
  })

  it('omits the Authorization header entirely when there is no token', async () => {
    await customFetch('/api/v1/health', { method: 'GET' })

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.has('Authorization')).toBe(false)
  })

  it('never sends cookies, because the API is bearer-only', async () => {
    await customFetch('/api/v1/health', { method: 'GET' })

    expect(fetchSpy.mock.calls[0][1]?.credentials).toBe('omit')
  })

  it('throws ApiError carrying the status on a 401', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ detail: 'Unauthorized' }, 401))

    await expect(customFetch('/api/v1/auth/me', { method: 'GET' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
  })

  it('resolves to undefined for a 204', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(customFetch('/api/v1/thing', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('exposes the failing url on the error', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 500))

    const error: unknown = await customFetch('/api/v1/health', { method: 'GET' }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).url).toBe('/api/v1/health')
  })
})
