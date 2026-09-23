import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { POSTS_PER_PAGE, paginate, postsTagged } from '@/lib/blog/posts'
import { getPostMetas } from '@/lib/blog/source'
import { canonicalMetadata } from '@/lib/seo/canonical'

import { BLOG_FEED, tagFeed } from '../../../../blog-feeds'
import { TagArchive, findTag, tagParams } from '../../tag-archive'

export const dynamicParams = false

export function generateStaticParams() {
  return tagParams().flatMap(({ tag }) => {
    const { totalPages } = paginate(postsTagged(getPostMetas(), tag), 1, POSTS_PER_PAGE)!
    return Array.from({ length: totalPages }, (_, i) => ({ tag, page: String(i + 1) }))
  })
}

export async function generateMetadata(
  props: PageProps<'/blog/tags/[tag]/page/[page]'>,
): Promise<Metadata> {
  const { tag: slug, page } = await props.params
  const tag = findTag(slug)
  if (!tag) notFound()

  return {
    title: `Posts tagged ${tag.name}, page ${page}`,
    ...canonicalMetadata(`/blog/tags/${slug}/page/${page}`, {
      feeds: [tagFeed(slug, tag.name), BLOG_FEED],
    }),
  }
}

export default async function BlogTagPage(props: PageProps<'/blog/tags/[tag]/page/[page]'>) {
  const { tag, page } = await props.params
  if (page === '1') permanentRedirect(`/blog/tags/${tag}`)

  return <TagArchive slug={tag} page={Number(page)} />
}
