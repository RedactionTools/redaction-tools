import { notFound } from 'next/navigation'

import { PostList } from '@/components/blog/post-list'
import { POSTS_PER_PAGE, paginate, postsTagged, tagCounts } from '@/lib/blog/posts'
import { getPostMetas } from '@/lib/blog/source'

/** Every tag, as `generateStaticParams` wants it. */
export function tagParams() {
  return tagCounts(getPostMetas()).map((tag) => ({ tag: tag.slug }))
}

export function findTag(slug: string) {
  return tagCounts(getPostMetas()).find((tag) => tag.slug === slug)
}

/** Page `page` of the posts carrying one tag - shared by `/tags/x` and `/tags/x/page/n`. */
export function TagArchive({ slug, page }: { slug: string; page: number }) {
  const tag = findTag(slug)
  const result = tag ? paginate(postsTagged(getPostMetas(), slug), page, POSTS_PER_PAGE) : null
  if (!tag || !result) notFound()

  return (
    <>
      <header className="mb-8 space-y-2 md:mb-10">
        <p className="text-muted-foreground text-sm">Tag</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {tag.name}
          {page > 1 ? <span className="text-muted-foreground"> · page {page}</span> : null}
        </h1>
      </header>
      <PostList
        posts={result.items}
        basePath={`/blog/tags/${slug}`}
        page={page}
        totalPages={result.totalPages}
      />
    </>
  )
}
