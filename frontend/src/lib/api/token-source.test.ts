import { describe, expect, it } from 'vitest'

import { getAccessToken, setTokenSource } from '@/lib/api/token-source'

describe('token source', () => {
  it('returns null before a source is registered', async () => {
    await expect(getAccessToken()).resolves.toBeNull()
  })

  it('returns the value from a registered synchronous source', async () => {
    setTokenSource(() => 'access-token')

    await expect(getAccessToken()).resolves.toBe('access-token')
  })

  it('awaits an asynchronous source', async () => {
    setTokenSource(async () => 'async-token')

    await expect(getAccessToken()).resolves.toBe('async-token')
  })

  it('normalises an undefined source result to null', async () => {
    setTokenSource(() => undefined as unknown as null)

    await expect(getAccessToken()).resolves.toBeNull()
  })
})
