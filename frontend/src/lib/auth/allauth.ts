/**
 * The django-allauth headless endpoints that mint and rotate our JWTs.
 *
 * These live at /_allauth/, outside backend/openapi.json (allauth serves its own
 * spec, and only from a running server), so Orval generates nothing for them.
 * That makes zod the type boundary here rather than redundant validation.
 */
import { z } from 'zod'

import { serverApiOrigin } from '@/lib/api/base-url'
import { readJwtExpiry } from '@/lib/auth/jwt'
import { DEFAULT_ACCESS_TOKEN_TTL_MS, type TokenPair } from '@/lib/auth/tokens'

const ALLAUTH = '/_allauth/app/v1'

export class AllauthError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AllauthError'
    this.status = status
  }
}

const providerTokenResponse = z.object({
  meta: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
})

const refreshResponse = z.object({
  data: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
})

function toPair(accessToken: string, refreshToken: string): TokenPair {
  return {
    accessToken,
    refreshToken,
    // The refresh endpoint returns no `expires_in`, so read the token's own exp.
    accessTokenExpiresAt: readJwtExpiry(accessToken) ?? Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS,
  }
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${serverApiOrigin()}${ALLAUTH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new AllauthError(`${path} responded ${response.status}`, response.status)
  }
  return response.json()
}

export async function exchangeGoogleIdToken(idToken: string): Promise<TokenPair> {
  const raw = await postJson('/auth/provider/token', {
    provider: 'google',
    process: 'login',
    token: { client_id: process.env.AUTH_GOOGLE_ID, id_token: idToken },
  })

  const parsed = providerTokenResponse.safeParse(raw)
  if (!parsed.success) throw new AllauthError('Unexpected provider/token response')

  return toPair(parsed.data.meta.access_token, parsed.data.meta.refresh_token)
}

export async function refreshTokenPair(refreshToken: string): Promise<TokenPair> {
  // allauth 400s on an invalid or expired refresh token; postJson turns that
  // into an AllauthError, which the caller treats as "force a re-login".
  const raw = await postJson('/tokens/refresh', { refresh_token: refreshToken })

  const parsed = refreshResponse.safeParse(raw)
  if (!parsed.success) throw new AllauthError('Unexpected tokens/refresh response')

  // Rotation: this refresh token is new and must replace the stored one.
  return toPair(parsed.data.data.access_token, parsed.data.data.refresh_token)
}
