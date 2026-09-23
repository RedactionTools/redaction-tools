import { ImageResponse } from 'next/og'

import { formatDay } from '@/components/blog/post-meta'
import { getAuthor } from '@/lib/blog/authors'
import { getPost, getPosts } from '@/lib/blog/source'
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og'
import { ArticleCard, SiteCard } from '@/lib/seo/og-card'

export const alt = 'Share card for a Redaction Tools blog post'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * Prerendered, one per post: the posts are compiled into the bundle, so unlike
 * a tool's card this reads nothing from the API and is safe at build time.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return getPosts().map((post) => ({ slug: post.slug }))
}

/** `params` is hand-typed: `next typegen` emits `PageProps` only for pages and routes. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug)

  if (!post) {
    return new ImageResponse(
      <SiteCard tagline="Every price with its unit, its source and the date we checked it." />,
      size,
    )
  }

  const names = post.authors.map((id) => getAuthor(id)?.name).filter(Boolean)
  return new ImageResponse(
    <ArticleCard title={post.title} byline={[...names, formatDay(post.date)].join(' · ')} />,
    size,
  )
}
