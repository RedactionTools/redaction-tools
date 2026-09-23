import type { Metadata } from 'next'
import Link from 'next/link'

import { PostList } from '@/components/blog/post-list'
import { BLOG_DESCRIPTION, POSTS_PER_PAGE, paginate, tagCounts } from '@/lib/blog/posts'
import { getPostMetas } from '@/lib/blog/source'
import { clientEnv } from '@/lib/env'
import { canonicalMetadata } from '@/lib/seo/canonical'
import { blogJsonLd, breadcrumbJsonLd, combineJsonLd } from '@/lib/seo/json-ld'

import { BLOG_FEED } from './blog-feeds'

export const metadata: Metadata = {
  title: 'Blog',
  description: BLOG_DESCRIPTION,
  ...canonicalMetadata('/blog', { feeds: [BLOG_FEED] }),
}

export default function BlogIndex() {
  const site = clientEnv.NEXT_PUBLIC_SITE_URL
  const posts = getPostMetas()
  const { items, totalPages } = paginate(posts, 1, POSTS_PER_PAGE)!
  const tags = tagCounts(posts)

  const jsonLd = combineJsonLd([
    blogJsonLd(site, posts),
    breadcrumbJsonLd(site, [
      { name: 'Redaction tools', url: `${site}/` },
      { name: 'Blog', url: `${site}/blog` },
    ]),
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <header className="mb-8 space-y-4 md:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Blog</h1>
        <p className="text-muted-foreground max-w-2xl text-pretty">{BLOG_DESCRIPTION}</p>
        {tags.length ? (
          <ul className="flex flex-wrap gap-2 text-sm">
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
        ) : null}
      </header>
      <PostList posts={items} featureFirst basePath="/blog" page={1} totalPages={totalPages} />
    </>
  )
}
