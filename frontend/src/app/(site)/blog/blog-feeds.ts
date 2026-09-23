import { BLOG_NAME } from '@/lib/blog/posts'

/** The site-wide feed, advertised in the <head> of every blog page. */
export const BLOG_FEED = { url: '/blog/rss.xml', title: BLOG_NAME }

export function tagFeed(slug: string, name: string) {
  return { url: `/blog/tags/${slug}/rss.xml`, title: `${BLOG_NAME}: ${name}` }
}
