import { BLOG_DESCRIPTION, BLOG_NAME } from '@/lib/blog/posts'
import { buildRssFeed } from '@/lib/blog/rss'
import { getPostMetas } from '@/lib/blog/source'
import { clientEnv } from '@/lib/env'

// Built once per image: the posts are in the bundle, and so is this feed.
export const dynamic = 'force-static'

export function GET(): Response {
  const xml = buildRssFeed(clientEnv.NEXT_PUBLIC_SITE_URL, getPostMetas(), {
    title: BLOG_NAME,
    description: BLOG_DESCRIPTION,
    path: '/blog/rss.xml',
  })

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
