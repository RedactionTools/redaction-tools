/**
 * The Orval mutator: every generated hook routes through this function.
 *
 * It prepends the origin (the spec has `servers: []` and fully-prefixed paths)
 * and attaches the bearer token from whichever source this runtime registered.
 */
import { ApiError } from '@/lib/api/api-error'
import { apiOrigin } from '@/lib/api/base-url'
import { getAccessToken } from '@/lib/api/token-source'

export const customFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = await getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${apiOrigin()}${url}`, {
    ...options,
    headers,
    // Bearer auth only - never send the Django session cookie to the API.
    credentials: 'omit',
    cache: 'no-store',
  })

  if (!response.ok) throw await ApiError.fromResponse(response, url)
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
