import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The module reads env at import time and holds its own reference to the
 * posthog singleton, so each case resets the registry and takes both together.
 */
async function loadAnalytics(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  const posthog = (await import('posthog-js')).default
  const spies = {
    capture: vi.spyOn(posthog, 'capture').mockReturnValue(undefined),
    identify: vi.spyOn(posthog, 'identify').mockReturnValue(undefined),
    reset: vi.spyOn(posthog, 'reset').mockReturnValue(undefined),
    captureException: vi.spyOn(posthog, 'captureException').mockReturnValue(undefined),
  }
  return { ...(await import('./analytics')), spies }
}

const configured = {
  NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
  NEXT_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('posthogConfig', () => {
  it('is null in development even when both variables are set', async () => {
    const { posthogConfig, analyticsEnabled } = await loadAnalytics({
      NODE_ENV: 'development',
      ...configured,
    })

    expect(posthogConfig).toBeNull()
    expect(analyticsEnabled).toBe(false)
  })

  it('carries the key and host outside development', async () => {
    const { posthogConfig, analyticsEnabled } = await loadAnalytics({
      NODE_ENV: 'production',
      ...configured,
    })

    expect(posthogConfig).toEqual({ key: 'phc_test', host: 'https://us.i.posthog.com' })
    expect(analyticsEnabled).toBe(true)
  })

  it('is null outside development when a variable is missing', async () => {
    const { posthogConfig } = await loadAnalytics({
      NODE_ENV: 'production',
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
      NEXT_PUBLIC_POSTHOG_HOST: undefined,
    })

    expect(posthogConfig).toBeNull()
  })
})

describe('analytics', () => {
  it('does not reach posthog in development', async () => {
    const { analytics, spies } = await loadAnalytics({ NODE_ENV: 'development', ...configured })

    analytics.capture('catalog_search_submitted', { has_query: true })
    analytics.identify('user-1', { email: 'a@b.c' })
    analytics.reset()
    analytics.captureException(new Error('boom'))

    expect(spies.capture).not.toHaveBeenCalled()
    expect(spies.identify).not.toHaveBeenCalled()
    expect(spies.reset).not.toHaveBeenCalled()
    expect(spies.captureException).not.toHaveBeenCalled()
  })

  it('forwards to posthog outside development', async () => {
    const { analytics, spies } = await loadAnalytics({ NODE_ENV: 'production', ...configured })

    analytics.capture('catalog_search_submitted', { has_query: true })
    analytics.identify('user-1', { email: 'a@b.c' })
    analytics.reset()

    expect(spies.capture).toHaveBeenCalledWith('catalog_search_submitted', { has_query: true })
    expect(spies.identify).toHaveBeenCalledWith('user-1', { email: 'a@b.c' })
    expect(spies.reset).toHaveBeenCalled()
  })
})
