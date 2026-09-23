import { describe, expect, it } from 'vitest'

import { canonicalMetadata } from './canonical'

describe('canonicalMetadata', () => {
  // The whole reason the two are returned together: a page that says one URL to
  // a search engine and another (or none) to a social scraper has two
  // identities for one page.
  it('tells a search engine and a social scraper the same URL', () => {
    const { alternates, openGraph } = canonicalMetadata('/tool/adobe-acrobat')

    expect(alternates?.canonical).toBe('/tool/adobe-acrobat')
    expect(openGraph?.url).toBe('/tool/adobe-acrobat')
  })

  // `openGraph` is assigned wholesale rather than merged, so a page that set
  // `openGraph: { url }` by hand would silently drop everything the root
  // layout declares. This hands back the lot precisely so it cannot.
  it('carries the site identity a page would otherwise drop', () => {
    const { openGraph } = canonicalMetadata('/methodology')

    expect(openGraph).toMatchObject({
      type: 'website',
      siteName: 'Redaction Tools',
      locale: 'en_US',
    })
  })

  it('keeps the path relative, for metadataBase to resolve', () => {
    const { openGraph } = canonicalMetadata('/')

    expect(openGraph?.url).toBe('/')
  })
})

describe('the share card a page claims', () => {
  // Declaring `openGraph` at all replaces what the root layout resolved,
  // including the image Next injected from `app/opengraph-image.tsx`. A page
  // with no card of its own has to name the site's, or it ships with none.
  it('names the site card for a route that has none of its own', () => {
    const { openGraph } = canonicalMetadata('/methodology')

    expect(openGraph?.images).toMatchObject([{ url: '/opengraph-image', width: 1200, height: 630 }])
  })

  // The mirror image: Next re-injects a route's own opengraph-image only when
  // that route's metadata has not set `images`. Naming one here would beat the
  // per-tool card and put the generic one on every profile.
  it('leaves images unset for a route that draws its own', () => {
    const { openGraph } = canonicalMetadata('/tool/adobe-acrobat', { hasRouteImage: true })

    expect(openGraph).not.toHaveProperty('images')
  })
})

describe('social wording that differs from the page title', () => {
  // Next fills og:title and og:description from the page's own title and
  // description, which is right nearly everywhere. A page is only allowed to
  // diverge deliberately - a title written for a search result reads badly as
  // a share card, and vice versa.
  it('says nothing of its own when the page title will do', () => {
    const { openGraph } = canonicalMetadata('/methodology')

    expect(openGraph).not.toHaveProperty('title')
    expect(openGraph).not.toHaveProperty('description')
  })

  it('carries a separate social title and description when given them', () => {
    const { openGraph } = canonicalMetadata('/', {
      socialTitle: 'Share card title',
      socialDescription: 'Share card description',
    })

    expect(openGraph?.title).toBe('Share card title')
    expect(openGraph?.description).toBe('Share card description')
  })
})

describe('a blog post', () => {
  const article = {
    publishedTime: '2026-09-23',
    modifiedTime: '2026-10-01',
    authors: ['Mykola Melnyk'],
    tags: ['Catalog'],
  }

  // `og:type=article` is what unlocks article:published_time and friends; a
  // post described as a website shares like a homepage.
  it('describes itself as an article, with its dates, authors and tags', () => {
    const { openGraph } = canonicalMetadata('/blog/hello', { article })

    expect(openGraph).toMatchObject({ type: 'article', url: '/blog/hello', ...article })
  })

  it('still carries the site identity', () => {
    const { openGraph } = canonicalMetadata('/blog/hello', { article })

    expect(openGraph).toMatchObject({ siteName: 'Redaction Tools', locale: 'en_US' })
  })
})

describe('feeds a page advertises', () => {
  // `alternates` is assigned wholesale like `openGraph`, so a page adding
  // `alternates.types` itself would drop its canonical.
  it('names the feed beside the canonical', () => {
    const { alternates } = canonicalMetadata('/blog', {
      feeds: [{ url: '/blog/rss.xml', title: 'Redaction Tools blog' }],
    })

    expect(alternates).toEqual({
      canonical: '/blog',
      types: { 'application/rss+xml': [{ url: '/blog/rss.xml', title: 'Redaction Tools blog' }] },
    })
  })

  it('names none by default', () => {
    expect(canonicalMetadata('/blog').alternates).toEqual({ canonical: '/blog' })
  })
})
