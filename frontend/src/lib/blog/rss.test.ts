import { describe, expect, it } from 'vitest'

import type { BlogPostMeta } from './posts'
import { buildRssFeed } from './rss'

const SITE = 'https://redaction.tools'

function post(overrides: Partial<BlogPostMeta> & { slug: string }): BlogPostMeta {
  return {
    url: `/blog/${overrides.slug}`,
    title: overrides.slug,
    description: 'A post.',
    date: '2026-09-23',
    draft: false,
    tags: [],
    authors: ['mykola-melnyk'],
    readingMinutes: 1,
    ...overrides,
  }
}

const channel = { title: 'Redaction Tools blog', description: 'News.', path: '/blog/rss.xml' }

describe('buildRssFeed', () => {
  it('describes the channel and points it at itself', () => {
    const xml = buildRssFeed(SITE, [], channel)

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<title>Redaction Tools blog</title>')
    expect(xml).toContain('<link>https://redaction.tools/blog</link>')
    expect(xml).toContain(
      '<atom:link href="https://redaction.tools/blog/rss.xml" rel="self" type="application/rss+xml"/>',
    )
  })

  it('lists each post with an absolute link, a stable guid and an RFC 822 date', () => {
    const xml = buildRssFeed(SITE, [post({ slug: 'hello', title: 'Hello' })], channel)

    expect(xml).toContain('<title>Hello</title>')
    expect(xml).toContain('<link>https://redaction.tools/blog/hello</link>')
    expect(xml).toContain('<guid isPermaLink="true">https://redaction.tools/blog/hello</guid>')
    expect(xml).toContain('<pubDate>Wed, 23 Sep 2026 00:00:00 GMT</pubDate>')
    expect(xml).toContain('<description>A post.</description>')
  })

  it('dates the channel by its newest post', () => {
    const xml = buildRssFeed(
      SITE,
      [post({ slug: 'new', date: '2026-09-23' }), post({ slug: 'old', date: '2025-01-01' })],
      channel,
    )

    expect(xml).toContain('<lastBuildDate>Wed, 23 Sep 2026 00:00:00 GMT</lastBuildDate>')
  })

  it('files each post under its tags', () => {
    const xml = buildRssFeed(SITE, [post({ slug: 'a', tags: ['Catalog', 'Pricing'] })], channel)

    expect(xml).toContain('<category>Catalog</category><category>Pricing</category>')
  })

  // A title with an ampersand would otherwise make the whole feed invalid XML,
  // and a reader rejects all of it rather than the one item.
  it('escapes what XML would choke on', () => {
    const xml = buildRssFeed(
      SITE,
      [post({ slug: 'a', title: 'GDPR & <HIPAA>', description: `"Quotes" 'too'` })],
      channel,
    )

    expect(xml).toContain('<title>GDPR &amp; &lt;HIPAA&gt;</title>')
    expect(xml).toContain('<description>&quot;Quotes&quot; &apos;too&apos;</description>')
  })
})
