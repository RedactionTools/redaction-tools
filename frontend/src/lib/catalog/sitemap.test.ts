import { describe, expect, it } from 'vitest'

import { makeTool } from '@/features/catalog/fixtures'

import { buildSitemapEntries } from './sitemap'

const SITE = 'https://redaction-tools.com'

describe('buildSitemapEntries', () => {
  it('lists the hub and the trust pages', () => {
    const urls = buildSitemapEntries(SITE, []).map((entry) => entry.url)

    expect(urls).toContain(`${SITE}/`)
    expect(urls).toContain(`${SITE}/submit`)
    expect(urls).toContain(`${SITE}/price-calculator`)
  })

  it('lists every docs page it is handed', () => {
    const urls = buildSitemapEntries(SITE, [], ['/docs', '/docs/methodology']).map((e) => e.url)

    expect(urls).toContain(`${SITE}/docs`)
    expect(urls).toContain(`${SITE}/docs/methodology`)
  })

  /**
   * The methodology moved into the docs and its old URL 308s. A sitemap that
   * still listed it would spend crawl budget proving the page had moved.
   */
  it('does not list a URL that redirects', () => {
    const urls = buildSitemapEntries(SITE, [], ['/docs/methodology']).map((e) => e.url)

    expect(urls).not.toContain(`${SITE}/methodology`)
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

describe('the hub entry', () => {
  const hubOf = (tools: Parameters<typeof buildSitemapEntries>[1]) =>
    buildSitemapEntries(SITE, tools).find((entry) => entry.url === `${SITE}/`)

  it('is dated by the newest price change in the catalog', () => {
    const older = makeTool()
    older.price_summary.last_changed_at = '2026-05-01T00:00:00Z'
    const newer = makeTool()
    newer.slug = 'nitro-pdf'
    newer.price_summary.last_changed_at = '2026-08-20T00:00:00Z'

    expect(hubOf([older, newer])?.lastModified).toBe('2026-08-20T00:00:00Z')
  })

  it('falls back to a verification when a tool has never moved its price', () => {
    const tool = makeTool()
    tool.price_summary.last_changed_at = null
    tool.price_summary.last_verified_at = '2026-09-15T00:00:00Z'

    expect(hubOf([tool])?.lastModified).toBe('2026-09-15T00:00:00Z')
  })

  // Claiming a date we cannot source is worse than claiming none: a lastmod
  // that moves on every deploy devalues the signal for the whole domain.
  it('goes undated when there is nothing to date it by', () => {
    expect(hubOf([])?.lastModified).toBeUndefined()
  })

  it('leaves the trust pages undated, having only the build date to offer', () => {
    const entries = buildSitemapEntries(SITE, [makeTool()], ['/docs/methodology'])

    for (const path of ['/submit', '/price-calculator', '/docs/methodology']) {
      expect(entries.find((entry) => entry.url === `${SITE}${path}`)?.lastModified).toBeUndefined()
    }
  })
})
