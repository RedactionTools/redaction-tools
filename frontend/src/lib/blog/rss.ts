import type { BlogPostMeta } from './posts'

/**
 * RSS 2.0, built by hand: the format is small and fixed, and a dependency for
 * it would outweigh the thirty lines it replaces.
 *
 * `posts` arrive newest first and already filtered - the route handlers that
 * call this read them from the macro, which this module may not import.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]!)
}

/** RFC 822, which is what RSS 2.0 requires. Days are UTC midnight. */
function rfc822(day: string): string {
  return new Date(`${day}T00:00:00Z`).toUTCString()
}

function item(site: string, post: BlogPostMeta): string {
  const url = `${site}${post.url}`
  return [
    '<item>',
    `<title>${escapeXml(post.title)}</title>`,
    `<link>${url}</link>`,
    `<guid isPermaLink="true">${url}</guid>`,
    `<pubDate>${rfc822(post.date)}</pubDate>`,
    `<description>${escapeXml(post.description)}</description>`,
    post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join(''),
    '</item>',
  ].join('')
}

export function buildRssFeed(
  site: string,
  posts: readonly BlogPostMeta[],
  channel: { title: string; description: string; path: string; link?: string },
): string {
  const newest = posts[0]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${escapeXml(channel.title)}</title>`,
    `<link>${site}${channel.link ?? '/blog'}</link>`,
    `<description>${escapeXml(channel.description)}</description>`,
    '<language>en-us</language>',
    newest ? `<lastBuildDate>${rfc822(newest.lastmod ?? newest.date)}</lastBuildDate>` : '',
    `<atom:link href="${site}${channel.path}" rel="self" type="application/rss+xml"/>`,
    ...posts.map((post) => item(site, post)),
    '</channel>',
    '</rss>',
  ].join('\n')
}
