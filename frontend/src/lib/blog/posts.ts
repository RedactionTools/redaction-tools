import type { StructuredData } from 'fumadocs-core/mdx-plugins/remark-structure'

import { SITE_NAME } from '@/lib/seo/site'

/**
 * The blog's logic, kept free of the content itself.
 *
 * Posts come from `./source.ts`, a fumadocs macro that throws outside the
 * bundler - so every function here takes posts as a parameter rather than
 * reading them, which is what lets this module have tests.
 */

/** A post as everything but its page renders it: no compiled body, no TOC. */
export type BlogPostMeta = {
  slug: string
  url: string
  title: string
  description: string
  /** `YYYY-MM-DD`, so string comparison is date comparison. */
  date: string
  lastmod?: string
  draft: boolean
  tags: string[]
  authors: string[]
  image?: string
  keywords?: string[]
  readingMinutes: number
}

export const BLOG_NAME = `${SITE_NAME} blog`
export const BLOG_DESCRIPTION =
  'News from the Redaction Tools catalog: new listings, how we verify prices, and what we learn benchmarking redaction tools.'

export const POSTS_PER_PAGE = 9

/** Newest first; a same-day tie falls back to the slug so builds agree. */
export function sortPosts<T extends BlogPostMeta>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) =>
    a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date),
  )
}

export function visiblePosts<T extends BlogPostMeta>(
  posts: readonly T[],
  { includeDrafts }: { includeDrafts: boolean },
): T[] {
  return includeDrafts ? [...posts] : posts.filter((post) => !post.draft)
}

/**
 * One page of posts, or `null` for a page that does not exist - which the
 * route turns into a 404. An empty list still has a first page, so `/blog`
 * renders an empty state rather than vanishing.
 */
export function paginate<T>(
  posts: readonly T[],
  page: number,
  perPage: number,
): { items: T[]; totalPages: number } | null {
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage))
  if (!Number.isInteger(page) || page < 1 || page > totalPages) return null

  return { items: posts.slice((page - 1) * perPage, page * perPage), totalPages }
}

/**
 * The neighbours of a post in a newest-first list: `prev` is the older post,
 * `next` the newer, which is how a reader moving through the archive expects
 * them.
 */
export function adjacentPosts<T extends BlogPostMeta>(
  posts: readonly T[],
  slug: string,
): { prev: T | undefined; next: T | undefined } {
  const index = posts.findIndex((post) => post.slug === slug)
  if (index === -1) return { prev: undefined, next: undefined }

  return { prev: posts[index + 1], next: index > 0 ? posts[index - 1] : undefined }
}

export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Every tag with the number of posts carrying it, most used first. Tags that
 * slug the same are one tag, named after the first spelling seen - two pages
 * at one URL is not an option.
 */
export function tagCounts(
  posts: readonly BlogPostMeta[],
): { slug: string; name: string; count: number }[] {
  const counts = new Map<string, { slug: string; name: string; count: number }>()

  for (const post of posts) {
    const seen = new Set<string>()
    for (const name of post.tags) {
      const slug = tagSlug(name)
      if (seen.has(slug)) continue
      seen.add(slug)

      const entry = counts.get(slug)
      if (entry) entry.count += 1
      else counts.set(slug, { slug, name, count: 1 })
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
}

export function postsTagged<T extends BlogPostMeta>(posts: readonly T[], slug: string): T[] {
  return posts.filter((post) => post.tags.some((tag) => tagSlug(tag) === slug))
}

const WORDS_PER_MINUTE = 220

/**
 * Minutes to read, from the text fumadocs already extracts for search - so
 * the count is of prose and headings, not of JSX or code fences' markup.
 */
export function readingMinutes(data: Pick<StructuredData, 'headings' | 'contents'>): number {
  const text = [...data.headings, ...data.contents].map((block) => block.content).join(' ')
  const words = text.split(/\s+/).filter(Boolean).length

  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}
