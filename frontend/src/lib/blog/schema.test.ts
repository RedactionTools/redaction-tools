import { describe, expect, it } from 'vitest'

import { AUTHORS } from './authors'
import { blogFrontmatterSchema } from './schema'

const minimal = { title: 'Hello', description: 'A post.', date: '2026-09-23' }

describe('blogFrontmatterSchema', () => {
  it('fills in the defaults a post can leave out', () => {
    expect(blogFrontmatterSchema.parse(minimal)).toEqual({
      ...minimal,
      draft: false,
      tags: [],
      authors: ['mykola-melnyk'],
    })
  })

  // YAML reads an unquoted `date: 2026-09-23` as a Date. Accepting both
  // spellings beats a build that fails over quote marks.
  it('reads an unquoted YAML date as the same day', () => {
    const parsed = blogFrontmatterSchema.parse({
      ...minimal,
      date: new Date('2026-09-23T00:00:00Z'),
      lastmod: new Date('2026-10-01T00:00:00Z'),
    })

    expect(parsed.date).toBe('2026-09-23')
    expect(parsed.lastmod).toBe('2026-10-01')
  })

  it.each(['23/09/2026', '2026-9-23', 'soon'])('rejects the date %j', (date) => {
    expect(() => blogFrontmatterSchema.parse({ ...minimal, date })).toThrow()
  })

  // It feeds <meta name="description"> and the RSS summary directly.
  it('requires a description', () => {
    expect(() => blogFrontmatterSchema.parse({ title: 'Hello', date: '2026-09-23' })).toThrow()
  })

  it('rejects an author nobody registered', () => {
    expect(() => blogFrontmatterSchema.parse({ ...minimal, authors: ['nobody'] })).toThrow()
  })

  it('only takes banners from the blog image folder', () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...minimal, image: 'https://example.com/a.png' }),
    ).toThrow()
    expect(blogFrontmatterSchema.parse({ ...minimal, image: '/images/blog/a/b.png' }).image).toBe(
      '/images/blog/a/b.png',
    )
  })
})

describe('AUTHORS', () => {
  it('registers the default author', () => {
    expect(AUTHORS['mykola-melnyk']?.name).toBe('Mykola Melnyk')
  })
})
