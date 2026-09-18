import { describe, expect, it } from 'vitest'

import { makeTool } from '@/features/catalog/fixtures'

import { buildSitemapEntries } from './sitemap'

const SITE = 'https://redaction-tools.com'

describe('buildSitemapEntries', () => {
  it('lists the hub and the trust pages', () => {
    const urls = buildSitemapEntries(SITE, []).map((entry) => entry.url)

    expect(urls).toContain(`${SITE}/`)
    expect(urls).toContain(`${SITE}/methodology`)
    expect(urls).toContain(`${SITE}/submit`)
  })

  it('gives every tool its canonical URL', () => {
    const urls = buildSitemapEntries(SITE, [makeTool()]).map((entry) => entry.url)

    expect(urls).toContain(`${SITE}/tool/adobe-acrobat`)
  })

  it('dates a tool by its last price CHANGE, not its last verification', () => {
    const tool = makeTool()
    tool.price_summary.last_changed_at = '2026-07-02T00:00:00Z'
    tool.price_summary.last_verified_at = '2026-09-15T00:00:00Z'

    const entry = buildSitemapEntries(SITE, [tool]).find((e) => e.url.endsWith('adobe-acrobat'))

    expect(entry?.lastModified).toBe('2026-07-02T00:00:00Z')
  })

  it('falls back to the verification date when a price has never moved', () => {
    const entry = buildSitemapEntries(SITE, [makeTool()]).find((e) =>
      e.url.endsWith('adobe-acrobat'),
    )

    expect(entry?.lastModified).toBe('2026-09-15T00:00:00Z')
  })

  it('never emits a filtered hub URL', () => {
    const urls = buildSitemapEntries(SITE, [makeTool()]).map((entry) => entry.url)

    expect(urls.some((url) => url.includes('?'))).toBe(false)
  })

  it('lists the calculator among the static routes', () => {
    const entries = buildSitemapEntries('https://example.com', [])

    expect(entries.map((entry) => entry.url)).toContain('https://example.com/price-calculator')
  })
})
