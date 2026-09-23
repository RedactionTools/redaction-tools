import { BLOG_NAME, postsTagged } from '@/lib/blog/posts'
import { buildRssFeed } from '@/lib/blog/rss'
import { getPostMetas } from '@/lib/blog/source'
import { clientEnv } from '@/lib/env'

import { findTag, tagParams } from '../tag-archive'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return tagParams()
}

export async function GET(
  _request: Request,
  ctx: RouteContext<'/blog/tags/[tag]/rss.xml'>,
): Promise<Response> {
  const slug = (await ctx.params).tag
  const tag = findTag(slug)
  if (!tag) return new Response('Not found', { status: 404 })

  const xml = buildRssFeed(clientEnv.NEXT_PUBLIC_SITE_URL, postsTagged(getPostMetas(), slug), {
    title: `${BLOG_NAME}: ${tag.name}`,
    description: `Redaction Tools blog posts about ${tag.name}.`,
    path: `/blog/tags/${slug}/rss.xml`,
    link: `/blog/tags/${slug}`,
  })

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}
