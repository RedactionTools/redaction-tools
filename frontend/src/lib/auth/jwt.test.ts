import { describe, expect, it } from 'vitest'

import { readJwtExpiry } from '@/lib/auth/jwt'

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`
}

describe('readJwtExpiry', () => {
  it('returns the exp claim in epoch milliseconds', () => {
    const token = tokenWithPayload({ exp: 1_700_000_000, sub: 'user-id' })

    expect(readJwtExpiry(token)).toBe(1_700_000_000_000)
  })

  it('returns null for a string that is not a JWT', () => {
    expect(readJwtExpiry('not-a-jwt')).toBeNull()
  })

  it('returns null when exp is not a number', () => {
    const token = tokenWithPayload({ exp: '1700000000' })

    expect(readJwtExpiry(token)).toBeNull()
  })

  it('returns null when the payload is not valid base64url JSON', () => {
    expect(readJwtExpiry('header.@@@not-base64@@@.signature')).toBeNull()
  })

  it('decodes a payload containing non-ASCII characters', () => {
    const token = tokenWithPayload({ exp: 1_700_000_000, name: 'Zoe' })

    expect(readJwtExpiry(token)).toBe(1_700_000_000_000)
  })
})
