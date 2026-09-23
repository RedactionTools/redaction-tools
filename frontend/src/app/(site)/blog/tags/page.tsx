import type { Metadata } from 'next'
import Link from 'next/link'

import { tagCounts } from '@/lib/blog/posts'
import { getPostMetas } from '@/lib/blog/source'
import { canonicalMetadata } from '@/lib/seo/canonical'

import { BLOG_FEED } from '../blog-feeds'

export const metadata: Metadata = {
  title: 'Blog tags',
  description: 'Every topic the Redaction Tools blog has written about.',
  ...canonicalMetadata('/blog/tags', { feeds: [BLOG_FEED] }),
}

export default function BlogTags() {
  const tags = tagCounts(getPostMetas())

  return (
    <>
      <header className="mb-8 md:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tags</h1>
      </header>
      {tags.length ? (
        <ul className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <Link
                href={`/blog/tags/${tag.slug}`}
                className="border-border hover:bg-muted inline-flex rounded-full border px-3 py-1"
              >
                {tag.name}
                <span className="text-muted-foreground ml-1.5 tabular-nums">{tag.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No posts yet.</p>
      )}
    </>
  )
}
