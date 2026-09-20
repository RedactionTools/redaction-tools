import { describe, expect, it } from 'vitest'

import { SITE_DESCRIPTION, SITE_NAME, SITE_SOCIAL_URLS } from './site'

describe('SITE_DESCRIPTION', () => {
  it('fits the snippet a search result gives it', () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160)
  })

  // This string is the fallback description on every page that sets none of its
  // own, so it is the one most likely to be read out of context - and it spent
  // its first months promising a benchmark leaderboard that is phase 4.
  it('claims no feature the catalog does not have', () => {
    expect(SITE_DESCRIPTION).not.toMatch(/benchmark|leaderboard/i)
  })

  it('names what the catalog actually compares', () => {
    expect(SITE_DESCRIPTION).toMatch(/price/i)
  })
})

describe('SITE_NAME', () => {
  it('is the wordmark the header and the title template share', () => {
    expect(SITE_NAME).toBe('Redaction Tools')
  })
})

describe('SITE_SOCIAL_URLS', () => {
  // These are the `sameAs` of the Organization node. A relative or http URL
  // there is a claim that cannot be resolved back to us.
  it('gives every profile as an absolute https URL', () => {
    expect(SITE_SOCIAL_URLS.length).toBeGreaterThan(0)
    for (const url of SITE_SOCIAL_URLS) {
      expect(url).toMatch(/^https:\/\//)
    }
  })

  it('lists each profile once', () => {
    expect(new Set(SITE_SOCIAL_URLS).size).toBe(SITE_SOCIAL_URLS.length)
  })
})
