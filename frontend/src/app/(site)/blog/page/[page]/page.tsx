import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { PostList } from '@/components/blog/post-list'
import { POSTS_PER_PAGE, paginate } from '@/lib/blog/posts'
import { getPostMetas } from '@/lib/blog/source'
import { canonicalMetadata } from '@/lib/seo/canonical'

import { BLOG_FEED } from '../../blog-feeds'

/** Every page there is, and nothing else: an unknown page is a 404, not a render. */
export const dynamicParams = false

export function generateStaticParams() {
  const { totalPages } = paginate(getPostMetas(), 1, POSTS_PER_PAGE)!
  // Page 1 is included so that `/blog/page/1` redirects rather than 404s.
  return Array.from({ length: totalPages }, (_, i) => ({ page: String(i + 1) }))
}

export async function generateMetadata(props: PageProps<'/blog/page/[page]'>): Promise<Metadata> {
  const { page } = await props.params

  return {
    title: `Blog, page ${page}`,
    ...canonicalMetadata(`/blog/page/${page}`, { feeds: [BLOG_FEED] }),
  }
}

export default async function BlogArchivePage(props: PageProps<'/blog/page/[page]'>) {
  const page = Number((await props.params).page)
  if (page === 1) permanentRedirect('/blog')

  const result = paginate(getPostMetas(), page, POSTS_PER_PAGE)
  if (!result) notFound()

  return (
    <>
      <header className="mb-8 md:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Blog <span className="text-muted-foreground">· page {page}</span>
        </h1>
      </header>
      <PostList posts={result.items} basePath="/blog" page={page} totalPages={result.totalPages} />
    </>
  )
}
