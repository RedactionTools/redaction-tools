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
  // Not for FormData: its Content-Type carries a boundary only the browser
  // knows, and labelling a multipart body as JSON makes Django parse it as an
  // empty POST - the upload arrives with no file and no error.
  const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isMultipart && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = await getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  // Server-rendered calls reach gunicorn directly over the compose network, as
  // plain HTTP - Caddy, which sets this header for browser traffic, is not in
  // that path. production.py pairs SECURE_SSL_REDIRECT with
  // SECURE_PROXY_SSL_HEADER, so without it Django 301s to https://backend:8007,
  // a port that speaks no TLS, and the render hangs until it times out. Never
  // from the browser: a custom header there forces a CORS preflight the API
  // does not allow.
  if (typeof window === 'undefined') headers.set('X-Forwarded-Proto', 'https')

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
