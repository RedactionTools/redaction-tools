import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { canonicalMetadata } from '@/lib/seo/canonical'

import { BLOG_FEED, tagFeed } from '../../blog-feeds'
import { TagArchive, findTag, tagParams } from './tag-archive'

export const dynamicParams = false

export function generateStaticParams() {
  return tagParams()
}

export async function generateMetadata(props: PageProps<'/blog/tags/[tag]'>): Promise<Metadata> {
  const slug = (await props.params).tag
  const tag = findTag(slug)
  if (!tag) notFound()

  return {
    title: `Posts tagged ${tag.name}`,
    description: `Redaction Tools blog posts about ${tag.name}.`,
    ...canonicalMetadata(`/blog/tags/${slug}`, { feeds: [tagFeed(slug, tag.name), BLOG_FEED] }),
  }
}

export default async function BlogTag(props: PageProps<'/blog/tags/[tag]'>) {
  return <TagArchive slug={(await props.params).tag} page={1} />
}
