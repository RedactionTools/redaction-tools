import type { BlogPostMeta } from '@/lib/blog/posts'

export function makePost(overrides: Partial<BlogPostMeta> = {}): BlogPostMeta {
  const slug = overrides.slug ?? 'introducing-redaction-tools'
  return {
    slug,
    url: `/blog/${slug}`,
    title: 'Introducing Redaction Tools',
    description: 'A catalog of redaction tools with prices you can trust.',
    date: '2026-09-23',
    draft: false,
    tags: ['Announcements', 'Catalog'],
    authors: ['mykola-melnyk'],
    readingMinutes: 4,
    ...overrides,
  }
}
