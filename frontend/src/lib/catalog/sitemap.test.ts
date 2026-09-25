import { describe, expect, it } from 'vitest'

import { makeTool } from '@/features/catalog/fixtures'

import type { BlogPostMeta } from '@/lib/blog/posts'

import { buildSitemapEntries } from './sitemap'

function post(overrides: Partial<BlogPostMeta> & { slug: string }): BlogPostMeta {
  return {
    url: `/blog/${overrides.slug}`,
    title: overrides.slug,
    description: '',
    date: '2026-01-01',
    draft: false,
    tags: [],
    authors: ['mykola-melnyk'],
    readingMinutes: 1,
    ...overrides,
  }
}

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

describe('the blog in the sitemap', () => {
  const posts = [
    post({ slug: 'newer', date: '2026-09-23', lastmod: '2026-10-01', tags: ['Catalog'] }),
    post({ slug: 'older', date: '2026-01-01', tags: ['Catalog', 'PDF redaction'] }),
  ]
  const entries = buildSitemapEntries(SITE, [], [], posts)
  const byUrl = (url: string) => entries.find((entry) => entry.url === url)

  it('lists every post, dated by its last edit', () => {
    expect(byUrl(`${SITE}/blog/newer`)?.lastModified).toBe('2026-10-01')
    expect(byUrl(`${SITE}/blog/older`)?.lastModified).toBe('2026-01-01')
  })

  it('dates the blog index by its newest change', () => {
    expect(byUrl(`${SITE}/blog`)?.lastModified).toBe('2026-10-01')
  })

  it('lists each tag once', () => {
    const tags = entries.filter((entry) => entry.url.startsWith(`${SITE}/blog/tags/`))

    expect(tags.map((entry) => entry.url)).toEqual([
      `${SITE}/blog/tags/catalog`,
      `${SITE}/blog/tags/pdf-redaction`,
    ])
  })

  // Page 2 of an archive is a moving window over the same posts; listing it
  // asks a crawler to index something that shifts under every new post.
  it('leaves out archive pages', () => {
    expect(entries.some((entry) => entry.url.includes('/page/'))).toBe(false)
  })

  it('still lists the blog index when nothing is published', () => {
    const urls = buildSitemapEntries(SITE, [], [], []).map((entry) => entry.url)

    expect(urls).toContain(`${SITE}/blog`)
  })
})

describe('benchmark routes', () => {
  it('lists every benchmark path it is handed, a leaderboard above the pages under it', () => {
    const entries = buildSitemapEntries(
      SITE,
      [],
      [],
      [],
      ['/benchmarks', '/benchmarks/pdf', '/benchmarks/pdf/tools/pdf-redaction'],
    )

    const benchmarks = entries.filter((entry) => entry.url.includes('/benchmarks'))
    expect(benchmarks.map((entry) => entry.url)).toEqual([
      `${SITE}/benchmarks`,
      `${SITE}/benchmarks/pdf`,
      `${SITE}/benchmarks/pdf/tools/pdf-redaction`,
    ])
    expect(benchmarks[1].priority).toBeGreaterThan(benchmarks[2].priority!)
  })
})
