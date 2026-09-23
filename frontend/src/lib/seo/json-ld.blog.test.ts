import { describe, expect, it } from 'vitest'

import type { BlogPostMeta } from '@/lib/blog/posts'

import { blogJsonLd, blogPostingJsonLd, organizationId, personId, personJsonLd } from './json-ld'

const SITE = 'https://redaction-tools.com'

const POST: BlogPostMeta = {
  slug: 'hello',
  url: '/blog/hello',
  title: 'Hello',
  description: 'A post.',
  date: '2026-09-23',
  draft: false,
  tags: ['Catalog'],
  authors: ['mykola-melnyk'],
  keywords: ['redaction'],
  readingMinutes: 3,
}

describe('personJsonLd', () => {
  it('names the author under a stable @id', () => {
    expect(personJsonLd(SITE, 'mykola-melnyk', { name: 'Mykola Melnyk' })).toEqual({
      '@type': 'Person',
      '@id': personId(SITE, 'mykola-melnyk'),
      name: 'Mykola Melnyk',
    })
  })

  // `sameAs` is how a search engine joins this author to the profiles it
  // already knows; an empty one says nothing and is left out.
  it('lists the profiles the author published, and only those', () => {
    const node = personJsonLd(SITE, 'a', {
      name: 'A',
      role: 'Editor',
      links: { github: 'https://github.com/a', linkedin: 'https://www.linkedin.com/in/a' },
    })

    expect(node).toMatchObject({
      jobTitle: 'Editor',
      sameAs: ['https://github.com/a', 'https://www.linkedin.com/in/a'],
    })
  })
})

describe('blogPostingJsonLd', () => {
  const node = blogPostingJsonLd(SITE, POST)

  it('is a BlogPosting at the post URL', () => {
    expect(node).toMatchObject({
      '@type': 'BlogPosting',
      '@id': `${SITE}/blog/hello#article`,
      url: `${SITE}/blog/hello`,
      mainEntityOfPage: `${SITE}/blog/hello`,
      headline: 'Hello',
      description: 'A post.',
      inLanguage: 'en',
      keywords: ['redaction'],
      articleSection: 'Catalog',
    })
  })

  // Without a lastmod, "modified" is the publication date - leaving it out
  // makes Google guess.
  it('dates it, falling back to the publication date for the modified one', () => {
    expect(node).toMatchObject({ datePublished: '2026-09-23', dateModified: '2026-09-23' })
    expect(blogPostingJsonLd(SITE, { ...POST, lastmod: '2026-10-01' })).toMatchObject({
      dateModified: '2026-10-01',
    })
  })

  // Pointers, not copies: the organization is defined by the layout and each
  // author by the Person node beside this one.
  it('points at its publisher and authors rather than redefining them', () => {
    expect(node).toMatchObject({
      publisher: { '@id': organizationId(SITE) },
      author: [{ '@id': personId(SITE, 'mykola-melnyk') }],
      isPartOf: { '@id': `${SITE}/blog#blog` },
    })
  })

  // Not the post's own card: Next hashes that route's path (the `(site)` group
  // is in it), so any URL spelled here would 404. The site card is unhashed.
  it('uses its banner as its image, or the site card without one', () => {
    expect(node.image).toBe(`${SITE}/opengraph-image`)
    expect(blogPostingJsonLd(SITE, { ...POST, image: '/images/blog/hello/b.png' }).image).toBe(
      `${SITE}/images/blog/hello/b.png`,
    )
  })
})

describe('blogJsonLd', () => {
  it('is the Blog every post is part of, listing them by pointer', () => {
    expect(blogJsonLd(SITE, [POST])).toEqual({
      '@type': 'Blog',
      '@id': `${SITE}/blog#blog`,
      url: `${SITE}/blog`,
      name: 'Redaction Tools blog',
      inLanguage: 'en',
      publisher: { '@id': organizationId(SITE) },
      blogPost: [{ '@id': `${SITE}/blog/hello#article` }],
    })
  })
})
