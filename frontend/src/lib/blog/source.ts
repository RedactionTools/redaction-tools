import type { TOCItemType } from 'fumadocs-core/toc'
import { defineCollections } from 'fumadocs-mdx/macro'
import type { MDXContent } from 'mdx/types'

import { type BlogPostMeta, readingMinutes, sortPosts, visiblePosts } from './posts'
import { blogFrontmatterSchema } from './schema'

/**
 * The blog's posts, compiled into the bundle.
 *
 * Same macro as `@/lib/source` and the same consequence: the standalone image
 * serves `/blog` without `content/` on disk, and **nothing with a vitest test
 * may import this module**. Everything testable lives in `./posts.ts` and takes
 * posts as a parameter. The file is named `source.ts` because that is the glob
 * `next.config.mjs` hands the macro plugin - under any other name the call
 * reaches the runtime unrewritten and throws.
 *
 * `dir` resolves against the working directory (frontend/), not this file.
 */
const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: blogFrontmatterSchema,
})

/** A post as its own page renders it: the list fields plus the compiled body. */
export type BlogPost = BlogPostMeta & { body: MDXContent; toc: TOCItemType[] }

/** Drafts render under `next dev` and are absent from every production build. */
const INCLUDE_DRAFTS = process.env.NODE_ENV !== 'production'

const POSTS: BlogPost[] = sortPosts(
  visiblePosts(
    blog.entries.map((entry) => {
      const slug = entry.info.path.replace(/\.mdx?$/, '')
      return {
        slug,
        url: `/blog/${slug}`,
        title: entry.title,
        description: entry.description,
        date: entry.date,
        lastmod: entry.lastmod,
        draft: entry.draft,
        tags: entry.tags,
        authors: entry.authors,
        image: entry.image,
        keywords: entry.keywords,
        readingMinutes: readingMinutes(entry.structuredData),
        body: entry.body,
        toc: entry.toc,
      }
    }),
    { includeDrafts: INCLUDE_DRAFTS },
  ),
)

/**
 * The list fields only - what the sitemap, llms.txt and feeds are built from.
 * The compiled body is a component, and nothing that serialises a post should
 * be handed one.
 */
const METAS: BlogPostMeta[] = POSTS.map((post) => {
  const meta: Partial<BlogPost> = { ...post }
  delete meta.body
  delete meta.toc
  return meta as BlogPostMeta
})

/** Every visible post, newest first. */
export function getPosts(): BlogPost[] {
  return POSTS
}

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((post) => post.slug === slug)
}

export function getPostMetas(): BlogPostMeta[] {
  return METAS
}
