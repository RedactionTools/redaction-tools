import { describe, expect, it } from 'vitest'

import {
  adjacentPosts,
  paginate,
  postsTagged,
  readingMinutes,
  sortPosts,
  tagCounts,
  tagSlug,
  visiblePosts,
  type BlogPostMeta,
} from './posts'

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

describe('sortPosts', () => {
  it('puts the newest post first', () => {
    const sorted = sortPosts([
      post({ slug: 'old', date: '2025-01-01' }),
      post({ slug: 'new', date: '2026-03-01' }),
      post({ slug: 'mid', date: '2025-06-01' }),
    ])

    expect(sorted.map((p) => p.slug)).toEqual(['new', 'mid', 'old'])
  })

  // Two posts on one day would otherwise swap places between builds, and with
  // them the prev/next links and the page each lands on.
  it('breaks a same-day tie by slug, so the order is stable', () => {
    const sorted = sortPosts([
      post({ slug: 'b', date: '2026-01-01' }),
      post({ slug: 'a', date: '2026-01-01' }),
    ])

    expect(sorted.map((p) => p.slug)).toEqual(['a', 'b'])
  })

  it('does not reorder the array it was handed', () => {
    const posts = [
      post({ slug: 'old', date: '2025-01-01' }),
      post({ slug: 'new', date: '2026-01-01' }),
    ]

    sortPosts(posts)

    expect(posts.map((p) => p.slug)).toEqual(['old', 'new'])
  })
})

describe('visiblePosts', () => {
  const posts = [post({ slug: 'live' }), post({ slug: 'wip', draft: true })]

  it('hides drafts from a production build', () => {
    expect(visiblePosts(posts, { includeDrafts: false }).map((p) => p.slug)).toEqual(['live'])
  })

  it('shows drafts where an author previews them', () => {
    expect(visiblePosts(posts, { includeDrafts: true }).map((p) => p.slug)).toEqual(['live', 'wip'])
  })
})

describe('paginate', () => {
  const posts = Array.from({ length: 5 }, (_, i) => post({ slug: `p${i}` }))

  it('slices out the requested page', () => {
    expect(paginate(posts, 2, 2)).toEqual({ items: [posts[2], posts[3]], totalPages: 3 })
  })

  it('returns a short last page', () => {
    expect(paginate(posts, 3, 2)?.items).toEqual([posts[4]])
  })

  it.each([0, 4, -1, 1.5, Number.NaN])('refuses page %s, which does not exist', (page) => {
    expect(paginate(posts, page, 2)).toBeNull()
  })

  // The list page renders an empty state rather than a 404 when nothing has
  // been published yet.
  it('still has a first page when there is nothing on it', () => {
    expect(paginate([], 1, 2)).toEqual({ items: [], totalPages: 1 })
  })
})

describe('adjacentPosts', () => {
  const posts = [post({ slug: 'newest' }), post({ slug: 'middle' }), post({ slug: 'oldest' })]

  it('links the older post as previous and the newer as next', () => {
    expect(adjacentPosts(posts, 'middle')).toEqual({ prev: posts[2], next: posts[0] })
  })

  it('has no next after the newest post', () => {
    expect(adjacentPosts(posts, 'newest')).toEqual({ prev: posts[1], next: undefined })
  })

  it('has no previous before the oldest post', () => {
    expect(adjacentPosts(posts, 'oldest')).toEqual({ prev: undefined, next: posts[1] })
  })
})

describe('tagSlug', () => {
  it.each([
    ['Announcements', 'announcements'],
    ['PDF redaction', 'pdf-redaction'],
    ['  AI / ML tools ', 'ai-ml-tools'],
    ['GDPR & HIPAA', 'gdpr-hipaa'],
  ])('turns %j into %j', (tag, slug) => {
    expect(tagSlug(tag)).toBe(slug)
  })
})

describe('tagCounts', () => {
  it('counts posts per tag, most used first, and keeps the display name', () => {
    const counts = tagCounts([
      post({ slug: 'a', tags: ['Catalog', 'Pricing'] }),
      post({ slug: 'b', tags: ['Pricing'] }),
    ])

    expect(counts).toEqual([
      { slug: 'pricing', name: 'Pricing', count: 2 },
      { slug: 'catalog', name: 'Catalog', count: 1 },
    ])
  })

  // Two spellings of one tag would otherwise be two pages at one URL.
  it('merges tags that share a slug', () => {
    const counts = tagCounts([
      post({ slug: 'a', tags: ['PDF redaction'] }),
      post({ slug: 'b', tags: ['pdf redaction'] }),
    ])

    expect(counts).toEqual([{ slug: 'pdf-redaction', name: 'PDF redaction', count: 2 }])
  })

  it('counts a post once however many times it spells a tag', () => {
    const counts = tagCounts([post({ slug: 'a', tags: ['Pricing', 'pricing'] })])

    expect(counts).toEqual([{ slug: 'pricing', name: 'Pricing', count: 1 }])
  })
})

describe('postsTagged', () => {
  it('finds posts by tag slug, whatever the spelling in frontmatter', () => {
    const posts = [
      post({ slug: 'a', tags: ['PDF redaction'] }),
      post({ slug: 'b', tags: ['Catalog'] }),
    ]

    expect(postsTagged(posts, 'pdf-redaction').map((p) => p.slug)).toEqual(['a'])
  })
})

describe('readingMinutes', () => {
  const text = (words: number) => ({
    headings: [],
    contents: [
      { heading: undefined, content: Array.from({ length: words }, () => 'word').join(' ') },
    ],
  })

  it('rounds up at 220 words a minute', () => {
    expect(readingMinutes(text(221))).toBe(2)
  })

  it('never claims a post takes no time at all', () => {
    expect(readingMinutes(text(0))).toBe(1)
  })

  it('counts headings as well as paragraphs', () => {
    const data = {
      headings: [{ id: 'h', content: 'word '.repeat(200) }],
      contents: text(30).contents,
    }

    expect(readingMinutes(data)).toBe(2)
  })
})
